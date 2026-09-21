#!/usr/bin/env python3
"""バトルルールの確認用: 模擬戦の通し(gbPlay)を直接呼んで、対面ごとの状態を書き出す。
使い方: python3 rulecheck.py <シナリオのJSファイル>
シナリオは window.__scenario(orig, picks, foes) を定義し、結果(何でも)を返す。"""
import os, re, sys, json, glob, socket, shutil, tempfile, threading, pathlib, subprocess
import http.server, urllib.parse, posixpath, html as H2

ROOT = pathlib.Path('/Users/t.t/Desktop/TARCY009.github.io')
SCN = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')

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
            inj = INJECT.replace('__PARTY__', json.dumps(PARTY)).replace('__SCN__', SCN)
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


m = re.search(r'^// PARTY: (.*)$', SCN, re.M)
PARTY = json.loads(m.group(1))
m = re.search(r'^// FOES: (.*)$', SCN, re.M)
GT = m.group(1).strip()


def main():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/gbl/?md=mock&gt={urllib.parse.quote(GT)}'
    chrome = sorted(glob.glob(os.path.expanduser(
        '~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))[-1]
    prof = tempfile.mkdtemp(prefix='gonavi-rule-')
    try:
        r = subprocess.run([chrome, '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}',
                            '--virtual-time-budget=30000', '--dump-dom', url],
                           capture_output=True, text=True, timeout=180)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    mm = re.search(r'id="__out"[^>]*>(.*?)</div>', r.stdout, re.S)
    if not mm:
        print('結果を取り出せませんでした'); print(r.stdout[:500]); return 1
    print(json.dumps(json.loads(H2.unescape(mm.group(1))), ensure_ascii=False, indent=1))


if __name__ == '__main__':
    sys.exit(main() or 0)
