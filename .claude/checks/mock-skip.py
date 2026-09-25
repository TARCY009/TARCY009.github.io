#!/usr/bin/env python3
"""模擬戦の「⏩決断まで」「⏸」まわりの通し検査（2026-09-25の点検で見つけた3つの再発防止・mock-sp.py と同じ作り）。

画面なしブラウザの仮想時間で本物の模擬戦を回し、**⏸で止めてから⏩決断まで**（と、演出中に⏩）で決着まで進める。
見ること（1つでも破れたら不合格）:
 P. 決着に達したら決着パネル（再戦・入れ替えて再戦・終了）が出る（⏸中に⏩で決着に達したときも・🎬OFFでも）
 F. 🎬ONなら決着の演出（WIN/LOSE）が流れる（GBL・ロケット団）
 D. 撃つと答えたじぶんのSPは、⏩で飛ばしても威力調整のメーターを通る（未確定のまま100%で撃たれない）
 C. 演出の列に「中身の無い演出」が入らない（同じ行が何度も積まれて、一呼吸ずつ空白が積み重なる＝画面が10秒以上止まる）
 E. 画面のエラー・起動の赤い帯が出ない ／ G. 最後まで終わる（止まらない）
使い方: python3 .claude/checks/mock-skip.py [--quick]
"""
import os, re, sys, json, glob, socket, shutil, tempfile, threading, pathlib, subprocess, random
import http.server, urllib.parse, posixpath, html as H2

ROOT = pathlib.Path(__file__).resolve().parents[2]

HEAD = r"""<script>
(function(){
  var CFG = __CFG__;
  var s = (CFG.seed * 7 + 13) >>> 0;
  Math.random = function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  window.__ERR = [];
  addEventListener('error', function(e){ window.__ERR.push('error: ' + String(e.message || e) + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno); });
  addEventListener('unhandledrejection', function(e){ window.__ERR.push('reject: ' + String(e.reason && (e.reason.message || e.reason)).slice(0,200)); });
  var ce = console.error; console.error = function(){ window.__ERR.push('console.error: ' + [].slice.call(arguments).join(' ').slice(0,200)); return ce.apply(console, arguments); };
  try{
    if(localStorage.getItem('__skipready') !== CFG.id){
      localStorage.clear();
      localStorage.setItem('gbl_party', JSON.stringify(CFG.party));
      localStorage.setItem('gbl_mock_rt', '0');
      localStorage.setItem('gbl_mock_ai', CFG.ai);
      localStorage.setItem('gbl_fx', CFG.fx ? '1' : '0');
      localStorage.setItem('gbl_snd', '0');
      localStorage.setItem('__skipready', CFG.id);
      location.replace(location.href);
    }
  }catch(e){}
})();
</script>"""

