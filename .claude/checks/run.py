#!/usr/bin/env python3
"""答え合わせ（見張り役4人目）。使い方: python3 .claude/checks/run.py gbl-engine [...]
すべて合格なら終了コード0。1つでも不合格・実行できなければ1。

gbl-engine: pvp-tests/engine-test.html（GBLエンジンの実測突き合わせ・7ケース×3項目＝21項目）を
            画面なしの Chrome で開き、21項目すべて ✅ かを確かめる。
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


CHECKS = {'gbl-engine': check_gbl_engine}


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
