#!/usr/bin/env python3
"""模擬戦のランダム操作検査（2026-09-25の点検用・mock-sp.py を土台に、既存の検査が見ていない操作を混ぜる）。

画面なしブラウザの仮想時間で本物の /gbl/・/rocket/ の模擬戦を回し、次をランダムに混ぜる:
  選択式: 質問への答え・チップの巻き戻し(選び直し・↺おまかせ)・⏩決断まで・⏭コマ送り・⏸/▶・×N倍速・🎬演出の切替・⇄交代
  リアルタイム: SPボタン(連打も)・⇄交代・シールドの窓のあいだの押下
  決着のあと: 再戦／入れ替えて再戦／✕→✕終了／終了 をランダムに選び、次のバトルが始まるかを見る
  見せ合い(6匹→3匹)・ロケット団(したっぱ／リーダー)・じぶん1匹だけ・🎬OFF・🔊ON も回す
見ること: E エラー(console.error/例外/起動の赤い帯)・W 警告(タイムラインの順番・時系列の守り以外)・F 再生が止まる・G 最後まで終わる・
  R 演出の取りこぼし・P 決着パネルと3つのボタン・DOCK 浮かぶスタートボタンがバトル中に出る/本物が見えているのに出る・
  T 画面に NaN/undefined・H HPバーの幅が0〜100%の外・X ✕終了/終了のあとに手や全画面が残る
使い方: python3 inspect-mock.py [--only 0,2] [--seed N]
"""
import os, re, sys, json, glob, socket, shutil, tempfile, threading, pathlib, subprocess, random
import http.server, urllib.parse, posixpath, html as H2

ROOT = pathlib.Path(__file__).resolve().parents[2]

