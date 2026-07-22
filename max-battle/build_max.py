# -*- coding: utf-8 -*-
"""
マックスバトル対策ツール データ生成スクリプト
============================================
PokeMiners の Game Master (latest.json) から
  1) ダイマックス実装済みロースター  (breadOverrides を持つ種)
  2) キョダイマックス実装済みロースター (BREAD_SHARED_SETTINGS.allowedSourdoughPokemon)
  3) キョダイマックスわざの固有タイプ  (SOURDOUGH_MOVE_MAPPING_SETTINGS + VN_BM_* move)
を自動抽出し、既存の gym_data.json (日本語名・種族値) と突き合わせて
data/max_data.js を生成する。

新規ポケモンが実装されると Game Master に反映されるため、
本スクリプトの再実行(GitHub Actions の update-data.yml から呼び出し)で
ロースターが自動更新される。

特例(ユーザー指定):
  - ムゲンダイナ                 : マックスわざ最大威力 450 (キョダイ扱い) / タイプ固定ドラゴン
  - ザシアン(けんのおう)         : 最大威力 350 / タイプ固定はがね
  - ザマゼンタ(たてのおう)       : 最大威力 350 / タイプ固定はがね
"""

import json, re, sys, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
GM_URL = "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json"
GM_LOCAL = os.path.join(HERE, "latest.json")
GYM_DATA = os.path.join(HERE, "..", "gym-attack", "data", "gym_data.json")
GYM_DATA_FALLBACK = os.path.join(HERE, "gym_data.json")
OUT = os.path.join(HERE, "data", "max_data.js")

# ---- 手動オーバーライド(実ゲームと Game Master の乖離対策) -----------------
# Game Master に先行収録されているが未実装、等の場合にここへ追加する
MANUAL_EXCLUDE = set([
    # 例: ("MEOWTH", "MEOWTH_GALARIAN"),
])
# GM未反映の新規実装ダイマックスをここへ追加 (pokemonId)
MANUAL_INCLUDE_D = [
    "HYDREIGON",        # サザンドラ (2026-07-19実装、GM未反映。進化前2種は最終進化フィルタで除外)
    "ELECTIVIRE",       # エレキブル (実装済み、GM未反映。2026-07-21本人指摘)
    # ニャース3種(D実装済み)の進化先。GMに視覚データ登録がないため手動追加
    "PERSIAN",          # ペルシアン
    "PERSIAN_ALOLA",    # ペルシアン(アローラ)
    "PERRSERKER",       # ニャイキング
]

# ---- キョダイマックス実装済みホワイトリスト --------------------------------
# Game Master の allowedSourdoughPokemon は未実装分を先行収録しているため、
# 実装済みのみをここで管理する (新規実装時に1行追加)。
# 以下18種 (2026-07-20 本人確認: ダストダス実装済み、オーロンゲ実装済み)
RELEASED_GMAX = set([
    "VENUSAUR", "CHARIZARD", "BLASTOISE", "BUTTERFREE", "PIKACHU", "EEVEE",
    "MEOWTH", "MACHAMP", "GENGAR", "KINGLER", "LAPRAS", "SNORLAX",
    "TOXTRICITY", "RILLABOOM", "CINDERACE", "INTELEON", "GARBODOR",
    "GRIMMSNARL",
])

# ---- タイプ定義 (gym_data.json の types_jp と同順) -------------------------
TYPE_ORDER = ["NORMAL","FIGHTING","FLYING","POISON","GROUND","ROCK","BUG","GHOST",
              "STEEL","FIRE","WATER","GRASS","ELECTRIC","PSYCHIC","ICE","DRAGON",
              "DARK","FAIRY"]
T_IDX = {t: i for i, t in enumerate(TYPE_ORDER)}

# タイプ別の汎用マックスわざ(ダイマックス勢: ノーマルアタックのタイプで決定)
GENERIC_MAX_JP = {
    "NORMAL":"ダイアタック","FIGHTING":"ダイナックル","FLYING":"ダイジェット",
    "POISON":"ダイアシッド","GROUND":"ダイアース","ROCK":"ダイロック",
    "BUG":"ダイワーム","GHOST":"ダイホロウ","STEEL":"ダイスチル",
    "FIRE":"ダイバーン","WATER":"ダイストリーム","GRASS":"ダイソウゲン",
    "ELECTRIC":"ダイサンダー","PSYCHIC":"ダイサイコ","ICE":"ダイアイス",
    "DRAGON":"ダイドラグーン","DARK":"ダイアーク","FAIRY":"ダイフェアリー",
}

