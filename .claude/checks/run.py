#!/usr/bin/env python3
"""答え合わせ（見張り役4人目）。使い方: python3 .claude/checks/run.py gbl-engine [...]
すべて合格なら終了コード0。1つでも不合格・実行できなければ1。

gbl-engine:  pvp-tests/engine-test.html（GBLエンジンの実測突き合わせ・7ケース×3項目＝21項目）
iv-calc:     .claude/checks/iv-check.html（個体値チェッカーのCP・順位・逆引き・進化後CP＝16項目）
raid-engine: .claude/checks/raid-check.html（スクショ5例のボスの攻撃時刻＋回帰5通り。基準は raid-baseline.json）
max-attacker:.claude/checks/max-check.html（マックスバトルのアタッカーが「ダメージ最大のマックスわざ」を選ぶか＝5項目）
gym-attack:  .claude/checks/gym-check.html（ジム挑戦の手計算の例・画面の上位30件を別の計算と比べる・確認済みの耐え数＝15項目）
dex-stats:   .claude/checks/dex-check.html（ステータス図鑑の最大CP・メガLv4・最大SCP・タイプ相性・わざ表の数値＝17項目）
exit-rank:   .claude/checks/exit-check.html?only=rank（1ポケモン1ページ用の出口＝画面の数字か。タイプ別火力・耐久指数・ジム防衛・マックスバトル タイプ別＝20項目）
exit-gbl:    .claude/checks/exit-check.html?only=gbl（同・GBLの環境一覧とロケット団のランキング＝16項目）
rules-scn:   .claude/checks/rules/scncheck.py（GBLのバトルルールのシナリオ6本＝expected/*.json と突き合わせ）
rules-random:.claude/checks/rules/randcheck.py（同・種1で600戦をランダムに回し、バトルルール違反0か）
mock-sp:     .claude/checks/mock-sp.py --quick（模擬戦を画面ごと回し、SPボタン・メーター・同時発動の順番が崩れないか。広く見るときは --seed N で16戦）
mock-skip:   .claude/checks/mock-skip.py --quick（模擬戦を⏸→⏩決断まで／演出中に⏩ で決着まで進め、決着パネル・決着の演出・威力調整・演出の列の空回りが崩れないか。全部見るときは引数なしで4本×3戦）
いずれも画面なしのブラウザで開き、すべて ✅ かを確かめる。
答え（期待値・基準ファイル）を変えるときは、必ずタダシさんに確認してから。
"""
import sys, os, re, socket, subprocess, tempfile, threading, pathlib, functools, http.server, shutil, html

ROOT = pathlib.Path(__file__).resolve().parents[2]
# 画面なし専用のブラウザを優先（通常の Chrome は画面なしモードで終了しないことがある・2026-09-17に確認）
def find_browser():
    import glob
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
    # GitHub の実行環境（Linux）では毎朝の自動更新が入れる画面なし専用ブラウザ（1ポケモン1ページの前の答え合わせ用）
    c = c or sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell'))
                    + glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/headless_shell')))
    return c[-1] if c else '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


