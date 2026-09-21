#!/usr/bin/env python3
# 進化・フォルムチェンジの条件（ゲーム内公開データの項目）を、ページに載せる日本語の札にする。
# 知らない項目・知らないアイテムが出てきたら UNKNOWN に積む＝毎朝のお知らせに出して、人が表に足す（黙って落とさない）。
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))

ITEM_JA = {
    'ITEM_SUN_STONE': 'たいようのいし', 'ITEM_KINGS_ROCK': 'おうじゃのしるし', 'ITEM_METAL_COAT': 'メタルコート',
    'ITEM_DRAGON_SCALE': 'りゅうのウロコ', 'ITEM_UP_GRADE': 'アップグレード',
    'ITEM_GEN4_EVOLUTION_STONE': 'シンオウのいし', 'ITEM_GEN5_EVOLUTION_STONE': 'イッシュのいし',
    'ITEM_BEANS': 'ジガルデ・セル',
    # 下のりんご3種・コレクレーのコイン・キュレムのエナジー2種は、2026-09-21にタダシさんが確認して確定
    'ITEM_OTHER_EVOLUTION_STONE_MAPLE_A': 'あまーいりんご', 'ITEM_OTHER_EVOLUTION_STONE_MAPLE_B': 'すっぱいりんご',
    'ITEM_OTHER_EVOLUTION_STONE_MAPLE_C': 'みついりりんご', 'ITEM_OTHER_EVOLUTION_STONE_A': 'コレクレーのコイン',
    'FUSION_RESOURCE_DUSKMANE_NECROZMA': 'サンエナジー', 'FUSION_RESOURCE_DAWNWINGS_NECROZMA': 'ムーンエナジー',
    'ITEM_RESOURCE_CROWNED_ZACIAN': 'ソードエナジー', 'ITEM_RESOURCE_CROWNED_ZAMAZENTA': 'シールドエナジー',
    'FUSION_RESOURCE_BLACK_KYUREM': 'ボルトエナジー', 'FUSION_RESOURCE_WHITE_KYUREM': 'ブレイズエナジー',
}
NEED_CHECK = []   # 日本語表記の確認待ち（いまは無し）
LURE_JA = {'ITEM_TROY_DISK_MAGNETIC': 'マグネットルアーモジュール', 'ITEM_TROY_DISK_GLACIAL': 'アイスルアーモジュール',
           'ITEM_TROY_DISK_RAINY': 'レイニールアーモジュール', 'ITEM_TROY_DISK_MOSSY': 'ハーブルアーモジュール'}
TYPE_JA = json.load(open(os.path.join(ROOT, 'godata.json'), encoding='utf-8'))['typeJa']
# 値を見なくてよい項目（別の場所で使う・表示に関係しない）
SKIP = {'evolution', 'form', 'candyCost', 'candyCostPurified', 'temporaryEvolution', 'temporaryEvolutionEnergyCost',
        'temporaryEvolutionEnergyCostSubsequent', 'priority', 'obPurificationEvolutionCandyCost', 'evolutionItemRequirementCost'}
UNKNOWN = []

_GM = None
def _quests():
    global _GM
    if _GM is None:
        gm = json.load(open(os.path.join(ROOT, 'max-battle', 'latest.json'), encoding='utf-8'))
        _GM = {x['templateId']: x['data'].get('evolutionQuestTemplate') for x in gm if x.get('templateId', '').endswith('_EVOLUTION_QUEST')}
    return _GM

def _types(lst):
    return '・'.join(TYPE_JA.get(t.replace('POKEMON_TYPE_', ''), t) for t in lst)