# キョダイマックスわざ日本語名 (Game Master の vfxName キー)
GMAX_JP = {
    "gmax_vinelash":"キョダイベンタツ","gmax_wildfire":"キョダイゴクエン",
    "gmax_cannonade":"キョダイホウゲキ","gmax_befuddle":"キョダイコワク",
    "gmax_voltcrash":"キョダイバンライ","gmax_goldrush":"キョダイコバン",
    "gmax_chistrike":"キョダイシンゲキ","gmax_terror":"キョダイゲンエイ",
    "gmax_foamburst":"キョダイホウマツ","gmax_resonance":"キョダイセンリツ",
    "gmax_cuddle":"キョダイホーヨー","gmax_replenish":"キョダイサイセイ",
    "gmax_malodor":"キョダイシュウキ","gmax_meltdown":"キョダイユウゲキ",
    "gmax_drumsolo":"キョダイコランダ","gmax_fireball":"キョダイカキュウ",
    "gmax_hydrosnipe":"キョダイソゲキ","gmax_windrage":"キョダイフウゲキ",
    "gmax_gravitas":"キョダイテンドウ","gmax_stonesurge":"キョダイガンジン",
    "gmax_volcalith":"キョダイフンセキ","gmax_tartness":"キョダイサンゲキ",
    "gmax_sweetness":"キョダイカンロ","gmax_sandblast":"キョダイサジン",
    "gmax_stun_shock":"キョダイカンデン","gmax_centiferno":"キョダイヒャッカ",
    "gmax_smite":"キョダイテンバツ","gmax_snooze":"キョダイスイマ",
    "gmax_finale":"キョダイダンエン","gmax_steelsurge":"キョダイコウジン",
    "gmax_depletion":"キョダイゲンスイ","gmax_oneblow":"キョダイイチゲキ",
    "gmax_rapidflow":"キョダイレンゲキ",
    # 特例3体の専用マックスわざ (仮称: 実ゲーム内表記の確認待ち)
    "max_behemoth_blade":"きょじゅうざん(マックス)",
    "max_behemoth_bash":"きょじゅうだん(マックス)",
    "max_dynamax_cannon":"ダイマックスほう(マックス)",
}

# 2026-06シーズン「新たな歩み」の新規習得技。Game Master/gym_data未反映のため手動補完。
# 出典: https://pokemongo.com/ja/news/go-battle-league-forever-forward
# キーは gym_data の表示名。q=ノーマルアタック / c=スペシャルアタック
SEASON_MOVE_FIX = {
    "ピジョット":   {"c": ["TWISTER"]},
    "マンタイン":   {"c": ["TWISTER"]},
    "カクレオン":   {"c": ["THUNDER_PUNCH", "DYNAMIC_PUNCH"]},
    "ミミロップ":   {"c": ["THUNDER_PUNCH", "SHADOW_BALL"]},
    "メルメタル":   {"c": ["DYNAMIC_PUNCH"]},
    "レディアン":   {"q": ["ROLLOUT_FAST"], "c": ["ACROBATICS"]},
    "ガマゲロゲ":   {"c": ["ICY_WIND"]},
    "ヌメイル":     {"q": ["DRAGON_BREATH_FAST"], "c": ["BODY_SLAM"]},
    "スターミー":   {"c": ["AQUA_JET"]},
    "カブトプス":   {"c": ["AQUA_JET"]},
    "スワンナ":     {"q": ["GUST_FAST"], "c": ["AQUA_JET"]},
    "キングドラ":   {"c": ["SURF"]},
    "ネイティオ":   {"c": ["SHADOW_BALL"]},
    "ハリーセン":   {"c": ["SHADOW_BALL"]},
    "ニンフィア":   {"q": ["FAIRY_WIND_FAST"], "c": ["SHADOW_BALL"]},
    "ドサイドン":   {"c": ["DRILL_RUN"]},
    "フレフワン":   {"q": ["FAIRY_WIND_FAST"]},
    "ローブシン":   {"q": ["FORCE_PALM_FAST"]},
    "ガラルサンダー": {"q": ["LOW_KICK_FAST"]},
    "ウェーニバル": {"q": ["LOW_KICK_FAST"]},
    "ギガイアス":   {"q": ["LOCK_ON_FAST"]},
}

