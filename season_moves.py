# -*- coding: utf-8 -*-
"""シーズンのわざアップデートの受け皿（3か月ごとの大型調整）

新シーズンの切り替わりのたびに大型のわざ調整が来るので、公式発表の内容をこの1ファイルに
書き写しておき、提供元のデータが追いついたかどうかを突き合わせる。

    python3 season_moves.py     → いまのデータに入っているかを一覧で出す

build_pvp_data.py の最後からも呼ばれ、未反映の項目があれば changes.md に追記する
（毎朝のお知らせメールに出るので、反映された日にすぐ気づける）。

⚠ この表を見てデータを手で書き換えないこと。
  公式が数字で出すのは威力だけで、メーター（SPアタックの消費ゲージ・ノーマルアタックの
  獲得ゲージ）は「チャージされやすく／にくくなります」としか書かれない。威力だけ入れて
  ゲージを据え置くと、実在しない性能のわざになる（誤案内は取りこぼしより悪い）。
  提供元のデータが入るのを待ち、入ったらこのチェッカーで全項目の一致を確かめる。

次のシーズンでの使い方:
  1. 公式ニュースの「わざの変更」「覚えられるわざの変更」を読む
  2. SEASON / MOVE_CHANGES / NEW_LEARNS を丸ごと書き替える（前シーズンぶんは消してよい）
  3. python3 season_moves.py を流し、「旧」の値がいまのデータと全部一致することを確かめる
     （ここがずれるなら、わざIDの対応づけを間違えているか、もう反映済み）
  4. シーズン開始後にパイプラインを回し、全項目が ✅ になるのを確かめる
"""
import json
import sys

SEASON = {
    'name':  '黄昏の旅路',
    'start': '2026-09-08',   # 日本時間10:00から。それまでは全項目が「未反映」で正しい
}

