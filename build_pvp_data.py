#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GOバトルリーグ対面シミュレート用 データ生成スクリプト
- PvPoke gamemaster から対戦用の技データ(威力/ゲージ/ターン数/能力変化)と技構成を取得
- PokeMiners Game Master + i18n から日本語名・CPM(レベル補正)・タイプ相性を取得
- 日本語名の変換表は build_data.py のものをそのまま再利用(重複管理しない)

実行: python3 build_pvp_data.py
出力: pvp_data.json / pvp_data.js (window.PVP_DATA)
"""
import json, re, math
from build_data import (SRC, fetch, TYPE_JA, REGION, FORM_JA, OVERRIDE,
                        DEFAULT_FORM, GEN9_JA, JP_MOVE_FIX)

# PvPoke速度に含まれるが対戦ツールでは扱わない特殊ID
SKIP_SPECIES_SUFFIX = ('_shadow',)          # シャドウは基本形にフラグで持つ
SKIP_MOVES = {'STRUGGLE', 'HIDDEN_POWER_NORMAL'}   # わるあがき(自動発動) / タイプ不定めざパ(実在しない)

# PvPoke固有ID・i18n未収録の技の日本語名(GM側と表記が違うものはID照合で解決するのでここは最小限)
JP_MOVE_FIX_PVP = {
    'DIVE': 'ダイビング', 'GLAIVE_RUSH': 'きょけんとつげき', 'PLASMA_FISTS': 'プラズマフィスト',
    'SNIPE_SHOT': 'ねらいうち', 'SPRINGTIDE_STORM': 'はるのあらし',
    'TECHNO_BLAST_DOUSE': 'テクノバスター（アクア）',
    # ギルガルド(シールドフォルム)専用のチャージ仕様技
    'AEGISLASH_CHARGE_AIR_SLASH': 'エアスラッシュ（独自性能）',
    'AEGISLASH_CHARGE_PSYCHO_CUT': 'サイコカッター（独自性能）',
}
# PvPoke固有IDでGMフォルムキーに機械照合できないポケモンの日本語名
# 提供元がまだ「未実装(released=false)」扱いのままだが、ゲームには実装済みのポケモン。
# rが0だと各ツールの候補から外れる(KEYSのフィルタ)ので、実装済みとして出す。
# 提供元が追いついたら消してよい
# 交換できる幻(レイド産)。これ以外の幻は交換不可=最低個体値10
TRADEABLE_MYTH = {'deoxys', 'darkrai', 'genesect', 'meltan', 'melmetal'}
# 幻ではないが交換できないポケモン
UNTRADEABLE_EXTRA = {'zygarde'}
MANUAL_RELEASED = {'cramorant'}   # ウッウ(2026-08-18実装)

SPECIES_JA_FIX = {
    'pikachu_5th_anniversary': 'ピカチュウ（5しゅうねん）',
    'pikachu_flying': 'そらをとぶピカチュウ',
    'pikachu_libre': 'マスクド・ピカチュウ',
    'pikachu_shaymin': 'ピカチュウ（シェイミスカーフ）',
    'tauros_aqua': 'パルデアケンタロス（アクア種）',
    'tauros_blaze': 'パルデアケンタロス（ブレイズ種）',
    'tauros_combat': 'パルデアケンタロス（コンバット種）',
    'mewtwo_armored': 'アーマードミュウツー',
    'zygarde_10': 'ジガルデ（10%）',
    'minior_core': 'メテノ（コア）', 'minior_meteor': 'メテノ（りゅうせい）',
    'basculegion_female': 'イダイトウ（メス）', 'basculegion_male': 'イダイトウ（オス）',
    'wo_chien': 'チオンジェン', 'chien_pao': 'パオジアン',
    'ting_lu': 'ディンルー', 'chi_yu': 'イーユイ',
}

def main():
    gm = fetch(SRC['gm'])
    ja = fetch(SRC['ja'])['data']
    ja_map = {ja[i]: ja[i+1] for i in range(0, len(ja)-1, 2)}
    pvp = fetch(SRC['pvp'])

    # ---- Game Master: 図鑑番号・技番号(日本語名の索引)・CPM ----
    dex, move_no = {}, {}
    gm_keys = {}   # GMのフォルムキー → (pokemonId, form)
    for e in gm:
        tid = e['templateId']
        m = re.match(r'^V(\d{4})_POKEMON_', tid)
        if m and 'pokemonSettings' in e.get('data', {}):
            ps = e['data']['pokemonSettings']
            pid = ps.get('pokemonId')
            if pid and pid not in dex: dex[pid] = m.group(1)
            if pid: gm_keys[ps.get('form') or pid] = (pid, ps.get('form') or '')
        m2 = re.match(r'^V(\d{4})_MOVE_([A-Z0-9_]+)$', tid)
        if m2 and 'moveSettings' in e.get('data', {}):
            raw = e['data']['moveSettings'].get('movementId', '')
            mid = raw if isinstance(raw, str) else m2.group(2)
            move_no[mid] = m2.group(1)
    cpm = {}
    for e in gm:
        if e['templateId'] == 'PLAYER_LEVEL_SETTINGS':
            for i, v in enumerate(e['data']['playerLevel']['cpMultiplier'], 1):
                cpm[str(i)] = v
    for l in [x/2 for x in range(3, 160, 2)]:
        lo, hi = int(l), int(l)+1
        if str(hi) in cpm and str(l) not in cpm:
            cpm[str(l)] = math.sqrt((cpm[str(lo)]**2 + cpm[str(hi)]**2) / 2)
    chart = {}
    for e in gm:
        d = e.get('data', {})
        if 'typeEffective' in d:
            chart[d['typeEffective']['attackType'].replace('POKEMON_TYPE_', '')] = d['typeEffective']['attackScalar']

    gm_keys_nound = {k.replace('_', ''): k for k in gm_keys}
    pname = lambda pid: ja_map.get(f'pokemon_name_{dex.get(pid, "????")}') or GEN9_JA.get(pid) or pid

    # build_data.py の display_name と同じ規則(main内関数のため再掲)
    def display_name(pid, form):
        base = pname(pid)
        if not form or form == pid: return base
        if form in OVERRIDE: return OVERRIDE[form]
        fpart = form[len(pid)+1:] if form.startswith(pid+'_') else form
        for en, jp in REGION.items():
            if fpart == en: return jp+base
            if fpart.startswith(en+'_'):
                rest = fpart[len(en)+1:]
                suf = FORM_JA.get(rest, TYPE_JA.get(rest))
                if suf is None: return jp+base+f'（{rest}）'
                return jp+base+(f'（{suf}）' if suf else '')
        suf = FORM_JA.get(fpart, TYPE_JA.get(fpart))
        if suf is None: return base+f'（{fpart}）'
        return base+(f'（{suf}）' if suf else '')

    # ---- 技: PvPoke(対戦用数値) + 日本語名 ----
    move_no_nound = {k.replace('_', ''): v for k, v in move_no.items()}   # FUTURE_SIGHT⇔FUTURESIGHT等の表記ゆれ吸収
    moves, warn_mv = {}, []
    for mv in pvp['moves']:
        mid = mv['moveId']
        if mid in SKIP_MOVES: continue
        no = move_no.get(mid) or move_no.get(mid + '_FAST') or move_no_nound.get(mid.replace('_', ''))  # 通常技はGM側が_FAST付き
        nm = JP_MOVE_FIX_PVP.get(mid) or JP_MOVE_FIX.get(mid) or JP_MOVE_FIX.get(mid.replace('_', '')) \
             or ja_map.get(f'move_name_{no}')
        if nm is None and mid.startswith('HIDDEN_POWER_'):
            nm = 'めざめるパワー（' + TYPE_JA.get(mid.replace('HIDDEN_POWER_', ''), '?') + '）'
        if nm is None:
            # 日本語名が無い技はゲーム未実装の作業用データ(「◯◯+」等)なので収録しない
            # (収録すると /gbl/ の「その他のわざ」欄に英語名のまま並んでしまう)
            warn_mv.append(mid); continue
        entry = {'n': nm, 't': mv['type'].upper(), 'p': mv['power']}
        if mv.get('energyGain'):                 # 通常技: ゲージ増加とターン数
            entry['eg'] = mv['energyGain']
            entry['tn'] = mv.get('turns', 1)
        if mv.get('energy'):                     # ゲージ技: 消費エネルギー
            entry['e'] = mv['energy']
        for k_src, k_dst in (('buffs','bf'), ('buffTarget','bt'), ('buffApplyChance','bc'),
                             ('buffsSelf','bs'), ('buffsOpponent','bo')):
            if k_src in mv:
                v = mv[k_src]
                entry[k_dst] = float(v) if k_src == 'buffApplyChance' else v
        moves[mid] = entry

    # ---- ポケモン: PvPoke(技構成・種族値) + 日本語名 ----
    def jp_name(sid):
        """PvPokeのspeciesIdをGMのフォルムキーに照合して日本語名を得る"""
        up = sid.upper()
        mega = ''
        m = re.match(r'^(.+?)_MEGA(_[XY])?$', up)
        if m and up not in gm_keys:
            up = m.group(1); mega = 'メガ', (m.group(2) or '').strip('_')
        if up.endswith('_PRIMAL'):
            up = up[:-7]; mega = 'ゲンシ', ''
        cands = [up, up.replace('_ALOLAN', '_ALOLA'), up.replace('_PALDEAN', '_PALDEA'),
                 up + '_NORMAL', up + '_HERO']
        for c in cands:
            if c in gm_keys:
                nm = display_name(*gm_keys[c])
                if c in DEFAULT_FORM: nm = DEFAULT_FORM[c]
                if mega: nm = mega[0] + nm + mega[1]
                return nm
        c = gm_keys_nound.get(up.replace('_', ''))   # ORICORIO_POM_POM⇔ORICORIO_POMPOM等
        if c:
            nm = display_name(*gm_keys[c])
            if mega: nm = mega[0] + nm + mega[1]
            return nm
        nm = GEN9_JA.get(up.replace('_', ''))        # GM未収録の第9世代(WALKING_WAKE等)
        if nm:
            return mega[0] + nm + mega[1] if mega else nm
        return None

    pokes, shadow_ok, warn_pk = {}, set(), []
    for p in pvp['pokemon']:
        sid = p['speciesId']
        if sid.endswith(SKIP_SPECIES_SUFFIX):
            shadow_ok.add(sid[:-7]); continue
        if 'duplicate' in (p.get('tags') or []): continue   # ランキング用の複製エントリ
        nm = SPECIES_JA_FIX.get(sid) or jp_name(sid)
        if nm is None:
            warn_pk.append(sid); nm = p['speciesName']
        st = p['baseStats']
        pokes[sid] = {'n': nm, 'dex': p.get('dex', 0),
                      'a': st['atk'], 'df': st['def'], 'h': st['hp'],
                      'ty': [t.upper() for t in p['types'] if t != 'none'],
                      'q': p.get('fastMoves', []), 'c': p.get('chargedMoves', []),
                      'eq': [m for m in p.get('eliteMoves', []) if m.endswith('_FAST') or (m in moves and 'eg' in moves[m])],
                      'ec': [m for m in p.get('eliteMoves', []) if m in moves and 'e' in moves[m]],
                      'r': 1 if (p.get('released') or sid in MANUAL_RELEASED) else 0}
        if p.get('tags'):
            if 'mega' in p['tags']: pokes[sid]['mega'] = 1
            if 'mythical' in p['tags']: pokes[sid]['myth'] = 1
    for sid in shadow_ok:
        if sid in pokes: pokes[sid]['shadow'] = 1
    # ---- 交換できないポケモンは最低個体値10(個体値10未満の個体はゲーム内に存在しない) ----
    # 幻(mythical)は原則交換不可。ただしレイド産で交換できるもの(TRADEABLE_MYTH)は除く。
    # 幻でなくても交換できないもの(UNTRADEABLE_EXTRA)は足す。ゲーム内の変更はタダシさんから指示が出る。
    # メガ・フォルム違いは元の扱いを引き継ぐ(キーの先頭一致)
    def untradeable(sid):
        base = sid
        for x in TRADEABLE_MYTH:
            if sid == x or sid.startswith(x + '_'): return False
        for x in UNTRADEABLE_EXTRA:
            if sid == x or sid.startswith(x + '_'): return True
        return bool(pokes[sid].get('myth'))
    for sid in pokes:
        if untradeable(sid): pokes[sid]['ivf'] = 10
    # 前回との差分を報告に足す(新しい幻が情報元に入ったときに気づけるように)
    try:
        prev = json.load(open('pvp_data.json', encoding='utf-8'))['pokemon']
        prev_u = {k for k, v in prev.items() if v.get('ivf')}
    except Exception:
        prev_u = None
    now_u = {k for k, v in pokes.items() if v.get('ivf')}
    if prev_u is not None and now_u != prev_u:
        lines = ['', '## 交換できないポケモン（最低個体値10）の変更', '']
        for k in sorted(now_u - prev_u): lines.append(f'- 追加: {pokes[k]["n"]} ({k}) → 全ツールで最低個体値10として扱います')
        for k in sorted(prev_u - now_u): lines.append(f'- 解除: {prev[k]["n"]} ({k})')
        lines.append('')
        print('\n'.join(lines))
        try: open('changes.md', 'a', encoding='utf-8').write('\n'.join(lines))
        except Exception: pass

    # ---- 対戦の基本定数(PvPoke settings + 公知の仕様値) ----
    s = pvp.get('settings', {})
    settings = {
        'shadowAtkMult': s.get('shadowAtkMult', 1.2),
        'shadowDefMult': s.get('shadowDefMult', 0.8333333),
        'chargeMult': 1.0,          # ミニゲームExcellent時の倍率(段階はエンジン側で)
        'buffDivisor': s.get('buffDivisor', 4),   # 能力変化: (4±段階)/4
        'maxBuffStages': 4,
        'leagues': {'super': 1500, 'hyper': 2500, 'master': 0},
    }

    out = {'pokemon': pokes, 'moves': moves, 'cpm': cpm, 'chart': chart,
           'types': list(TYPE_JA.keys()), 'typeJa': TYPE_JA, 'settings': settings}
    js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    open('pvp_data.json', 'w', encoding='utf-8').write(js)
    open('pvp_data.js', 'w', encoding='utf-8').write('window.PVP_DATA=' + js + ';')

    # ---- 検証サマリー ----
    print(f'ポケモン: {len(pokes)}種(シャドウ可 {sum(1 for p in pokes.values() if p.get("shadow"))}種 / 実装済 {sum(1 for p in pokes.values() if p["r"])}種)')
    print(f'技: {len(moves)}件(通常技 {sum(1 for m in moves.values() if "eg" in m)} / ゲージ技 {sum(1 for m in moves.values() if "e" in m)})')
    if warn_mv: print(f'警告: 日本語名未収録の技({len(warn_mv)}件) →', warn_mv)
    if warn_pk: print(f'警告: 日本語名未解決のポケモン({len(warn_pk)}件) →', warn_pk)

    # CP計算の答え合わせ: マリルリ 0/15/15 PL45.5 は CP1499 のはず(みんポケ実測)
    az = pokes.get('azumarill')
    if az:
        a, d, h = az['a']+0, az['df']+15, az['h']+15
        c = cpm[str(45.5)]
        cp = math.floor(a * math.sqrt(d) * math.sqrt(h) * c * c / 10)
        print(f'検証: マリルリ0/15/15 PL45.5 → CP{cp}', '✅' if cp == 1499 else '❌(1499のはず)')

if __name__ == '__main__':
    main()