# gym_data.json に未収録の種の日本語名フォールバック (dex -> 名前)
NAME_FALLBACK = {
    834: "カジリガメ",
    869: "マホイップ",
    879: "ダイオウドウ",
}

# 特例3体 (ユーザー指定仕様)
SPECIALS = {
    ("ZACIAN","ZACIAN_CROWNED_SWORD"):    {"power": 350, "cat": "S350"},
    ("ZAMAZENTA","ZAMAZENTA_CROWNED_SHIELD"): {"power": 350, "cat": "S350"},
    ("ETERNATUS","ETERNATUS_NORMAL"):     {"power": 450, "cat": "S450"},
}


def has_real_evolution(ps):
    """さらに進化できるか(メガシンカ等の一時進化はevolutionBranchに
    temporaryEvolutionとして入るため除外して判定)"""
    for b in (ps.get("evolutionBranch") or []):
        if "temporaryEvolution" not in b:
            return True
    return False


def load_gm():
    # 通常は毎回最新を取得(自動更新用)。開発時のみ --local でキャッシュ利用
    if "--local" not in sys.argv or not os.path.exists(GM_LOCAL):
        print("downloading Game Master ...")
        urllib.request.urlretrieve(GM_URL, GM_LOCAL)
    with open(GM_LOCAL, encoding="utf-8") as f:
        return json.load(f)


