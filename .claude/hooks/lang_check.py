#!/usr/bin/env python3
"""返事が英語になっていないかの見張り（2026-09-24タダシさん指示・Stop フック）。

Claude が返事を書き終えた瞬間に動く。いまの回（タダシさんの最後の発言より後）に Claude が書いた文を調べ、
英語の文が多いものがあれば止めて、日本語で書き直させる。
- コード（``` で囲んだ所・`...`）・URL・ファイルの場所・英字だけの専門用語の短い並びは数えない
- 止めたあとの書き直し（stop_hook_active）では、最後の文だけを見る（前の英語の文で止まり続けないように）
"""
import json, re, sys

JP = re.compile(r'[぀-ヿ㐀-鿿ｦ-ﾟ]')
EN_WORD = re.compile(r'[A-Za-z]{2,}')


def clean(t):
    t = re.sub(r'```.*?```', ' ', t, flags=re.S)          # コードのかたまり
    t = re.sub(r'`[^`\n]*`', ' ', t)                       # 行内のコード
    t = re.sub(r'\]\([^)]*\)', ']', t)                     # リンクの行き先
    t = re.sub(r'https?://\S+', ' ', t)                    # URL
    t = re.sub(r'[\w./-]*/[\w./-]+', ' ', t)               # ファイルの場所
    return t


def english_heavy(t):
    t = clean(t)
    words = EN_WORD.findall(t)
    en = sum(len(w) for w in words)
    jp = len(JP.findall(t))
    # 英字の単語が5個以上あり、日本語の文字が英字の4分の1に届かない＝英語の文として書いている
    # (日本語の文に英字の用語がまじるだけなら、日本語の文字のほうがずっと多いので止まらない)
    return len(words) >= 5 and jp < en / 4


def texts_of(msg):
    c = (msg.get('message') or {}).get('content')
    if isinstance(c, str):
        return [c]
    return [b.get('text', '') for b in (c or []) if isinstance(b, dict) and b.get('type') == 'text']


def is_real_user(msg):
    if msg.get('type') != 'user':
        return False
    c = (msg.get('message') or {}).get('content')
    if isinstance(c, str):
        return True
    return any(isinstance(b, dict) and b.get('type') == 'text' for b in (c or []))


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    path = data.get('transcript_path')
    if not path:
        return 0
    try:
        with open(path, encoding='utf-8') as f:
            rows = [json.loads(l) for l in f if l.strip()]
    except Exception:
        return 0
    last_user = max((i for i, r in enumerate(rows) if is_real_user(r)), default=-1)
    texts = []
    for r in rows[last_user + 1:]:
        if r.get('type') == 'assistant':
            texts += [t for t in texts_of(r) if t.strip()]
    if data.get('stop_hook_active'):
        texts = texts[-1:]
    bad = [t for t in texts if english_heavy(t)]
    if not bad:
        return 0
    sample = re.sub(r'\s+', ' ', clean(bad[0])).strip()[:120]
    print(json.dumps({
        'decision': 'block',
        'reason': ('【見張り役・言語】いまの回の返事に英語の文があります（例:「' + sample + '」）。'
                   'タダシさんとのやりとりは常に日本語です（CLAUDE.md）。英語になった部分の内容を、日本語で書き直して伝え直してください。'
                   '英語になっていたことを一言おわびし、同じ内容を日本語でまとめてください。')
    }, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
