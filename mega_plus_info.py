# -*- coding: utf-8 -*-
"""
メガの＋わざ（追加SPアタック）の「分かっていること」の表（2026-10-14タダシさん指示）

ここに1行足すだけで、あとは毎朝の自動更新が段階を進める:

  ① 名前だけ分かった      → 図鑑に名前だけ出す（性能は「−」）
  ② 公式発表で威力が分かった → 下の表の威力を埋める（図鑑に威力だけ出す。メガが実装済みなら
                               ジム・レイドのツールにも入る＝時間は元わざを引き継ぐ決まり・2026-09-04タダシさん指示）
  ③ 実装されて情報元に入った → 情報元の確定値に自動で切り替わる（ここの値より情報元が優先）
       ・トレーナーバトル: 対戦データの情報元に＋わざ（メガ専用わざの印つき）が入った時点
       ・ジム・レイド    : ゲーム内公開データにわざが入った時点

形式: メガのキー（ジム・レイド側の大文字キー）: (元わざID, レイド威力, 対戦威力, 対戦消費, 出どころ)
  ・＋わざのIDは「元わざID + _PLUS」、名前は「元わざの名前 + ＋」、タイプは元わざと同じ
  ・威力・消費が分からないところは None。対戦の消費は正の数（通常のわざと同じ形）
  ・未実装のメガでもよい（図鑑の未実装メガに付く。build_mega_preview.py が作る）
  ・情報元にもう入ったわざ（MEGA_PLUS_MOVES の16本）は書かなくてよい
"""

