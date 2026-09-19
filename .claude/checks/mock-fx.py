#!/usr/bin/env python3
"""模擬戦の通しテスト: 「スタート → すぐ⇄交代」で演出がどの順に流れるかを記録する。
画面なしブラウザの仮想時間でタイマーを進め、#fxlayer に出た演出を順に書き出す。
使い方: python3 mock_fx_check.py
合格の条件: VS が1回だけ・交代のあとに VS が出てこない。
"""
import os, re, sys, json, glob, socket, shutil, tempfile, threading, pathlib, subprocess
import http.server, urllib.parse, posixpath

ROOT = pathlib.Path('/Users/t.t/Desktop/TARCY009.github.io')

# ページに差し込むスクリプト（演出の記録＋自動操作）
INJECT = """<script>
// じぶん3匹・あいて3匹を仕込む（localStorage なので、無ければ入れて読み直す）
(function(){
  try{
    if(!localStorage.getItem('__mockready')){
      localStorage.setItem('gbl_party', JSON.stringify([
        {key:'azumarill',fast:'BUBBLE',c1:'ICE_BEAM',c2:'PLAY_ROUGH'},
        {key:'medicham',fast:'COUNTER',c1:'POWER_UP_PUNCH',c2:'ICE_PUNCH'},
        {key:'bastiodon',fast:'SMACK_DOWN',c1:'STONE_EDGE',c2:'FLAMETHROWER'}]));
      localStorage.setItem('gbl_mock_foes', JSON.stringify([
        {key:'stunfisk_galarian',fast:'MUD_SHOT',c1:'ROCK_SLIDE',c2:'EARTHQUAKE'},
        {key:'skarmory',fast:'AIR_SLASH',c1:'SKY_ATTACK',c2:'BRAVE_BIRD'},
        {key:'venusaur',fast:'VINE_WHIP',c1:'FRENZY_PLANT',c2:'SLUDGE_BOMB'}]));
      localStorage.setItem('gbl_mock_rt','0');
      localStorage.setItem('gbl_fx','1');
      localStorage.setItem('__mockready','1');
      location.replace(location.href);
    }
  }catch(e){}
})();
window.__fx = [];
window.__log = function(s){ window.__fx.push(s); };
function dump(){
  var d=document.getElementById('__fxout');
  if(!d){ d=document.createElement('div'); d.id='__fxout'; d.style.display='none';
    (document.body||document.documentElement).appendChild(d); }
  d.textContent=JSON.stringify(window.__fx);
}
setInterval(dump, 120);
addEventListener('load', function(){
  // 演出レイヤーの出入りを記録
  var t0 = Date.now();
  function watch(){
    // ⚠ #fxlayer はバトル開始時に作られるので、先に自分で作って監視を始める
    //   （待っているとVSの演出を取りこぼす）。fxShow は同じidを使い回す
    var layer=document.getElementById('fxlayer');
    if(!layer){ layer=document.createElement('div'); layer.id='fxlayer'; document.body.appendChild(layer); }
    new MutationObserver(function(ms){
      ms.forEach(function(m){ [].forEach.call(m.addedNodes, function(n){
        if(n.nodeType===1){
          var k=(n.className||'').replace('fxitem','').trim();
          var tx=(n.textContent||'').replace(/\\s+/g,' ').trim().slice(0,24);
          window.__log('FX '+k+' : '+tx);
        }
      }); });
    }).observe(layer,{childList:true});
    window.__log('watch ok');
  }
  watch();
  // 自動操作: ①スタート ②少し待って⇄交代
  function step1(){
    var b=document.querySelector('.rbstart');
    if(!b){ setTimeout(step1,150); return; }
    window.__log('-- スタートを押す --');
    b.click();
    setTimeout(step2, 2600);
  }
  function step2(){
    var bs=[].slice.call(document.querySelectorAll('.hmsw')).filter(function(x){return !x.disabled;});
    window.__log('-- ⇄ボタン: '+document.querySelectorAll('.hmsw').length+'個 / 押せるの '+bs.length+'個 --');
    if(!bs.length){
      // クールタイム表示で押せないときは無効を外して押す（ローカル確認用）
      var all=[].slice.call(document.querySelectorAll('.hmsw'));
      if(all.length){ all[0].disabled=false; bs=[all[0]]; window.__log('-- 無効を外して押す --'); }
    }
    if(bs.length){ window.__log('-- ⇄交代を押す --'); bs[0].click(); }
    setTimeout(step3, 5200);
  }
  // ③ ✕終了 → もう一度スタート（前回の交代が勝手に再現されないかを見る）
  function step3(){
    var e=document.querySelector('.hend');
    window.__log('-- ✕終了を押す --');
    if(e) e.click();
    setTimeout(function(){
      var b=document.querySelector('.rbstart');
      window.__log('-- 2回目のスタート（ここから先に交代が出たら不合格） --');
      if(b) b.click(); else window.__log('!! スタートボタンが見つからない');
      setTimeout(function(){ window.__log('-- おわり --'); dump(); }, 6000);
    }, 1200);
  }
  setTimeout(step1, 1600);
});
</script>"""


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        p = posixpath.normpath(urllib.parse.unquote(p)).lstrip('/')
        f = ROOT / p
        if f.is_dir():
            f = f / 'index.html'
        if not f.is_file():
            self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers(); return
        data = f.read_bytes()
        ct = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
              '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
              }.get(f.suffix.lower(), 'application/octet-stream')
        if f.suffix.lower() == '.html':
            t = data.decode('utf-8', 'ignore')
            m = re.search(r'</body>', t, re.I)
            t = (t[:m.start()] + INJECT + t[m.start():]) if m else (t + INJECT)
            data = t.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)


