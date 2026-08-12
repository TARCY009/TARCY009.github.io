#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""正解セット(answer_key.js) → assets/meta_moves.js を生成し、更新結果を報告する。

わざ構成の決め方（上から順に採用する）:
  1. 人が確認した確定値（answer_key.js にある行）
  2. 同じリーグの通常⇄シャドウの確定値をコピー
     （人が確認済みの39ペアで検証して 39/39 一致。式で決めるのではなく人の答えの写しなので、
       「式で自動的に決める」を不採用にした2026-08-12の判断とは矛盾しない）
  3. 情報元の推奨構成（answer-key.html の初期値と同じ叩き台）
     ＝「チェックが無い＝叩き台のままで正しい」というタダシさんの判断

環境上位リストは毎週月曜に自動更新されるため、入れ替わりで入ってきた新顔も
このスクリプトが自動で 2→3 の順に埋める。どれがどう変わったかは
pvp-tests/meta_changes.md に書き出す（GitHub Actions がこれをコミットに残す）。

使い方: python3 pvp-tests/build_meta_moves.py
       python3 pvp-tests/build_meta_moves.py --no-report  （報告ファイルを書かない。
         毎日のデータ更新から呼ぶとき用。あちらの報告は changes.md にまとまるため）
"""
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NO_REPORT = '--no-report' in sys.argv
LG_NAME = {'1500': 'スーパー', '2500': 'ハイパー', '0': 'マスター'}
CAP_LIST = 30   # 報告に並べる上限（超えたら「…他◯件」）


def load_js_val(src, var):
    """window.XXX = {...}; / [...]; の形から値を取り出す"""
    i = src.index(var)
    i = src.index('=', i) + 1
    while src[i] in ' \t\r\n':
        i += 1
    op = src[i]
    cl = {'{': '}', '[': ']'}[op]
    depth = 0
    for j in range(i, len(src)):
        if src[j] == op:
            depth += 1
        elif src[j] == cl:
            depth -= 1
            if depth == 0:
                return json.loads(src[i:j + 1])
    raise ValueError('見つかりません: ' + var)


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def read_head(path):
    """1つ前のコミット時点の中身（更新前との比較用）。取れなければ None"""
    try:
        return subprocess.run(['git', 'show', 'HEAD:' + path], cwd=ROOT, check=True,
                              capture_output=True, text=True).stdout
    except Exception:
        return None


PVP = json.load(open(os.path.join(ROOT, 'pvp_data.json'), encoding='utf-8'))
POKE, MOVES = PVP['pokemon'], PVP['moves']
LISTS_SRC = read('assets/meta_lists.js')
META = load_js_val(LISTS_SRC, 'window.META_LISTS')
EXT = load_js_val(LISTS_SRC, 'window.META_EXT')
CUPS = load_js_val(LISTS_SRC, 'window.CUP_LISTS')
ANS = load_js_val(read('pvp-tests/answer_key.js'), 'window.ANSWER_KEY')

BAD = {'RETURN', 'FRUSTRATION'}
jp = lambda m: MOVES[m]['n'] if m in MOVES else m
mvtext = lambda mv: ' / '.join(jp(x) for x in mv)


def pools(key):
    p = POKE[key]
    fasts = [m for m in dict.fromkeys(p['q'] + p['eq']) if m in MOVES]
    chs = [m for m in dict.fromkeys(p['c'] + p['ec']) if m in MOVES and m not in BAD]
    return fasts, chs


def base_of(m):
    """情報元の推奨構成（answer-key.html の初期値と同じ）"""
    fasts, chs = pools(m['k'])
    f = m.get('f') if m.get('f') in fasts else None
    c1 = m.get('c1') if m.get('c1') in chs else None
    c2 = m.get('c2') if m.get('c2') in chs and m.get('c2') != c1 else None
    return [x for x in [f or (fasts[0] if fasts else ''),
                        c1 or (chs[0] if chs else ''), c2 or ''] if x]


def twin_of(mid):
    """通常⇄シャドウの相方のID"""
    return mid[:-2] if mid.endswith('|s') else mid + '|s'


warns = []


def pick(m, a):
    """1匹ぶんのわざ構成と、その出どころを返す"""
    mid = m['k'] + ('|s' if m.get('s') else '')
    fasts, chs = pools(m['k'])

    def ok(mv):
        mv = [x for x in mv if x]
        if not mv or mv[0] not in fasts:
            return None
        if any(x not in chs for x in mv[1:]):
            return None
        if len(mv) > 2 and mv[1] == mv[2]:
            return None
        return mv

    if mid in a:
        mv = ok(a[mid])
        if mv:
            return mv, 'ans'
        warns.append(f'{m["n"]}（{mid}）: 確定値 {mvtext(a[mid])} をおぼえないので情報元の推奨に戻しました')
    tw = twin_of(mid)
    if tw in a:
        mv = ok(a[tw])
        if mv:
            return mv, 'twin'
    return base_of(m), 'base'


# ---- 生成 ----
out, origin, rows_of = {}, {}, {}
stats, mismatch = [], []
for lg in ('1500', '2500', '0'):
    rows = (META.get(lg) or []) + (EXT.get(lg) or [])
    a = ANS.get(lg) or {}
    d, og, cnt = {}, {}, {'ans': 0, 'twin': 0, 'base': 0}
    for m in rows:
        mid = m['k'] + ('|s' if m.get('s') else '')
        mv, src = pick(m, a)
        d[mid], og[mid] = mv, src
        cnt[src] += 1
    # 通常版とシャドウ版で構成が食い違っていないか（順番の違いは無視）
    for k in d:
        if k.endswith('|s'):
            continue
        s = d.get(k + '|s')
        if s and (d[k][0], sorted(d[k][1:])) != (s[0], sorted(s[1:])):
            mismatch.append(f'{LG_NAME[lg]} {POKE[k]["n"]}: 通常 {mvtext(d[k])} ／ シャドウ {mvtext(s)}')
    out[lg], origin[lg], rows_of[lg] = d, og, rows
    stats.append((lg, len(d), cnt))

lines = ['// 環境上位のわざ構成（人が確認した確定値）。pvp-tests/answer-key.html で作り、',
         '// pvp-tests/build_meta_moves.py で生成する。手編集しない。',
         '// 形式: リーグ(1500/2500/0) → "ポケモンキー(|s=シャドウ)" → [ノーマル, SP1, SP2]',
         '// ここに載っているポケモンは、環境一覧・パーティ診断・対策さがしをこの構成で計算する',
         'window.META_MOVES = {']
for i, lg in enumerate(('1500', '2500', '0')):
    lines.append(f' "{lg}": {{')
    items = list(out[lg].items())
    for j, (k, v) in enumerate(items):
        tail = ',' if j < len(items) - 1 else ''
        lines.append(f'  "{k}": {json.dumps(v)}{tail}')
    lines.append(' }' + (',' if i < 2 else ''))
lines.append('};')

old_moves_src = read_head('assets/meta_moves.js')
old_lists_src = read_head('assets/meta_lists.js')
with open(os.path.join(ROOT, 'assets/meta_moves.js'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

# ---- 更新結果の報告（pvp-tests/meta_changes.md） ----
OLD_MOVES = load_js_val(old_moves_src, 'window.META_MOVES') if old_moves_src else None
OLD_META = load_js_val(old_lists_src, 'window.META_LISTS') if old_lists_src else None
OLD_EXT = load_js_val(old_lists_src, 'window.META_EXT') if old_lists_src else None
OLD_CUPS = load_js_val(old_lists_src, 'window.CUP_LISTS') if old_lists_src else None

rep, headline = [], []
SRC_JA = {'ans': '人の確定値', 'twin': 'シャドウ⇄通常の引き継ぎ', 'base': '情報元の推奨'}


def sec(title, items):
    if not items:
        return
    rep.append(f'### {title}（{len(items)}件）')
    rep.extend('- ' + x for x in items[:CAP_LIST])
    if len(items) > CAP_LIST:
        rep.append(f'- …他{len(items) - CAP_LIST}件')
    rep.append('')


def churn(label, old_top, old_ext, new_top, new_ext):
    """入れ替わりを1グループぶん調べる。戻り値は新顔の行"""
    if old_top is None:
        return []
    idm = lambda m: m['k'] + ('|s' if m.get('s') else '')
    on, nn = {idm(m): m for m in old_top + old_ext}, {idm(m): m for m in new_top + new_ext}
    otop, ntop = {idm(m) for m in old_top}, {idm(m) for m in new_top}
    order = {idm(m): i + 1 for i, m in enumerate(new_top + new_ext)}
    added = [m for k, m in nn.items() if k not in on]
    gone = [m for k, m in on.items() if k not in nn]
    up = [m for k, m in nn.items() if k in on and k in ntop and k not in otop]
    down = [m for k, m in nn.items() if k in on and k not in ntop and k in otop]
    if not (added or gone or up or down):
        return []
    rep.append(f'## {label}')
    rep.append('')
    sec('🆕 新しく入った', [f'{m["n"]}（{order[idm(m)]}位）' for m in added])
    sec('🗑 抜けた', [m['n'] for m in gone])
    sec('⬆ 上位50入り', [f'{m["n"]}（{order[idm(m)]}位）' for m in up])
    sec('⬇ 上位50から後退', [f'{m["n"]}（{order[idm(m)]}位）' for m in down])
    return added


now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
rep.append(f'# 環境リストの更新結果（{now:%Y-%m-%d %H:%M} JST）')
rep.append('')

new_rows = {}
for lg in ('1500', '2500', '0'):
    new_rows[lg] = churn(f'{LG_NAME[lg]}リーグ', (OLD_META or {}).get(lg) if OLD_META else None,
                         (OLD_EXT or {}).get(lg) or [], META.get(lg) or [], EXT.get(lg) or [])
if OLD_CUPS is not None:
    oc = {c['slug']: c for c in OLD_CUPS}
    for c in CUPS:
        o = oc.get(c['slug'])
        churn(c['label'], o['list'] if o else None, (o or {}).get('ext') or [], c['list'], c['ext'])

# わざ構成が変わった行
if OLD_MOVES is not None:
    chg = []
    for lg in ('1500', '2500', '0'):
        o = OLD_MOVES.get(lg) or {}
        for mid, mv in out[lg].items():
            if mid not in o:
                continue
            if (mv[0], sorted(mv[1:])) != (o[mid][0], sorted(o[mid][1:])):
                nm = POKE[mid.split('|')[0]]['n']
                nm = ('シャドウ' if mid.endswith('|s') else '') + nm
                chg.append(f'{LG_NAME[lg]} {nm}: {mvtext(o[mid])} → {mvtext(mv)}'
                           f'（{SRC_JA[origin[lg][mid]]}）')
    if chg:
        rep.append('## わざ構成が変わったポケモン')
        rep.append('')
        sec('🔧 変更', chg)
        headline.append(f'わざ構成変更{len(chg)}件')

# 新顔のうち、まだ人が確認していないもの
todo_new, todo_all = [], 0
for lg in ('1500', '2500', '0'):
    a = ANS.get(lg) or {}
    for m in rows_of[lg]:
        mid = m['k'] + ('|s' if m.get('s') else '')
        if mid not in a:
            todo_all += 1
    for m in new_rows.get(lg) or []:
        mid = m['k'] + ('|s' if m.get('s') else '')
        if mid not in a:
            todo_new.append(f'{LG_NAME[lg]} {m["n"]}: {mvtext(out[lg][mid])}'
                            f'（{SRC_JA[origin[lg][mid]]}）')
if todo_new:
    rep.append('## 新顔の暫定わざ構成（人の確認はまだ）')
    rep.append('')
    rep.append('このまま使えます。直したいときだけ pvp-tests/answer-key.html の「未確認」タブで選び直してください。')
    rep.append('')
    sec('🆕 新顔', todo_new)

rep.append('## 内訳')
rep.append('')
for lg, n, cnt in stats:
    rep.append(f'- {LG_NAME[lg]}: {n}匹（人の確定値 {cnt["ans"]} / シャドウ⇄通常の引き継ぎ {cnt["twin"]}'
               f' / 情報元の推奨 {cnt["base"]}）')
rep.append(f'- 人の確認がまだの行: 合計 {todo_all}匹')
rep.append('')
if warns:
    rep.append('## ⚠ 取り込めなかった確定値')
    rep.append('')
    rep.append('わざの仕様変更などで、おぼえないわざが確定値に残っています。'
               'answer-key.html で選び直してください（それまでは情報元の推奨で動きます）。')
    rep.append('')
    sec('⚠ 要修正', warns)
if mismatch:
    rep.append('## ⚠ 通常版とシャドウ版で構成が食い違っています')
    rep.append('')
    rep.append('意図的でなければ answer-key.html で直してください。')
    rep.append('')
    sec('⚠ 食い違い', mismatch)

if not NO_REPORT:
    with open(os.path.join(ROOT, 'pvp-tests/meta_changes.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(rep).rstrip() + '\n')

# ---- 画面への出力 ----
print('assets/meta_moves.js を出力しました')
for lg, n, cnt in stats:
    print(f'  {LG_NAME[lg]}: {n}匹（人 {cnt["ans"]} / 引き継ぎ {cnt["twin"]} / 情報元 {cnt["base"]}）')
for w in warns:
    print('  ⚠', w)
print('  通常版とシャドウ版の食い違い: ' + ('なし' if not mismatch else f'{len(mismatch)}件'))
for w in mismatch:
    print('    ⚠', w)
if not NO_REPORT:
    print('pvp-tests/meta_changes.md に更新結果を書き出しました')
if todo_new:
    headline.insert(0, f'新顔{len(todo_new)}匹')
print('HEADLINE: ' + ('・'.join(headline) if headline else '入れ替わりなし'))
