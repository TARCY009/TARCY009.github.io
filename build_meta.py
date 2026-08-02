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
import urllib.request

TOP_N = 50
LEAGUES = {          # 出力キー: (PvPokeのCP, 表示名)
    "1500": (1500, "スーパー"),
    "2500": (2500, "ハイパー"),
    "0":    (10000, "マスター"),
}
# 特殊カップ(スラッグ, CP上限, 日本語名)。PvPoke側にデータが無いものは自動でスキップされる
CUPS = [
    ("premier", 10000, "マスタープレミア"),
    ("premier", 2500, "ハイパープレミア"),
    ("classic", 10000, "マスタークラシック"),
    ("remix", 1500, "スーパーリミックス"),
    ("little", 500, "リトルカップ"),
    ("summer", 1500, "サマーカップ"),
    ("catch", 1500, "キャッチカップ"),
]
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
for lg, (cp, label) in LEAGUES.items():
    rows = fetch(cp)
    picked, skipped = [], []
    for e in rows:
        if len(picked) >= TOP_N:
            break
        c = convert(e)
        if c is None:
            skipped.append(e["speciesId"])
            continue
        picked.append(c)
    meta[lg] = picked
    print(f"{label}(CP{cp}): {len(picked)}匹採用 / 変換不可 {len(skipped)}件 {skipped[:5]}")

def fetch_cup(cup, cp):
    with urllib.request.urlopen(URL_CUP.format(cup=cup, cp=cp), timeout=30) as r:
        return json.load(r)


cups_out = []
for slug, cp, label in CUPS:
    try:
        rows = fetch_cup(slug, cp)
    except Exception as e:
        print(f"{label}: データなし→スキップ ({e})")
        continue
    picked = []
    for e in rows:
        if len(picked) >= TOP_N:
            break
        c = convert(e)
        if c is not None:
            picked.append(c)
    cups_out.append({"slug": f"{slug}-{cp}", "label": label, "cp": cp, "list": picked})
    print(f"{label}(CP{cp}): {len(picked)}匹採用")

with open("assets/meta_lists.js", "w", encoding="utf-8") as f:
    f.write("// 環境上位リスト(PvPokeランキング由来)。build_meta.py で再生成する\n")
    f.write("window.META_LISTS = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
    f.write("window.CUP_LISTS = " + json.dumps(cups_out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("assets/meta_lists.js を出力した")