def quest_ja(tid):
    q = (_quests().get(tid) or {})
    goal = (q.get('goals') or [{}])[0]
    n, qt = goal.get('target'), q.get('questType')
    conds = {c.get('type'): c for c in goal.get('condition', [])}
    ty = ''
    if 'WITH_POKEMON_TYPE' in conds:
        ty = _types(conds['WITH_POKEMON_TYPE']['withPokemonType']['pokemonType'])
    if qt == 'QUEST_BUDDY_EVOLUTION_WALK':
        return f'相棒にして{n}km歩く'
    if qt == 'QUEST_BUDDY_EARN_AFFECTION_POINTS':
        return f'相棒にしてハートを{n}個ためる'
    if qt == 'QUEST_BUDDY_FEED':
        return f'相棒にしておやつを{n}回あげる'
    if qt == 'QUEST_CATCH_POKEMON' and ty:
        return f'相棒にして{ty}タイプのポケモンを{n}匹つかまえる'
    if qt == 'QUEST_COMPLETE_RAID_BATTLE':
        return f'相棒にしてレイドバトルに{n}回勝つ'
    if qt == 'QUEST_COMPLETE_BATTLE' and ty:
        ct = conds.get('WITH_COMBAT_TYPE', {}).get('withCombatType', {}).get('combatType', [])
        where = 'レイドバトル・マックスバトル' if any('MAX' in c for c in ct) else 'レイドバトル'
        return f'相棒にして{ty}タイプのポケモンとの{where}に{n}回勝つ'
    if qt == 'QUEST_FIGHT_POKEMON' and 'WITH_OPPONENT_POKEMON_BATTLE_STATUS' in conds:
        ot = _types(conds['WITH_OPPONENT_POKEMON_BATTLE_STATUS']['withOpponentPokemonBattleStatus'].get('opponentPokemonType', []))
        return f'相棒にして{ot}タイプのポケモンを{n}匹たおす'
    if qt == 'QUEST_LAND_THROW':
        return f'相棒にしてエクセレントスローを{n}回決める'
    if qt == 'QUEST_USE_INCENSE':
        return f'相棒にしておこうを{n}回使う'
    UNKNOWN.append(('quest', tid, qt))
    return None

def evo_conditions(e, moves_ja=None, sibs=0):
    """evolutionBranch の1件 → 条件の札（日本語）のリスト。アメの数は別に出すのでここには入れない"""
    out = []
    for k, v in e.items():
        if k in SKIP:
            continue
        if k == 'evolutionItemRequirement':
            n = e.get('evolutionItemRequirementCost')
            name = ITEM_JA.get(v)
            if not name:
                UNKNOWN.append(('item', v, e.get('evolution')))
                continue
            out.append(f'{name}×{n}' if n else name)
        elif k == 'lureItemRequirement':
            if v in LURE_JA:
                out.append(f'{LURE_JA[v]}を使ったポケストップの近く')
            else:
                UNKNOWN.append(('lure', v, e.get('evolution')))
        elif k == 'kmBuddyDistanceRequirement':
            out.append(f'相棒にして{v:g}km歩く')
        elif k == 'mustBeBuddy':
            pass   # 「相棒にして」は距離の札に含めてある
        elif k == 'onlyDaytime':
            out.append('昼に進化')
        elif k == 'onlyNighttime':
            out.append('夜に進化')
        elif k == 'onlyDuskPeriod':
            out.append('夕方（午後5時〜6時）に進化')
        elif k == 'onlyFullMoon':
            out.append('満月の夜に進化')
        elif k == 'onlyUpsideDown':
            out.append('スマホを逆さまにして進化')
        elif k == 'genderRequirement':
            out.append('♀だけ' if v == 'FEMALE' else '♂だけ')
        elif k == 'noCandyCostViaTrade':
            out.append('交換した個体はアメ0個')
        elif k == 'evolutionLikelihoodWeight':
            # 割合は同じポケモンの枝ぜんぶの重みから出す（sibs＝その合計。無ければ割合は書かない）
            out.append(f'進化先はランダム（{v / sibs * 100:g}%）' if sibs else '進化先はランダム')
        elif k == 'evolutionMoveRequirement':
            out.append(f'「{(moves_ja or {}).get(v, v)}」をおぼえている')
        elif k == 'questDisplay':
            for q in v:
                s = quest_ja(q.get('questRequirementTemplateId'))
                if s:
                    out.append(s)
        else:
            UNKNOWN.append(('key', k, e.get('evolution')))
    return list(dict.fromkeys(out))   # 同じ札は1つに（歩く距離が2つの項目に重ねて書かれている）

def evo_all(p, moves_ja=None):
    """ポケモン1匹の進化の枝ぜんぶ → [(枝, 条件の札)]"""
    br = p.get('evolutionBranch', [])
    sibs = sum(e.get('evolutionLikelihoodWeight', 0) for e in br)
    return [(e, evo_conditions(e, moves_ja, sibs)) for e in br]

if __name__ == '__main__':
    g = json.load(open(os.path.join(HERE, 'data', 'gm.json'), encoding='utf-8'))
    n = 0
    seen = {}
    for k, p in g.items():
        for e, c in evo_all(p):
            n += 1
            if c:
                seen.setdefault(' ／ '.join(c), []).append(f"{k}→{e.get('evolution') or e.get('temporaryEvolution')}")
    print('進化の枝', n, '／条件つき', sum(len(v) for v in seen.values()), '／取りこぼし', len(UNKNOWN), UNKNOWN[:10])
    for s, who in sorted(seen.items(), key=lambda x: -len(x[1])):
        print(f'{len(who):4d}  {s}   例: {who[0]}')
