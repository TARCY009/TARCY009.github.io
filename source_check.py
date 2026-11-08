# -*- coding: utf-8 -*-
"""
取り寄せ先どうしの食い違いを見つける（2026-11-08タダシさん指示・取り寄せ先の改善の柱⑤）

ゲーム内データ（gm_source.py の置き場）と対戦データの情報元を、実装済みのポケモンについて比べる:
  わざの顔ぶれ／タイプの並び／種族値
新しく見つかった食い違いだけを毎朝のお知らせ（changes.md）に出す。前からあるもの（旧レガシーわざの差など）は控え
（.github/source_diff.json）に入れて二度は出さない。情報元の片方が実装前の予想のわざのまま、などに早く気づくため。
build_pvp_data.py から呼ぶ（両方のデータを持っているため）。
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, '.github', 'source_diff.json')
TY = lambda t: t.replace('POKEMON_TYPE_', '')


def _gm_index(gm):
    idx = {}
    for e in gm:
        ps = (e.get('data') or {}).get('pokemonSettings')
        if not ps or not str(e.get('templateId', '')).startswith('V0'): continue
        key = ps.get('form') or ps.get('pokemonId')
        if isinstance(key, str): idx.setdefault(key, ps)
    return idx


def _gm_of(idx, sid):
    up = sid.upper()
    for c in (up, up.replace('_ALOLAN', '_ALOLA'), up.replace('_PALDEAN', '_PALDEA'), up + '_NORMAL'):
        if c in idx: return idx[c]
    return None


def _norm(m):
    """書き方の違いをそろえる（FUTURESIGHT⇔FUTURE_SIGHT・めざめるパワー/ウェザーボールのタイプ展開・ギルガルドの独自わざ）"""
    m = m.replace('_FAST', '').replace('AEGISLASH_CHARGE_', '')
    for b in ('HIDDEN_POWER', 'WEATHER_BALL', 'TECHNO_BLAST', 'AURA_WHEEL'):
        if m.startswith(b): return b
    return m.replace('_', '')


def check(gm, pvp_pokemon, names, released, move_names=None):
    """食い違いの一覧（文字列）と、新しく見つかったものの一覧を返す。names: sid→日本語名・released: 実装済みのsid"""
    idx = _gm_index(gm)
    found = {}
    for p in pvp_pokemon:
        sid = p['speciesId']
        if sid not in released or sid.endswith('_shadow') or '_mega' in sid or sid.endswith('_primal'): continue
        if 'duplicate' in (p.get('tags') or []): continue
        g = _gm_of(idx, sid)
        if not g: continue
        nm = names.get(sid, sid)
        mn = move_names or {}
        jp = lambda ids: '・'.join(sorted(mn.get(i, i) for i in ids)) or 'なし'
        gq = {_norm(m): m for m in (g.get('quickMoves') or []) + (g.get('eliteQuickMove') or []) if isinstance(m, str)}
        gc = {_norm(m): m for m in (g.get('cinematicMoves') or []) + (g.get('eliteCinematicMove') or []) if isinstance(m, str)}
        el = p.get('eliteMoves') or []
        pq = {_norm(m): m for m in (p.get('fastMoves') or []) + [m for m in el if m in (p.get('fastMoves') or [])]}
        pc = {_norm(m): m for m in (p.get('chargedMoves') or []) + [m for m in el if m not in (p.get('fastMoves') or [])]}
        for slot, gg, pp, lab in (('q', gq, pq, 'ノーマルアタック'), ('c', gc, pc, 'SPアタック')):
            if gg and pp and set(gg) != set(pp):
                a = [pp.get(k) or gg[k].replace('_FAST', '') for k in set(gg) - set(pp)]
                b = [pp[k] for k in set(pp) - set(gg)]
                found[f'{sid}:{slot}'] = f"{nm}の{lab}: ゲーム内データだけ {jp(a)} ／ 対戦データだけ {jp(b)}"
        gt = [TY(t) for t in (g.get('type'), g.get('type2')) if t]
        pt = [t.upper() for t in p.get('types', []) if t != 'none']
        if gt and pt and gt != pt:
            from build_data import TYPE_JA
            found[f'{sid}:t'] = f"{nm}のタイプの並び: ゲーム内データ {'・'.join(TYPE_JA.get(t, t) for t in gt)} ／ 対戦データ {'・'.join(TYPE_JA.get(t, t) for t in pt)}"
        st, bs = g.get('stats') or {}, p.get('baseStats') or {}
        gs = (st.get('baseAttack'), st.get('baseDefense'), st.get('baseStamina'))
        ps_ = (bs.get('atk'), bs.get('def'), bs.get('hp'))
        if all(gs) and all(ps_) and gs != ps_:
            found[f'{sid}:s'] = f"{nm}の種族値: ゲーム内データ {gs[0]}/{gs[1]}/{gs[2]} ／ 対戦データ {ps_[0]}/{ps_[1]}/{ps_[2]}"
    try: old = json.load(open(STATE, encoding='utf-8'))
    except Exception: old = None
    new = [] if old is None else [v for k, v in sorted(found.items()) if old.get(k) != v]
    json.dump(found, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    return found, new
