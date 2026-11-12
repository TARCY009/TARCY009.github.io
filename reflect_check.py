# -*- coding: utf-8 -*-
"""
ツール反映の検査（反映漏れの検知・2026-11-12タダシさん承認）

告知台帳（ledger.py）の全件を「入っているべきもの」として、各ツールのデータと突き合わせる。
  ・新ポケモン／メガ … ゲーム内データ(godata)・対戦データ(pvp_data・実装済みの印)・ジム挑戦(gym_data)・個体値チェッカー(POKE)・
                      ジム防衛(defense_data・メガ/伝説/配置不可を除く)。図鑑・わざ図鑑・耐久指数・タイプ別火力・SCPは
                      godata/pvp_data を実行時に読むので、この2つが正しければ正しい
  ・シャドウ         … godata の shadow・対戦データの shadow・gym_data の shadow
  ・＋わざ           … godata のメガに plus が付き、そのわざがわざ表にある
  ・ダイマックス／キョダイマックス … マックスバトルのデータ(max_data)の一覧に、その区分で入っている
さらに、マックスバトルに登場するボスで設定値（boss_params.js）が未登録のものを知らせる。

結果: .github/reflect_report.json に書き、changes.md（毎朝のお知らせ）に節を足し、
      公式ニュースの知らせ（.github/official_news.json の notices・kind='reflect'）に入れてチャットの始めに伝える。
      公開は止めない（終了コードは常に0）。

使い方: python3 reflect_check.py            … 検査して報告・記録を書く
        python3 reflect_check.py --dry-run  … 画面に出すだけ（ファイルは書かない）
"""
import json, os, re, sys, hashlib, datetime, unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import ledger

REPORT = os.path.join(ROOT, '.github', 'reflect_report.json')
NEWS = os.path.join(ROOT, '.github', 'official_news.json')


_PREFIX_FORMS = re.compile(r'^(.+?)（(メガX|メガY|メガ|ゲンシ|アローラ|ガラル|ヒスイ|パルデア|アーマード)）$')


def norm(s):
    """名前の表記ゆれをそろえる（全角半角・括弧・空白）。
    ジム挑戦・個体値チェッカーは「ミュウツー（メガX）」「ヌメルゴン（ヒスイ）」の書き方なので、
    ゲーム内データの「メガミュウツーX」「ヒスイヌメルゴン」の形にそろえてから比べる"""
    s = unicodedata.normalize('NFKC', s or '')
    s = s.replace('(', '（').replace(')', '）').replace(' ', '').replace('　', '')
    m = _PREFIX_FORMS.match(s)
    if m:
        base, tag = m.group(1), m.group(2)
        if tag in ('メガX', 'メガY'):
            s = 'メガ' + base + tag[-1]
        else:
            s = tag + base
    return s