BODY = r"""<script>
(function(){
  var CFG = __CFG__;
  var seed = CFG.seed >>> 0;
  function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  var battles = [], cur = null, done = false;
  function now(){ return Math.round(performance.now()); }
  function log(k, x){ if(cur) cur.ev.push([now(), k, x || '', (typeof RBV !== 'undefined' ? RBV.cur : -1)]); }
  function out(){
    var d=document.getElementById('__out');
    if(!d){ d=document.createElement('div'); d.id='__out'; d.style.display='none'; document.body.appendChild(d); }
    d.textContent = JSON.stringify({ done: done, battles: battles, err: window.__ERR, boot: (document.getElementById('booterr')||{}).textContent || '' });
  }
  setInterval(out, 500);
  function q(s){ return document.querySelector(s); }
  function qa(s){ return [].slice.call(document.querySelectorAll(s)); }
  function fxBusy(){ return (typeof FX_BUSY !== 'undefined' && FX_BUSY) || (typeof FX_Q !== 'undefined' && FX_Q.length > 0); }
  function isEnded(){
    if(typeof RBV === 'undefined' || !RBV.started) return false;
    var hp = q('.hplay');
    return (hp && hp.textContent === '↻') || !!q('#gbend') || (!q('.bfull') && !q('.rbwin') && !q('#spqwin'));
  }
  addEventListener('load', function(){
    // 威力調整のメーターは差し替え(人の操作が要る部品): ランダムな出来ですぐ確定
    if(typeof spqMeter !== 'undefined') window.spqMeter = function(mv, fin){ log('meter', mv); setTimeout(function(){ fin([.25,.5,.75,1][Math.floor(rnd()*4)]); }, 60); };
    var ofr = window.fxRun;
    if(ofr) window.fxRun = function(list, d2, onHit){ log('fxRun', 'busy=' + FX_BUSY + ' q=' + FX_Q.length); return ofr.apply(this, arguments); };
    var of = window.fxOne;
    if(of) window.fxOne = function(f){ if(f) log('fx:' + f.k + (f.side ? '1' : '0'), f.name || f.mv || ''); return of.apply(this, arguments); };
    var lastCur = -1, lastMove = now(), endAt = 0, endAt2 = 0;
    function finish(){
      cur.fin = now();
      cur.pend = Object.keys(RB.ans).filter(function(k){ return RB.ans[k] && RB.ans[k].pwPend; });
      cur.pend.forEach(function(k){
        var li = +k.split(':')[0], seq = +k.split(':')[3];
        var fired = qa('.rbfeed .fi.in[data-li="' + li + '"][data-fx]').reduce(function(a, el){ try { return a + fxList(el).filter(function(f){ return f && f.k === 'sp' && !f.side; }).length; } catch(x){ return a; } }, 0);
        if(fired > seq) log('D', k + ' (じぶんのSPが' + fired + '回表示)');
      });
      cur.fxOn = (typeof FX !== 'undefined') ? FX.on : null;
      var pn = q('#gbend'); cur.panel = !!pn;
      battles.push(cur); cur = null;
    }
    function drive(){
      if(done) return;
      if(!cur){
        var b = q('.rbstart');
        if(b){ cur = { ev: [], i: battles.length, t0: now() }; RBV.speed = 1; b.click(); }
        return setTimeout(drive, 150);
      }
      if(isEnded()){
        if(!endAt) endAt = now();
        if(fxBusy() && now() - endAt < 90000){ endAt2 = now(); return setTimeout(drive, 200); }
        var gbl = CFG.page === 'gbl';
        if(gbl && !q('#gbend') && now() - (endAt2 || endAt) < 20000) return setTimeout(drive, 200);
        // ロケット団には決着パネルが無いので、演出の列が空いてから決着の演出(260ms後に始まる)が出るまで少し待つ
        if(!gbl && now() - (endAt2 || endAt) < 6000) return setTimeout(drive, 200);
        finish(); endAt = 0; endAt2 = 0;
        if(battles.length >= CFG.n){ done = true; out(); return; }
        var pn = q('#gbend'); if(pn) pn.querySelector('.gbe-end').click(); else { var e = q('.hend'); if(e) e.click(); }
        return setTimeout(drive, 1200);
      }
      if(RBV.cur !== lastCur){ lastCur = RBV.cur; lastMove = now(); }
      var hp = q('.hplay'), paused = hp && hp.textContent === '▶';
      if(!q('.rbwin') && !q('#spqwin') && !paused && now() - lastMove > 30000){ log('STUCK', RBV.cur); lastMove = now(); }
      if(now() - cur.t0 > 900000){ log('TIMEOUT'); finish(); done = true; out(); return; }
      var w = q('.rbwin:not(.foe)');
      if(w){
        var bs = qa('.rbwin:not(.foe) .rwb button').filter(function(x){ return !x.classList.contains('wdet') && !x.disabled; });
        if(bs.length){ var pick = bs[Math.floor(rnd()*bs.length)]; log('answer', pick.textContent.replace(/\s+/g,' ').trim().slice(0,20)); pick.click(); }
        return setTimeout(drive, 120);
      }
      if(q('#spqwin')) return setTimeout(drive, 100);
      if(CFG.pat === 'pause-skip'){
        if(paused){ var sk = q('.hskip'); if(sk){ log('act', '⏩(⏸中)'); sk.click(); } }
        else if(hp && rnd() < .5){ log('act', '⏸'); hp.click(); }
      } else {   // fx-skip: 演出中に⏩
        if(typeof FX_BUSY !== 'undefined' && FX_BUSY && rnd() < .6){ var sk1 = q('.hskip'); if(sk1){ log('act', '⏩(演出中)'); sk1.click(); } }
      }
      setTimeout(drive, 110);
    }
    setTimeout(drive, 1500);
  });
})();
</script>"""