# ===== わざの性能変更 =====
# id     : 対戦データ（pvp_data）のわざID
# pve    : ジム・レイド側（godata）のわざID。ノーマルアタックは末尾が _FAST で別IDになる
# kind   : 'fast'（ノーマルアタック） / 'charged'（SPアタック）
# pvp    : トレーナーバトルの (旧威力, 新威力)。変更が無ければ None
# raid   : ジム・レイドの (旧威力, 新威力)。変更が無ければ None
# meter  : 'easy'（チャージされやすくなる）/ 'hard'（されにくくなる）/ None
#          ⚠ 公式は数値を出さないので向きだけ持つ。合否の判定には使わない
# buff   : 能力変化の新しい値 (段階[攻,防], 対象, 発動確率)。数値が公式に書かれているものだけ
# note   : 数値が出ていない変更の説明
MOVE_CHANGES = [
    {'ja': 'エアカッター', 'id': 'AIR_CUTTER', 'pve': 'AIR_CUTTER', 'kind': 'charged',
     'pvp': (45, 60), 'meter': 'hard',
     'note': '自分の「こうげき」が1段階上がる確率が下がる（新しい確率は非公開）'},
    {'ja': 'じならし', 'id': 'BULLDOZE', 'pve': 'BULLDOZE', 'kind': 'charged',
     'pvp': (45, 80), 'meter': 'hard', 'buff': ([0, -1], 'opponent', 1.0),
     'note': '相手の「ぼうぎょ」を必ず1段階下げる（確率50%→100%）'},
    {'ja': 'のしかかり', 'id': 'BODY_SLAM', 'pve': 'BODY_SLAM', 'kind': 'charged',
     'pvp': (55, 65), 'meter': 'hard'},
    {'ja': 'すなじごく', 'id': 'SAND_TOMB', 'pve': 'SAND_TOMB', 'kind': 'charged',
     'pvp': (40, 55), 'meter': 'hard'},
    {'ja': 'しおみず', 'id': 'BRINE', 'pve': 'BRINE', 'kind': 'charged',
     'pvp': (60, 100), 'meter': 'hard'},
    {'ja': 'バブルこうせん', 'id': 'BUBBLE_BEAM', 'pve': 'BUBBLE_BEAM', 'kind': 'charged',
     'pvp': (25, 50), 'meter': 'hard'},
    {'ja': 'ミラーコート', 'id': 'MIRROR_COAT', 'pve': 'MIRROR_COAT', 'kind': 'charged',
     'pvp': (60, 75), 'meter': 'easy'},
    {'ja': '１０まんばりき', 'id': 'HIGH_HORSEPOWER', 'pve': 'HIGH_HORSEPOWER', 'kind': 'charged',
     'meter': 'easy'},
    {'ja': 'ブレイズキック', 'id': 'BLAZE_KICK', 'pve': 'BLAZE_KICK', 'kind': 'charged',
     'meter': 'easy'},
    {'ja': 'あくのはどう', 'id': 'DARK_PULSE', 'pve': 'DARK_PULSE', 'kind': 'charged',
     'meter': 'easy'},
    {'ja': 'マグネットボム', 'id': 'MAGNET_BOMB', 'pve': 'MAGNET_BOMB', 'kind': 'charged',
     'meter': 'easy'},
    {'ja': 'シャドーダイブ', 'id': 'SHADOW_FORCE', 'pve': 'SHADOW_FORCE', 'kind': 'charged',
     'meter': 'easy'},
    {'ja': 'アイアンヘッド', 'id': 'IRON_HEAD', 'pve': 'IRON_HEAD', 'kind': 'charged',
     'pvp': (70, 85)},
    {'ja': 'ドレインキッス', 'id': 'DRAINING_KISS', 'pve': 'DRAINING_KISS', 'kind': 'charged',
     'pvp': (60, 80), 'buff': ([0, 1], 'self', 1.0),
     'note': '使うポケモンの「ぼうぎょ」が必ず1段階上がる（もともと能力変化なし）'},
    {'ja': 'どくどくのキバ', 'id': 'POISON_FANG', 'pve': 'POISON_FANG', 'kind': 'charged',
     'pvp': (45, 50)},
    {'ja': 'とびかかる', 'id': 'LUNGE', 'pve': 'LUNGE', 'kind': 'charged',
     'pvp': (60, 70)},
    {'ja': 'ダブルパンツァー', 'id': 'DOUBLE_IRON_BASH', 'pve': 'DOUBLE_IRON_BASH', 'kind': 'charged',
     'pvp': (55, 70)},
    {'ja': 'ムーンフォース', 'id': 'MOONBLAST', 'pve': 'MOONBLAST', 'kind': 'charged',
     'pvp': (110, 90), 'meter': 'easy'},
    {'ja': 'シャドーボール', 'id': 'SHADOW_BALL', 'pve': 'SHADOW_BALL', 'kind': 'charged',
     'pvp': (100, 90)},
    {'ja': 'ふんどのこぶし', 'id': 'RAGE_FIST', 'pve': 'RAGE_FIST', 'kind': 'charged',
     'pvp': (50, 55), 'meter': 'hard'},
    {'ja': 'サイコブースト', 'id': 'PSYCHO_BOOST', 'pve': 'PSYCHO_BOOST', 'kind': 'charged',
     'pvp': (70, 85), 'raid': (70, 130), 'meter_raid': 'easy',
     'note': 'ジム・レイドのメーターだけがチャージされやすくなる（トレーナーバトルは据え置き）'},
    {'ja': 'チャージビーム', 'id': 'CHARGE_BEAM', 'pve': 'CHARGE_BEAM_FAST', 'kind': 'fast',
     'pvp': (5, 6)},
    {'ja': 'かみつく', 'id': 'BITE', 'pve': 'BITE_FAST', 'kind': 'fast',
     'pvp': (4, 2), 'meter': 'easy'},
    {'ja': 'まとわりつく', 'id': 'INFESTATION', 'pve': 'INFESTATION_FAST', 'kind': 'fast',
     'pvp': (6, 10)},
    {'ja': 'とっしん', 'id': 'TAKE_DOWN', 'pve': 'TAKE_DOWN_FAST', 'kind': 'fast',
     'pvp': (5, 14), 'meter': 'easy'},
    {'ja': 'ひっかく', 'id': 'SCRATCH', 'pve': 'SCRATCH_FAST', 'kind': 'fast',
     'pvp': (4, 3), 'meter': 'easy'},
    {'ja': 'けたぐり', 'id': 'LOW_KICK', 'pve': 'LOW_KICK_FAST', 'kind': 'fast',
     'pvp': (5, 6)},
]