def main():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    # 模擬戦の枠をそろえた状態で開く（localStorage はプロファイルに残らないので URL 経由で渡す）
    party = [{"key": "azumarill", "fast": "BUBBLE", "c1": "ICE_BEAM", "c2": "PLAY_ROUGH"},
             {"key": "medicham", "fast": "COUNTER", "c1": "POWER_UP_PUNCH", "c2": "ICE_PUNCH"},
             {"key": "bastiodon", "fast": "SMACK_DOWN", "c1": "STONE_EDGE", "c2": "FLAMETHROWER"}]
    gt = 'stunfisk_galarian~0~MUD_SHOT~ROCK_SLIDE~EARTHQUAKE,skarmory~0~AIR_SLASH~SKY_ATTACK~BRAVE_BIRD,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB'
    q = f'md=mock&gt={urllib.parse.quote(gt)}'
    url = f'http://127.0.0.1:{port}/gbl/?{q}'

    c = sorted(glob.glob(os.path.expanduser(
        '~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
    chrome = c[-1]
    prof = tempfile.mkdtemp(prefix='gonavi-mock-')
    try:
        # じぶんの3匹は localStorage 頼みなので、起動直後に書いてから開き直す小細工をする
        boot = ROOT / 'scratchpad' / '_mockboot.html'
        r = subprocess.run([chrome, '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                            f'--user-data-dir={prof}', '--virtual-time-budget=70000',
                            '--dump-dom', url], capture_output=True, text=True, timeout=180)
        dom = r.stdout
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    m = re.search(r'id="__fxout"[^>]*>(.*?)</div>', dom, re.S)
    if not m:
        print('記録を取り出せませんでした（ページが最後まで動いていない可能性）')
        print(dom[:600])
        return 1
    import html as H2
    try:
        rows = json.loads(H2.unescape(m.group(1)))
    except Exception as e:
        print('記録の形が読めません:', e); print(m.group(1)[:400]); return 1
    print('―― 流れた演出（上から順） ――')
    for x in rows:
        print(' ', x)
    # 1回目のバトル（スタート〜✕終了）と2回目（再スタート以降）に分けて見る
    def idx(mark):
        for i, x in enumerate(rows):
            if mark in x:
                return i
        return len(rows)
    i_end, i_re = idx('✕終了'), idx('2回目のスタート')
    first = [x for x in rows[:i_end] if x.startswith('FX ')]
    second = [x for x in rows[i_re:] if x.startswith('FX ')]
    print()
    print('■ 1回目（スタート → ⇄交代）')
    vs1 = [i for i, x in enumerate(first) if 'fxvs' in x]
    sw1 = [i for i, x in enumerate(first) if 'fxsw' in x]
    ok1 = len(vs1) == 1 and (not sw1 or max(vs1) < min(sw1))
    print(f'  VS {len(vs1)}回 / 交代 {len(sw1)}回 … ' +
          ('✅ VSは1回だけで、交代より前' if ok1 else '❌ 交代のあとにVSが出ている'))
    print('■ 2回目（✕終了 → もう一度スタート）')
    me2 = [x for x in second if 'fxsw' in x and ' me ' in x]
    vs2 = [x for x in second if 'fxvs' in x]
    ok2 = not me2
    print(f'  VS {len(vs2)}回 / じぶんの交代 {len(me2)}回 … ' +
          ('✅ 前回の交代は再現されない' if ok2 else '❌ 押していないのに じぶんが交代している'))
    for x in second:
        print('   ', x)
    print()
    print('判定: ' + ('✅ 両方とも直っている' if (ok1 and ok2) else '❌ まだ残っている'))
    return 0 if (ok1 and ok2) else 1
    httpd.shutdown()


if __name__ == '__main__':
    sys.exit(main() or 0)
