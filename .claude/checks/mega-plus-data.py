# -*- coding: utf-8 -*-
# メガの＋わざ・未実装メガのデータ点検（2026-10-14・タダシさん指示の点検で作成・保存前に自動で流れる）
#  B 半角の「+」のわざ名が無い ／ C 表の＋わざ（タダシさんの一覧）がそろい図鑑に出る ／
#  D 発表値（あやしいかぜ＋・ナイトヘッド＋）・実装前メガのわざがツールに漏れない・ジム挑戦に＋わざが無い ／
#  A 未実装メガの名前の重複・確定済みの＋わざの値
import json, re, sys, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
os.chdir(ROOT); sys.path.insert(0, str(ROOT))
from mega_plus_info import MEGA_PLUS_INFO, MEGA_PLUS_PVP_BUFF, plus_id
from build_data import MEGA_PLUS_MOVES
bad = []
def ng(*a): bad.append(' '.join(str(x) for x in a)); print('NG', *a)
g = json.load(open('godata.json')); p = json.load(open('pvp_data.json'))
u = json.load(open('pokedex/unreleased.json'))['pokemon']; mp = json.load(open('pokedex/mega_preview.json'))
gu = json.load(open('gym-attack/data/gym_unreleased.json')); gd = json.load(open('gym-attack/data/gym_data.json'))

# B 半角＋
for nm, d in (('godata', g['moves']), ('pvp', {**p['moves'], **p.get('plusMoves', {})}), ('preview', {x['id']: x for x in mp['plus'].values()})):
    for k, v in d.items():
        if re.search(r'\+$', v.get('n', '')): ng('B 半角＋', nm, k, v['n'])
for k, v in gu['moves'].items():
    if re.search(r'\+$', v.get('name', v.get('n', '')) or ''): ng('B 半角＋ gym_unrel', k)

# C 表の64件（タダシさんの一覧＋シャンデラ・プテラ・ヤミラミ）
want = {'VENUSAUR_MEGA':'ハードプラント','CHARIZARD_MEGA_X':'ドラゴンクロー','CHARIZARD_MEGA_Y':'ブラストバーン','BLASTOISE_MEGA':'ハイドロカノン',
 'PIDGEOT_MEGA':'ぼうふう','ALAKAZAM_MEGA':'サイコショック','GENGAR_MEGA':'シャドーボール','PINSIR_MEGA':'つばめがえし','GYARADOS_MEGA':'しっぺがえし',
 'MEGANIUM_MEGA':'ソーラービーム','FERALIGATR_MEGA':'ワイドブレイカー','AMPHAROS_MEGA':'かみなりパンチ','STEELIX_MEGA':'ジャイロボール','SCIZOR_MEGA':'シザークロス',
 'HERACROSS_MEGA':'とびかかる','TYRANITAR_MEGA':'ストーンエッジ','SCEPTILE_MEGA':'リーフブレード','BLAZIKEN_MEGA':'ブレイズキック','SWAMPERT_MEGA':'だくりゅう',
 'GARDEVOIR_MEGA':'マジカルシャイン','MAWILE_MEGA':'じゃれつく','AGGRON_MEGA':'ヘビーボンバー','MEDICHAM_MEGA':'とびひざげり','SHARPEDO_MEGA':'かみくだく',
 'CAMERUPT_MEGA':'ねっぷう','ALTARIA_MEGA':'チャームボイス','BANETTE_MEGA':'シャドーパンチ','CHIMECHO_MEGA':'ラスターカノン','ABSOL_MEGA':'つじぎり',
 'ABSOL_MEGA_Z':'かげうち','SALAMENCE_MEGA':'そらをとぶ','METAGROSS_MEGA':'コメットパンチ','LATIAS_MEGA':'ミストボール','LATIOS_MEGA':'ラスターパージ',
 'RAYQUAZA_MEGA':'ガリョウテンセイ','LOPUNNY_MEGA':'インファイト','GARCHOMP_MEGA':'じしん','GARCHOMP_MEGA_Z':'りゅうせいぐん','LUCARIO_MEGA':'はどうだん',
 'LUCARIO_MEGA_Z':'きあいだま','ABOMASNOW_MEGA':'ふぶき','HEATRAN_MEGA':'マグマストーム','EMBOAR_MEGA':'ニトロチャージ','EXCADRILL_MEGA':'ドリルライナー',
 'AUDINO_MEGA':'ドレインキッス','SCOLIPEDE_MEGA':'メガホーン','EELEKTROSS_MEGA':'ワイルドボルト','GOLURK_MEGA':'だいちのちから','PYROAR_MEGA':'だいもんじ',
 'MEOWSTIC_MEGA':'サイコキネシス','MEOWSTIC_FEMALE_MEGA':'サイコキネシス','BARBARACLE_MEGA':'クロスチョップ','DRAGALGE_MEGA':'ヘドロウェーブ',
 'HAWLUCHA_MEGA':'フライングプレス','DIANCIE_MEGA':'パワージェム','CRABOMINABLE_MEGA':'ドレインパンチ','GOLISOPOD_MEGA':'アイアンヘッド','ZERAORA_MEGA':'プラズマフィスト',
 'SCOVILLAIN_MEGA':'かえんほうしゃ','GLIMMORA_MEGA':'メテオビーム','TATSUGIRI_MEGA':'りゅうのはどう','BAXCALIBUR_MEGA':'つららばり',
 'CHANDELURE_MEGA':'あやしいかぜ','AERODACTYL_MEGA':'いわなだれ','SABLEYE_MEGA':'ナイトヘッド'}
