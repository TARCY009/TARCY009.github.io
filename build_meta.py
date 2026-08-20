#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GBL環境上位リスト生成スクリプト
PvPokeのランキング(オープンソース・シーズンごとに更新)から
各リーグの環境上位を取り込み assets/meta_lists.js を生成する。

使い方: python3 build_meta.py
シーズンが変わったら再実行すれば最新の環境に更新される。
"""
import json
import os
import urllib.request

TOP_N = 50    # 環境一覧・パーティ診断・環境スコアが使う基準の件数(変えると環境スコアの基準が動くので固定)
EXT_N = 100   # カウンター検索の「上位100」用。51〜100位は別枠(META_EXT / cup.ext)に出す
LEAGUES = {          # 出力キー: (PvPokeのCP, 表示名)
    "1500": (1500, "スーパー"),
    "2500": (2500, "ハイパー"),
    "0":    (10000, "マスター"),
}
# 特殊カップ。いま開催されているものはカップ定義から自動で拾う(下は常設ぶんの土台)。
# 日本語名は past_cup_names.json から引く(過去のカップと同じ表記にそろえるため)
BASE_CUPS = [
    ("mega", 1500), ("mega", 2500), ("mega", 10000),
    ("premier", 10000), ("premier", 2500), ("classic", 10000),
    ("remix", 1500), ("little", 500), ("summer", 1500), ("catch", 1500),
]
# ゲーム内のカップではない(大会・コミュニティ主催)フォーマットを外すための目印
COMMUNITY = ("Devon", "Battle Frontier", "Battle Tower", "Gymbreakers", "Championship Series",
             "Invitational", "Spice Bowl", "UFC", "Zygarden", "P!P", "Continental", "Worlds",
             "ADL", "TeamUp", "Slitzko", "Faction", "Remix V2", "Silph", "GO Stadium",
             "Draft League", "San Benedetto", "Arrohh")
URL_FORMATS = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/formats.json"

URL = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-{cp}.json"
URL_CUP = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/{cup}/overall/rankings-{cp}.json"

with open("pvp_data.json", encoding="utf-8") as f:
    PVP = json.load(f)
POKE = PVP["pokemon"]
MOVES = PVP["moves"]


def fetch(cp):
    with urllib.request.urlopen(URL.format(cp=cp), timeout=30) as r:
        return json.load(r)


def convert(entry):
    """PvPokeの1件をこのツールのキー形式に変換。対象外ならNone"""
    sid = entry["speciesId"]
    shadow = sid.endswith("_shadow")
    key = sid[:-7] if shadow else sid
    if key not in POKE:
        return None
    p = POKE[key]
    ms = entry.get("moveset", [])
    fast = ms[0] if len(ms) > 0 and ms[0] in MOVES else None
    c1 = ms[1] if len(ms) > 1 and ms[1] in MOVES else None
    c2 = ms[2] if len(ms) > 2 and ms[2] in MOVES else None
    out = {"k": key, "n": ("シャドウ" if shadow else "") + p["n"]}
    if shadow:
        out["s"] = 1
    if fast:
        out["f"] = fast
    if c1:
        out["c1"] = c1
    if c2:
        out["c2"] = c2
    return out


meta = {}
meta_ext = {}
for lg, (cp, label) in LEAGUES.items():
    rows = fetch(cp)
    picked, skipped = [], []
    for e in rows:
        if len(picked) >= EXT_N:
            break
        c = convert(e)
        if c is None:
            skipped.append(e["speciesId"])
            continue
        picked.append(c)
    meta[lg] = picked[:TOP_N]
    meta_ext[lg] = picked[TOP_N:]
    print(f"{label}(CP{cp}): {len(meta[lg])}匹採用(+拡張{len(meta_ext[lg])}匹) / 変換不可 {len(skipped)}件 {skipped[:5]}")

def build_cup_list():
    """いま開催中のカップ + 常設ぶん を、日本語名つきで並べる"""
    names = {}
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "past_cup_names.json"), encoding="utf-8") as f:
            names = json.load(f)
    except FileNotFoundError:
        print("past_cup_names.json が見つからないので英語名で出す")
    live, titles = [], {}
    try:
        with urllib.request.urlopen(URL_FORMATS, timeout=30) as r:
            for f in json.load(r):
                slug, cp = f.get("cup"), f.get("cp")
                if not slug or slug == "custom" or not cp:
                    continue
                t = f.get("title", "")
                titles[f"{slug}-{cp}"] = t
                if any(c.lower() in t.lower() for c in COMMUNITY):
                    continue          # ゲーム内のカップではないので出さない
                live.append((slug, cp))
    except Exception as e:
        print(f"カップ定義が取れなかったので常設ぶんだけ出す ({e})")
    out, seen = [], set()
    for slug, cp in live + BASE_CUPS:
        key = f"{slug}-{cp}"
        if key in seen:
            continue
        seen.add(key)
        out.append((slug, cp, names.get(key) or titles.get(key) or key))
    return out


def fetch_cup(cup, cp):
    with urllib.request.urlopen(URL_CUP.format(cup=cup, cp=cp), timeout=30) as r:
        return json.load(r)


cups_out = []
for slug, cp, label in build_cup_list():
    try:
        rows = fetch_cup(slug, cp)
    except Exception as e:
        print(f"{label}: データなし→スキップ ({e})")
        continue
    picked = []
    for e in rows:
        if len(picked) >= EXT_N:
            break
        c = convert(e)
        if c is not None:
            picked.append(c)
    cups_out.append({"slug": f"{slug}-{cp}", "label": label, "cp": cp,
                     "list": picked[:TOP_N], "ext": picked[TOP_N:]})
    print(f"{label}(CP{cp}): {len(picked[:TOP_N])}匹採用(+拡張{len(picked[TOP_N:])}匹)")

with open("assets/meta_lists.js", "w", encoding="utf-8") as f:
    f.write("// 環境上位リスト。build_meta.py で再生成する\n")
    f.write("// META_LISTS=上位50(環境一覧・パーティ診断・環境スコアの基準) / META_EXT=51〜100位(カウンター検索の「上位100」専用)\n")
    f.write("window.META_LISTS = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
    f.write("window.META_EXT = " + json.dumps(meta_ext, ensure_ascii=False, separators=(",", ":")) + ";\n")
    f.write("window.CUP_LISTS = " + json.dumps(cups_out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("assets/meta_lists.js を出力した")
