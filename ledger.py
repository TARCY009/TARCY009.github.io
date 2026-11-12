# -*- coding: utf-8 -*-
"""
告知台帳（2026-11-12タダシさん承認・自動取り込みの土台）

「実装が告知された・先行して入れた」ポケモン・メガ・シャドウ・＋わざ・ダイマックス・キョダイマックスを1つの台帳にまとめる。
出どころは2つ:
  ① 公式ニュースの読み取り結果（news_auto.py → .github/official_news.json）
  ② 生成スクリプトの手の表（build_data.py / build_pvp_data.py / max-battle/build_max.py / mega_plus_info.py の MANUAL_…）
反映漏れの検査（reflect_check.py）はこの台帳を「入っているべきもの」として、各ツールのデータと突き合わせる。

使い方: python3 ledger.py        … 台帳を .github/ledger.json に書き出して一覧を表示
        import ledger; ledger.build()  … 台帳（辞書のリスト）を返す

台帳の1件: {'kind': pokemon|mega|shadow|plus|dynamax|gigantamax, 'name': 日本語名,
           'pve': ゲーム内データのキー(あれば), 'pvp': 対戦データのキー(あれば), 'source': 出どころ, 'note': 補足}
"""
import json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '.github', 'ledger.json')


def _load_json(path):
    try:
        with open(os.path.join(ROOT, path), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _names():
    """名前を引くための表: ゲーム内データ側（実装済み＋未実装の控え）と対戦データ側"""
    pve = dict(_load_json('godata.json').get('pokemon') or {})
    pve.update(_load_json('pokedex/unreleased.json').get('pokemon') or {})
    pvp = _load_json('pvp_data.json').get('pokemon') or {}
    return pve, pvp


def build():
    pve, pvp = _names()
    entries = {}

    def add(kind, name, pve_key=None, pvp_key=None, source='', note=''):
        if not name:
            return
        k = (kind, name)
        if k in entries:   # 同じ件は出どころを足すだけ
            e = entries[k]
            if source and source not in e['source']:
                e['source'] = e['source'] + '・' + source
            e['pve'] = e['pve'] or pve_key
            e['pvp'] = e['pvp'] or pvp_key
            return
        entries[k] = {'kind': kind, 'name': name, 'pve': pve_key, 'pvp': pvp_key, 'source': source, 'note': note}

    def pvp_name(key):
        return (pvp.get(key) or {}).get('n')

    def pve_name(key):
        return (pve.get(key) or {}).get('n')

    # ① 公式ニュースの読み取り結果
    try:
        sys.path.insert(0, ROOT)
        import news_auto
        arts = (news_auto.load().get('articles') or {})
    except Exception:
        arts = {}
    for slug, rec in arts.items():
        src = 'ニュース:' + slug
        for key, v in (rec.get('released') or {}).items():
            nm = v.get('name') or pvp_name(key)
            kind = 'mega' if (pvp.get(key) or {}).get('mega') or key.endswith('_mega') or '_mega_' in key else 'pokemon'
            add(kind, nm, pvp_key=key, source=src)
        for key, v in (rec.get('shadow') or {}).items():
            add('shadow', v.get('name') or pvp_name(key), pvp_key=key, source=src)
        for key, v in (rec.get('plus') or {}).items():
            add('plus', v.get('name') or pve_name(key), pve_key=key, source=src,
                note=f"{v.get('move') or ''}（元わざ {v.get('base') or ''}・レイド威力 {v.get('raid')}）")

    # ② 生成スクリプトの手の表
    try:
        import build_data as bd
        for key in bd.MANUAL_RELEASED:
            add('pokemon', pve_name(key) or key, pve_key=key, source='手の表:build_data.MANUAL_RELEASED')
        for key in bd.MANUAL_SHADOW:
            add('shadow', pve_name(key) or key, pve_key=key, source='手の表:build_data.MANUAL_SHADOW')
        for key, (nm, *_rest) in bd.MANUAL_MEGA.items():
            add('mega', nm, pve_key=key, source='手の表:build_data.MANUAL_MEGA')
        for key, (pvp_key, nm, *_rest) in bd.MANUAL_POKE.items():
            add('pokemon', nm, pve_key=key, pvp_key=pvp_key, source='手の表:build_data.MANUAL_POKE')
    except Exception as e:
        print('警告: build_data の手の表を読めません →', e)
    try:
        import build_pvp_data as bp
        for key in bp.MANUAL_RELEASED:
            kind = 'mega' if key.endswith('_mega') or '_mega_' in key else 'pokemon'
            add(kind, pvp_name(key) or key, pvp_key=key, source='手の表:build_pvp_data.MANUAL_RELEASED')
        for key in bp.MANUAL_SHADOW:
            add('shadow', pvp_name(key) or key, pvp_key=key, source='手の表:build_pvp_data.MANUAL_SHADOW')
        for key, (nm, *_rest) in bp.MANUAL_MEGA_PVP.items():
            add('mega', nm, pvp_key=key, source='手の表:build_pvp_data.MANUAL_MEGA_PVP')
    except Exception as e:
        print('警告: build_pvp_data の手の表を読めません →', e)
    try:
        sys.path.insert(0, os.path.join(ROOT, 'max-battle'))
        import build_max as bm
        for key in bm.MANUAL_INCLUDE_D:
            add('dynamax', pve_name(key) or key, pve_key=key, source='手の表:build_max.MANUAL_INCLUDE_D')
        for key in bm.MANUAL_INCLUDE_G:
            add('gigantamax', pve_name(key) or key, pve_key=key, source='手の表:build_max.MANUAL_INCLUDE_G')
    except Exception as e:
        print('警告: build_max の手の表を読めません →', e)
    try:
        import mega_plus_info as mp
        for key, row in mp.MEGA_PLUS_INFO.items():
            base, raid_pw = row[0], row[1]
            if raid_pw is None:
                continue   # 威力が分かっていないものは「入っているべき」ではない
            add('plus', pve_name(key) or key, pve_key=key, source='手の表:mega_plus_info.MEGA_PLUS_INFO',
                note=f'元わざ {base}・レイド威力 {raid_pw}')
    except Exception as e:
        print('警告: mega_plus_info の表を読めません →', e)

    order = {'pokemon': 0, 'mega': 1, 'shadow': 2, 'plus': 3, 'dynamax': 4, 'gigantamax': 5}
    return sorted(entries.values(), key=lambda e: (order.get(e['kind'], 9), e['name']))


KIND_JA = {'pokemon': '新ポケモン', 'mega': 'メガ', 'shadow': 'シャドウ', 'plus': '＋わざ',
           'dynamax': 'ダイマックス', 'gigantamax': 'キョダイマックス'}


def save(entries):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    es = build()
    save(es)
    print(f'告知台帳: {len(es)}件 → {os.path.relpath(OUT, ROOT)}')
    for e in es:
        print(f"  [{KIND_JA[e['kind']]}] {e['name']}  ({e['source']}){('  ' + e['note']) if e['note'] else ''}")