# ===== 新しく覚えるようになるわざ =====
# (ポケモンの表示名, 対戦データのキー, ジム・レイド側のキー, わざID, ジム・レイド側のわざID)
# ジム・レイド側にそのフォルムが無いときは None（ストリンダーはフォルムを分けていない）
NEW_LEARNS = [
    # --- ノーマルアタック ---
    ('バルビート',            'volbeat',            'VOLBEAT',          'INFESTATION',  'INFESTATION_FAST'),
    ('イルミーゼ',            'illumise',           'ILLUMISE',         'INFESTATION',  'INFESTATION_FAST'),
    ('ウツボット',            'victreebel',         'VICTREEBEL',       'SUCKER_PUNCH', 'SUCKER_PUNCH_FAST'),
    ('ダークライ',            'darkrai',            'DARKRAI',          'SUCKER_PUNCH', 'SUCKER_PUNCH_FAST'),
    ('タブンネ',              'audino',             'AUDINO',           'CHARGE_BEAM',  'CHARGE_BEAM_FAST'),
    ('クロバット',            'crobat',             'CROBAT',           'GUST',         'GUST_FAST'),
    ('カラミンゴ',            'flamigo',            'FLAMIGO',          'PECK',         'PECK_FAST'),
    ('シャンデラ',            'chandelure',         'CHANDELURE',       'ASTONISH',     'ASTONISH_FAST'),
    ('ガチグマ',              'ursaluna',           'URSALUNA',         'SCRATCH',      'SCRATCH_FAST'),
    ('タギングル',            'grafaiai',           'GRAFAIAI',         'SCRATCH',      'SCRATCH_FAST'),
    ('デオキシス（ディフェンス）', 'deoxys_defense',  'DEOXYS_DEFENSE',   'LOW_KICK',     'LOW_KICK_FAST'),
    ('ドドゲザン',            'kingambit',          'KINGAMBIT',        'LOW_KICK',     'LOW_KICK_FAST'),
    ('ヘルガー',              'houndoom',           'HOUNDOOM',         'INCINERATE',   'INCINERATE_FAST'),
    ('カビゴン',              'snorlax',            'SNORLAX',          'PSYWAVE',      'PSYWAVE_FAST'),
    # --- SPアタック ---
    ('バルビート',            'volbeat',            'VOLBEAT',          'LUNGE',          'LUNGE'),
    ('アーボック',            'arbok',              'ARBOK',            'BRUTAL_SWING',   'BRUTAL_SWING'),
    ('プテラ',                'aerodactyl',         'AERODACTYL',       'BRUTAL_SWING',   'BRUTAL_SWING'),
    ('アローラベトベトン',    'muk_alolan',         'MUK_ALOLA',        'BRUTAL_SWING',   'BRUTAL_SWING'),
    ('ゲッコウガ',            'greninja',           'GRENINJA',         'BRUTAL_SWING',   'BRUTAL_SWING'),
    ('アリアドス',            'ariados',            'ARIADOS',          'FOUL_PLAY',      'FOUL_PLAY'),
    ('ダークライ',            'darkrai',            'DARKRAI',          'FOUL_PLAY',      'FOUL_PLAY'),
    ('タギングル',            'grafaiai',           'GRAFAIAI',         'FOUL_PLAY',      'FOUL_PLAY'),
    ('ライチュウ',            'raichu',             'RAICHU',           'VOLT_TACKLE',    'VOLT_TACKLE'),
    ('アローラライチュウ',    'raichu_alolan',      'RAICHU_ALOLA',     'VOLT_TACKLE',    'VOLT_TACKLE'),
    ('オーロンゲ',            'grimmsnarl',         'GRIMMSNARL',       'DRAINING_KISS',  'DRAINING_KISS'),
    ('ボスゴドラ',            'aggron',             'AGGRON',           'BRICK_BREAK',    'BRICK_BREAK'),
    ('ゼラオラ',              'zeraora',            'ZERAORA',          'DYNAMIC_PUNCH',  'DYNAMIC_PUNCH'),
    ('エルレイド',            'gallade',            'GALLADE',          'SACRED_SWORD',   'SACRED_SWORD'),
    ('ムウマージ',            'mismagius',          'MISMAGIUS',        'MYSTICAL_FIRE',  'MYSTICAL_FIRE'),
    ('イルミーゼ',            'illumise',           'ILLUMISE',         'SHADOW_BALL',    'SHADOW_BALL'),
    ('デスカーン',            'cofagrigus',         'COFAGRIGUS',       'ENERGY_BALL',    'ENERGY_BALL'),
    ('ヘルガー',              'houndoom',           'HOUNDOOM',         'TRAILBLAZE',     'TRAILBLAZE'),
    ('エアームド',            'skarmory',           'SKARMORY',         'DRILL_RUN',      'DRILL_RUN'),
    ('オトシドリ',            'bombirdier',         'BOMBIRDIER',       'DRILL_RUN',      'DRILL_RUN'),
    ('ルギア',                'lugia',              'LUGIA',            'EARTH_POWER',    'EARTH_POWER'),
    ('ミルタンク',            'miltank',            'MILTANK',          'HIGH_HORSEPOWER','HIGH_HORSEPOWER'),
    ('ニドキング',            'nidoking',           'NIDOKING',         'AVALANCHE',      'AVALANCHE'),
    ('ヒスイゾロアーク',      'zoroark_hisuian',    'ZOROARK_HISUIAN',  'SWIFT',          'SWIFT'),
    ('ストリンダー（ロー）',  'toxtricity_low_key', 'TOXTRICITY',       'SWIFT',          'SWIFT'),
    ('ストリンダー（ハイ）',  'toxtricity_amped',   'TOXTRICITY',       'SWIFT',          'SWIFT'),
    ('アーボック',            'arbok',              'ARBOK',            'WRAP',           'WRAP'),
    ('アローラベトベトン',    'muk_alolan',         'MUK_ALOLA',        'ICE_PUNCH',      'ICE_PUNCH'),
]

