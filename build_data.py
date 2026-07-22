#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ポケモンGO 火力チェッカー データ自動生成スクリプト
- PokeMiners Game Master(最新)から全ポケモン・技データを取得
- PokeMiners i18n から日本語名を取得
- PvPoke から実装済みシャドウ一覧を取得
- template.html に埋め込んで index.html を出力

実行: python3 build_data.py
必要: requests (pip install requests)
"""
import json, re, math, sys, urllib.request

SRC = {
    'gm':   'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json',
    'ja':   'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_japanese.json',
    'pvp':  'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json',
}

def fetch(url):
    print('DL:', url)
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)

# ============================================================
# 手動補完テーブル（Game Masterに載らない特別技・新メガ等）
# 新しい合体技・限定技が実装されたらここに追記するだけでOK
# ============================================================
SUPP_EC = {  # ゲージ技の特別枠へ追加
    'NECROZMA_DUSK_MANE':      ['SUNSTEEL_STRIKE'],   # メテオドライブ
    'NECROZMA_DAWN_WINGS':     ['MOONGEIST_BEAM'],    # シャドーレイ
    'ZACIAN_CROWNED_SWORD':    ['BEHEMOTH_BLADE'],    # きょじゅうざん
    'ZAMAZENTA_CROWNED_SHIELD':['BEHEMOTH_BASH'],     # きょじゅうだん
    'KYUREM_BLACK':            ['FREEZE_SHOCK'],      # フリーズボルト
    'KYUREM_WHITE':            ['ICE_BURN'],          # コールドフレア
}
SUPP_EQ = {  # 通常技の特別枠へ追加
    'MEWTWO': ['COUNTER_FAST'],                       # カウンター(GOフェス2026)
}
# 種族値・技構成がGame Master上で同一でも、独立エントリとして収録するフォルム
# (フォルムチェンジ専用の特別技持ち等。統合dedupの対象外にする)
FORCE_SPLIT = {'KELDEO_RESOLUTE'}
# フォルム専用の技調整: remove=そのフォルムが覚えない技を除去 / add_ec=特別枠へ追加
FORM_MOVE_FIX = {
    'KELDEO_RESOLUTE': {'add_ec': ['SECRET_SWORD']},  # かくご: せいなるつるぎに加え、しんぴのつるぎが追加される
}
# Game Master未収録のメガ等を手動登録: key: (名前, 攻, 防, HP, [タイプ], 元ポケモンkey)
MANUAL_MEGA = {
    'MEWTWO_MEGA_X': ('メガミュウツーX', 399, 215, 228, ['PSYCHIC','FIGHTING'], 'MEWTWO'),
    'MEWTWO_MEGA_Y': ('メガミュウツーY', 413, 223, 228, ['PSYCHIC'],            'MEWTWO'),
}
# i18nに未収録の技・ポケモンの日本語名
JP_MOVE_FIX = {'CHILLING_WATER':'ひやみず','SECRET_SWORD':'しんぴのつるぎ','BEAK_BLAST':'くちばしキャノン',
 'MIND_BLOWN':'ビックリヘッド','DRUM_BEATING':'ドラムアタック','PYROBALL':'かえんボール','GIGATON_HAMMER':'デカハンマー',
 'AURA_WHEEL_ELECTRIC':'オーラぐるま（でんき）','AURA_WHEEL_DARK':'オーラぐるま（あく）','DYNAMAX_CANNON':'ダイマックスほう'}
GEN9_JA = {'WALKINGWAKE':'ウネルミナモ','IRONLEAVES':'テツノイサハ','DIPPLIN':'カミッチュ','POLTCHAGEIST':'チャデス',
 'SINISTCHA':'ヤバソチャ','OKIDOGI':'イイネイヌ','MUNKIDORI':'マシマシラ','FEZANDIPITI':'キチキギス','OGERPON':'オーガポン',
 'ARCHALUDON':'ブリジュラス','HYDRAPPLE':'カミツオロチ','GOUGINGFIRE':'ウガツホムラ','RAGINGBOLT':'タケルライコ',
 'IRONBOULDER':'テツノイワオ','IRONCROWN':'テツノカシラ','TERAPAGOS':'テラパゴス','PECHARUNT':'モモワロウ'}
# フォルム日本語名
TYPE_JA = {'NORMAL':'ノーマル','FIGHTING':'かくとう','FLYING':'ひこう','POISON':'どく','GROUND':'じめん','ROCK':'いわ','BUG':'むし','GHOST':'ゴースト','STEEL':'はがね','FIRE':'ほのお','WATER':'みず','GRASS':'くさ','ELECTRIC':'でんき','PSYCHIC':'エスパー','ICE':'こおり','DRAGON':'ドラゴン','DARK':'あく','FAIRY':'フェアリー'}
REGION = {'ALOLA':'アローラ','GALARIAN':'ガラル','HISUIAN':'ヒスイ','PALDEA':'パルデア'}
FORM_JA = {
 'ATTACK':'アタック','DEFENSE':'ディフェンス','SPEED':'スピード','NORMAL':'',
 'SUNNY':'たいよう','RAINY':'あまみず','SNOWY':'ゆきぐも','OVERCAST':'ネガ',
 'PLANT':'くさきのミノ','SANDY':'すなちのミノ','TRASH':'ゴミのミノ',
 'WEST_SEA':'にしのうみ','EAST_SEA':'ひがしのうみ',
 'HEAT':'ヒート','WASH':'ウォッシュ','FROST':'フロスト','FAN':'スピン','MOW':'カット',
 'ORIGIN':'オリジン','ALTERED':'アナザー','LAND':'ランド','SKY':'スカイ',
 'RED_STRIPED':'あかすじ','BLUE_STRIPED':'あおすじ','WHITE_STRIPED':'しろすじ',
 'STANDARD':'','ZEN':'ダルマ','SPRING':'はる','SUMMER':'なつ','AUTUMN':'あき','WINTER':'ふゆ',
 'INCARNATE':'けしん','THERIAN':'れいじゅう','BLACK':'ブラック','WHITE':'ホワイト',
 'ARIA':'ボイス','PIROUETTE':'ステップ','ORDINARY':'いつも','RESOLUTE':'かくご',
 'BURN':'ブレイズ','CHILL':'フリーズ','DOUSE':'アクア','SHOCK':'イナズマ',
 'TEN_PERCENT':'10%','FIFTY_PERCENT':'50%','COMPLETE':'パーフェクト','COMPLETE_TEN_PERCENT':'10%','COMPLETE_FIFTY_PERCENT':'50%',
 'SMALL':'ちいさい','AVERAGE':'ふつう','LARGE':'おおきい','SUPER':'とくだい',
 'BAILE':'めらめら','POMPOM':'ぱちぱち','PAU':'ふらふら','SENSU':'まいまい',
 'MIDDAY':'まひる','MIDNIGHT':'まよなか','DUSK':'たそがれ','SOLO':'たんどく','SCHOOL':'むれた',
 'DISGUISED':'ばけた','BUSTED':'ばれた','AMPED':'ハイ','LOW_KEY':'ロー',
 'NOICE':'ナイス','FULL_BELLY':'まんぷく','HANGRY':'はらぺこ',
 'SINGLE_STRIKE':'いちげき','RAPID_STRIKE':'れんげき','ICE_RIDER':'はくばじょう','SHADOW_RIDER':'こくばじょう',
 'CROWNED_SWORD':'けんのおう','CROWNED_SHIELD':'たてのおう','HERO':'れきせんのゆうしゃ','ZERO':'ナイーブ','ETERNAMAX':'ムゲンダイマックス',
 'CONFINED':'いましめられし','UNBOUND':'ときはなたれし','DAWN_WINGS':'あかつきのつばさ','DUSK_MANE':'たそがれのたてがみ','ULTRA':'ウルトラ',
 'MALE':'オス','FEMALE':'メス','APEX':'','ULTIMATE':'','TWO':'ふたふし','THREE':'みつふし',
 'EXCLAMATION_POINT':'！','QUESTION_MARK':'？','NATURAL':'','BLADE':'ブレード','SHIELD':'シールド',
 'FLYING_OKINAWA':'そらとぶ・おきなわ','FLYING_01':'そらとぶ','HORIZONS':'ホライズン','JEJU':'チェジュ','KARIYUSHI':'かりゆし',
 'ROCK_STAR':'ロックスター','POP_STAR':'アイドル','DOCTOR':'ドクター','KABUKI':'カブキ','PHARAOH':'キングダム',
 'CURLY':'そった','DROOPY':'たれた','STRETCHY':'のびた','FAMILY_OF_THREE':'','FAMILY_OF_FOUR':'',
 'UNREMARKABLE':'ボンサク','MASTERPIECE':'ケッサク','PHONY':'まがいもの','ANTIQUE':'ほんもの','COUNTERFEIT':'まがいもの','ARTISAN':'たくみ',
 'ORIGINAL_COLOR':'500ねんまえ','S':'S'}
OVERRIDE = {'MEWTWO_A':'アーマードミュウツー','CHERRIM_SUNNY':'チェリム（ポジ）','CHERRIM_OVERCAST':'チェリム（ネガ）',
 'EISCUE_ICE':'コオリッポ（アイス）','EISCUE_NOICE':'コオリッポ（ナイス）',
 'PALAFIN_HERO':'イルカマン（マイティ）','PALAFIN_ZERO':'イルカマン（ナイーブ）',
 'TAUROS_PALDEA_COMBAT':'パルデアケンタロス（コンバット種）','TAUROS_PALDEA_BLAZE':'パルデアケンタロス（ブレイズ種）','TAUROS_PALDEA_AQUA':'パルデアケンタロス（アクア種）',
 'MINIOR':'メテノ（りゅうせい）','MINIOR_BLUE':'メテノ（コア）',
 'ZACIAN_HERO':'ザシアン（れきせんのゆうしゃ）','ZAMAZENTA_HERO':'ザマゼンタ（れきせんのゆうしゃ）',
 'PIKACHU_BB_2026':'ピカチュウ（コスチューム2026）','PIKACHU_COSTUME_2020':'ピカチュウ（コスチューム2020）','PIKACHU_VS_2019':'ピカチュウ（コスチューム2019）'}
DEFAULT_FORM = {'LANDORUS':'ランドロス（けしん）','TORNADUS':'トルネロス（けしん）','THUNDURUS':'ボルトロス（けしん）',
 'ENAMORUS':'ラブトロス（けしん）','SHAYMIN':'シェイミ（ランド）','HOOPA':'フーパ（いましめられし）','GIRATINA':'ギラティナ（アナザー）',
 'KELDEO':'ケルディオ（いつも）'}

def main():
    data = fetch(SRC['gm'])
    ja = fetch(SRC['ja'])['data']
    ja_map = {ja[i]: ja[i+1] for i in range(0, len(ja)-1, 2)}
    pvp = fetch(SRC['pvp'])['pokemon']
    shadow_ids = {p['speciesId'][:-7].upper().replace('_ALOLAN','_ALOLA') for p in pvp if p['speciesId'].endswith('_shadow')}
    print('実装済みシャドウ:', len(shadow_ids))
    released_map = {p['speciesId']: bool(p.get('released')) for p in pvp}

    dex, move_no, num2move = {}, {}, {}
    for e in data:
        tid = e['templateId']
        m = re.match(r'^V(\d{4})_POKEMON_', tid)
        if m and 'pokemonSettings' in e.get('data',{}):
            pid = e['data']['pokemonSettings'].get('pokemonId')
            if pid and pid not in dex: dex[pid] = m.group(1)
        m2 = re.match(r'^V(\d{4})_MOVE_([A-Z0-9_]+)$', tid)
        if m2 and 'moveSettings' in e.get('data',{}):
            raw = e['data']['moveSettings'].get('movementId','')
            mid = raw if isinstance(raw, str) else m2.group(2)  # 数値IDはテンプレート名を採用
            move_no[mid] = m2.group(1); num2move[int(m2.group(1))] = mid
    norm = lambda lst: sorted(str(num2move.get(m,m)) if not isinstance(m,str) else m for m in (lst or []))
    pname = lambda pid: ja_map.get(f'pokemon_name_{dex.get(pid,"????")}') or GEN9_JA.get(pid) or pid
    mname = lambda mid: ja_map.get(f'move_name_{move_no.get(mid,"")}')

    moves = {}
    for e in data:
        ms = e.get('data',{}).get('moveSettings')
        if ms and ms.get('power'):
            raw = ms['movementId']
            m3 = re.match(r'^V\d{4}_MOVE_([A-Z0-9_]+)$', e['templateId'])
            mid = raw if isinstance(raw, str) else (m3.group(1) if m3 else str(raw))
            nm = JP_MOVE_FIX.get(mid) or mname(mid)
            if nm is None:
                print('警告: 日本語名未収録の技 →', mid, '(JP_MOVE_FIXに追記してください)')
                nm = mid
            moves[mid] = {'n':nm,'t':ms['pokemonType'].replace('POKEMON_TYPE_',''),
                          'p':ms['power'],'d':ms.get('durationMs',0)/1000,'e':ms.get('energyDelta',0)}

    def display_name(pid, form):
        base = pname(pid)
        if not form or form == pid: return base, ''
        if form in OVERRIDE: return OVERRIDE[form], ''
        fpart = form[len(pid)+1:] if form.startswith(pid+'_') else form
        for en, jp in REGION.items():
            if fpart == en: return jp+base, ''
            if fpart.startswith(en+'_'):
                rest = fpart[len(en)+1:]
                suf = FORM_JA.get(rest, TYPE_JA.get(rest))
                if suf is None: return jp+base+f'（{rest}）', 'RAW'
                return jp+base+(f'（{suf}）' if suf else ''), ''
        suf = FORM_JA.get(fpart, TYPE_JA.get(fpart))
        if suf is None:
            if re.fullmatch(r'[A-Z]', fpart): return base+f'（{fpart}）', ''
            return base+f'（{fpart}）', 'RAW'
        return base+(f'（{suf}）' if suf else ''), ''

    pokes, groups, order = {}, {}, []
    for e in data:
        if not re.match(r'^V\d{4}_POKEMON_', e['templateId']): continue
        ps = e.get('data',{}).get('pokemonSettings')
        if not ps or not ps.get('stats',{}).get('baseAttack'): continue
        pid, form = ps['pokemonId'], ps.get('form') or ''
        key = form or pid
        st = ps['stats']
        q,c,eq,ec = norm(ps.get('quickMoves')), norm(ps.get('cinematicMoves')), norm(ps.get('eliteQuickMove')), norm(ps.get('eliteCinematicMove'))
        sig = (pid, st['baseAttack'], st['baseDefense'], st['baseStamina'], tuple(q), tuple(c), tuple(eq), tuple(ec), ps.get('type'), ps.get('type2'))
        if sig in groups and key not in FORCE_SPLIT: groups[sig]['dupes'].append(key); continue
        name, flag = display_name(pid, form)
        if flag=='RAW': print('警告: 未翻訳フォルム →', key, name, '(FORM_JA/OVERRIDEに追記してください)')
        entry = {'n':name,'pid':pid,'a':st['baseAttack'],'df':st['baseDefense'],'h':st['baseStamina'],
                 'ty':[t.replace('POKEMON_TYPE_','') for t in [ps.get('type'),ps.get('type2')] if t],
                 'q':q,'c':c,'eq':eq,'ec':ec,'dupes':[key],'tev':ps.get('tempEvoOverrides') or []}
        if sig not in groups: groups[sig]=entry  # FORCE_SPLIT分は統合グループを乗っ取らない
        pokes[key]=entry; order.append(key)

    # 旧フォームレステンプレートを除去（フォルム版が正）
    for k in [k for k in list(pokes) if (k+'_NORMAL' in pokes) or (k+'_HERO' in pokes)]:
        twin = k+'_NORMAL' if k+'_NORMAL' in pokes else k+'_HERO'
        pokes[twin]['dupes'] += pokes[k]['dupes']
        del pokes[k]; order.remove(k)

    from collections import Counter
    per_pid = Counter(pokes[k]['pid'] for k in pokes)
    for k in pokes:
        p = pokes[k]
        if per_pid[p['pid']] == 1 and k not in OVERRIDE:
            nm,_ = display_name(p['pid'], '')
            for en, jp in REGION.items():
                if k.endswith('_'+en) or ('_'+en+'_') in k: nm = jp+nm
            p['n'] = nm
        if k in DEFAULT_FORM and p['n'] == DEFAULT_FORM[k].split('（')[0]:
            p['n'] = DEFAULT_FORM[k]
        p['shadow'] = any(d in shadow_ids for d in p['dupes'])

    final = {}
    for k in order:
        p = pokes[k]
        final[k] = {kk:p[kk] for kk in ['n','a','df','h','ty','q','c','eq','ec','shadow']}
        for ov in p['tev']:
            stt = ov.get('stats')
            if not stt: continue
            tev = ov.get('tempEvoId','')
            tag = 'ゲンシ' if tev.endswith('PRIMAL') else 'メガ'
            xy = 'X' if tev.endswith('_X') else ('Y' if tev.endswith('_Y') else '')
            mkey = k+'_'+tev.replace('TEMP_EVOLUTION_','')
            if mkey in final: continue
            final[mkey] = {'n':tag+p['n']+xy,'a':stt['baseAttack'],'df':stt['baseDefense'],'h':stt['baseStamina'],
                           'ty':[t.replace('POKEMON_TYPE_','') for t in [ov.get('typeOverride1'),ov.get('typeOverride2')] if t],
                           'q':p['q'],'c':p['c'],'eq':p['eq'],'ec':p['ec'],'shadow':False,'mega':True}

    # ===== 未実装ポケモンの除外（PvPokeのreleasedフラグで判定） =====
    # 照合できたうえで released=False のものだけ除外。照合不能は安全側で残す。
    SPECIAL_PVP = {'MEWTWO_A':'mewtwo_armored'}
    # アンダースコア表記の違いを吸収する補助テーブル（chi_yu ⇔ CHIYU など）
    released_nound = {}
    for sid, rel in released_map.items():
        released_nound.setdefault(sid.replace('_',''), rel)
    def pvp_candidates(key):
        k = key.lower()
        c = [k, k.replace('_alola','_alolan')]
        if k.endswith('_normal'): c.append(k[:-7])
        if k.endswith('_hero'):   c.append(k[:-5])
        c.append(k+'_incarnate')
        if key in SPECIAL_PVP: c.insert(0, SPECIAL_PVP[key])
        # フォルム名を後ろから削って種の本体でも判定（例: calyrex_shadow_rider → calyrex）
        parts = k.split('_')
        while len(parts) > 1:
            parts = parts[:-1]
            c.append('_'.join(parts))
        return c
    excluded = []
    for k in list(final):
        rel = None
        for cand in pvp_candidates(k):
            if cand in released_map:
                rel = released_map[cand]; break
        if rel is None:  # 最後の手段: アンダースコア無視で照合
            rel = released_nound.get(k.lower().replace('_',''))
        if rel is False:
            excluded.append(final[k]['n']); del final[k]
    print(f'未実装として除外: {len(excluded)}種（例: {"、".join(excluded[:6])} …）')

    for k,ms in SUPP_EC.items():
        if k in final:
            for m in ms:
                if m not in final[k]['ec'] and m not in final[k]['c']: final[k]['ec'].append(m)
    for k,ms in SUPP_EQ.items():
        if k in final:
            for m in ms:
                if m not in final[k]['eq'] and m not in final[k]['q']: final[k]['eq'].append(m)
    for k,fix in FORM_MOVE_FIX.items():
        if k in final:
            for m in fix.get('remove', []):
                for slot in ('q','c','eq','ec'):
                    if m in final[k][slot]: final[k][slot].remove(m)
            for m in fix.get('add_ec', []):
                if m not in final[k]['ec'] and m not in final[k]['c']: final[k]['ec'].append(m)
    for mkey,(nm,a,df,h,ty,src) in MANUAL_MEGA.items():
        if mkey in final: continue  # Game Masterに正式収録されたら自動取得値を優先
        s = final[src]
        final[mkey] = {'n':nm,'a':a,'df':df,'h':h,'ty':ty,'q':s['q'],'c':s['c'],'eq':s['eq'],'ec':s['ec'],'shadow':False,'mega':True}

    cpm = {}
    for e in data:
        if e['templateId']=='PLAYER_LEVEL_SETTINGS':
            for i,v in enumerate(e['data']['playerLevel']['cpMultiplier'],1): cpm[str(i)]=v
    for l in [x/2 for x in range(3,160,2)]:
        lo,hi=int(l),int(l)+1
        if str(hi) in cpm and str(l) not in cpm:
            cpm[str(l)] = math.sqrt((cpm[str(lo)]**2+cpm[str(hi)]**2)/2)
    TYPES=['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL','FIRE','WATER','GRASS','ELECTRIC','PSYCHIC','ICE','DRAGON','DARK','FAIRY']
    chart={}
    for e in data:
        d=e.get('data',{})
        if 'typeEffective' in d:
            chart[d['typeEffective']['attackType'].replace('POKEMON_TYPE_','')]=d['typeEffective']['attackScalar']

    god = json.dumps({'pokemon':final,'moves':moves,'cpm':cpm,'chart':chart,'types':TYPES,'typeJa':TYPE_JA},
                     ensure_ascii=False, separators=(',',':'))

    # ===== 前回データとの差分サマリー（changes.md / godata.json同士で比較） =====
    def load_old():
        try:
            return json.load(open('godata.json', encoding='utf-8'))
        except Exception:
            return None
    old = load_old()
    lines = []
    if old:
        op, np_ = old.get('pokemon',{}), final
        added   = [np_[k]['n'] for k in np_ if k not in op]
        removed = [op[k]['n'] for k in op if k not in np_]
        newshadow = [np_[k]['n'] for k in np_ if k in op and np_[k].get('shadow') and not op[k].get('shadow')]
        statchg = [f"{np_[k]['n']}（攻{op[k]['a']}→{np_[k]['a']} 防{op[k]['df']}→{np_[k]['df']} HP{op[k]['h']}→{np_[k]['h']}）"
                   for k in np_ if k in op and (np_[k]['a'],np_[k]['df'],np_[k]['h'])!=(op[k]['a'],op[k]['df'],op[k]['h'])]
        movechg = []
        for k in np_:
            if k not in op: continue
            newm = (set(np_[k]['q']+np_[k]['c']+np_[k]['eq']+np_[k]['ec'])
                    - set(op[k]['q']+op[k]['c']+op[k]['eq']+op[k]['ec']))
            if newm:
                nm = [moves[m]['n'] if m in moves else m for m in newm]
                movechg.append(f"{np_[k]['n']}：{'、'.join(sorted(nm))}")
        om, nm_ = old.get('moves',{}), moves
        newmoves = [nm_[m]['n'] for m in nm_ if m not in om]
        adjmoves = [f"{nm_[m]['n']}（威力{om[m]['p']}→{nm_[m]['p']}）" for m in nm_ if m in om and nm_[m]['p']!=om[m]['p']]
        def sec(title, items, cap=30):
            if items:
                lines.append(f"### {title}（{len(items)}件）")
                lines.extend(f"- {x}" for x in items[:cap])
                if len(items)>cap: lines.append(f"- …他{len(items)-cap}件")
                lines.append("")
        sec("🆕 新ポケモン・新実装", added)
        sec("🟣 新シャドウ実装", newshadow)
        sec("📊 種族値変更", statchg)
        sec("⚔️ 覚える技の追加", movechg)
        sec("✨ 新しい技", newmoves)
        sec("🔧 技の威力調整", adjmoves)
        sec("🗑️ 削除", removed)
    if not lines:
        lines = ["データに実質的な変更はありません（CPM表・相性表など内部値のみの差分の可能性）。"]
    open('changes.md','w',encoding='utf-8').write(
        "## データ更新の内容\n\nこの内容で問題なければ **Merge pull request** を押すとサイトに反映されます。反映しない場合はこのPRを **Close** してください。\n\n" + "\n".join(lines))

    open('godata.json','w',encoding='utf-8').write(god)
    tpl = open('template.html', encoding='utf-8').read()
    open('index.html','w',encoding='utf-8').write(tpl.replace('__GODATA__', god))
    dup = [(n,ct) for n,ct in Counter(p['n'] for p in final.values()).items() if ct>1]
    if dup: print('警告: 表示名重複 →', dup)
    print(f'完了: {len(final)}種 / シャドウ実装 {sum(1 for p in final.values() if p.get("shadow"))}種 / index.html 出力')

if __name__ == '__main__':
    main()