def load_gym():
    path = GYM_DATA if os.path.exists(GYM_DATA) else GYM_DATA_FALLBACK
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    gm = load_gm()
    gym = load_gym()

    # 新シーズン習得技を gym_data 側の学習セットへマージ
    fixed = set()
    for p in gym["pokemon"]:
        fix = SEASON_MOVE_FIX.get(p["name"])
        if not fix:
            continue
        for mv in fix.get("q", []):
            if mv not in (p.get("fast") or []):
                p.setdefault("fast", []).append(mv)
        for mv in fix.get("c", []):
            if mv not in (p.get("charged") or []):
                p.setdefault("charged", []).append(mv)
        fixed.add(p["name"])
    miss = set(SEASON_MOVE_FIX) - fixed
    if miss:
        print("警告: SEASON_MOVE_FIX 未適用 →", sorted(miss))

    # ---- move templates ---------------------------------------------------
    # 通常わざ (タイプ参照用) と VN_BM_* (マックスわざ) を収集
    move_type = {}      # "VINE_WHIP_FAST" -> "GRASS"
    bm_moves = {}       # "VN_BM_019" -> {"type":"FIRE","vfx":"gmax_wildfire"}
    for t in gm:
        tid = t.get("templateId", "")
        d = t.get("data", {})
        ms = d.get("moveSettings")
        if not ms:
            continue
        ptype = str(ms.get("pokemonType", "")).replace("POKEMON_TYPE_", "")
        if tid.startswith("VN_BM_"):
            bm_moves[tid] = {"type": ptype, "vfx": ms.get("vfxName", "")}
        else:
            m = re.match(r"^V\d{4}_MOVE_(.+)$", tid)
            if m:
                move_type[m.group(1)] = ptype

    # ---- pokemonSettings (種族値・タイプ・技) ------------------------------
    poke = {}           # templateId(without EXTENDED_) -> settings
    for t in gm:
        tid = t.get("templateId", "")
        d = t.get("data", {})
        ps = d.get("pokemonSettings")
        if ps and re.match(r"^V\d{4}_POKEMON_", tid):
            poke[tid] = ps

    # ---- 1) ダイマックス勢: breadOverrides 検出 ----------------------------
    dmax_forms = set()  # settings templateId
    for t in gm:
        tid = t.get("templateId", "")
        d = t.get("data", {})
        pes = d.get("pokemonExtendedSettings")
        if not pes:
            continue
        if "breadOverrides" not in json.dumps(pes):
            continue
        base = tid.replace("EXTENDED_", "")
        if base in poke:
            dmax_forms.add(base)

    # 同種の「無印」テンプレは、フォルム付きテンプレが存在する場合に除去
    drop = set()
    for tid in dmax_forms:
        for other in dmax_forms:
            if other != tid and other.startswith(tid + "_"):
                drop.add(tid)
                break
    dmax_forms -= drop

    # ---- 2) キョダイマックス勢: allowedSourdoughPokemon --------------------
    gmax_forms = []     # (pokemonId, form)
    for t in gm:
        if t.get("templateId") == "BREAD_SHARED_SETTINGS":
            bs = t["data"]["breadSettings"]
            for e in bs.get("allowedSourdoughPokemon", []):
                pid = e["pokemonId"]
                for f in e.get("form", ["FORM_UNSET"]):
                    gmax_forms.append((pid, f))

    # ---- 3) キョダイマックスわざ対応表 ------------------------------------
    sour_map = {}       # (pokemonId, form) -> VN_BM id
    for t in gm:
        if t.get("templateId") == "SOURDOUGH_MOVE_MAPPING_SETTINGS":
            for m in t["data"]["sourdoughMoveMappingSettings"]["mappings"]:
                sour_map[(m["pokemonId"], m.get("form", "FORM_UNSET"))] = m["move"]

    # ---- gym_data 突き合わせ (日本語名) ------------------------------------
    def jp_lookup(dex, types_idx, atk):
        cands = [p for p in gym["pokemon"]
                 if p["dex"] == dex and sorted(p["types"]) == sorted(types_idx)]
        if len(cands) == 1:
            return cands[0]
        cands2 = [p for p in cands if p["atk"] == atk]
        if len(cands2) >= 1:
            return cands2[0]
        return cands[0] if cands else None

    unmatched, report = [], []

    def settings_to_entry(tid, ps, cat, fixed=None, gname=None):
        dex = int(re.match(r"^V(\d{4})_", tid).group(1))
        types = [ps.get("type"), ps.get("type2")]
        types_idx = [T_IDX[t.replace("POKEMON_TYPE_", "")] for t in types if t]
        stats = ps.get("stats", {})
        atk = stats.get("baseAttack")
        if atk is None:
            return None
        jp = jp_lookup(dex, types_idx, atk)
        if jp:
            name = jp["name"]
        elif dex in NAME_FALLBACK:
            name = NAME_FALLBACK[dex]
        else:
            name = tid.split("_POKEMON_")[1]
            unmatched.append(tid)
        fasts = []
        for q in (ps.get("quickMoves", []) or []):
            ty = move_type.get(q)
            if ty in T_IDX:
                mj = gym["moves"].get(q, {})
                f = {"jp": mj.get("jp", q), "t": T_IDX[ty], "e": 0,
                     "p": mj.get("power", 0)}
                if mj.get("dur") == 500:
                    f["q"] = 1  # 0.5秒技
                fasts.append(f)
        for q in (ps.get("eliteQuickMove", []) or []):
            ty = move_type.get(q)
            if ty in T_IDX:
                mj = gym["moves"].get(q, {})
                f = {"jp": mj.get("jp", q), "t": T_IDX[ty], "e": 1,
                     "p": mj.get("power", 0)}
                if mj.get("dur") == 500:
                    f["q"] = 1
                fasts.append(f)
        # 新シーズン習得のノーマルアタックを補完(GM未反映分)
        fix = SEASON_MOVE_FIX.get(name)
        if fix:
            have = {(f["jp"], f["t"]) for f in fasts}
            for mv in fix.get("q", []):
                mj = gym["moves"].get(mv)
                if not mj:
                    continue
                f = {"jp": mj["jp"], "t": mj["type"], "e": 0, "p": mj.get("power", 0)}
                if mj.get("dur") == 500:
                    f["q"] = 1
                if (f["jp"], f["t"]) not in have:
                    fasts.append(f)
        entry = {"n": name, "dex": dex, "ty": types_idx, "atk": atk,
                 "df": stats.get("baseDefense"), "st": stats.get("baseStamina"),
                 "cat": cat}
        # タンク評価用: ノーマルアタック一覧はカテゴリ問わず持たせる
        entry["fm"] = fasts
        if cat != "D":
            entry["ft"] = T_IDX[fixed]
            entry["gm"] = gname
        return entry

    entries = []

    # ダイマックス勢 (350 / ノーマルアタック依存)
    for tid in sorted(dmax_forms):
        pid_form = tid.split("_POKEMON_")[1]
        sp = poke[tid]
        pid = sp.get("pokemonId", pid_form)
        if (pid, pid_form) in MANUAL_EXCLUDE:
            continue
        # 特例3体・ムゲンダイマックスは D として出さない
        if pid in ("ZACIAN", "ZAMAZENTA", "ETERNATUS"):
            continue
        # 進化前(まだ進化先がある)はランキング対象外
        # ※キョダイマックス勢は進化できないため除外しない(ピカチュウ等はGで収録)
        # ※メガシンカは一時進化のため進化前扱いにしない
        if has_real_evolution(sp):
            continue
        e = settings_to_entry(tid, sp, "D")
        if e:
            entries.append(e)
            report.append(("D", e["n"]))

    # GM未反映の新規実装ダイマックス (MANUAL_INCLUDE_D)
    for pid in MANUAL_INCLUDE_D:
        cand = None
        for tid, ps in poke.items():
            if (tid.endswith("_POKEMON_" + pid) or
                tid.endswith("_POKEMON_" + pid + "_NORMAL")):
                cand = (tid, ps)
                if tid.endswith("_NORMAL"):
                    break
        if not cand:
            report.append(("D?", f"{pid} (settings なし)"))
            continue
        if has_real_evolution(cand[1]):
            continue  # 進化前は対象外
        e = settings_to_entry(cand[0], cand[1], "D")
        if e:
            entries.append(e)
            report.append(("D", e["n"] + " (手動追加)"))

    # キョダイマックス勢 (450 / タイプ固定) — 実装済みホワイトリストで絞り込み
    for (pid, form) in gmax_forms:
        if pid not in RELEASED_GMAX:
            report.append(("G未実装", pid))
            continue
        key = (pid, form)
        mv = sour_map.get(key) or sour_map.get((pid, "FORM_UNSET"))
        if not mv:
            report.append(("G?", f"{pid}/{form} (わざ対応なし)"))
            continue
        info = bm_moves.get(mv, {})
        ftype, vfx = info.get("type"), info.get("vfx")
        # settings template を探す
        cand = None
        for tid, ps in poke.items():
            if ps.get("pokemonId") == pid and (
                tid.endswith("_" + form) or
                (form == "FORM_UNSET" and re.match(r"^V\d{4}_POKEMON_" + re.escape(pid) + r"(_NORMAL)?$", tid))):
                cand = (tid, ps)
                if tid.endswith("_NORMAL") or tid.endswith("_" + form):
                    break
        if not cand:
            report.append(("G?", f"{pid}/{form} (settings なし)"))
            continue
        e = settings_to_entry(cand[0], cand[1], "G", fixed=ftype, gname=GMAX_JP.get(vfx, vfx))
        if e:
            entries.append(e)
            report.append(("G", e["n"]))

    # 特例3体
    for (pid, form), spec in SPECIALS.items():
        mv = sour_map.get((pid, form))
        info = bm_moves.get(mv, {}) if mv else {}
        ftype, vfx = info.get("type"), info.get("vfx")
        cand = None
        for tid, ps in poke.items():
            if ps.get("pokemonId") == pid and tid.endswith("_" + form):
                cand = (tid, ps); break
        if not cand and form.endswith("_NORMAL"):
            for tid, ps in poke.items():
                if ps.get("pokemonId") == pid and re.match(r"^V\d{4}_POKEMON_" + re.escape(pid) + r"$", tid):
                    cand = (tid, ps); break
        if not cand:
            report.append(("S?", f"{pid}/{form} (settings なし)"))
            continue
        e = settings_to_entry(cand[0], cand[1], spec["cat"],
                              fixed=ftype or "STEEL", gname=GMAX_JP.get(vfx, vfx))
        if e:
            if pid == "ZAMAZENTA":
                e["wall"] = 1  # ウォールアンロック時、開始時に盾1枚(+60HP換算)
            entries.append(e)
            report.append((spec["cat"], e["n"]))

    # ---- 重複マージ (色違いテンプレ・同名同性能フォルム対策) ----------------
    merged, seen = [], {}
    for e in entries:
        key = (e["n"], e["cat"], e.get("ft"), e.get("gm"), e["atk"], tuple(sorted(e["ty"])))
        if key in seen:
            if "fm" in e:
                base = seen[key]
                have = {(f["jp"], f["t"]) for f in base.get("fm", [])}
                for f in e["fm"]:
                    if (f["jp"], f["t"]) not in have:
                        base.setdefault("fm", []).append(f)
            continue
        seen[key] = e
        merged.append(e)
    entries = merged

    # ---- 表記オーバーライド -------------------------------------------------
    # ストリンダーはハイなすがた/ローなすがたで見た目のみ異なり性能は同一
    NAME_OVERRIDE = {"ストリンダー": "ストリンダー(ハイ&ロー)"}
    for e in entries:
        if e["n"] in NAME_OVERRIDE:
            e["n"] = NAME_OVERRIDE[e["n"]]

    # ---- 出力 --------------------------------------------------------------
    # ボス候補からコスチューム個体を除外
    # (コスチュームは括弧内が英数字表記。フォルム違いは日本語表記のため影響なし)
    costume_pat = re.compile(r"\([A-Za-z0-9 ._\-]+\)$")
    boss_list = [p for p in gym["pokemon"] if not costume_pat.search(p["name"])]
    # ボスの技: マックスバトルでは全スペシャルアタック(特別技・レガシー含む)を
    # 打ってくる可能性がある(ノーマルアタックは打ってこない)
    cmove_keys, cmove_idx = [], {}
    def cm_index(key):
        if key not in cmove_idx:
            cmove_idx[key] = len(cmove_keys)
            cmove_keys.append(key)
        return cmove_idx[key]
    boss_cm = {}
    for p in boss_list:
        ids = []
        for key in p.get("charged", []) or []:
            mj = gym["moves"].get(key)
            if not mj or mj.get("fast"):
                continue
            if mj.get("type") is None or mj.get("power") is None:
                continue
            ids.append(cm_index(key))
        boss_cm[id(p)] = ids
    cmoves_out = []
    for key in cmove_keys:
        mj = gym["moves"][key]
        cmoves_out.append({"jp": mj["jp"], "t": mj["type"], "p": mj["power"]})
    for p in boss_list:
        if p["name"] == "ストリンダー":
            p["name"] = "ストリンダー(ハイ&ロー)"
    out = {
        "generated": True,
        "types_jp": gym["types_jp"],
        "chart": gym["chart"],
        "cpm50": gym["cpm"]["50"],
        "power": {"D": 350, "G": 450, "S350": 350, "S450": 450},
        "stab": 1.2,
        "generic_max_jp": {str(T_IDX[k]): v for k, v in GENERIC_MAX_JP.items()},
        "roster": entries,
        "bosses": [{"n": p["name"], "dex": p["dex"], "ty": p["types"],
                    "cm": boss_cm[id(p)]}
                   for p in boss_list],
        "cmoves": cmoves_out,
        "wall_hp": 60,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("const MAX_DATA = ")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # ---- レポート ----------------------------------------------------------
    d_cnt = sum(1 for c, _ in report if c == "D")
    g_cnt = sum(1 for c, _ in report if c == "G")
    s_cnt = sum(1 for c, _ in report if c.startswith("S") and not c.endswith("?"))
    print(f"OK: D(ダイマックス)={d_cnt} / G(キョダイマックス)={g_cnt} / 特例={s_cnt}")
    if unmatched:
        print("日本語名が引けなかったもの:", unmatched)
    warn = [r for r in report if r[0].endswith("?")]
    if warn:
        print("警告:", warn)


if __name__ == "__main__":
    main()