METER_JA = {'easy': 'メーター易化', 'hard': 'メーター難化'}


def _power_state(cur, old, new):
    """いまの威力が 新／旧／どちらでもない のどれかを返す"""
    if cur is None:
        return 'missing'
    if cur == new:
        return 'done'
    if cur == old:
        return 'todo'
    return 'odd'


def check(pvp_data, go_data):
    """(行の一覧, 未反映の数, 想定外の数, 確認できない数) を返す"""
    pm = dict(pvp_data.get('moves') or {})
    pm.update(pvp_data.get('plusMoves') or {})
    gm = go_data.get('moves') or {}
    pk = pvp_data.get('pokemon') or {}
    gk = go_data.get('pokemon') or {}
    lines, todo, odd, skip = [], 0, 0, 0

    lines.append(f'## わざの性能変更（{len(MOVE_CHANGES)}件）')
    for c in MOVE_CHANGES:
        marks, detail = [], []
        m = pm.get(c['id'])
        if c.get('pvp'):
            o, n = c['pvp']
            st = _power_state(None if m is None else m.get('p'), o, n)
            marks.append(st)
            detail.append(f'対戦の威力 {o}→{n}' + ('' if st == 'done' else f'（いま{m and m.get("p")}）'))
        if c.get('raid'):
            o, n = c['raid']
            g = gm.get(c['pve'])
            st = _power_state(None if g is None else g.get('p'), float(o), float(n))
            marks.append(st)
            detail.append(f'ジム・レイドの威力 {o}→{n}' + ('' if st == 'done' else f'（いま{g and g.get("p")}）'))
        if c.get('buff'):
            bf, bt, bc = c['buff']
            now = (m.get('bf'), m.get('bt'), m.get('bc')) if m else None
            st = 'done' if now == (bf, bt, bc) else 'todo'
            marks.append(st)
            detail.append('能力変化' + ('' if st == 'done' else f'（いま{now}）'))
        for key in ('meter', 'meter_raid'):
            if c.get(key):
                where = '対戦' if key == 'meter' else 'ジム・レイド'
                detail.append(f'{where}の{METER_JA[c[key]]}（公式が数値を出さないので確認できません）')
        if not marks:
            mark, note = '—', 'メーターだけの変更'
            skip += 1
        elif 'odd' in marks or 'missing' in marks:
            mark, note = '⚠', '想定外（わざIDの対応づけを確認してください）'
            odd += 1
        elif all(x == 'done' for x in marks):
            mark, note = '✅', '反映済み'
        else:
            mark, note = '⏳', '未反映'
            todo += 1
        lines.append(f'- {mark} {c["ja"]}: ' + ' / '.join(detail) + (f' … {note}' if mark in '⚠⏳' else ''))
        if c.get('note'):
            lines.append(f'    ※ {c["note"]}')

    lines.append('')
    lines.append(f'## 新しく覚えるわざ（{len(NEW_LEARNS)}件）')
    for ja, pkey, gkey, mid, gmid in NEW_LEARNS:
        got = []
        for key, src, move in ((pkey, pk, mid), (gkey, gk, gmid)):
            if key is None:
                got.append(None)
                continue
            e = src.get(key)
            if e is None:
                got.append('missing')
            else:
                have = set(e.get('q') or []) | set(e.get('c') or []) | set(e.get('eq') or []) | set(e.get('ec') or [])
                got.append('done' if move in have else 'todo')
        mname = (pm.get(mid) or {}).get('n', mid)
        if 'missing' in got:
            mark = '⚠'
            odd += 1
        elif all(x in (None, 'done') for x in got):
            mark = '✅'
        else:
            mark = '⏳'
            todo += 1
        where = []
        if got[0] and got[0] != 'done':
            where.append('対戦')
        if got[1] and got[1] != 'done':
            where.append('ジム・レイド')
        lines.append(f'- {mark} {ja}: {mname}' + (f'（{"・".join(where)}が未反映）' if where else ''))
    return lines, todo, odd, skip


