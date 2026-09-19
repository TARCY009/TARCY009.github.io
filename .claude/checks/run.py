#!/usr/bin/env python3
"""答え合わせ（見張り役4人目）。使い方: python3 .claude/checks/run.py gbl-engine [...]
すべて合格なら終了コード0。1つでも不合格・実行できなければ1。

gbl-engine:  pvp-tests/engine-test.html（GBLエンジンの実測突き合わせ・7ケース×3項目＝21項目）
iv-calc:     .claude/checks/iv-check.html（個体値チェッカーのCP・順位・逆引き・進化後CP＝16項目）
raid-engine: .claude/checks/raid-check.html（スクショ5例のボスの攻撃時刻＋回帰5通り。基準は raid-baseline.json）
max-attacker:.claude/checks/max-check.html（マックスバトルのアタッカーが「ダメージ最大のマックスわざ」を選ぶか＝5項目）
いずれも画面なしのブラウザで開き、すべて ✅ かを確かめる。
答え（期待値・基準ファイル）を変えるときは、必ずタダシさんに確認してから。
"""
import sys, os, re, socket, subprocess, tempfile, threading, pathlib, functools, http.server, shutil, html

ROOT = pathlib.Path(__file__).resolve().parents[2]
# 画面なし専用のブラウザを優先（通常の Chrome は画面なしモードで終了しないことがある・2026-09-17に確認）
def find_browser():
    import glob
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
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
        r = subprocess.run([CHROME] + head + ['--disable-gpu', '--no-first-run', '--no-default-browser-check',
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


def page_check(path, min_ok):
    """.claude/checks/ の答え合わせページ（結果を #sum の data-ok／data-ng に書く形）を読む。"""
    def fn(port):
        dom = dump_dom(f'http://127.0.0.1:{port}/{path}')
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


CHECKS = {
    'gbl-engine': check_gbl_engine,
    'iv-calc': page_check('.claude/checks/iv-check.html', 16),
    'raid-engine': page_check('.claude/checks/raid-check.html', 10),
    'max-attacker': page_check('.claude/checks/max-check.html', 5),
    'mock-fx': check_mock_fx,
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
