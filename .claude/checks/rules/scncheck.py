#!/usr/bin/env python3
"""バトルルールのシナリオ検査(scn-*.js・ランダム検査は除く)を全部流し、expected/<名前>.json と突き合わせる。
使い方: python3 scncheck.py           … 答え合わせ(1つでも違えば終了コード1)
        python3 scncheck.py --update  … いまの結果を期待値として書き直す(⚠ 仕様を変えて答えが変わるときは、必ずタダシさんに確認してから)
期待値の出どころ(2026-09-22): .claude/rules/gbl.md の各節の「基準」。
  scn-spswap … SP直後の交代は硬直なし・能力変化は交代で消える・ばれたミミッキュは戻っても[0,-1]
  scn-swapko … HP5のマリルリへ交代→はっぱカッターで1ターンの対面で倒れる
  scn-buff   … グロウパンチ後に交代→出し直しで[0,0]
  scn-cmp    … ミラーの同時発動は種で10対10・シャドウにしても先後は変わらない
  scn-party  … 同じポケモン・地方のすがたは「すでに入っています」・ロケット団は通る
  scn-order  … 同じターンのノーマルとSPの順番(ノーマルが先／倒れる一撃ならSPだけ／打ちかけの途中はSPが先)
"""
import sys, json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from rulecheck import run_scenario

EXP = HERE / 'expected'


def main():
    update = '--update' in sys.argv
    EXP.mkdir(exist_ok=True)
    bad = 0
    names = sorted(p.stem for p in HERE.glob('scn-*.js') if p.stem != 'scn-random')
    for n in names:
        got = run_scenario((HERE / f'{n}.js').read_text(encoding='utf-8'))
        if isinstance(got, dict) and got.get('err'):
            print(f'✖ {n}: 実行できませんでした {str(got.get("err"))[:200]}'); bad += 1; continue
        f = EXP / f'{n}.json'
        if update or not f.is_file():
            f.write_text(json.dumps(got, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
            print(f'📝 {n}: 期待値を書きました'); continue
        exp = json.loads(f.read_text(encoding='utf-8'))
        if exp == got:
            print(f'✔ {n}: 期待値どおり')
        else:
            bad += 1
            print(f'✖ {n}: 期待値と違います')
            print('  期待:', json.dumps(exp, ensure_ascii=False)[:600])
            print('  結果:', json.dumps(got, ensure_ascii=False)[:600])
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
