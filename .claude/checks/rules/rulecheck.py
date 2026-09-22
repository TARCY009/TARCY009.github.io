#!/usr/bin/env python3
"""バトルルールの確認用: 模擬戦の通し(gbPlay)を直接呼んで、対面ごとの状態を書き出す。
使い方: python3 rulecheck.py <シナリオのJSファイル>
シナリオは window.__scenario(orig, picks, foes) を定義し、結果(何でも)を返す。
ほかのスクリプト(randcheck.py)からは run_scenario(シナリオの文字列) で同じ仕組みを使える。"""
import os, re, sys, json, glob, socket, shutil, tempfile, threading, pathlib, subprocess
import http.server, urllib.parse, posixpath, html as H2

ROOT = pathlib.Path(__file__).resolve().parents[3]

INJECT = """<script>
(function(){
  try{
    if(!localStorage.getItem('__ready')){
      localStorage.setItem('gbl_party', JSON.stringify(__PARTY__));
      localStorage.setItem('gbl_mock_rt','0');
      localStorage.setItem('gbl_mock_ai','easy');
      localStorage.setItem('gbl_fx','0');
      localStorage.setItem('__ready','1');
      location.replace(location.href);
      return;
    }
  }catch(e){}
  var cap = null;
  var orig = window.gbPlay;
  window.gbPlay = function(p, f, a, s){ if(!cap) cap = [p, f]; return orig(p, f, a, s); };
  function out(v){
    var d=document.createElement('div'); d.id='__out'; d.style.display='none';
    d.textContent=JSON.stringify(v); document.body.appendChild(d);
  }
  addEventListener('load', function(){
    var n=0;
    (function wait(){
      // 起動時の呼び出しは包む前に終わっているので、もう一度描かせて引数を拾う
      if(!cap){ try{ runMockBuild(); }catch(e){} }
      if(!cap){ if(++n>80){ out({err:'gbPlay が呼ばれない'}); return; } setTimeout(wait,150); return; }
      try{ __SCN__; out(window.__scenario(orig, cap[0], cap[1])); }
      catch(e){ out({err:String(e && e.stack || e)}); }
    })();
  });
})();
</script>"""


def make_handler(scn, party):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'
        def log_message(self, *a): pass
        def do_GET(self):
            p = urllib.parse.urlparse(self.path).path
            p = posixpath.normpath(urllib.parse.unquote(p)).lstrip('/')
            f = ROOT / p
            if f.is_dir(): f = f / 'index.html'
            if not f.is_file():
                self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers(); return
            data = f.read_bytes()
            ct = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
                  '.png': 'image/png'}.get(f.suffix.lower(), 'application/octet-stream')
            if f.suffix.lower() == '.html':
                t = data.decode('utf-8', 'ignore')
                inj = INJECT.replace('__PARTY__', json.dumps(party)).replace('__SCN__', scn)
                # ⚠ gbPlay を包むので、gbl-app.js の読み込みより後・init より前には入れられない。
                #   gbl-app.js は同期で init まで走るが、gbPlay の呼び出しは毎回グローバルを引くので後から包んでも効く
                m = re.search(r'</body>', t, re.I)
                t = (t[:m.start()] + inj + t[m.start():]) if m else (t + inj)
                data = t.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', ct)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
    return H


def find_browser():
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
    c = c or sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell'))
                    + glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/headless_shell')))
    return c[-1] if c else None


def run_scenario(scn, budget_ms=30000, timeout=180):
    """シナリオ(JSの文字列)を /gbl/ の模擬戦の上で動かし、__scenario の返り値(JSON)を返す。
    先頭の `// PARTY: [...]` と `// FOES: ...` が枠の中身になる。"""
    m = re.search(r'^// PARTY: (.*)$', scn, re.M)
    party = json.loads(m.group(1))
    m = re.search(r'^// FOES: (.*)$', scn, re.M)
    gt = m.group(1).strip()
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), make_handler(scn, party))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/gbl/?md=mock&gt={urllib.parse.quote(gt)}'
    chrome = find_browser()
    if not chrome:
        return {'err': '画面なし専用のブラウザが見つかりません'}
    prof = tempfile.mkdtemp(prefix='gonavi-rule-')
    try:
        r = subprocess.run([chrome, '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}',
                            f'--virtual-time-budget={budget_ms}', '--dump-dom', url],
                           capture_output=True, text=True, timeout=timeout)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
        httpd.shutdown()
    mm = re.search(r'id="__out"[^>]*>(.*?)</div>', r.stdout, re.S)
    if not mm:
        return {'err': '結果を取り出せませんでした', 'head': r.stdout[:500]}
    return json.loads(H2.unescape(mm.group(1)))


def main():
    scn = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
    v = run_scenario(scn)
    print(json.dumps(v, ensure_ascii=False, indent=1))
    return 1 if isinstance(v, dict) and v.get('err') else 0


if __name__ == '__main__':
    sys.exit(main() or 0)