def report(pvp_data, go_data, write_changes=True):
    """突き合わせの結果を表示し、未反映があれば changes.md にも追記する"""
    lines, todo, odd, skip = check(pvp_data, go_data)
    total = len(MOVE_CHANGES) + len(NEW_LEARNS)
    head = (f'シーズン「{SEASON["name"]}」（{SEASON["start"]}開始）のわざアップデート: '
            f'{total - todo - odd - skip}/{total - skip}件が反映済み')
    if todo:
        head += f' / 未反映 {todo}件'
    if odd:
        head += f' / 想定外 {odd}件'
    if skip:
        head += f' / メーターだけの変更で確認できないもの {skip}件'
    print('\n' + head)
    print('\n'.join(lines))
    if write_changes and (todo or odd):
        try:
            with open('changes.md', 'a', encoding='utf-8') as f:
                f.write('\n\n### 🗓️ ' + head + '\n\n'
                        'シーズン開始前は未反映で正しい状態です。開始後も未反映が残る場合は、\n'
                        '提供元のデータがまだ追いついていません（`python3 season_moves.py` で内訳を見られます）。\n')
        except Exception:
            pass
    return todo, odd


def main():
    pvp = json.load(open('pvp_data.json', encoding='utf-8'))
    go = json.load(open('godata.json', encoding='utf-8'))
    todo, odd = report(pvp, go, write_changes=False)
    sys.exit(1 if odd else 0)


if __name__ == '__main__':
    main()
