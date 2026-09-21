#!/usr/bin/env python3
# 1ポケモン1ページの共通の部品（名前の変換・タイプ相性・最大CPなど）。build.py が読み込む。
import json, os, re, html, math

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
J = lambda *p: json.load(open(os.path.join(*p), encoding='utf-8'))
GO, PVP = J(ROOT, 'godata.json'), J(ROOT, 'pvp_data.json')

# build.py が差し替えるもの（ページの一覧・ゲームデータ・各場面の読み取り・日付・アイテム名）
PAGES, GM, ITEM_JA, DATE_JA = [], {}, {}, ''
td_rows = max_rows = gbl_of = rkt_best = None

TYPE_ORDER = ['NORMAL', 'GRASS', 'FIRE', 'WATER', 'ELECTRIC', 'ICE', 'ROCK', 'FLYING', 'BUG', 'PSYCHIC',
              'GHOST', 'FIGHTING', 'GROUND', 'POISON', 'DRAGON', 'STEEL', 'DARK', 'FAIRY']
JA = GO['typeJa']
LG = {'1500': 'スーパー', '2500': 'ハイパー', '0': 'マスター'}
esc = html.escape
norm = lambda s: s.replace('(', '（').replace(')', '）')
_src = open(os.path.join(ROOT, 'assets', 'type-icons.js'), encoding='utf-8').read()
TCOL = {m.group(1): m.group(2) for m in re.finditer(r'"([^"]+)":\s*\{\s*top:\s*"(#[0-9A-Fa-f]{6})"', _src)}
TEMP_SUFFIX = {'TEMP_EVOLUTION_MEGA': '_mega', 'TEMP_EVOLUTION_MEGA_X': '_mega_x', 'TEMP_EVOLUTION_MEGA_Y': '_mega_y', 'TEMP_EVOLUTION_PRIMAL': '_primal'}


def ty(t, size=18):
    return f'<span class="ty" data-ty="{JA[t]}" data-sz="{size}"></span>'

def max_cp(p, lv=50):
    c = GO['cpm'][str(lv)]
    return max(10, math.floor((p['a'] + 15) * math.sqrt(p['df'] + 15) * math.sqrt(p['h'] + 15) * c * c / 10))

def matchups(types):
    out = {}
    for at in GO['types']:
        m = 1.0
        for d in types:
            m *= GO['chart'][at][GO['types'].index(d)]
        out[at] = round(m, 4)
    return out

def mult_label(m):
    return {2.56: '×2.56', 1.6: '×1.6', 0.625: '×0.63', 0.3906: '×0.39', 0.2441: '×0.24'}.get(m, f'×{m:g}')

def ja_id(pid):
    p = PVP['pokemon'].get(pid.lower())
    if p:
        return p['n']
    for k, v in PVP['pokemon'].items():   # すがた違いしか無いポケモン（ザシアン等）は、括弧の前の名前を使う
        if k.startswith(pid.lower() + '_'):
            return re.sub(r'（.*）$', '', v['n'])
    return pid

def ja_form(form):
    p = PVP['pokemon'].get(form.lower())
    if p:
        return p['n']
    if form.endswith('_NORMAL'):
        return ja_id(form[:-7])
    return form

def ja_move(mid):
    for src in (GO['moves'], PVP['moves']):
        if mid in src:
            return src[mid]['n']
        if mid + '_FAST' in src:
            return src[mid + '_FAST']['n']
    return mid