def make_handler(cfg):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'
        def log_message(self, *a): pass
        def handle(self):
            try: super().handle()
            except (BrokenPipeError, ConnectionResetError): pass
        def do_GET(self):
            p = posixpath.normpath(urllib.parse.unquote(urllib.parse.urlparse(self.path).path)).lstrip('/')
            f = ROOT / p
            if f.is_dir(): f = f / 'index.html'
            if not f.is_file():
                self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers(); return
            data = f.read_bytes()
            ct = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
                  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'}.get(f.suffix.lower(), 'application/octet-stream')
            if f.suffix.lower() == '.html':
                t = data.decode('utf-8', 'ignore'); c = json.dumps(cfg)
                t = re.sub(r'<head[^>]*>', lambda m: m.group(0) + HEAD.replace('__CFG__', c), t, count=1, flags=re.I)
                m = re.search(r'</body>', t, re.I); inj = BODY.replace('__CFG__', c)
                t = (t[:m.start()] + inj + t[m.start():]) if m else (t + inj)
                data = t.encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', ct); self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(data)
    return H


def find_browser():
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
    c = c or sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell'))
                    + glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/headless_shell')))
    return c[-1] if c else None


def run_one(cfg, urlq, budget):
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), make_handler(cfg))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/{cfg["page"]}/?{urlq}'
    prof = tempfile.mkdtemp(prefix='gonavi-skip-')
    try:
        r = subprocess.run([find_browser(), '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}',
                            f'--virtual-time-budget={budget}', '--dump-dom', url], capture_output=True, text=True, timeout=1500)
    finally:
        shutil.rmtree(prof, ignore_errors=True); httpd.shutdown()
    m = re.search(r'id="__out"[^>]*>(.*?)</div>', r.stdout, re.S)
    if not m: return {'err': ['結果を取り出せませんでした'], 'battles': [], 'done': False}
    return json.loads(H2.unescape(m.group(1)))


def judge(b, cfg):
    bad = []; ev = b['ev']
    if any(x[1] == 'STUCK' for x in ev): bad.append('G 再生が止まった')
    if any(x[1] == 'TIMEOUT' for x in ev): bad.append('G 時間内に終わらない')
    if cfg['page'] == 'gbl' and not b.get('panel'): bad.append('P 決着パネル(再戦・入れ替えて再戦・終了)が出ない')
    if b.get('fxOn') and not any(x[1] == 'fx:end0' for x in ev): bad.append('F 🎬ONなのに決着の演出(WIN/LOSE)が流れていない')
    for x in ev:
        if x[1] == 'D': bad.append('D 撃つと答えたSPが威力調整を通らずに撃たれた: ' + x[2])
    # C: 始まった演出(busy=false の fxRun)のあとに、次の fxRun までひとつも演出(fx:)が出ていない＝中身の無い演出
    # (⏩を押した直後に始まった並びが空になるのは正しい動きなので、空のまま**一呼吸ぶん(800ms以上)止まる**ものだけ数える。
    #  直す前は FX_PRE＋FX_POST≒1.1秒ずつ止まっていた)
    empty = 0
    for i, x in enumerate(ev):
        if x[1] == 'fxRun' and 'busy=false' in x[2]:
            nxt = next((y for y in ev[i + 1:] if y[1] == 'fxRun' or y[1].startswith('fx:')), None)
            if nxt and nxt[1] == 'fxRun' and nxt[0] - x[0] > 800: empty += 1
    if empty: bad.append(f'C 中身の無い演出で{empty}回、一呼吸ぶん止まった(演出の列に同じ行が積まれて空回り)')
    return bad


