# -*- coding: utf-8 -*-
"""
告知された新メガの自動先行収録（2026-11-12タダシさん承認）

公式の告知（news_auto.py）で「メガ◯◯」の初登場が決まったら、ゲーム内データ・対戦データの情報元を待たずに、
原作の種族値をGOの式で換算した値（図鑑用の pokedex/mega_preview.json・既存メガ53匹で一致を確認済み）で
レイド側（build_data.py の MANUAL_MEGA と同じ形）・対戦側（build_pvp_data.py の MANUAL_MEGA_PVP と同じ形）へ入れる。
わざは元のポケモンのものを引き継ぐ（メガの決まり）。手の表（MANUAL_MEGA / MANUAL_MEGA_PVP）に同じキーがあればそちらが優先。

実装されて情報元に入ったら自動でそちらに切り替わる（生成スクリプトが「キーが既にあれば何もしない」ため）。
そのとき換算値と確定値が違えば、生成スクリプトがお知らせ（changes.md）に出す＝実装の前後で照らし合わせる。

使い方: import mega_auto; mega_auto.pve_table() / mega_auto.pvp_table()
        python3 mega_auto.py … いま自動で入れる対象を表示
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.path.join(ROOT, 'pokedex', 'mega_preview.json')
OUT = os.path.join(ROOT, '.github', 'mega_auto.json')


def _norm(s):
    return (s or '').replace('（', '(').replace('）', ')').replace(' ', '').replace('　', '')


def _announced():
    """告知で初登場が決まったメガの名前（メガ◯◯・ゲンシ◯◯）"""
    try:
        sys.path.insert(0, ROOT)
        import news_auto
        names = set(news_auto.new_megas())
        # 情報元に載っていたメガの告知（released）も名前で拾う
        try:
            with open(os.path.join(ROOT, 'pvp_data.json'), encoding='utf-8') as f:
                pv = json.load(f)['pokemon']
        except Exception:
            pv = {}
        for k in news_auto.released_pvp():
            v = pv.get(k)
            if v and (v.get('mega') or k.endswith('_mega') or '_mega_' in k):
                names.add(v['n'])
        return {_norm(n) for n in names}
    except Exception as e:
        print('警告: 告知のメガを読めません →', e)
        return set()


def _preview():
    try:
        with open(PREVIEW, encoding='utf-8') as f:
            return json.load(f).get('pokemon') or {}
    except Exception:
        return {}


def build():
    """{'pve': {KEY: (名前, 攻, 防, HP, [タイプ], 元のKEY)}, 'pvp': {key: (…, 元のkey)}, 'missing': [名前…]}"""
    want = _announced()
    prev = _preview()
    by_name = {_norm(v['n']): (k, v) for k, v in prev.items()}
    done = set()   # もう実装済み（ゲーム内データに入っている）メガは対象外
    try:
        with open(os.path.join(ROOT, 'godata.json'), encoding='utf-8') as f:
            done = {_norm(v['n']) for v in json.load(f)['pokemon'].values()}
    except Exception:
        pass
    pve, pvp, missing = {}, {}, []
    for nm in sorted(want):
        if nm in done:
            continue
        hit = by_name.get(nm)
        if not hit:
            missing.append(nm); continue
        k, v = hit
        base = v.get('base') or re.sub(r'_(MEGA(_[XYZ])?|PRIMAL)$', '', k)
        pve[k] = (v['n'], v['a'], v['df'], v['h'], list(v['ty']), base)
        pvp[k.lower()] = (v['n'], v['a'], v['df'], v['h'], list(v['ty']), base.lower())
    return {'pve': pve, 'pvp': pvp, 'missing': missing}


_CACHE = None


def _get():
    global _CACHE
    if _CACHE is None:
        _CACHE = build()
    return _CACHE


def pve_table():
    return dict(_get()['pve'])


def pvp_table():
    return dict(_get()['pvp'])


def save():
    r = _get()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'pve': r['pve'], 'pvp': r['pvp'], 'missing': r['missing']}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    r = build()
    print(f'告知された新メガの自動先行収録: {len(r["pve"])}匹')
    for k, (nm, a, d, h, ty, base) in r['pve'].items():
        print(f'  {nm} ({k}) 攻{a} 防{d} HP{h} {"/".join(ty)} 元:{base}')
    if r['missing']:
        print('  ⚠ 換算値が無く自動では入れられない（図鑑の未実装メガに無い）:', '、'.join(r['missing']))
    save()