if set(want) - set(MEGA_PLUS_INFO): ng('C 表から消えた', set(want) - set(MEGA_PLUS_INFO))   # 表に足すのは自由（減ったら不合格）
allpk = {**u, **g['pokemon'], **mp['pokemon']}
for mk, nm in want.items():
    base = MEGA_PLUS_INFO.get(mk, [None])[0]
    if not base or g['moves'].get(base, {}).get('n') != nm: ng('C わざ名', mk, base, g['moves'].get(base, {}).get('n'), '≠', nm)
    if mk not in allpk: ng('C メガが見つからない', mk)
    # 図鑑で＋わざが出る（godata に付いている か preview にある）
    if not (g['pokemon'].get(mk, {}).get('plus') == plus_id(base) or mk in mp['plus']): ng('C 図鑑に出ない', mk)
    # メガの名前との対応（メガ◯◯）
print('C 確認', len(want), '件')

# D あやしいかぜ＋・ナイトヘッド＋
ow = g['moves']['OMINOUS_WIND']
if 'CHANDELURE_MEGA' in g['pokemon']:
    # 2026-10-30 実装（公式ニュースの告知で取り込み）。期待する値は実装前と同じ（威力145・元わざの時間・ゲージ1本）
    c = g['moves'].get('OMINOUS_WIND_PLUS') or {}
    if not (c.get('p') == 145 and c.get('d') == ow['d'] and c.get('w') == ow['w'] and c.get('e') == -100): ng('D あやしいかぜ＋ pve', c)
    if g['pokemon']['CHANDELURE_MEGA'].get('plus') != 'OMINOUS_WIND_PLUS': ng('D シャンデラに付いていない')
    cp = p.get('plusMoves', {}).get('OMINOUS_WIND_PLUS') or {}
    if not (cp.get('p') == 50 and cp.get('bf') == [1, 1] and cp.get('bt') == 'self'): ng('D あやしいかぜ＋ pvp', cp)
else:
    c = mp['plus']['CHANDELURE_MEGA']
    if not (c['pve'].get('p') == 145 and c['pve'].get('d') == ow['d'] and c['pve'].get('w') == ow['w'] and c['pve'].get('e') == -100): ng('D あやしいかぜ＋ pve', c['pve'])
    if not (c['pvp'].get('p') == 50 and c['pvp'].get('bf') == [1, 1] and c['pvp'].get('bt') == 'self' and c['pvp'].get('bcu') == 1): ng('D あやしいかぜ＋ pvp', c['pvp'])
    if 'OMINOUS_WIND_PLUS' in g['moves']: ng('D 実装前メガのわざが godata に漏れている')
ns, n0 = g['moves'].get('NIGHT_SHADE_PLUS'), g['moves']['NIGHT_SHADE']
if not ns or ns['p'] != 160 or ns['d'] != n0['d'] or ns['w'] != n0['w'] or ns['e'] != -100: ng('D ナイトヘッド＋', ns, n0)
if g['pokemon']['SABLEYE_MEGA'].get('plus') != 'NIGHT_SHADE_PLUS': ng('D ヤミラミに付いていない')
if mp['plus'].get('SABLEYE_MEGA', {}).get('pvp', {}).get('p') != 55: ng('D ヤミラミ pvp 55')
# ジム挑戦に＋わざが出ていない
gm_ids = set(json.dumps(gd, ensure_ascii=False).split('"'))
for mid in list(MEGA_PLUS_MOVES) + ['NIGHT_SHADE_PLUS', 'OMINOUS_WIND_PLUS']:
    if mid in gm_ids: ng('D ジム挑戦に＋わざ', mid)
# 実装前メガのわざが godata に（表から作ったもの）
for mk, (b, *_r) in MEGA_PLUS_INFO.items():
    if mk not in g['pokemon'] and plus_id(b) in g['moves']: ng('D 実装前の＋わざが godata', mk)

# A 図鑑: 名前の重複・未実装メガの重複
names = {}
for k, v in allpk.items(): names.setdefault(v['n'], []).append(k)
for k, v in p['pokemon'].items():
    if v.get('hid'): continue
for n, ks in names.items():
    if len(ks) > 1 and any('MEGA' in x for x in ks): ng('A メガの名前が重複', n, ks)
for k in mp['pokemon']:
    if k in g['pokemon'] or k in u: ng('A 実装済みなのに preview にいる', k)
# 確定済み16本の数値（MEGA_PLUS_MOVES の表どおり）
for mid, (mk, ty, pw, d, w, we) in MEGA_PLUS_MOVES.items():
    m = g['moves'].get(mid)
    if mid in ('NIGHT_SHADE_PLUS',): continue
    if not m or m['p'] != pw or abs(m['d'] - d / 1000) > 1e-9: ng('A 確定値がずれた', mid, m, pw, d)
# 公式ニュース: 記事を読み直しても、前に読み取った実装の印を消さない（消すと未実装へ戻る）
import news_auto
_k = news_auto.keep_old({'released': {'a': 1}, 'shadow': {'b': 1}, 'plus': {'C': 1}}, {'released': {}, 'shadow': {'d': 1}, 'plus': {}})
if _k != {'released': {'a': 1}, 'shadow': {'b': 1, 'd': 1}, 'plus': {'C': 1}}: ng('公式ニュース 読み直しで印が消える', _k)
print('問題', len(bad), '件')
sys.exit(1 if bad else 0)