HEAD = r"""<script>
(function(){
  var CFG = __CFG__;
  // AIの癖の乱数(RB.rseed)も同じ種で決まるように、Math.random を先に差し替える(同じ種なら同じバトル)
  var s = (CFG.seed * 7 + 13) >>> 0;
  Math.random = function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  window.__ERR = []; window.__WARN = [];
  addEventListener('error', function(e){ window.__ERR.push('error: ' + String(e.message || e) + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno); });
  addEventListener('unhandledrejection', function(e){ window.__ERR.push('reject: ' + String(e.reason && (e.reason.stack || e.reason.message) || e.reason).slice(0,200)); });
  var ce = console.error; console.error = function(){ window.__ERR.push('console.error: ' + [].slice.call(arguments).join(' ').slice(0,200)); return ce.apply(console, arguments); };
  var cw = console.warn; console.warn = function(){ window.__WARN.push([].slice.call(arguments).map(function(a){ return typeof a === 'string' ? a : JSON.stringify(a); }).join(' ').slice(0,220)); return cw.apply(console, arguments); };
  try{
    if(localStorage.getItem('__inspready') !== CFG.id){
      localStorage.clear();
      localStorage.setItem('gbl_party', JSON.stringify(CFG.party));
      localStorage.setItem('gbl_mock_rt', CFG.rt ? '1' : '0');
      localStorage.setItem('gbl_mock_ai', CFG.ai);
      localStorage.setItem('gbl_fx', CFG.fx ? '1' : '0');
      localStorage.setItem('gbl_snd', CFG.snd ? '1' : '0');
      if(CFG.sd) localStorage.setItem('gbl_showdown', JSON.stringify({ on: true, my: CFG.sd.my, foe: CFG.sd.foe, pick: CFG.sd.pick, edit: false, sug: false }));
      localStorage.setItem('__inspready', CFG.id);
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
  var battles = [], cur = null, done = false, actions = {};
  function now(){ return Math.round(performance.now()); }
  function log(k, x){ if(cur) cur.ev.push([now(), k, x || '', (typeof RBV !== 'undefined' ? RBV.cur : -1)]); }
  function act(k){ actions[k] = (actions[k]||0) + 1; log('act:' + k); }
  function out(){
    var d=document.getElementById('__out');
    if(!d){ d=document.createElement('div'); d.id='__out'; d.style.display='none'; document.body.appendChild(d); }
    d.textContent = JSON.stringify({ done: done, battles: battles, err: window.__ERR, warn: window.__WARN, actions: actions,
      boot: (document.getElementById('booterr')||{}).textContent || '' });
  }
  setInterval(out, 500);
  function q(s){ return document.querySelector(s); }
  function qa(s){ return [].slice.call(document.querySelectorAll(s)); }
  function vis(el){ return !!(el && el.getClientRects && el.getClientRects().length); }
  function busy(){ return q('.rbwin') || q('#spqwin'); }
  function bfull(){ return q('.bfull'); }
  function started(){ return typeof RBV !== 'undefined' && RBV.started; }
  function isEnded(){
    if(!started()) return false;
    var hp = q('.hplay');
    if(hp && hp.textContent === '↻') return true;
    if(q('#gbend')) return true;
    // 全画面が解けている＝決着(決着の演出のあいだも解けている)
    return !bfull() && !busy();
  }
  function textBad(){
    var t = ((q('.gbbody')||q('.rkbody')||{}).textContent || '');
    var m = t.match(/NaN|undefined|\[object|null%/);
    return m ? m[0] + ' … ' + t.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g,' ') : '';
  }
  function hpBad(){
    return qa('.hb i').map(function(b){ var w = parseFloat(b.style.width); return isNaN(w) || w < 0 || w > 100.01 ? b.style.width : null; }).filter(Boolean);
  }
  addEventListener('load', function(){
    // 威力調整のメーターは差し替え(人の操作が要る部品)。ランダムな出来ですぐ確定・1割でやめる
    if(typeof spqMeter !== 'undefined'){
      window.spqMeter = function(mv, fin, cancel){
        log('meter', mv);
        var w = document.createElement('div'); w.id = 'spqwin'; document.body.appendChild(w);
        setTimeout(function(){ w.remove(); if(cancel && rnd() < .1){ log('meterX'); cancel(); } else { var pw=[.25,.5,.75,1][Math.floor(rnd()*4)]; log('meterOK', pw); fin(pw); } }, 60);
      };
    }
    var ofr = window.fxRun;
    if(ofr) window.fxRun = function(list, done, onHit){
      var live = list.length > 0 && list.every(fxLive);
      log('fxRun', 'n=' + list.length + ' live=' + live + ' busy=' + FX_BUSY + ' q=' + FX_Q.length + ' gen=' + FX_GEN + ' ' + list.map(function(el){ return (el.dataset.gt||'') + ':' + (el.dataset.fx||'').slice(0,30); }).join('|'));
      var g = FX_GEN + 1;
      return ofr.call(this, list, function(){ log('fxDone', 'gen=' + g + ' now=' + FX_GEN); return done.apply(this, arguments); }, onHit);
    };
    var oes = window.gbEndShow;
    if(oes) window.gbEndShow = function(){ log('gbEndShow', arguments[0]); return oes.apply(this, arguments); };
    var lastEF = null, lastEP = null;
    setInterval(function(){ if(typeof RBV === 'undefined') return; if(RBV.endFx !== lastEF){ lastEF = RBV.endFx; log('endFx', String(lastEF).slice(0,12)); } if(RBV.endPanel !== lastEP){ lastEP = RBV.endPanel; log('endPanel', String(lastEP).slice(0,12)); } }, 100);
    var of = window.fxOne;
    if(of) window.fxOne = function(f){
      if(f) log('fx:' + f.k + (f.side ? '1' : '0'), f.name || f.mv || f.outcome || '');
      return of.apply(this, arguments);
    };
    new MutationObserver(function(ms){ ms.forEach(function(m){ [].forEach.call(m.addedNodes, function(n){
      if(n.nodeType !== 1) return;
      if(n.id === 'spstfx') log('spstart');
      if(n.classList && n.classList.contains('swpfx')) log('swpfx');
      if(n.id === 'gbend') { log('panel', n.textContent.replace(/\s+/g,' ').trim().slice(0,60)); if(cur) cur.panels = (cur.panels||0) + 1; }
    }); }); }).observe(document.body, { childList: true });
    var lastCur = -1, lastMove = now(), endAt = 0, endAt2 = 0, endAct = null, lastRdy = [];
    function startBattle(){
      var b = q('.rbstart');
      if(!b){ return false; }
      cur = { ev: [], i: battles.length, t0: now(), via: endAct || 'start' };
      endAct = null;
      if(!CFG.rt && typeof RBV !== 'undefined' && rnd() < .7) RBV.speed = 4;
      // 浮かぶスタートボタンが見えていれば、たまにそちらを押す
      var d = q('.startdock');
      if(d && !d.hidden && rnd() < .5){ act('startdock'); d.click(); } else b.click();
      return true;
    }
    function finishBattle(){
      cur.fin = now();
      try { cur.fxMiss = qa('.rbfeed .fi.in[data-fx]').reduce(function(a, el){
          fxList(el).forEach(function(f){ if (f && !RBV.fxDone.has(fxKey1(el, f))) a.push(el.dataset.gt + ':' + f.k + (f.side ? '1' : '0') + ':' + (f.name || f.mv || '')); }); return a; }, []);
      } catch (x) { cur.fxMiss = ['(調べられず) ' + x]; }
      cur.textBad = textBad(); cur.hpBad = hpBad();
      cur.pend = Object.keys(RB.ans).filter(function(k){ return RB.ans[k] && RB.ans[k].pwPend; });
      cur.pend.forEach(function(k){
        var li = +k.split(':')[0], seq = +k.split(':')[3];
        var fired = qa('.rbfeed .fi.in[data-li="' + li + '"][data-fx]').reduce(function(a, el){ try { return a + fxList(el).filter(function(f){ return f && f.k === 'sp' && !f.side; }).length; } catch(x){ return a; } }, 0);
        if(fired > seq) log('D 未確定(メーター前)の答え ' + k + ' なのに、その対面でじぶんのSPが' + fired + '回表示されている');
      });
      cur.fxOn = (typeof FX !== 'undefined') ? FX.on : null;
      var pn = q('#gbend');
      cur.panel = !!pn; cur.panelTxt = pn ? pn.textContent.replace(/\s+/g,' ').trim().slice(0,80) : '';
      battles.push(cur); cur = null;
    }
    function pickSd(){
      // 見せ合い: 選出が空なら3匹を選ぶ(相性表の行を押す)
      var rows = qa('.sdmr').filter(function(r){ return r.getAttribute('aria-pressed') !== 'true'; });
      var on = qa('.sdmr[aria-pressed="true"]').length;
      if(on >= 3) return true;
      if(!rows.length) return false;
      var r = rows[Math.floor(rnd()*rows.length)]; act('sdpick'); r.click();
      return false;
    }
    function drive(){
      if(done) return;
      // ---- 開始前 ----
      if(!cur){
        if(CFG.sd && !q('.rbstart')){ pickSd(); return setTimeout(drive, 200); }
        if(!startBattle()){
          // 再戦はボタンを押さずに始まる
          if(started() && bfull()){ cur = { ev: [], i: battles.length, t0: now(), via: endAct || 're' }; endAct = null; }
          else if(now() - lastMove > 20000){ log('NOSTART'); lastMove = now(); }
        }
        return setTimeout(drive, 150);
      }
      // ---- 決着 ----
      if(isEnded()){
        if(!endAt) endAt = now();
        var pn = q('#gbend');
        var gbl = CFG.page === 'gbl';
        var fxBusy = (typeof FX_BUSY !== 'undefined' && FX_BUSY) || (typeof FX_Q !== 'undefined' && FX_Q.length > 0);
        if(fxBusy && now() - endAt < 90000){ endAt2 = now(); return setTimeout(drive, 200); }
        if(gbl && !pn && now() - (endAt2 || endAt) < 20000) return setTimeout(drive, 200);
        if(pn) log('panelAt', (now() - endAt) + 'ms後');
        // 浮かぶスタートボタンは決着後(startedのまま)には出ないはず
        var dk = q('.startdock'); if(dk && !dk.hidden) log('DOCK 決着後に浮かぶスタートボタン');
        finishBattle(); endAt = 0; endAt2 = 0;
        if(battles.length >= CFG.n){ if(pn) pn.querySelector('.gbe-end').click(); else { var e0 = q('.hend'); if(e0) e0.click(); } done = true; out(); return; }
        var r = rnd();
        if(pn){
          if(r < .4){ endAct = 're'; act('再戦'); pn.querySelector('.gbe-re').click();
            var ok = !q('#gbend') && !!bfull() && RBV.started && RBV.cur === 0 && !Object.keys(RB.ans).length;
            if(!ok) log('P 再戦を押してもすぐ始まらない ' + JSON.stringify({gbend: !!q('#gbend'), bfull: !!bfull(), started: RBV.started, cur: RBV.cur, ans: Object.keys(RB.ans).length}));
            cur = { ev: [], i: battles.length, t0: now(), via: 're' }; endAct = null;
          } else if(r < .7){ endAct = 'sw'; act('入れ替えて再戦'); pn.querySelector('.gbe-sw').click();
            setTimeout(function(){ if(bfull() || RBV.started) log('X 入れ替えて再戦のあとに全画面/開始状態が残る'); if(Object.keys(RB.ans).length) log('X 入れ替えて再戦のあとに手が残る ' + Object.keys(RB.ans).join(',')); }, 300);
          } else if(r < .85){ endAct = 'x+end'; act('✕閉じる'); pn.querySelector('.gbendx').click();
            setTimeout(function(){ if(q('#gbend')) log('P ✕で閉じたのにパネルが残る'); var e = q('.hend'); if(e){ act('✕終了'); e.click(); }
              setTimeout(function(){ if(bfull() || RBV.started) log('X ✕終了のあとに全画面/開始状態が残る'); if(Object.keys(RB.ans).length) log('X ✕終了のあとに手が残る'); }, 300); }, 400);
          } else { endAct = 'end'; act('終了'); pn.querySelector('.gbe-end').click();
            setTimeout(function(){ if(bfull() || RBV.started) log('X 終了のあとに全画面/開始状態が残る'); if(Object.keys(RB.ans).length) log('X 終了のあとに手が残る'); if(scrollY > 40) log('X 終了のあとページの一番上ではない scrollY=' + scrollY); }, 900);
          }
        } else {
          if(gbl) log('P 決着パネルが出ない');
          var e2 = q('.hend'); if(e2){ endAct = 'x'; act('✕終了'); e2.click(); }
        }
        return setTimeout(drive, 1200);
      }
      // ---- バトル中の見張り ----
      if(RBV.cur !== lastCur){ lastCur = RBV.cur; lastMove = now(); }
      var dock = q('.startdock');
      if(dock && !dock.hidden && bfull()) { log('DOCK バトル中に浮かぶスタートボタン'); dock.hidden = true; }
      var rb = q('.rbstart:not(.bfull *)'); if(dock && !dock.hidden && rb && vis(rb)){ var rr = rb.getBoundingClientRect(); if(rr.top >= 0 && rr.bottom <= innerHeight) log('DOCK 本物のボタンが見えているのに浮かぶ'); }
      var hp = q('.hplay'), paused = hp && hp.textContent === '▶';
      if(!busy() && !paused && now() - lastMove > 30000){ log('STUCK', RBV.cur + ' playing=' + RBV.playing + ' timer=' + !!RBV.timer + ' fxq=' + (typeof FX_Q !== 'undefined' ? FX_Q.length : '?') + ' busy=' + (typeof FX_BUSY !== 'undefined' ? FX_BUSY : '?') + ' fx=' + ((q('#fxlayer')||{}).textContent||'').slice(0,30)); lastMove = now(); }
      if(now() - cur.t0 > 1500000){ log('TIMEOUT'); finishBattle(); done = true; out(); return; }
      var tb = textBad(); if(tb && !cur.tb){ cur.tb = 1; log('T 画面に変な文字 ' + tb); }
      // ---- 質問(じぶんの窓) ----
      var w = q('.rbwin:not(.foe)');
      if(w){
        if(CFG.rt && !w.dataset.spTried){
          w.dataset.spTried = '1';
          var rw = qa('.hsp').filter(function(x){ return lastRdy.indexOf(x.dataset.mv) >= 0; });
          if(rw.length && rnd() < .6){ var b3 = rw[Math.floor(rnd()*rw.length)]; act('窓でSP'); b3.click(); if(rnd() < .3){ act('窓でSP連打'); b3.click(); } }
          return setTimeout(drive, 300);
        }
        if(!w.dataset.detTried && rnd() < .3){ w.dataset.detTried = '1'; var dt = w.querySelector('.wdet'); if(dt){ act('…詳細'); dt.click(); return setTimeout(drive, 100); } }
        var editing = !!w.querySelector('.wx');
        if(editing && rnd() < .25){ act('窓を閉じる'); w.querySelector('.wx').click(); return setTimeout(drive, 150); }
        var bs = qa('.rbwin:not(.foe) .rwb button').filter(function(x){ return !x.classList.contains('wdet') && !x.disabled; });
        if(bs.length){ var pick = bs[Math.floor(rnd()*bs.length)]; log('answer', pick.textContent.replace(/\s+/g,' ').trim().slice(0,20)); pick.click(); }
        return setTimeout(drive, 120);
      }
      if(q('#spqwin')) return setTimeout(drive, 100);
      lastRdy = qa('.hsp.rdy').filter(function(x){ return !x.disabled; }).map(function(x){ return x.dataset.mv; });
      var P = CFG.p;
      if(CFG.rt){
        var rdy = qa('.hsp.rdy').filter(function(x){ return !x.disabled; });
        if(rdy.length && rnd() < P.press){ var b2 = rdy[Math.floor(rnd()*rdy.length)]; act('SP'); b2.click(); if(rnd() < .15){ act('SP連打'); b2.click(); } }
        var sw = qa('.hmsw').filter(function(x){ return !x.disabled && x.style.display !== 'none'; });
        if(sw.length && rnd() < P.swap){ act('⇄'); sw[0].click(); }
      } else if(CFG.pat === 'pause-skip'){
        if(paused){ var sk0 = q('.hskip'); if(sk0){ act('⏩(⏸中)'); sk0.click(); } }
        else if(hp && rnd() < .5){ act('⏸'); hp.click(); }
      } else if(CFG.pat === 'fx-skip'){
        if(typeof FX_BUSY !== 'undefined' && FX_BUSY && rnd() < .6){ var sk1 = q('.hskip'); if(sk1){ act('⏩(演出中)'); sk1.click(); } }
      } else {
        if(paused){ if(rnd() < .35){ act('▶再生'); hp.click(); } else if(rnd() < .5){ var st = q('.hstep'); if(st){ act('⏭'); st.click(); } } }
        else {
          var r2 = rnd();
          if(r2 < P.skip){ var sk = q('.hskip'); if(sk){ act('⏩'); sk.click(); } }
          else if(r2 < P.skip + P.step){ var st2 = q('.hstep'); if(st2){ act('⏭'); st2.click(); } }
          else if(r2 < P.skip + P.step + P.pause){ if(hp){ act('⏸'); hp.click(); } }
          else if(r2 < P.skip + P.step + P.pause + P.spd){ var sp = q('.hspd'); if(sp){ act('×N'); sp.click(); } }
          else if(r2 < P.skip + P.step + P.pause + P.spd + P.fx){ var fx = q('.hfx'); if(fx){ act('🎬'); fx.click(); } }
          else if(r2 < P.skip + P.step + P.pause + P.spd + P.fx + P.chip){
            var chips = qa('.fchip').filter(function(c){ return !c.disabled && vis(c); });
            if(chips.length){ var c = chips[Math.floor(rnd()*chips.length)]; act('巻き戻し'); c.click(); }
          }
          else if(r2 < P.skip + P.step + P.pause + P.spd + P.fx + P.chip + P.swap){
            var sw2 = qa('.hmsw').filter(function(x){ return !x.disabled && x.style.display !== 'none'; });
            if(sw2.length){ act('⇄'); sw2[Math.floor(rnd()*sw2.length)].click();
              if(CFG.page === 'rocket'){ setTimeout(function(){ var to = qa('.rbwin [data-to]'); if(to.length && rnd() < .8){ act('⇄先'); to[Math.floor(rnd()*to.length)].click(); } else { var mx = q('.mswx'); if(mx){ act('⇄やめる'); mx.click(); } } }, 120); }
            }
          }
        }
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
                t = data.decode('utf-8', 'ignore')
                c = json.dumps(cfg)
                t = re.sub(r'<head[^>]*>', lambda m: m.group(0) + HEAD.replace('__CFG__', c), t, count=1, flags=re.I)
                m = re.search(r'</body>', t, re.I)
                inj = BODY.replace('__CFG__', c)
                t = (t[:m.start()] + inj + t[m.start():]) if m else (t + inj)
                data = t.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', ct); self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(data)
    return H


def find_browser():
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
    return c[-1] if c else None


def run_one(cfg, url_q, budget):
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), make_handler(cfg))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/{cfg["page"]}/?{url_q}'
    prof = tempfile.mkdtemp(prefix='gonavi-insp-')
    try:
        r = subprocess.run([find_browser(), '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}', '--window-size=390,844',
                            f'--virtual-time-budget={budget}', '--dump-dom', url], capture_output=True, text=True, timeout=1800)
    finally:
        shutil.rmtree(prof, ignore_errors=True); httpd.shutdown()
    m = re.search(r'id="__out"[^>]*>(.*?)</div>', r.stdout, re.S)
    if not m: return {'err': ['結果を取り出せませんでした'], 'battles': [], 'done': False, 'warn': [], 'actions': {}}
    return json.loads(H2.unescape(m.group(1)))


POOL = [
    {"key": "azumarill", "fast": "BUBBLE", "c1": "ICE_BEAM", "c2": "PLAY_ROUGH"},
    {"key": "medicham", "fast": "COUNTER", "c1": "POWER_UP_PUNCH", "c2": "ICE_PUNCH"},
    {"key": "cramorant", "fast": "WATER_GUN", "c1": "SURF", "c2": "DIVE"},
    {"key": "aegislash_shield", "fast": "AEGISLASH_CHARGE_PSYCHO_CUT", "c1": "GYRO_BALL", "c2": "SHADOW_BALL"},
    {"key": "morpeko_full_belly", "fast": "THUNDER_SHOCK", "c1": "AURA_WHEEL_ELECTRIC", "c2": "PSYCHIC_FANGS"},
    {"key": "mimikyu", "fast": "SHADOW_CLAW", "c1": "SHADOW_SNEAK", "c2": "PLAY_ROUGH"},
    {"key": "machamp", "fast": "COUNTER", "c1": "CROSS_CHOP", "c2": "CLOSE_COMBAT"},
    {"key": "swampert", "fast": "MUD_SHOT", "c1": "HYDRO_CANNON", "c2": "EARTHQUAKE"},
    {"key": "registeel", "fast": "LOCK_ON", "c1": "FLASH_CANNON", "c2": "FOCUS_BLAST"},
    {"key": "ninetales_alolan", "fast": "CHARM", "c1": "PSYSHOCK", "c2": "ICE_BEAM"},
    {"key": "bastiodon", "fast": "SMACK_DOWN", "c1": "STONE_EDGE", "c2": "FLAMETHROWER"},
    {"key": "stunfisk_galarian", "fast": "MUD_SHOT", "c1": "ROCK_SLIDE", "c2": "EARTHQUAKE"},
]
SD_M = lambda p: {**p, "shadow": False, "ivMode": "auto", "maxLv": 51}
foe_str = lambda t: ','.join(f"{p['key']}~0~{p['fast']}~{p['c1']}~{p['c2']}" for p in t)
P_SEL = {'press': 0, 'skip': .012, 'step': .01, 'pause': .006, 'spd': .004, 'fx': .004, 'chip': .006, 'swap': .004}
P_RT = {'press': .45, 'skip': 0, 'step': 0, 'pause': 0, 'spd': 0, 'fx': .003, 'chip': 0, 'swap': .006}


def main():
    R = random.Random(int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 20260925)
    runs = []
    def add(tag, cfg, urlq, budget):
        cfg.setdefault('page', 'gbl'); cfg.setdefault('rt', False); cfg.setdefault('ai', 'normal'); cfg.setdefault('fx', True)
        cfg.setdefault('snd', False); cfg.setdefault('sd', None); cfg.setdefault('n', 3)
        cfg.setdefault('p', P_RT if cfg['rt'] else P_SEL); cfg['seed'] = R.randrange(1, 2**31); cfg['id'] = f'in{len(runs)}-{R.random()}'
        runs.append((tag, cfg, urlq, budget))
    add('選択式・NORMAL・ミラー・🎬ON', {'party': [POOL[0], POOL[1], POOL[6]]}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[0], POOL[1], POOL[6]])), 1500000)
    add('選択式・HARD・特殊能力4匹・🎬OFF・🔊ON', {'party': [POOL[2], POOL[3], POOL[4]], 'ai': 'hard', 'fx': False, 'snd': True}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[5], POOL[8], POOL[7]])), 1500000)
    add('リアルタイム・NORMAL・🎬ON・🔊ON', {'party': [POOL[5], POOL[4], POOL[0]], 'rt': True, 'snd': True}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[3], POOL[2], POOL[1]])), 2400000)
    sdmy = [SD_M(p) for p in POOL[:6]]; sdfoe = [SD_M(p) for p in POOL[6:12]]
    add('見せ合い・選択式・NORMAL', {'party': [POOL[0], POOL[1], POOL[6]], 'sd': {'my': sdmy, 'foe': sdfoe, 'pick': [0, 1, 2]}}, 'md=mock', 1500000)
    add('見せ合い・リアルタイム・HARD', {'party': [POOL[0], POOL[1], POOL[6]], 'rt': True, 'ai': 'hard', 'sd': {'my': sdmy, 'foe': sdfoe, 'pick': [3, 4, 5]}}, 'md=mock', 2400000)
    add('ロケット団・したっぱ・選択式', {'page': 'rocket', 'party': [POOL[1], POOL[7], POOL[6]]}, 'rt=1&rk=grunt&rp=' + urllib.parse.quote('venusaur~~,skarmory~~,charizard~~'), 1200000)
    add('ロケット団・リーダー(シエラ)・選択式', {'page': 'rocket', 'party': [POOL[8], POOL[7], POOL[0]]}, 'rt=1&rk=leader&rw=sierra&rl=000&rp=' + urllib.parse.quote('amaura~~,ferrothorn~~,houndoom~~'), 1200000)
    add('選択式・NORMAL・⏸してから⏩で進める(決着の演出とパネルが出るか)', {'party': [POOL[0], POOL[1], POOL[6]], 'pat': 'pause-skip', 'n': 3}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[7], POOL[5], POOL[3]])), 900000)
    add('選択式・NORMAL・🎬OFF・⏸してから⏩で進める(決着パネルが出るか)', {'party': [POOL[0], POOL[1], POOL[6]], 'pat': 'pause-skip', 'fx': False, 'n': 3}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[7], POOL[5], POOL[3]])), 900000)
    add('選択式・NORMAL・演出中に⏩(決着の演出とパネルが出るか)', {'party': [POOL[0], POOL[1], POOL[6]], 'pat': 'fx-skip', 'n': 3}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[7], POOL[5], POOL[3]])), 900000)
    add('選択式・EASY・じぶん1匹だけ', {'party': [POOL[0]], 'ai': 'easy', 'n': 2}, 'md=mock&gt=' + urllib.parse.quote(foe_str([POOL[6], POOL[8], POOL[1]])), 900000)
    if '--only' in sys.argv:
        pick = {int(x) for x in sys.argv[sys.argv.index('--only') + 1].split(',')}
        runs = [r for i, r in enumerate(runs) if i in pick]
    total_bad = 0; total_b = 0
    for tag, cfg, urlq, budget in runs:
        res = run_one(cfg, urlq, budget)
        probs = []
        if res.get('err'): probs += ['E ' + x[:160] for x in res['err'][:6]]
        if res.get('boot'): probs.append('E 起動の赤い帯: ' + res['boot'][:120])
        if not res.get('done'): probs.append('G 決められた数の対戦が終わらなかった')
        warns = [w for w in res.get('warn', []) if '受け付けませんでした' not in w]
        refused = sum(1 for w in res.get('warn', []) if '受け付けませんでした' in w)
        if warns: probs += ['W ' + w[:160] for w in warns[:6]]
        for b in res.get('battles', []):
            total_b += 1
            for x in b['ev']:
                if x[1] in ('STUCK', 'TIMEOUT', 'NOSTART') or x[1][:2] in ('P ', 'X ', 'T ') or x[1][:4] == 'DOCK': probs.append(f'{x[1]} {x[2]} (ターン{x[3]}・{b["i"]}戦目)')
            if b.get('fxMiss'): probs.append(f'R 流れなかった演出({b["i"]}戦目): ' + ', '.join(b['fxMiss'][:6]))
            if b.get('hpBad'): probs.append(f'H HPバーの幅({b["i"]}戦目): ' + ', '.join(b['hpBad'][:4]))
            if b.get('textBad'): probs.append(f'T 画面に変な文字({b["i"]}戦目): ' + b['textBad'])
            if cfg['page'] == 'gbl' and not b.get('panel'): probs.append(f'P 決着パネルが出ない({b["i"]}戦目・via {b.get("via")})')
            if cfg['page'] == 'gbl' and b.get('fxOn') and not any(x[1] == 'fx:end0' for x in b['ev']): probs.append(f'FXEND 🎬ONなのに決着の演出(WIN/LOSE)が流れていない({b["i"]}戦目)')
            if b.get('panels', 0) > 1: probs.append(f'P 決着パネルが{b["panels"]}回出た({b["i"]}戦目)')
        total_bad += len(probs)
        print(('✅ ' if not probs else '❌ ') + tag + f'　{len(res.get("battles", []))}戦・操作 ' + json.dumps(res.get('actions', {}), ensure_ascii=False) + (f'・時系列の守りで断った入力 {refused}' if refused else ''))
        for b in res.get('battles', []):
            ends = [x for x in b['ev'] if x[1] == 'fx:end0' or x[1] == 'fx:end1']
            print(f'    {b["i"]}戦目 via={b.get("via")} 出来事{len(b["ev"])}件 決着={[x[2] for x in ends]} パネル={b.get("panelTxt","")[:40]} 未確定の答え={b.get("pend")}')
        for p in probs[:14]: print('    ', p)
        if os.environ.get('INSP_DUMP'):
            for b in res.get('battles', []):
                if os.environ.get('INSP_DUMP') == 'all' or any(x[1][:2] in ('P ', 'X ', 'D ') or x[1] in ('STUCK','TIMEOUT') for x in b['ev']) or (cfg['page']=='gbl' and not b.get('panel')):
                    print(f'   --- {b["i"]}戦目 via={b.get("via")} の出来事(最後の45件)')
                    for x in b['ev'][-45:]: print('     ', x[0], x[1], str(x[2])[:70], '@', x[3])
    print(f'対戦 {total_b}戦・問題 {total_bad}件')
    return 0 if total_bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
