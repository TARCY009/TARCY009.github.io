# -*- coding: utf-8 -*-
"""個体値チェッカー データ同期スクリプト
=====================================
対戦データ（pvp_data.json）を元に iv-checker/index.html の `const POKE = [...]` を更新する。

このデータだけ手作業で足してきたため、新ポケモン・新メガが出ても
このツールだけ取り残されていた（2026-08-15にメガ4匹の欠けで発覚）。
以後は  python3 build_pvp_data.py → python3 iv-checker/build_iv.py  の順で実行すれば追従する。

なぜ対戦データ（pvp_data.json）を元にするか:
  個体値チェッカーはPvP順位を出すツールなので、収録範囲も対戦側とそろえるのが正しい。
  実際、突き合わせたところ**全1250匹で種族値が完全一致**していた（ずれ0件）。
  火力チェッカー側（godata.json）は実装済みのものしか持たないので、
  実装間近のポケモンが入らず範囲が狭い。

同期のルール（既存の表示名・並びを壊さないための安全設計。build_gym.py と同じ考え方）:
  1) speciesId が一致する既存エントリは **種族値・図鑑番号・タイプ(t)だけ** 対戦データの値で更新する
     （t は 2026-08-16 にタイプアイコン表示のため追加）
  2) **表示名（n/e）・進化先（v）・伝説(l)・幻(m)は既存のものに触らない**
     このツールだけ「リザードン(メガY)」「バケッチャ(M)」のように短く手直しした名前を使っており、
     機械生成に置き換えると29匹の表示が変わってしまうため（実測）
  3) 対戦データにしか無いもの（=新実装・新メガ）を図鑑番号の位置へ挿入する。
     名前・進化先・伝説/幻の印はここで自動生成する
  4) 足さないのは **「名前も図鑑番号も種族値も、すでにあるエントリと完全に同じ」ときだけ**。
     画面上まったく同じ行が2つ並ぶだけなので、落としても失うものが無いと言い切れる。

     **⚠ ここを賢くしようとしてはいけない（2026-08-15にタダシさんの指摘で作り直した）**。
     このツールは「表示どおりに強化したのにCPが違った」が起きてはいけないので、
     **1匹でも取りこぼすほうが、重複が1行増えるより悪い**。
     - 「種族値が同じなら足さない」→ **ネクロズマのたそがれのたてがみ／あかつきのつばさ**のように
       別ポケモンで種族値が丸かぶりする組が**13組**あり、片方が落ちる
     - 「元フォルムの派生（`pikachu_5th_anniversary` に対する `pikachu`）で種族値も同じなら足さない」
       → **地方フォルムは元と種族値が同じことが多い**ため、
       **アローラコラッタ・ガラルマタドガス・ヒスイニューラ・パルデアウパーなど81匹が落ちる**
       （空から作り直す検算で発覚）
     いまのルールなら、コスチュームのピカチュウのように**名前が違うものは必ず残る**。
     同じ結果の行が増えるだけなので害は無い
  5) 対戦データから消えたエントリは**消さずに残して報告する**（取り込み元の一時的な欠けで
     データを失わないため）
  6) 追加があった日は changes.md の末尾に足す（毎日のお知らせに載る）

新しく足すときの自動生成の精度（2026-08-15に既存1253匹で実測）:
  英語名 1253/1253 ・ 伝説 1253/1253 ・ 図鑑番号 1253/1253 ・ 進化先 1252/1253 ・
  日本語名 1224/1253（残りは上記2の手直し済みの名前）
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, REPO)
from build_data import SRC, fetch      # noqa: E402  取得先URLと取得処理を使い回す

PVP = os.path.join(REPO, 'pvp_data.json')
PAGE = os.path.join(HERE, 'index.html')
CHANGES = os.path.join(REPO, 'changes.md')

# 前に付く呼び名は、このツールでは「◯◯(呼び名)」の形にする
TAG_JA = {'mega': 'メガ', 'primal': 'ゲンシ', 'alolan': 'アローラ',
          'galarian': 'ガラル', 'hisuian': 'ヒスイ', 'paldean': 'パルデア'}
FORM_RE = re.compile(r'^(.*?)_(mega(?:_[xy])?|primal|alolan|galarian|hisuian|paldean)$')
# 出力するキーの並び（既存ファイルと同じにして無駄な差分を出さない）
# t=タイプ(対戦データのtyそのまま・大文字英語)。2026-08-16にタイプアイコン表示のため追加。
# 種族値と同じく毎回同期する(タイプ変更の告知は無いが、元データに追従しておく)
ORDER = ['i', 'n', 'e', 'd', 'a', 'f', 'h', 't', 'l', 'v', 'm']


def ja_name(sid, name):
    """対戦データの日本語名 → このツールの表記へ直す
    「メガリザードンY」→「リザードン(メガY)」 ／ 全角カッコ → 半角"""
    n = name.replace('（', '(').replace('）', ')')
    m = FORM_RE.match(sid)
    if not m:
        return n
    kind = m.group(2)
    tag = TAG_JA[re.sub(r'_[xy]$', '', kind)]
    xy = 'X' if kind.endswith('_x') else ('Y' if kind.endswith('_y') else '')
    if not n.startswith(tag):
        return n
    body = n[len(tag):]
    if xy and body.endswith(xy):
        body = body[:-len(xy)]
    return f'{body}({tag}{xy})'


def insert_at(arr, dex):
    """図鑑番号の並びを保てる位置（自分より大きい番号が現れる直前）"""
    for i, e in enumerate(arr):
        if e['d'] > dex:
            return i
    return len(arr)


def main():
    pvp = json.load(open(PVP, encoding='utf-8'))['pokemon']
    src = {p['speciesId']: p for p in fetch(SRC['pvp'])['pokemon']}

    page = open(PAGE, encoding='utf-8').read()
    m = re.search(r'^const POKE = (\[.*?\]);\s*$', page, re.M | re.S)
    if not m:
        raise SystemExit('index.html の const POKE が見つかりません')
    arr = json.loads(m.group(1))
    idx = {p['i']: i for i, p in enumerate(arr)}

    # 「名前・図鑑番号・種族値がすべて同じ」＝画面上まったく同じ行、を見つけるための索引
    def row(n, d, a, f, h):
        return (n, d, a, f, h)

    sigs = {row(e['n'], e['d'], e['a'], e['f'], e['h']) for e in arr}

    added, updated, dup = [], [], []
    for sid, p in pvp.items():
        stat = (p['a'], p['df'], p['h'], p['dex'])
        ty = [x for x in (p.get('ty') or []) if x and x != 'NONE']
        if sid in idx:
            e = arr[idx[sid]]
            before = (e['a'], e['f'], e['h'], e['d'])
            if before != stat:
                e['a'], e['f'], e['h'], e['d'] = stat
                sigs.add(row(e['n'], e['d'], e['a'], e['f'], e['h']))
                updated.append((e['n'], before, stat))
            if ty and e.get('t') != ty:
                e['t'] = ty
            continue
        name = ja_name(sid, p['n'])
        if row(name, p['dex'], p['a'], p['df'], p['h']) in sigs:
            dup.append(p['n'])
            continue
        g = src.get(sid, {})
        tags = g.get('tags') or []
        ent = {'i': sid, 'n': name, 'e': g.get('speciesName') or p['n'],
               'd': p['dex'], 'a': p['a'], 'f': p['df'], 'h': p['h']}
        if ty:
            ent['t'] = ty
        if 'legendary' in tags or 'ultrabeast' in tags:
            ent['l'] = 1
        # 進化先は、このツールが持っているものだけ（取り込み元に綴り違いの項目が混じることがある）
        ev = [x for x in ((g.get('family') or {}).get('evolutions') or []) if x in pvp]
        if ev:
            ent['v'] = ev
        if 'mythical' in tags:
            ent['m'] = 1
        at = insert_at(arr, ent['d'])
        arr.insert(at, {k: ent[k] for k in ORDER if k in ent})
        idx = {q['i']: i for i, q in enumerate(arr)}
        sigs.add(row(ent['n'], ent['d'], ent['a'], ent['f'], ent['h']))
        added.append(ent)

    stale = [e['n'] for e in arr if e['i'] not in pvp]

    # ===== 自己点検（取りこぼしがあったら止める）=====
    # このツールは「表示どおりに強化したらCPが違った」が起きてはいけないので、
    # 対戦データの1匹1匹について「そのポケモンを引ける行があるか」を必ず確かめる。
    # 引けない＝取りこぼしなので、その場で止めて気づけるようにする。
    have = {row(e['n'], e['d'], e['a'], e['f'], e['h']) for e in arr}
    ids = {e['i'] for e in arr}
    missing = [f'{sid}({p["n"]})' for sid, p in pvp.items()
               if sid not in ids
               and row(ja_name(sid, p['n']), p['dex'], p['a'], p['df'], p['h']) not in have]
    if missing:
        raise SystemExit('取りこぼしがあります（同じ内容の行も見つかりません）: ' + '、'.join(missing))

    # キーの並びをORDERへそろえる(あとから足したtが末尾に散らばらないように)
    arr = [{k: e[k] for k in ORDER if k in e} for e in arr]
    txt = json.dumps(arr, ensure_ascii=False, separators=(',', ':'))
    out = page[:m.start(1)] + txt + page[m.end(1):]
    changed = out != page
    if changed:
        open(PAGE, 'w', encoding='utf-8').write(out)

    print(f'完了: {len(arr)}匹（追加 {len(added)} / 種族値の更新 {len(updated)}）')
    if added:
        print('追加:', '、'.join(e['n'] for e in added))
    if updated:
        for n, b, a in updated:
            print(f'  種族値の更新: {n} {b[0]}/{b[1]}/{b[2]} → {a[0]}/{a[1]}/{a[2]}')
    if dup:
        print(f'まったく同じ行がすでにあるので足さなかったもの（{len(dup)}件）:', '、'.join(dup))
        print('  ※ 別のポケモンなのにここに出てきたら、名前を手で付け分けること')
    if stale:
        print(f'※ 対戦データに無いエントリ（残してあります・要確認 {len(stale)}件）:', '、'.join(stale))

    # 追加・変更があった日だけ、毎日のお知らせ（changes.md）へ足す
    if (added or updated) and os.path.exists(CHANGES):
        with open(CHANGES, 'a', encoding='utf-8') as f:
            f.write('\n### 🔢 個体値チェッカーへの反映\n')
            for e in added:
                f.write(f'- 追加: {e["n"]}\n')
            for n, b, a in updated:
                f.write(f'- 種族値の更新: {n} {b[0]}/{b[1]}/{b[2]} → {a[0]}/{a[1]}/{a[2]}\n')


if __name__ == '__main__':
    main()