POOL = [
    {"key": "azumarill", "fast": "BUBBLE", "c1": "ICE_BEAM", "c2": "PLAY_ROUGH"},
    {"key": "medicham", "fast": "COUNTER", "c1": "POWER_UP_PUNCH", "c2": "ICE_PUNCH"},
    {"key": "machamp", "fast": "COUNTER", "c1": "CROSS_CHOP", "c2": "CLOSE_COMBAT"},
    {"key": "swampert", "fast": "MUD_SHOT", "c1": "HYDRO_CANNON", "c2": "EARTHQUAKE"},
    {"key": "ninetales_alolan", "fast": "CHARM", "c1": "PSYSHOCK", "c2": "ICE_BEAM"},
    {"key": "stunfisk_galarian", "fast": "MUD_SHOT", "c1": "ROCK_SLIDE", "c2": "EARTHQUAKE"},
    {"key": "registeel", "fast": "LOCK_ON", "c1": "FLASH_CANNON", "c2": "FOCUS_BLAST"},
]
foe_str = lambda t: ','.join(f"{p['key']}~0~{p['fast']}~{p['c1']}~{p['c2']}" for p in t)


def main():
    quick = '--quick' in sys.argv
    R = random.Random(int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 20260925)
    n = 2 if quick else 3
    party = [POOL[0], POOL[1], POOL[2]]
    gt = 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[5], POOL[4], POOL[3]]))
    runs = [
        ('🎬OFF・⏸してから⏩で決着まで', {'page': 'gbl', 'party': party, 'ai': 'normal', 'fx': False, 'pat': 'pause-skip'}, gt),
        ('🎬ON・⏸してから⏩で決着まで', {'page': 'gbl', 'party': party, 'ai': 'hard', 'fx': True, 'pat': 'pause-skip'}, gt),
        ('🎬ON・演出中に⏩', {'page': 'gbl', 'party': party, 'ai': 'normal', 'fx': True, 'pat': 'fx-skip'}, gt),
        ('ロケット団・🎬ON・⏸してから⏩で決着まで', {'page': 'rocket', 'party': [POOL[6], POOL[3], POOL[0]], 'ai': 'normal', 'fx': True, 'pat': 'pause-skip'},
         'rt=1&rk=leader&rw=sierra&rl=000&rp=' + urllib.parse.quote('amaura~~,ferrothorn~~,houndoom~~')),
    ]
    if quick: runs = [runs[0], runs[2]]
    total_bad = 0; total_b = 0
    for tag, cfg, urlq in runs:
        cfg = {**cfg, 'n': n, 'seed': R.randrange(1, 2**31), 'id': f'sk-{R.random()}'}
        res = run_one(cfg, urlq, 900000)
        probs = []
        if res.get('err'): probs += ['E ' + x[:160] for x in res['err'][:5]]
        if res.get('boot'): probs.append('E 起動の赤い帯: ' + res['boot'][:120])
        if not res.get('done'): probs.append('G 決められた数の対戦が終わらなかった')
        for b in res.get('battles', []):
            total_b += 1
            probs += [f'{p}（{b["i"]}戦目）' for p in judge(b, cfg)]
        total_bad += len(probs)
        acts = sum(1 for b in res.get('battles', []) for x in b['ev'] if x[1] == 'act')
        meters = sum(1 for b in res.get('battles', []) for x in b['ev'] if x[1] == 'meter')
        print(('✅ ' if not probs else '❌ ') + tag + f'　{len(res.get("battles", []))}戦・⏩/⏸ {acts}回・メーター {meters}回')
        for p in probs[:10]: print('    ', p)
    print(f'対戦 {total_b}戦・問題 {total_bad}件')
    return 0 if total_bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
