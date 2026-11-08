# -*- coding: utf-8 -*-
"""
実機で確かめた値の表（2026-11-08タダシさん指示・取り寄せ先の改善の柱②）

情報の優先順位: ①ここ（タダシさんがゲームで確かめた値）＞ ②公式ニュース ＞ ③ゲーム内データ（gm_source.py） ＞ ④対戦データの情報元
実装の日に運営がわざなどを差し替えると、どの解析データよりもゲーム画面のほうが早くて正確なので、ここに1行書けば全ツールに入る。

形式: ジム・レイド側のキー（大文字）: {
    'day': 確かめた日, 'src': 出どころ（スクショなど）,
    'q': ノーマルアタック（対戦データと同じ名前＝_FAST を付けない）, 'c': SPアタック, 'eq'/'ec': 特別わざ（省略可）,
    'ty': タイプの並び（ゲーム画面の左から）,
}
書いていない項目は情報元のまま。build_data.py（ジム・レイド）と build_pvp_data.py（対戦）の両方が読む。
情報元が同じ値に追いついたら、毎朝のお知らせに「この行は消してよい」と出る（消さなくても害はない）。
"""

VERIFIED = {
    'SLIGGOO_HISUIAN': {'day': '2026-11-08', 'src': 'タダシさんの実機スクショ',
                        'q': ['TACKLE', 'WATER_GUN'],
                        'c': ['SLUDGE_WAVE', 'HEAVY_SLAM', 'WATER_PULSE', 'DRAGON_PULSE'],
                        'ty': ['STEEL', 'DRAGON']},
    'GOODRA_HISUIAN':  {'day': '2026-11-08', 'src': 'タダシさんの実機スクショ',
                        'q': ['IRON_TAIL', 'WATER_GUN', 'DRAGON_TAIL'],
                        'c': ['SLUDGE_WAVE', 'HEAVY_SLAM', 'HYDRO_PUMP', 'DRACO_METEOR'],
                        'ty': ['STEEL', 'DRAGON']},
}


def pvp_key(k):
    """ジム・レイド側のキー → 対戦データのキー"""
    return k.lower().replace('_alola', '_alolan').replace('_paldea', '_paldean')


def apply(entry, v, side):
    """1匹ぶんを上書きする。side='pve'ならノーマルアタックに _FAST を付ける。
    戻り値: 情報元がすでに同じ値だったか（True＝この行は消してよい）"""
    same = True
    for slot in ('q', 'c', 'eq', 'ec'):
        if slot not in v: continue
        ids = [m + '_FAST' if side == 'pve' and slot in ('q', 'eq') and not m.endswith('_FAST') else m for m in v[slot]]
        if sorted(entry.get(slot) or []) != sorted(ids): same = False
        entry[slot] = sorted(ids) if side == 'pve' else list(ids)
    if 'ty' in v:
        if list(entry.get('ty') or []) != list(v['ty']): same = False
        entry['ty'] = list(v['ty'])
    return same


def report(name, same_keys):
    """お知らせ用の一文（情報元が追いついた行だけ）"""
    return [f'実機確認の表（verified.py）の {k} は、{name}が同じ値に追いつきました（行を消してよい）' for k in same_keys]