CHROME = find_browser()


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def dump_dom(url, budget_ms=30000):
    prof = tempfile.mkdtemp(prefix='gonavi-check-')
    try:
        head = [] if 'headless-shell' in CHROME else ['--headless=new']
        r = subprocess.run([CHROME] + head + ['--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                            f'--user-data-dir={prof}', f'--virtual-time-budget={budget_ms}', '--dump-dom', url],
                           capture_output=True, text=True, timeout=120)
        return r.stdout
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def check_gbl_engine(port):
    page = ROOT / 'pvp-tests/engine-test.html'
    if not page.is_file():
        return False, 'pvp-tests/engine-test.html がありません（答え合わせができないため不合格扱い）'
    dom = dump_dom(f'http://127.0.0.1:{port}/pvp-tests/engine-test.html')
    m = re.search(r'<div id="out">(.*?)<script', dom, re.S)
    body = m.group(1) if m else ''
    ok_n, ng_n = body.count('✅'), body.count('❌')
    if 'エラー:' in body or '実行中' in body or not body:
        return False, f'engine-test が最後まで動きませんでした: {html.unescape(re.sub("<[^>]+>", " ", body))[:300]}'
    detail = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    detail = re.sub(r'[ \t]+', ' ', detail)
    if ng_n or ok_n != 21:
        return False, f'engine-test: ✅{ok_n} ❌{ng_n}（21項目すべて✅が合格）\n{detail[:1500]}'
    return True, f'engine-test: 21項目すべて✅'


def page_check(path, min_ok, budget_ms=30000):
    """.claude/checks/ の答え合わせページ（結果を #sum の data-ok／data-ng に書く形）を読む。"""
    def fn(port):
        dom = dump_dom(f'http://127.0.0.1:{port}/{path}', budget_ms)
        m = re.search(r'id="sum" data-ok="(\d+)" data-ng="(\d+)"', dom)
        body = re.search(r'<div id="out">(.*?)<iframe', dom, re.S)
        detail = html.unescape(re.sub(r'<[^>]+>', '\n', body.group(1) if body else dom[:500]))
        detail = '\n'.join(l for l in detail.split('\n') if l.strip())
        if not m:
            return False, f'{path} が最後まで動きませんでした\n{detail[:800]}'
        okn, ngn = int(m.group(1)), int(m.group(2))
        if ngn or okn < min_ok:
            return False, f'{path}: ✅{okn} ❌{ngn}（{min_ok}項目以上すべて✅が合格）\n' + '\n'.join(l for l in detail.split('\n') if '❌' in l or '実行エラー' in l)[:1500]
        return True, f'{path}: {okn}項目すべて✅'
    return fn


def check_mock_fx(port):
    """模擬戦の通しテスト（.claude/checks/mock-fx.py）。自前でサーバーを立てるので port は使わない。
    ①スタート→すぐ⇄交代 で「交代のあとにVSがまた流れない」
    ②✕終了→もう一度スタート で「押していない交代が再現されない」
    この2つは何度も再発した症状なので、保存のたびに機械で確かめる（2026-09-20タダシさん指示）"""
    f = ROOT / '.claude/checks/mock-fx.py'
    if not f.is_file():
        return False, '.claude/checks/mock-fx.py がありません（答え合わせができないため不合格扱い）'
    try:
        r = subprocess.run(['python3', str(f)], capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        return False, '模擬戦の通しテストが時間内に終わりませんでした'
    tail = '\n'.join(l for l in r.stdout.strip().split('\n') if l.strip())[-700:]
    if r.returncode == 0:
        return True, '模擬戦の通し（交代のあとのVS・終了後の手の残り）2項目とも✅'
    return False, '模擬戦の通しテストが不合格\n' + tail


def sub_check(rel, args, label, timeout=600):
    """自前でブラウザを立てる検査(.claude/checks/rules/*.py)を子プロセスで流す。終了コード0が合格。"""
    def fn(port):
        f = ROOT / rel
        if not f.is_file():
            return False, f'{rel} がありません（答え合わせができないため不合格扱い）'
        try:
            r = subprocess.run(['python3', str(f)] + args, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return False, f'{label}が時間内に終わりませんでした'
        out = '\n'.join(l for l in (r.stdout + r.stderr).strip().split('\n') if l.strip())
        if r.returncode == 0:
            return True, label + ': ' + out[-300:].replace('\n', ' ／ ')
        return False, label + 'が不合格\n' + out[-1200:]
    return fn


CHECKS = {
    'gbl-engine': check_gbl_engine,
    # バトルルールの検査(2026-09-22): シナリオ6本＝期待値との突き合わせ／ランダム＝種固定で600戦回して違反0
    'rules-scn': sub_check('.claude/checks/rules/scncheck.py', [], 'バトルルールのシナリオ検査'),
    'rules-random': sub_check('.claude/checks/rules/randcheck.py', ['--n', '600', '--seed', '1', '--ms', '60000'], 'バトルルールのランダム検査'),
    'iv-calc': page_check('.claude/checks/iv-check.html', 16),
    'raid-engine': page_check('.claude/checks/raid-check.html', 10),
    'max-attacker': page_check('.claude/checks/max-check.html', 5),
    'gym-attack': page_check('.claude/checks/gym-check.html', 15, 60000),
    'dex-stats': page_check('.claude/checks/dex-check.html', 17, 60000),
    'mock-fx': check_mock_fx,
    # 模擬戦のSPアタックの通し検査(2026-09-24): 押した瞬間の演出・メーターの順番・同時発動・止まらない など。保存前は短い版(2戦)
    'mock-sp': sub_check('.claude/checks/mock-sp.py', ['--quick'], '模擬戦のSPアタックの通し検査'),
    # ⏩決断まで・⏸の通し検査(2026-09-25の点検で見つけた3件の再発防止): 決着パネルが出る・威力調整を通る・演出の列が空回りしない
    'mock-skip': sub_check('.claude/checks/mock-skip.py', ['--quick'], '模擬戦の⏩決断まで・⏸の通し検査'),
    'exit-rank': page_check('.claude/checks/exit-check.html?only=rank', 20, 120000),
    'exit-gbl': page_check('.claude/checks/exit-check.html?only=gbl', 16, 300000),
}


def main(names):
    if not os.path.exists(CHROME):
        print('Chrome が見つからないため答え合わせができません（不合格扱い）'); return 1
    httpd, port = serve()
    bad = 0
    try:
        for n in names:
            fn = CHECKS.get(n)
            if not fn:
                print(f'✖ {n}: 答え合わせの名前が見つかりません'); bad += 1; continue
            try:
                ok, msg = fn(port)
            except Exception as e:
                ok, msg = False, f'実行エラー {type(e).__name__}: {e}'
            print(('✔ ' if ok else '✖ ') + n + ': ' + msg)
            bad += 0 if ok else 1
    finally:
        httpd.shutdown()
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or list(CHECKS)))