def load_json(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return json.load(f)


def load_js_obj(path, head):
    """`const X = {...};` の形の JS からオブジェクトを読む"""
    s = open(os.path.join(ROOT, path), encoding='utf-8').read()
    i = s.index(head)
    i = s.index('{', i)
    j = s.rindex('}')
    return json.loads(s[i:j + 1])


def load_iv_poke():
    s = open(os.path.join(ROOT, 'iv-checker', 'index.html'), encoding='utf-8').read()
    m = re.search(r'const POKE\s*=\s*(\[)', s)
    i = m.end() - 1
    # 配列の終わりは対応する ']' を数えて探す（文字列の中に ] は出ない前提＝名前・英名だけ）
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '[': depth += 1
        elif s[j] == ']':
            depth -= 1
            if depth == 0:
                return json.loads(s[i:j + 1])
    raise ValueError('iv-checker の POKE を読めません')


def boss_param_names():
    """boss_params.js に登録済みのボス名（bosses のキー＋tiers の名前）"""
    s = open(os.path.join(ROOT, 'max-battle', 'data', 'boss_params.js'), encoding='utf-8').read()
    names = set()
    i = s.find('"tiers"')
    j = s.find('"bosses"')
    if i >= 0 and j >= 0:
        names |= set(re.findall(r'"([^"]+)"', s[i:j]))
        tail = s[j:]
        names |= set(re.findall(r'^\s*"([^"]+)":\s*\{', tail, flags=re.M))
    return {norm(n) for n in names if n and n not in ('tiers', 'bosses', 'star', 'hp', 'defCpm', 'atk1', 'atk2', 'verified', 'memo', 'coeff')}


def defense_exclude_prefix():
    """ジム防衛が意図して外している名前の頭（特殊能力持ち・build_defense.py の MANUAL_EXCLUDE_PREFIX）"""
    s = open(os.path.join(ROOT, 'gym-defense', 'build_defense.py'), encoding='utf-8').read()
    m = re.search(r'MANUAL_EXCLUDE_PREFIX\s*=\s*\(([^)]*)\)', s)
    return tuple(re.findall(r"'([^']+)'", m.group(1))) if m else ()


def run(drop=()):
    """drop: 自己点検用。ここに入れた名前はどのツールにも無いことにして検査する（見つけられるかを確かめる）"""
    entries = ledger.build()
    god = load_json('godata.json')
    unrel = (load_json('pokedex/unreleased.json') or {}).get('pokemon') or {}
    pvp = load_json('pvp_data.json')
    gym = load_json('gym-attack/data/gym_data.json')
    dfn = load_json('gym-defense/data/defense_data.json')
    mx = load_js_obj('max-battle/data/max_data.js', 'MAX_DATA')
    iv = load_iv_poke()

    dropn = {norm(x) for x in drop}
    god_by = {norm(v['n']): (k, v) for k, v in god['pokemon'].items() if norm(v['n']) not in dropn}
    unrel_by = {norm(v['n']) for v in unrel.values()}
    pvp_by = {norm(v['n']): (k, v) for k, v in pvp['pokemon'].items() if not v.get('hid') and norm(v['n']) not in dropn}
    gym_by = {norm(p['name']): p for p in gym['pokemon'] if norm(p['name']) not in dropn}
    dfn_by = {norm(e['n']) for e in dfn['entries']} - dropn
    iv_by = {norm(p['n']): p for p in iv if norm(p['n']) not in dropn}
    lm_dex = {p['d'] for p in iv if p.get('l') or p.get('m')}   # ジム防衛の配置不可（伝説・幻）＝ build_defense.py と同じ出どころ
    dfn_skip = defense_exclude_prefix()
    mx_by = {}
    for p in mx['roster']:
        if norm(p['n']) in dropn: continue
        mx_by.setdefault(norm(p['n']), set()).add(p.get('cat'))

    problems = []

    def bad(e, tool, msg):
        problems.append({'kind': e['kind'], 'name': e['name'], 'tool': tool, 'msg': msg,
                         'id': 'reflect:' + hashlib.md5(f"{e['kind']}|{e['name']}|{tool}".encode()).hexdigest()[:10]})

    for e in entries:
        nm = norm(e['name'])
        kind = e['kind']
        if kind in ('pokemon', 'mega'):
            g = god_by.get(nm)
            if not g:
                bad(e, 'ゲーム内データ(godata)', '未実装の控えにある' if nm in unrel_by else '無い')
            p = pvp_by.get(nm)
            if not p:
                bad(e, '対戦データ(pvp_data)', '無い')
            elif not p[1].get('r'):
                bad(e, '対戦データ(pvp_data)', '未実装の印のまま（r=0）')
            if nm not in gym_by:
                bad(e, 'ジム挑戦(gym_data)', '無い')
            if nm not in iv_by:
                bad(e, '個体値チェッカー(POKE)', '無い')
            if kind == 'pokemon' and g:
                gv = g[1]
                dex = (iv_by.get(nm) or {}).get('d')
                if (not gv.get('lg') and not gv.get('mega') and dex not in lm_dex and nm not in dfn_by
                        and not e['name'].startswith(dfn_skip)):
                    bad(e, 'ジム防衛(defense_data)', '無い')
        elif kind == 'shadow':
            g = god_by.get(nm)
            if not g:
                bad(e, 'ゲーム内データ(godata)', '本体が無い')
            elif not g[1].get('shadow'):
                bad(e, 'ゲーム内データ(godata)', 'shadow の印が無い')
            p = pvp_by.get(nm)
            if not p:
                bad(e, '対戦データ(pvp_data)', '本体が無い')
            elif not p[1].get('shadow') and (p[0] + '_shadow') not in pvp['pokemon']:
                bad(e, '対戦データ(pvp_data)', 'シャドウが無い')
            gp = gym_by.get(nm)
            if gp and not gp.get('shadow'):
                bad(e, 'ジム挑戦(gym_data)', 'shadow の印が無い')
        elif kind == 'plus':
            g = god_by.get(nm)
            if not g:
                bad(e, 'ゲーム内データ(godata)', 'メガが無い')
            else:
                plus = g[1].get('plus')
                if not plus:
                    bad(e, 'ゲーム内データ(godata)', '＋わざ(plus)が付いていない')
                elif plus not in god['moves']:
                    bad(e, 'ゲーム内データ(godata)', f'＋わざ {plus} がわざ表に無い')
        elif kind in ('dynamax', 'gigantamax'):
            cats = mx_by.get(nm) or set()
            want = 'D' if kind == 'dynamax' else 'G'
            if not cats:
                bad(e, 'マックスバトル(max_data)', '無い')
            elif want not in cats:
                bad(e, 'マックスバトル(max_data)', f'区分が {sorted(cats)} で {want} が無い')

    # マックスバトルのボスで設定値が未登録のもの（既定値で計算している）。
    # ボスになるのはダイマックス・キョダイマックスできるポケモンなので、その一覧（D/G）のうち boss_params.js に無いものを控え、
    # 知らせるのは台帳に載っている（登場が告知された）ものだけ
    reg = boss_param_names()
    dmax_names = {p['n'] for p in mx['roster'] if p.get('cat') in ('D', 'G')}
    unreg_all = sorted(n for n in dmax_names if norm(n) not in reg)
    announced = {e['name'] for e in entries if e['kind'] in ('dynamax', 'gigantamax')}
    unreg = [n for n in unreg_all if n in announced]
    info = {'bosses_without_params': unreg, 'dynamax_without_params_all': unreg_all}

    # ツールどうしの全数の突き合わせ（情報として控える）: 実装済みの名前が片側にしか無いもの
    pve_names = {norm(v['n']) for v in god['pokemon'].values()}
    pvp_rel = {norm(v['n']) for v in pvp['pokemon'].values() if v.get('r') and not v.get('hid')}
    info['only_pve'] = sorted(pve_names - pvp_rel)[:40]
    info['only_pvp'] = sorted(pvp_rel - pve_names)[:40]
    info['counts'] = {'ledger': len(entries), 'godata': len(pve_names), 'pvp_released': len(pvp_rel),
                      'gym': len(gym_by), 'defense': len(dfn_by), 'iv': len(iv_by), 'max': len(mx['roster'])}
    return entries, problems, info


def selftest():
    """検査そのものを疑う: 台帳の全種類から1件ずつ、わざと全ツールから欠けさせて、見つけられるかを確かめる"""
    entries = ledger.build()
    picked = {}
    for e in entries:
        picked.setdefault(e['kind'], e['name'])
    names = sorted(set(picked.values()))
    _, problems, _ = run(drop=names)
    found = {p['name'] for p in problems}
    missing = [n for n in names if n not in found]
    print(f'自己点検: {len(names)}件をわざと欠けさせて {len(found)}件を検知（{", ".join(names)}）')
    if missing:
        print('  ✗ 見つけられなかった:', '、'.join(missing)); sys.exit(1)
    print('  ✓ 全部見つけた')


def main():
    if '--selftest' in sys.argv:
        selftest(); return
    dry = '--dry-run' in sys.argv
    entries, problems, info = run()
    today = datetime.date.today().isoformat()
    prev = {}
    try:
        with open(REPORT, encoding='utf-8') as f:
            prev = json.load(f)
    except Exception:
        pass
    prev_ids = {p['id'] for p in (prev.get('problems') or [])}
    new = [p for p in problems if p['id'] not in prev_ids]
    fixed = [p for p in (prev.get('problems') or []) if p['id'] not in {q['id'] for q in problems}]
    prev_unreg = set(prev.get('info', {}).get('bosses_without_params') or [])
    new_unreg = [b for b in info['bosses_without_params'] if b not in prev_unreg]

    c = info['counts']
    print(f"ツール反映の検査: 台帳{c['ledger']}件 → 漏れ{len(problems)}件（新しく{len(new)}件・解消{len(fixed)}件）")
    for p in problems:
        print(f"  ✗ [{ledger.KIND_JA[p['kind']]}] {p['name']}: {p['tool']} に {p['msg']}")
    if info['bosses_without_params']:
        print('  ⚠ 設定値が未登録のボス（既定値で計算中）:', '、'.join(info['bosses_without_params']))
    if info['only_pve'] or info['only_pvp']:
        print(f"  ℹ 実装済みの名前が片側にしか無い: ゲーム内データだけ{len(info['only_pve'])}件・対戦データだけ{len(info['only_pvp'])}件（名前の付け方の違いを含む）")
    if dry:
        return

    # お知らせ（changes.md）: 問題があるとき・解消したとき・ボスが新しく未登録になったときだけ節を足す
    lines = []
    if problems:
        lines.append('\n### 🔎 ツール反映の検査（告知台帳との突き合わせ）')
        lines.append(f'- 台帳{c["ledger"]}件のうち、ツールに入っていないものが {len(problems)} 件' + ('（新しく見つかったものに ★）' if new else ''))
        for p in problems:
            mark = '★ ' if p['id'] not in prev_ids else ''
            lines.append(f"- {mark}{ledger.KIND_JA[p['kind']]}「{p['name']}」: {p['tool']} に {p['msg']}")
    elif fixed:
        lines.append('\n### 🔎 ツール反映の検査\n- 前回の漏れ ' + '、'.join(f"「{p['name']}」" for p in fixed) + ' は解消（いまは漏れ0件）')
    if new_unreg:
        lines.append('\n### ⚠ マックスバトルのボスの設定値が未登録（既定値で計算中）\n- ' + '、'.join(new_unreg) +
                     '（HP・防御CPMが分かったら max-battle/data/boss_params.js に足す）')
    if lines:
        try:
            with open(os.path.join(ROOT, 'changes.md'), 'a', encoding='utf-8') as f:
                f.write('\n'.join(lines) + '\n')
        except Exception:
            pass

    # チャットの始めの知らせ（official_news.json の notices・kind='reflect'）: いまの漏れだけを残す
    try:
        with open(NEWS, encoding='utf-8') as f:
            news = json.load(f)
    except Exception:
        news = {}
    notices = [n for n in (news.get('notices') or []) if n.get('kind') != 'reflect']
    for p in problems:
        notices.append({'id': p['id'], 'kind': 'reflect', 'date': today, 'title': 'ツール反映の検査',
                        'text': f"{ledger.KIND_JA[p['kind']]}「{p['name']}」が {p['tool']} に{p['msg']}（反映漏れ）"})
    for b in info['bosses_without_params']:
        notices.append({'id': 'reflect:boss:' + hashlib.md5(b.encode()).hexdigest()[:8], 'kind': 'reflect', 'date': today,
                        'title': 'マックスバトルのボス', 'text': f"ボス「{b}」の設定値（HP・防御CPM）が未登録＝既定値で計算中"})
    news['notices'] = notices
    with open(NEWS, 'w', encoding='utf-8') as f:
        json.dump(news, f, ensure_ascii=False, indent=1)

    with open(REPORT, 'w', encoding='utf-8') as f:
        json.dump({'date': today, 'problems': problems, 'info': info}, f, ensure_ascii=False, indent=1)
    ledger.save(entries)


if __name__ == '__main__':
    main()
