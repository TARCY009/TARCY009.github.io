#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ステータス図鑑だけの「未実装メガ」と「＋わざの判明段階」(2026-10-14タダシさん指示)

出力: pokedex/mega_preview.json（図鑑だけが読む。火力・ジム・GBLなどのツールには入れない）
  pokemon: ゲームにまだ無いメガ。種族値は
             ① 対戦データの情報元に未実装のまま載っていればその値
             ② 無ければ原作の種族値をGOの決まりで換算（cv=1。実装時に変わることがある）
           わざは元のポケモンのものを引き継ぐ。実装されて godata.json / pvp_data.json に入ったら自動でここから消える
  plus:    mega_plus_info.py の表の＋わざ。メガのキーごとに
             pve / pvp = {st:'name'(名前だけ)|'power'(威力だけ)|'full'(確定), p, d, e, w, ...}
           godata.json / pvp_data.json にもう同じ＋わざが付いている側は書かない（そちらが正）

実行順: build_data.py → build_pvp_data.py → これ（両方の出力を読む）
原作の種族値の換算式は assets/devadd.js の goStats と同じ（既存メガ53匹で一致を確認済み・2026-10-14）
"""
import json, math, re, urllib.request
from mega_plus_info import MEGA_PLUS_INFO, MEGA_PLUS_PVP_BUFF, plus_id

SD_URL = 'https://play.pokemonshowdown.com/data/pokedex.json'     # 原作の種族値（Z-Aの新メガを含む）
PVP_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json'
OUT = 'pokedex/mega_preview.json'
# 原作のフォルム → GOの元のポケモン（ここに無いものは名前をそのまま大文字にする）
BASE_FIX = {('Zygarde', ''): 'ZYGARDE_COMPLETE', ('Meowstic', 'F'): 'MEOWSTIC_FEMALE'}
SKIP_FORM = {'Original'}   # マギアナ（500ねんまえ）はGOに無い


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def rnd(x): return math.floor(x + 0.5)


def go_stats(b, nf):
    """原作の6つ → GOの [攻撃, 防御, HP]。nf=元のポケモンが弱体化されている(×0.97)"""
    hp, at, df, sa, sd, spe = b['hp'], b['atk'], b['def'], b['spa'], b['spd'], b['spe']
    sp, k = 1 + (spe - 75) / 500, (0.97 if nf else 1)
    a = rnd(rnd(2 * (7 / 8 * max(at, sa) + 1 / 8 * min(at, sa))) * sp * k)
    d = rnd(rnd(2 * (5 / 8 * max(df, sd) + 3 / 8 * min(df, sd))) * sp * k)
    h = rnd((1.75 * hp + 50) * k) if nf else math.floor(1.75 * hp + 50)
    return [a, d, h]


def main():
    god = json.load(open('godata.json', encoding='utf-8'))
    pvpd = json.load(open('pvp_data.json', encoding='utf-8'))
    unrel = json.load(open('pokedex/unreleased.json', encoding='utf-8'))['pokemon']
    sd = fetch(SD_URL)
    go_all = {**unrel, **god['pokemon']}
    pv = pvpd['pokemon']
    sd_id = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

    out_pk = {}
    for v in sd.values():
        f = v.get('forme') or ''
        if v.get('num', 0) <= 0 or not re.search(r'(^|-)(Mega|Primal)(-|$)', f): continue
        pre = f.split('-Mega')[0] if '-Mega' in f else ''
        if pre in SKIP_FORM: continue
        kind = 'PRIMAL' if 'Primal' in f else 'MEGA' + ('_' + f.split('Mega-')[1] if 'Mega-' in f else '')
        base = BASE_FIX.get((v['baseSpecies'], pre)) or re.sub(r'[^A-Z0-9]', '_', v['baseSpecies'].upper())
        if base not in go_all: continue
        b = go_all[base]
        key = (base.replace('_COMPLETE', '') if base == 'ZYGARDE_COMPLETE' else base) + '_' + kind
        if key in go_all or key in out_pk: continue                 # 実装済み（または同じ姿がもう入った）
        tag = 'ゲンシ' if kind == 'PRIMAL' else 'メガ'
        xyz = kind.split('_')[1] if '_' in kind else ''
        nm0 = b['n']
        paren = re.search(r'（.*?）', nm0)
        keep = paren.group(0) if paren and base in ('MEOWSTIC_FEMALE',) else ''
        name = tag + re.sub(r'（.*?）', '', nm0) + xyz + keep
        # 対戦データの情報元に同じメガが載っていればその値（キーの書き方が違っても名前で見つける）
        pk = pv.get(key.lower()) or next((x for x in pv.values() if x.get('n') == name and not x.get('hid')), None)
        if pk and pk.get('n') and not pk.get('hid'):
            a, d, h = pk['a'], pk['df'], pk['h']; cv = 0
        else:
            # 弱体化の判定: 元のポケモンのGOの値が、原作の値をそのまま換算したものと違えば弱体化されている
            bsd = sd.get(sd_id(v['baseSpecies'] + ('complete' if base == 'ZYGARDE_COMPLETE' else '') + (pre if pre in ('F',) else '')))
            nf = bool(bsd) and go_stats(bsd['baseStats'], False) != [b['a'], b['df'], b['h']]
            a, d, h = go_stats(v['baseStats'], nf); cv = 1
        ty = [t.upper() for t in v['types']]
        e = {'n': name, 'a': a, 'df': d, 'h': h, 'ty': ty, 'q': b['q'], 'c': b['c'], 'eq': b['eq'], 'ec': b['ec'],
             'shadow': False, 'mega': True, 'fe': 1, 'base': base}
        if b.get('lg'): e['lg'] = 1
        if cv: e['cv'] = 1
        # トレーナーバトル側は元のポケモンの対戦データ（わざ・図鑑番号・個体値の下限）を借りる
        bp = (pv.get(base.lower()) or next((x for x in pv.values() if x.get('n') == nm0), None)
              or next((x for k, x in sorted(pv.items()) if k.startswith(base.lower() + '_') and not x.get('hid')), None))
        if bp:
            e['pv'] = {kk: bp[kk] for kk in ('dex', 'q', 'c', 'eq', 'ec', 'ivf', 'lvf') if kk in bp}
        out_pk[key] = e

    # ---- ＋わざの判明段階 ----
    try: src_mv = {m['moveId']: m for m in fetch(PVP_URL)['moves']}
    except Exception: src_mv = {}
    out_plus = {}
    for mk, (base, raid, pp, pe, src) in MEGA_PLUS_INFO.items():
        mid = plus_id(base)
        gb, pb = god['moves'].get(base), pvpd['moves'].get(base)
        if not gb: continue
        ent = {'id': mid, 'n': gb['n'] + '＋', 't': gb['t'], 'src': src}
        gp = god['pokemon'].get(mk)
        if not (gp and gp.get('plus') == mid):           # ジム・レイド側がまだ付いていない
            gm = god['moves'].get(mid)
            if gm: ent['pve'] = {'st': 'full', **gm}
            # 威力が分かったら、時間は元わざと同じ・ゲージは1本(100)（＋わざの決まり・2026-09-04）。図鑑では「未確定」の札つきで出す
            elif raid is not None: ent['pve'] = {'st': 'est', 'p': float(raid), 'd': gb['d'], 'w': gb['w'], 'we': gb['we'], 'e': -100}
            else: ent['pve'] = {'st': 'name'}
        pp_ = pv.get(mk.lower())
        if not (pp_ and pp_.get('cp') == mid):            # トレーナーバトル側がまだ付いていない
            pm = (pvpd.get('plusMoves') or {}).get(mid)
            sm = src_mv.get(mid)
            if pm: ent['pvp'] = {'st': 'full', **pm}
            elif sm:
                x = {'st': 'full', 'p': sm['power'], 'e': sm['energy']}
                for k_src, k_dst in (('buffs', 'bf'), ('buffTarget', 'bt'), ('buffApplyChance', 'bc')):
                    if k_src in sm: x[k_dst] = float(sm[k_src]) if k_src == 'buffApplyChance' else sm[k_src]
                ent['pvp'] = x
            elif pp is not None:
                ent['pvp'] = {'st': 'full' if pe is not None else 'power', 'p': pp, **({'e': pe} if pe is not None else {})}
            else:
                ent['pvp'] = {'st': 'name'}
            # 公式発表の能力変化（情報元の確定値が無いときだけ足す）
            bfx = MEGA_PLUS_PVP_BUFF.get(mid)
            if bfx and ent['pvp'].get('st') != 'full':
                ent['pvp'].update({'bf': bfx['bf'], 'bt': bfx['bt']})
                if bfx.get('bc') is None: ent['pvp']['bcu'] = 1
                else: ent['pvp']['bc'] = bfx['bc']
        if 'pve' in ent or 'pvp' in ent:
            out_plus[mk] = ent

    report(out_pk, out_plus)
    js = json.dumps({'pokemon': dict(sorted(out_pk.items())), 'plus': out_plus}, ensure_ascii=False, separators=(',', ':'))
    open(OUT, 'w', encoding='utf-8').write(js)
    print(f'図鑑の未実装メガ: {len(out_pk)}匹（うち換算 {sum(1 for x in out_pk.values() if x.get("cv"))}匹）'
          f'・＋わざの判明段階: {len(out_plus)}件 → {OUT}')


STAGE_JA = {'name': '名前だけ', 'power': '威力だけ', 'est': '威力＋時間（元わざ）', 'full': '確定値'}


def report(out_pk, out_plus):
    """前回の出力と比べて、段階が進んだもの・実装データに入ったものを毎朝のお知らせ(changes.md)に足す"""
    try: prev = json.load(open(OUT, encoding='utf-8'))
    except Exception: return
    lines = []
    for k, v in prev.get('pokemon', {}).items():
        if k not in out_pk:
            lines.append(f'{v["n"]}: ゲームのデータに入ったので、換算値の仮表示を終えて正式な値に切り替え')
        elif v.get('cv') and not out_pk[k].get('cv'):
            lines.append(f'{v["n"]}: 対戦データの情報元に載ったので、換算値から情報元の種族値に切り替え')
    for mk, x in out_plus.items():
        if mk not in prev.get('plus', {}):
            lines.append(f'{x["n"]}（{mk}）: 表に追加')
    for mk, x in prev.get('plus', {}).items():
        y = out_plus.get(mk, {})
        for side, ja in (('pve', 'ジム・レイド'), ('pvp', 'トレーナーバトル')):
            if side not in x: continue
            if side not in y:
                lines.append(f'{x["n"]}（{mk}）{ja}: 確定してツールのデータに入った（図鑑の仮表示を終了）')
            elif x[side].get('st') != y[side].get('st'):
                lines.append(f'{x["n"]}（{mk}）{ja}: {STAGE_JA.get(x[side].get("st"))} → {STAGE_JA.get(y[side].get("st"))}')
    if lines:
        msg = ['', '### ⚡ メガの＋わざ・未実装メガ（ステータス図鑑）', '', *[f'- {t}' for t in lines], '']
        print('\n'.join(msg))
        try: open('changes.md', 'a', encoding='utf-8').write('\n'.join(msg))
        except Exception: pass


if __name__ == '__main__':
    main()