MEGA_PLUS_INFO = {
    # 2026-10 外部の解析情報（ゲーム内データに追加された＋わざ・海外の情報・変更の可能性あり）。公式発表・実装で変わることがある
    'VENUSAUR_MEGA':        ('FRENZY_PLANT', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガフシギバナ『ハードプラント＋』
    'CHARIZARD_MEGA_X':     ('DRAGON_CLAW', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガリザードンX『ドラゴンクロー＋』
    'CHARIZARD_MEGA_Y':     ('BLAST_BURN', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガリザードンY『ブラストバーン＋』
    'BLASTOISE_MEGA':       ('HYDRO_CANNON', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガカメックス『ハイドロカノン＋』
    'PIDGEOT_MEGA':         ('HURRICANE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガピジョット『ぼうふう＋』
    'ALAKAZAM_MEGA':        ('PSYSHOCK', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガフーディン『サイコショック＋』
    'GENGAR_MEGA':          ('SHADOW_BALL', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガゲンガー『シャドーボール＋』
    'PINSIR_MEGA':          ('AERIAL_ACE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガカイロス『つばめがえし＋』
    'GYARADOS_MEGA':        ('PAYBACK', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガギャラドス『しっぺがえし＋』
    'MEGANIUM_MEGA':        ('SOLAR_BEAM', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガメガニウム『ソーラービーム＋』
    'FERALIGATR_MEGA':      ('BREAKING_SWIPE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガオーダイル『ワイドブレイカー＋』
    'AMPHAROS_MEGA':        ('THUNDER_PUNCH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガデンリュウ『かみなりパンチ＋』
    'STEELIX_MEGA':         ('GYRO_BALL', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガハガネール『ジャイロボール＋』
    'SCIZOR_MEGA':          ('X_SCISSOR', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガハッサム『シザークロス＋』
    'HERACROSS_MEGA':       ('LUNGE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガヘラクロス『とびかかる＋』
    'TYRANITAR_MEGA':       ('STONE_EDGE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガバンギラス『ストーンエッジ＋』
    'SCEPTILE_MEGA':        ('LEAF_BLADE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガジュカイン『リーフブレード＋』
    'BLAZIKEN_MEGA':        ('BLAZE_KICK', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガバシャーモ『ブレイズキック＋』
    'SWAMPERT_MEGA':        ('MUDDY_WATER', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガラグラージ『だくりゅう＋』
    'GARDEVOIR_MEGA':       ('DAZZLING_GLEAM', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガサーナイト『マジカルシャイン＋』
    'MAWILE_MEGA':          ('PLAY_ROUGH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガクチート『じゃれつく＋』
    'AGGRON_MEGA':          ('HEAVY_SLAM', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガボスゴドラ『ヘビーボンバー＋』
    'MEDICHAM_MEGA':        ('HIGH_JUMP_KICK', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガチャーレム『とびひざげり＋』
    'SHARPEDO_MEGA':        ('CRUNCH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガサメハダー『かみくだく＋』
    'CAMERUPT_MEGA':        ('HEAT_WAVE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガバクーダ『ねっぷう＋』
    'ALTARIA_MEGA':         ('DISARMING_VOICE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガチルタリス『チャームボイス＋』
    'BANETTE_MEGA':         ('SHADOW_PUNCH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガジュペッタ『シャドーパンチ＋』
    'CHIMECHO_MEGA':        ('FLASH_CANNON', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガチリーン『ラスターカノン＋』
    'ABSOL_MEGA':           ('NIGHT_SLASH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガアブソル『つじぎり＋』
    'ABSOL_MEGA_Z':         ('SHADOW_SNEAK', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガアブソルZ『かげうち＋』
    'SALAMENCE_MEGA':       ('FLY', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガボーマンダ『そらをとぶ＋』
    'METAGROSS_MEGA':       ('METEOR_MASH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガメタグロス『コメットパンチ＋』
    'LATIAS_MEGA':          ('MIST_BALL', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガラティアス『ミストボール＋』
    'LATIOS_MEGA':          ('LUSTER_PURGE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガラティオス『ラスターパージ＋』
    'RAYQUAZA_MEGA':        ('DRAGON_ASCENT', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガレックウザ『ガリョウテンセイ＋』
    'LOPUNNY_MEGA':         ('CLOSE_COMBAT', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガミミロップ『インファイト＋』
    'GARCHOMP_MEGA':        ('EARTHQUAKE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガガブリアス『じしん＋』
    'GARCHOMP_MEGA_Z':      ('DRACO_METEOR', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガガブリアスZ『りゅうせいぐん＋』
    'LUCARIO_MEGA':         ('AURA_SPHERE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガルカリオ『はどうだん＋』
    'LUCARIO_MEGA_Z':       ('FOCUS_BLAST', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガルカリオZ『きあいだま＋』
    'ABOMASNOW_MEGA':       ('BLIZZARD', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガユキノオー『ふぶき＋』
    'HEATRAN_MEGA':         ('MAGMA_STORM', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガヒードラン『マグマストーム＋』
    'EMBOAR_MEGA':          ('FLAME_CHARGE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガエンブオー『ニトロチャージ＋』
    'EXCADRILL_MEGA':       ('DRILL_RUN', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガドリュウズ『ドリルライナー＋』
    'AUDINO_MEGA':          ('DRAINING_KISS', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガタブンネ『ドレインキッス＋』
    'SCOLIPEDE_MEGA':       ('MEGAHORN', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガペンドラー『メガホーン＋』
    'EELEKTROSS_MEGA':      ('WILD_CHARGE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガシビルドン『ワイルドボルト＋』
    'GOLURK_MEGA':          ('EARTH_POWER', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガゴルーグ『だいちのちから＋』
    'PYROAR_MEGA':          ('FIRE_BLAST', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガカエンジシ『だいもんじ＋』
    'MEOWSTIC_MEGA':        ('PSYCHIC', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガニャオニクス『サイコキネシス＋』
    'MEOWSTIC_FEMALE_MEGA': ('PSYCHIC', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガニャオニクス『サイコキネシス＋』
    'BARBARACLE_MEGA':      ('CROSS_CHOP', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガガメノデス『クロスチョップ＋』
    'DRAGALGE_MEGA':        ('SLUDGE_WAVE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガドラミドロ『ヘドロウェーブ＋』
    'HAWLUCHA_MEGA':        ('FLYING_PRESS', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガルチャブル『フライングプレス＋』
    'DIANCIE_MEGA':         ('POWER_GEM', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガディアンシー『パワージェム＋』
    'CRABOMINABLE_MEGA':    ('DRAIN_PUNCH', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガケケンカニ『ドレインパンチ＋』
    'GOLISOPOD_MEGA':       ('IRON_HEAD', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガグソクムシャ『アイアンヘッド＋』
    'ZERAORA_MEGA':         ('PLASMA_FISTS', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガゼラオラ『プラズマフィスト＋』
    'SCOVILLAIN_MEGA':      ('FLAMETHROWER', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガスコヴィラン『かえんほうしゃ＋』
    'GLIMMORA_MEGA':        ('METEOR_BEAM', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガキラフロル『メテオビーム＋』
    'TATSUGIRI_MEGA':       ('DRAGON_PULSE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガシャリタツ『りゅうのはどう＋』
    'BAXCALIBUR_MEGA':      ('ICICLE_SPEAR', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガセグレイブ『つららばり＋』
    'CHANDELURE_MEGA':      ('OMINOUS_WIND', 145, 50, None, '公式発表 2026-10（シャンデラのスーパーメガレイド・デイ）'),   # メガシャンデラ『あやしいかぜ＋』（対戦: 確率で自分の攻撃・防御+1。確率は未発表）
    'SABLEYE_MEGA':         ('NIGHT_SHADE', 160, 55, None, '公式発表 2026-10（ハロウィン2026パート2・11/1から）'),   # メガヤミラミ『ナイトヘッド＋』
    'AERODACTYL_MEGA':      ('ROCK_SLIDE', None, None, None, '解析情報 2026-10（未発表・変更の可能性あり）'),   # メガプテラ『いわなだれ＋』
}


# トレーナーバトルの能力変化（公式発表に書いてあるもの）。bf=[攻撃,防御]の段階・bt=self(自分)/opponent(相手)・
# bc=発動する確率(0〜1)。確率が発表されていないときは None（図鑑は「確率は未発表」と出す）
# ⚠ 公式発表の本文に効果が書いてあれば、確率が分からなくても必ずここに入れる（2026-10-14タダシさん指示）
MEGA_PLUS_PVP_BUFF = {
    'OMINOUS_WIND_PLUS': {'bf': [1, 1], 'bt': 'self', 'bc': None},   # あやしいかぜ＋「こうげきとぼうぎょが1段階上がることがある」
}

# 公式ニュースから読み取った＋わざ（news_auto.py・2026-10-30タダシさん指示）。上の表に無いメガは足し、
# 表の威力が None のところだけ埋める（表に手で書いた値があればそちらが優先）。能力変化も無いときだけ足す
try:
    from news_auto import plus_info as _news_plus
    for _mk, _v in _news_plus().items():
        _src = f'公式ニュース（{_v.get("slug", "")}）'
        _row = MEGA_PLUS_INFO.get(_mk)
        if _row is None:
            MEGA_PLUS_INFO[_mk] = (_v['base'], _v.get('raid'), _v.get('pvp'), None, _src)
        elif _row[0] == _v['base']:
            MEGA_PLUS_INFO[_mk] = (_row[0], _row[1] if _row[1] is not None else _v.get('raid'),
                                   _row[2] if _row[2] is not None else _v.get('pvp'), _row[3],
                                   _row[4] if _row[1] is not None else _src)
        if _v.get('buff') and _v['base'] + '_PLUS' not in MEGA_PLUS_PVP_BUFF:
            MEGA_PLUS_PVP_BUFF[_v['base'] + '_PLUS'] = _v['buff']
except Exception as _e:   # 読めなくても表だけで動く
    print('公式ニュースの＋わざを読めません（表だけで続ける）:', _e)

def plus_id(base):
    return base + '_PLUS'


def info_ids():
    """表にある＋わざのID（対戦データの通常のわざ欄に混ぜないため）"""
    return {plus_id(v[0]) for v in MEGA_PLUS_INFO.values()}
