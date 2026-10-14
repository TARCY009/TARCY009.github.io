# -*- coding: utf-8 -*-
# 「情報元に＋わざの確定値が入った日」を作り出して、毎朝の流れを通しで試す（作業用コピーで実行）
import sys, os, json, copy
sys.path.insert(0, os.getcwd())
SC = sys.argv[1]   # scratchpad (gm.json / pvpgm.json / sd.json のキャッシュ)
GM = json.load(open(SC + '/gm.json'))
PV = json.load(open(SC + '/pvpgm.json'))
SD = json.load(open(SC + '/sd.json'))
stage = sys.argv[2]

def gm_data():
    d = copy.deepcopy(GM)
    if stage in ('gm', 'both'):
        # ゲーム内公開データに＋わざ2本と未登録の＋わざ1本が入った
        for mid, ty, pw in (('OMINOUS_WIND_PLUS', 'GHOST', 150.0), ('NIGHT_SHADE_PLUS', 'GHOST', 160.0), ('TEST_MOVE_PLUS', 'NORMAL', 99.0)):
            d.append({'templateId': f'V9{len(d)}_MOVE_{mid}', 'data': {'moveSettings': {'movementId': mid, 'pokemonType': 'POKEMON_TYPE_' + ty,
                      'power': pw, 'durationMs': 2500, 'damageWindowStartMs': 2000, 'damageWindowEndMs': 2300, 'energyDelta': -100}}})
    return d

def pv_data():
    d = copy.deepcopy(PV)
    if stage in ('pvp', 'both'):
        d['moves'].append({'moveId': 'OMINOUS_WIND_PLUS', 'name': 'Ominous Wind+', 'type': 'ghost', 'power': 50, 'energy': 40,
                           'energyGain': 0, 'cooldown': 500, 'buffs': [1, 1], 'buffTarget': 'self', 'buffApplyChance': '0.3', 'turns': 1, 'isMegaMove': True})
        d['moves'].append({'moveId': 'NIGHT_SHADE_PLUS', 'name': 'Night Shade+', 'type': 'ghost', 'power': 55, 'energy': 45,
                           'energyGain': 0, 'cooldown': 500, 'turns': 1, 'isMegaMove': True})
        d['moves'].append({'moveId': 'ZZZ_PLUS', 'name': 'Zzz+', 'type': 'normal', 'power': 10, 'energy': 40,
                           'energyGain': 0, 'cooldown': 500, 'turns': 1, 'isMegaMove': True})
        base = next(p for p in d['pokemon'] if p['speciesId'] == 'chandelure')
        m = copy.deepcopy(base); m.update({'speciesId': 'chandelure_mega', 'speciesName': 'Chandelure (Mega)', 'released': False,
                                           'baseStats': {'atk': 335, 'def': 227, 'hp': 155}, 'types': ['ghost', 'fire'], 'tags': ['mega']})
        d['pokemon'].append(m)
        a = copy.deepcopy(next(p for p in d['pokemon'] if p['speciesId'] == 'absol'))
        a.update({'speciesId': 'absol_mega_z', 'speciesName': 'Absol (Mega Z)', 'released': False,
                  'baseStats': {'atk': 332, 'def': 138, 'hp': 163}, 'types': ['dark', 'ghost'], 'tags': ['mega']})
        d['pokemon'].append(a)
    return d

import build_data as bd
real = bd.fetch
def fake(url):
    if url == bd.SRC['gm']: return gm_data()
    if url == bd.SRC['pvp']: return pv_data()
    return real(url)
bd.fetch = fake
which = sys.argv[3]
if which == 'data':
    bd.main()
elif which == 'pvp':
    import build_pvp_data as bp
    bp.fetch = fake
    bp.main()
elif which == 'preview':
    import build_mega_preview as mp
    def f2(url):
        if 'pvpoke' in url: return pv_data()
        if 'showdown' in url: return SD
        return real(url)
    mp.fetch = f2
    mp.main()
