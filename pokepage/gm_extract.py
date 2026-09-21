#!/usr/bin/env python3
# ゲーム内公開データ（max-battle/latest.json）から、ページに載せる「育成の情報」を抜き出す。
# 進化の条件とコスト・メガ/ゲンシのエナジー・フォルムチェンジ/合体の条件・リトレーン・3つ目のわざ・相棒の距離。
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
GM = json.load(open(os.path.join(ROOT, 'max-battle', 'latest.json'), encoding='utf-8'))

SET = {}          # templateId -> pokemonSettings
for x in GM:
    t = x.get('templateId', '')
    d = x.get('data', {})
    if 'pokemonSettings' in d and re.match(r'^V\d{4}_POKEMON_', t):
        SET[t] = d['pokemonSettings']

def base_tpl(pid):
    for t, p in SET.items():
        if p.get('pokemonId') == pid and 'form' not in p:
            return t, p
    return None, None

def form_tpl(form):
    for t, p in SET.items():
        if p.get('form') == form:
            return t, p
    return None, None

KEEP = ('pokemonId', 'form', 'familyId', 'parentPokemonId', 'evolutionBranch', 'formChange', 'thirdMove', 'shadow',
        'kmBuddyDistance', 'pokemonClass', 'buddyWalkedMegaEnergyAward', 'tempEvoOverrides', 'pokedexHeightM', 'pokedexWeightKg')

def slim(p):
    o = {k: p[k] for k in KEEP if k in p}
    if 'tempEvoOverrides' in o:
        o['tempEvoOverrides'] = [{'tempEvoId': e.get('tempEvoId'), 'stats': e.get('stats'),
                                  'types': [e.get('typeOverride1'), e.get('typeOverride2')]} for e in o['tempEvoOverrides'] if e.get('tempEvoId')]
    for fc in o.get('formChange', []):
        for k in ('locationCardSettings',):
            fc.pop(k, None)
        c = fc.get('componentPokemonSettings')
        if c:
            c.pop('locationCardSettings', None)
    return o
