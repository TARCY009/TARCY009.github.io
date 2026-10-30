# -*- coding: utf-8 -*-
"""
チャットの始めに、公式ニュースから自動で読み取ったこと（news_auto.py の結果）を Claude に知らせる（2026-10-30タダシさん指示）

  python3 .claude/hooks/news_notice.py         … SessionStart フック。まだ伝えていない知らせがあれば Claude へ渡す
  python3 .claude/hooks/news_notice.py --ack   … いまの知らせを「タダシさんに伝えた」にする（伝えたあとで Claude が流す）

読み取り結果は毎朝の自動更新が GitHub 上で書くので、まず公開中の最新（origin/main）を短い時間で取りに行き、
取れなければ手元のファイルを読む。伝えた印は .claude/state/news_ack.json（git に入れない）
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REL = '.github/official_news.json'
ACK = os.path.join(ROOT, '.claude', 'state', 'news_ack.json')


def load_state():
    try:
        subprocess.run(['git', '-C', ROOT, 'fetch', '-q', 'origin', 'main'], timeout=8,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = subprocess.run(['git', '-C', ROOT, 'show', 'origin/main:' + REL], timeout=5,
                             capture_output=True, text=True)
        if out.returncode == 0 and out.stdout.strip():
            return json.loads(out.stdout)
    except Exception:
        pass
    try:
        with open(os.path.join(ROOT, REL), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def load_ack():
    try:
        with open(ACK, encoding='utf-8') as f:
            return set(json.load(f))
    except Exception:
        return set()


def main():
    notices = load_state().get('notices') or []
    acked = load_ack()
    if '--ack' in sys.argv:
        os.makedirs(os.path.dirname(ACK), exist_ok=True)
        with open(ACK, 'w', encoding='utf-8') as f:
            json.dump(sorted(acked | {n['id'] for n in notices}), f, ensure_ascii=False)
        print('公式ニュースの知らせを伝えた印を付けました')
        return
    new = [n for n in notices if n['id'] not in acked]
    if not new:
        return
    auto = [n for n in new if n.get('kind') == 'auto']
    check = [n for n in new if n.get('kind') != 'auto']
    lines = ['【公式ニュースの自動読み取り】まだタダシさんに伝えていない知らせがあります。'
             'この回の最初の返事で、ほかの作業より先に短く伝えてください。']
    if check:
        lines.append('■ 確かめてほしいもの（記事を読んで判断し、必要ならツールに入れる。決められないものはタダシさんに聞く）:')
        lines += [f'  - {n["text"]}（{n["title"]}・https://pokemongo.com/ja/news/{n["slug"]}）' for n in check]
    if auto:
        lines.append('■ 自動でツールに入れたもの（毎朝の自動更新で公開済み。数字がツールに入っているか確かめてから伝える）:')
        lines += [f'  - {n["text"]}（{n["title"]}）' for n in auto]
    lines.append('伝え終えたら `python3 .claude/hooks/news_notice.py --ack` を流して、伝えた印を付けること。')
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart',
                                             'additionalContext': '\n'.join(lines)}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
