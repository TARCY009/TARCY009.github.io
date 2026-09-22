#!/usr/bin/env python3
"""バトルルールのランダム検査(2026-09-22)。
GBL模擬戦の通し(gbPlay)を、ランダムな編成・難易度・決断で何戦も回し、
バトルルールの下書き(.claude/drafts/gbl-battle-rules-draft.md)の「検査 できる」の項目の違反を探す。
台本は scn-random.js(何を照合しているかはそのファイルの頭に一覧)。

使い方: python3 randcheck.py [--n 30] [--seed 1] [--ms 45000] [--ai easy,normal,hard] [--json]
  違反が1つでもあれば終了コード1。同じ種なら同じ結果(答え合わせに使うときは種を固定する)。
"""
import sys, json, argparse, pathlib, time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from rulecheck import run_scenario


def run(n=30, seed=1, ms=45000, ai=None, caps=None, dump=None):
    scn = (HERE / 'scn-random.js').read_text(encoding='utf-8')
    opts = {'n': n, 'seed': seed, 'ms': ms}
    if ai: opts['ai'] = ai
    if caps: opts['caps'] = caps
    if dump: opts['dump'] = dump
    scn = scn.replace('window.__scenario = function', f'window.__RAND_OPTS__ = {json.dumps(opts)};\nwindow.__scenario = function', 1)
    # ブラウザの仮想時間は計算中は進まないので、実時間の打ち切り(ms)より長めに待つ
    return run_scenario(scn, budget_ms=60000, timeout=max(120, ms // 1000 + 90))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=30)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--ms', type=int, default=45000)
    ap.add_argument('--ai', default='')
    ap.add_argument('--caps', default='')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--dump', default='', help='中身を書き出す戦の番号(カンマ区切り)')
    a = ap.parse_args()
    t0 = time.time()
    v = run(a.n, a.seed, a.ms, [x for x in a.ai.split(',') if x] or None,
            [int(x) for x in a.caps.split(',') if x] or None, [int(x) for x in a.dump.split(',') if x] or None)
    if a.json:
        print(json.dumps(v, ensure_ascii=False, indent=1)); return 1 if v.get('err') or v.get('viol') else 0
    if v.get('err'):
        print('✖ 実行できませんでした: ' + str(v.get('err'))[:600]); print(str(v.get('head', ''))[:300]); return 1
    c = v['counts']
    print(f"ランダム検査: {c['battles']}戦(種{a.seed}・{v['elapsed']/1000:.1f}秒・実{time.time()-t0:.1f}秒) "
          f"勝{c['win']}/負{c['lose']}/引{c['draw']}/決着なし{c['timeout']}(時間切れ{c['timeUp']}) "
          f"対面{c['legs']}・決断{c['decisions']}・交代{c['swaps']}(⇄{c['msw']}・開幕{c['lead']})・SP{c['sp']}(防いだ{c['shields']}・出来つき{c.get('spEvPw', 0)}/答え{c.get('pw', 0)}) 難易度{c['byAi']}")
    for d in v.get('dumps') or []:
        print(f"---- 戦{d['b']} {d['ai']} buff={d['buff']} cap={d['cap']}")
        print('  じぶん', d['picks']); print('  あいて', d['foes']); print('  答え', d['ans'])
        for l in d['legs']:
            print(f"  対面{l['li']} {l['me']} vs {l['foe']} base={l['base']} turns={l['turns']} hud={l['hud']} swOk={l['swOk']} sw={l['sw']} down={l['down']} swapHit={l['swapHit']} extra={l['extra']} timeUp={l['timeUp']} final={l['final']}")
            for r in l['rows']:
                if r[1] or r[2] != ' | ' or True:
                    print(f"     T{r[0]} {r[1]} {r[2]}   {r[3]}")
    viol = v['viol']
    if not viol:
        print('✔ 違反なし'); return 0
    by = {}
    for x in viol: by.setdefault(x['rule'], []).append(x)
    print(f'✖ 違反 {len(viol)}件（{len(set(x["b"] for x in viol))}戦）')
    for rule, xs in sorted(by.items(), key=lambda kv: -len(kv[1])):
        print(f'  [{rule}] {len(xs)}件')
        for x in xs[:6]:
            print(f'    戦{x["b"]}: {x["msg"]}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
