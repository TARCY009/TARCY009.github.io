#!/usr/bin/env python3
"""1ポケモン1ページの「集める係」。各ツール本体を画面なしブラウザで開き、出口の数字を JSON に書き出す。
使い方: python3 collect.py [simple gym rocket gbl]   （省略＝全部）   出力: ../data/*.json
"""
import sys, os, re, json, glob, html, time, socket, shutil, tempfile, threading, functools, subprocess, http.server
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '..', 'data')
PAGE = '/' + os.path.relpath(os.path.join(HERE, 'collect.html'), ROOT).replace(os.sep, '/')
CHUNK, WORKERS = 200, 4


def find_browser():
    # Mac の画面なし専用ブラウザ／GitHub の実行環境（Linux）で入れる画面なし専用ブラウザ
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell'))
               + glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell'))
               + glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/headless_shell')))
    for p in c[::-1] + ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:
        if os.path.exists(p):
            return p
    raise SystemExit('画面なしブラウザが見つかりません')


CHROME = find_browser()


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return port


def fetch(port, query):
    prof = tempfile.mkdtemp(prefix='gonavi-collect-')
    try:
        head = [] if 'headless-shell' in CHROME else ['--headless=new']
        r = subprocess.run([CHROME] + head + ['--disable-gpu', '--no-first-run', '--no-sandbox', f'--user-data-dir={prof}',
                            '--virtual-time-budget=600000', '--dump-dom', f'http://127.0.0.1:{port}{PAGE}?{query}'],
                           capture_output=True, text=True, timeout=1800)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    m = re.search(r'<pre id="json">(.*?)</pre>', r.stdout, re.S)
    if not m or not m.group(1):
        raise SystemExit(f'{query}: 結果が取れませんでした\n{r.stdout[-800:]}\n{r.stderr[-400:]}')
    d = json.loads(html.unescape(m.group(1)))
    if d.get('error'):
        raise SystemExit(f'{query}: {d["error"]}')
    return d


def save(name, d):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '.json')
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'  → {name}.json {os.path.getsize(p) // 1024}KB')


def main():
    parts = sys.argv[1:] or ['simple', 'gym', 'rocket', 'gbl']
    port = serve()
    for part in parts:
        t0 = time.time()
        print(part, '…')
        if part == 'gbl':
            n = len(json.load(open(os.path.join(ROOT, 'pvp_data.json'), encoding='utf-8'))['pokemon'])
            jobs = [(lg, a) for lg in (1500, 2500, 0) for a in range(0, n, CHUNK)]
            with ThreadPoolExecutor(WORKERS) as ex:
                res = list(ex.map(lambda j: fetch(port, f'part=gbl&lg={j[0]}&from={j[1]}&to={j[1] + CHUNK}'), jobs))
            for lg in (1500, 2500, 0):
                rs = [r for r, j in zip(res, jobs) if j[0] == lg]
                data = {}
                for r in rs:
                    data.update(r['data'])
                save(f'gbl_{lg}', {'lg': lg, 'meta': rs[0]['meta'], 'data': data})
        else:
            d = fetch(port, 'part=' + part)
            if part == 'simple':
                for k, v in d.items():
                    save(k, v)
            else:
                save(part, d)
        print(f'  {time.time() - t0:.1f}秒')


if __name__ == '__main__':
    main()
