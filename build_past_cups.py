#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
過去の特殊カップ環境アーカイブ生成スクリプト

環境上位リストの提供元は、カップが終わるとそのカップのフォルダを消してしまうが、
リポジトリの履歴には最後に開催されたときのリストがそのまま残っている。
そこから「そのカップが最後に開催されたときの環境上位100匹」を取り出して
assets/meta_past.js を作る。

過去のぶんは中身が変わらないので、一度作ったら作り直す必要はない。
新しくカップが終わったときだけ、再実行すれば追加される。

使い方: python3 build_past_cups.py [作業用ディレクトリ]
"""
import json
import os
import re
import subprocess
import sys

WORK = sys.argv[1] if len(sys.argv) > 1 else "/tmp/pvpoke-archive"
SRC = "https://github.com/pvpoke/pvpoke.git"
FORMATS = "src/data/gamemaster/formats.json"
REF = "origin/master"   # 展開せずに最新の履歴を見るための参照先
TOP_N, EXT_N = 50, 100

# 大会・コミュニティ主催のフォーマット(ゲーム内のカップではない)を除くための目印
COMMUNITY = ("Devon", "Battle Frontier", "Battle Tower", "Gymbreakers", "Championship Series",
             "Invitational", "Spice Bowl", "UFC", "Zygarden", "P!P", "Continental", "Worlds",
             "ADL", "TeamUp", "Slitzko", "Faction", "Remix V2", "Silph", "GO Stadium",
             "Draft League", "San Benedetto", "Arrohh")

# 日本語名。ここに無いカップは英語名のまま出す(あとで足せる)
NAMES = {}
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "past_cup_names.json"),
              encoding="utf-8") as f:
        NAMES = json.load(f)
except FileNotFoundError:
    pass


def git(*args, repo=None):
    r = subprocess.run(["git", "-C", repo or WORK] + list(args),
                       capture_output=True, text=True)
    return r.stdout


def prepare():
    """履歴だけの軽い複製を用意する(中身は必要なぶんだけ取りに行く)"""
    if os.path.isdir(os.path.join(WORK, ".git")):
        print(f"作業用の複製を更新: {WORK}")
        git("fetch", "--quiet", "origin")   # 展開はしない(ファイルの中身は必要なぶんだけ取る)
        return
    print(f"作業用の複製を作成: {WORK}")
    subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", "--quiet", SRC, WORK],
                   check=True)


def load_formats():
    """カップ定義の全履歴から スラッグ+CP → 英語名・参加条件 を集める"""
    vers = [l.split("|") for l in
            git("log", REF, "--format=%H|%cs", "--", FORMATS).strip().split("\n") if l]
    out, read = {}, 0
    for sha, date in vers:
        txt = git("show", f"{sha}:{FORMATS}")
        if not txt.strip():
            continue
        try:
            data = json.loads(txt)
        except json.JSONDecodeError:
            continue
        read += 1
        for f in data:
            cup = f.get("cup")
            if not cup or cup == "custom":
                continue
            key = f"{cup}|{f.get('cp')}"
            e = out.setdefault(key, {"title": "", "rules": []})
            e["title"] = e["title"] or f.get("title", "")
            if f.get("rules") and not e["rules"]:
                e["rules"] = f["rules"]
    print(f"カップ定義 {read}/{len(vers)} 版を読んで {len(out)} フォーマット")
    return out


def load_finals():
    """ランキングごとに「中身が残っている最後のコミット」を特定する"""
    log = git("log", REF, "--full-history", "--name-status", "--format=@%H %cs",
              "--", "src/data/rankings")
    finals, sha, date = {}, None, None
    for line in log.split("\n"):
        if line.startswith("@"):
            sha, date = line[1:].split(" ")
        elif line[:1] in ("A", "M") and "/overall/rankings-" in line:
            path = line.split("\t")[-1]
            finals.setdefault(path, (sha, date))
    return finals


def convert(entry, poke, moves):
    sid = entry["speciesId"]
    shadow = sid.endswith("_shadow")
    key = sid[:-7] if shadow else sid
    if key not in poke:
        return None
    ms = entry.get("moveset", [])
    out = {"k": key, "n": ("シャドウ" if shadow else "") + poke[key]["n"]}
    if shadow:
        out["s"] = 1
    for i, name in ((0, "f"), (1, "c1"), (2, "c2")):
        if len(ms) > i and ms[i] in moves:
            out[name] = ms[i]
    return out


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(root, "pvp_data.json"), encoding="utf-8") as f:
        pvp = json.load(f)
    poke, moves = pvp["pokemon"], pvp["moves"]

    prepare()
    formats = load_formats()
    finals = load_finals()

    cups, skipped = [], []
    for path, (sha, date) in finals.items():
        m = re.match(r"src/data/rankings/(.+)/overall/rankings-(\d+)\.json$", path)
        if not m:
            continue
        slug, cp = m.group(1), int(m.group(2))
        if slug == "all":
            continue
        f = formats.get(f"{slug}|{cp}", {})
        title = f.get("title", "")
        if not title:
            skipped.append(f"{slug}-{cp}(名前不明)")
            continue
        if any(c.lower() in title.lower() for c in COMMUNITY):
            continue                      # ゲーム内のカップではないので入れない
        txt = git("show", f"{sha}:{path}")
        if not txt.strip():
            skipped.append(f"{slug}-{cp}(取得失敗)")
            continue
        rows = json.loads(txt)
        picked, ng = [], 0
        for e in rows:
            if len(picked) >= EXT_N:
                break
            c = convert(e, poke, moves)
            if c is None:
                ng += 1
            else:
                picked.append(c)
        if len(picked) < 10:
            skipped.append(f"{slug}-{cp}(件数不足 {len(picked)})")
            continue
        key = f"{slug}-{cp}"
        cups.append({"slug": key, "label": NAMES.get(key, title), "en": title, "cp": cp,
                     "ym": date[:7], "rules": f.get("rules", []),
                     "list": picked[:TOP_N], "ext": picked[TOP_N:]})
        print(f"{date[:7]}  {key:<22}{len(picked):>3}匹 (変換不可{ng})  {NAMES.get(key, title)}")

    cups.sort(key=lambda c: c["ym"], reverse=True)
    out = os.path.join(root, "assets", "meta_past.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// 過去の特殊カップ環境。build_past_cups.py で生成する(過去のぶんは中身が変わらない)\n")
        f.write("// ym=そのカップが最後に開催された時期 / list=上位50 / ext=51〜100位\n")
        f.write("window.PAST_CUPS = " + json.dumps(cups, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"\n{len(cups)}カップを {out} に出力 ({os.path.getsize(out)//1024}KB)")
    if skipped:
        print(f"入れなかったもの {len(skipped)}件: {skipped[:8]}")


if __name__ == "__main__":
    main()
