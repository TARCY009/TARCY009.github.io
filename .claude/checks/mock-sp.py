#!/usr/bin/env python3
"""模擬戦のSPアタックまわりの通し検査（2026-09-24タダシさん指示「さまざまな状況で打つように自動でシミュレートして検査」）。

画面なしブラウザの仮想時間で、本物の /gbl/ の模擬戦を何戦も回す。
- リアルタイム操作: 点灯したSPボタンをランダムなタイミングで押す（連打・2本目・⇄交代も混ぜる）
- 選択式: 出てきた質問（SP・シールド・交代・次のポケモン）にランダムに答える
- 威力調整のメーターは差し替えて、ランダムな出来（25/50/75/100%）で確定（リアルタイムは1割でやめる）
ポケモンは特殊な動きのあるもの（ウッウ・ギルガルド・モルペコ・ミミッキュ）・同時発動が起きやすいミラーも混ぜる。

見ること（1つでも破れたら不合格）:
 A. 「SPが始まる」演出は、押した（答えた）瞬間にだけ出る（メーターの番で2回目が出ない）
 B. メーターのあとに最初に流れる演出は、じぶんのSPアタック（メーターを出したのにSPが出ない・順番が崩れる、が無い）
 C. メーターとじぶんのSPのあいだに、あいてのSPが割り込まない（同時発動で相手が先攻なら、相手のSP → メーター → じぶん）
 D. じぶんのSPアタックの演出は、メーターを通っている（撃つ答え・リアルタイムの入力なのにメーターが出ていない、が無い）
 E. 画面のエラー・起動の赤い帯が出ない
 F. 途中で止まらない（質問もメーターも出ていないのに時間だけ進んで再生が進まない、が無い）
 G. 対戦が最後まで終わる
 P. 決着のあとに決着パネル（再戦・入れ替えて再戦・終了）が出て、「再戦」ですぐ次のバトルが始まる（2026-09-24）
 Q. たおれた側から次に出てくるポケモンは「くりだした！」で出る（「交代した！」にならない・2026-09-24）
 R. 表示した行の演出（くりだした・交代した・たおした・SPなど）が1つも取りこぼされずに流れる（2026-09-24）
 I. 押した（撃つと答えた）SPには、押した瞬間の「SPが始まる」演出がある（2026-09-24）
 J. シールドの窓のあいだ（あいてのSPがもう入っている）に押したSPは、演出も出ず、あいてのSPのあとに勝手に撃たれない（押し直しが要る・2026-09-25タダシさん指示）
使い方: python3 .claude/checks/mock-sp.py [--quick]
"""
import os, re, sys, json, glob, socket, shutil, tempfile, threading, pathlib, subprocess, random
import http.server, urllib.parse, posixpath, html as H2

ROOT = pathlib.Path(__file__).resolve().parents[2]

INJECT = r"""<script>
(function(){
  var CFG = __CFG__;
  try{
    if(localStorage.getItem('__spready') !== CFG.id){
      localStorage.clear();
      localStorage.setItem('gbl_party', JSON.stringify(CFG.party));
      localStorage.setItem('gbl_mock_rt', CFG.rt ? '1' : '0');
      localStorage.setItem('gbl_mock_ai', CFG.ai);
      localStorage.setItem('gbl_fx', '1');
      localStorage.setItem('gbl_snd', '0');
      localStorage.setItem('__spready', CFG.id);
      location.replace(location.href);
      return;
    }
  }catch(e){}
  var seed = CFG.seed >>> 0;
  function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  var LOG = [], ERR = [], WARN = [], battles = [], cur = null, done = false;
  function now(){ return Math.round(performance.now()); }
  function log(k, x){ if(cur) cur.ev.push([now(), k, x || '', (typeof RBV !== 'undefined' ? RBV.cur : -1)]); }
  addEventListener('error', function(e){ ERR.push(String(e.message || e)); });
  var ce = console.error; console.error = function(){ ERR.push([].slice.call(arguments).join(' ')); return ce.apply(console, arguments); };
  var cw = console.warn; console.warn = function(){ var s=[].slice.call(arguments).join(' '); if(/模擬戦/.test(s)) WARN.push(s.slice(0,160)); return cw.apply(console, arguments); };
  function out(){
    var d=document.getElementById('__spout');
    if(!d){ d=document.createElement('div'); d.id='__spout'; d.style.display='none'; document.body.appendChild(d); }
    d.textContent = JSON.stringify({ done: done, battles: battles, err: ERR, warn: WARN,
      boot: (document.getElementById('booterr')||{}).textContent || '' });
  }
  setInterval(out, 500);
  addEventListener('load', function(){
    // メーターの差し替え: ランダムな出来ですぐ確定（リアルタイムは1割でやめる）
    window.spqMeter = function(mv, fin, cancel){
      var pk = Object.keys(RB.ans).filter(function(k){ return RB.ans[k] && RB.ans[k].pwPend; });
      log('meter', mv + ' 未確定=' + pk.map(function(k){ return k + JSON.stringify(RB.ans[k]); }).join(','));
      var g0 = RBV.cur;
      setTimeout(function(){
        var rows = [].slice.call(document.querySelectorAll('.fi')).filter(function(e){ var g=+e.dataset.gt; return g >= g0 - 1 && g <= g0 + 4; })
          .map(function(e){ return e.dataset.gt + (e.classList.contains('in') ? '+' : '-') + ':' + e.textContent.replace(/\s+/g,' ').trim().slice(0,40); });
        log('after', rows.join(' | '));
      }, 2500);
      var w = document.createElement('div'); w.id = 'spqwin'; document.body.appendChild(w);
      setTimeout(function(){
        w.remove();
        if(cancel && rnd() < .1){ log('meterX', mv); cancel(); }
        else { var pw = [.25,.5,.75,1][Math.floor(rnd()*4)]; log('meterOK', pw); fin(pw); }
      }, 60);
    };
    // 演出の記録: SPアタックのカットイン(side)・「SPが始まる」演出・決着
    var of = window.fxOne;
    window.fxOne = function(f){
      if(f && f.k === 'sp') log('fxsp' + (f.side ? '1' : '0'), f.mv);
      if(f && f.k === 'end') log('end', f.outcome || '');
      if(f && (f.k === 'in' || f.k === 'swap')) log('fx' + f.k + (f.side ? '1' : '0'), f.name || '');
      if(f && f.k === 'ko') log('fxko' + (f.win ? '1' : '0'), f.name || '');   // fxko1 = あいてをたおした
      return of.apply(this, arguments);
    };
    new MutationObserver(function(ms){ ms.forEach(function(m){ [].forEach.call(m.addedNodes, function(n){
      if(n.id === 'spstfx') log('start');
    }); }); }).observe(document.body, { childList: true });
    var lastCur = -1, lastMove = now(), started = false; var lastRdy = [];
    function drive(){
      if(done) return;
      var bfull = document.querySelector('.bfull');
      // 対戦の開始
      if(!cur){
        var b = document.querySelector('.rbstart');
        if(b){ cur = { ev: [], i: battles.length, t0: now() }; if(!CFG.rt && typeof RBV !== 'undefined') RBV.speed = 4; b.click(); started = true; }
        return setTimeout(drive, 150);
      }
      // 決着: 終了を押して次へ
      var ended = cur.ev.some(function(e){ return e[1] === 'end'; });
      if(ended && !document.getElementById('spqwin')){
        if(!cur.fin){ cur.fin = now(); }
        // 決着パネル(2026-09-24): 出るのを待ち、1戦目のあとは「再戦」を押して次のバトルが始まるかを見る(最後は✕終了)
        var pn = document.getElementById('gbend');
        if(pn || now() - cur.fin > 9000){
          cur.pend = Object.keys(RB.ans).filter(function(k){ return RB.ans[k] && RB.ans[k].pwPend; }).map(function(k){ return k + (RB.ans[k].late ? '(late)' : ''); });
          // R: 表示した行の演出がすべて流れたか(取りこぼし＝待ちの上書きで捨てられた演出・2026-09-24)
          try { cur.fxMiss = [].slice.call(document.querySelectorAll('.rbfeed .fi.in[data-fx]')).reduce(function(a, el){
              fxList(el).forEach(function(f){ if (f && !RBV.fxDone.has(fxKey1(el, f))) a.push(el.dataset.gt + ':' + f.k + (f.side ? '1' : '0') + ':' + (f.name || f.mv || '')); }); return a; }, []);
          } catch (x) { cur.fxMiss = ['(調べられず) ' + x]; }
          cur.panel = !!pn; cur.panelTxt = pn ? pn.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
          battles.push(cur); cur = null;
          if(battles.length >= CFG.n){ var e = document.querySelector('.hend'); if(e) e.click(); done = true; out(); return; }
          if(pn){
            cur = { ev: [], i: battles.length, t0: now(), viaRe: true };
            pn.querySelector('.gbe-re').click();
            cur.reStarted = !document.getElementById('gbend') && !!document.querySelector('.bfull') && RBV.started && RBV.cur === 0 && !Object.keys(RB.ans).length;
          } else { var e2 = document.querySelector('.hend'); if(e2) e2.click(); }
        }
        return setTimeout(drive, 150);
      }
      // 止まっていないか
      if(typeof RBV !== 'undefined' && RBV.cur !== lastCur){ lastCur = RBV.cur; lastMove = now(); }
      var busy = document.querySelector('.rbwin') || document.getElementById('spqwin');
      if(!busy && now() - lastMove > 30000){ log('STUCK', RBV.cur + ' playing=' + RBV.playing + ' timer=' + !!RBV.timer + ' started=' + RBV.started + ' fx=' + ((document.getElementById('fxlayer')||{}).textContent||'').slice(0,30)); lastMove = now(); }
      if(now() - cur.t0 > 900000){ log('TIMEOUT'); cur.fin = now() - 3000; cur.ev.push([now(),'end','timeout',-1]); }
      // 質問への答え(じぶんの窓だけ)
      var w = document.querySelector('.rbwin:not(.foe)');
      if(w){
        // リアルタイム: シールドの窓のあいだにSPを押す(同時発動で相手が先攻のとき、押した瞬間に演出が出るか・2026-09-24)
        if(CFG.rt && !w.dataset.spTried){
          w.dataset.spTried = '1';
          // 人は灰色になったボタンでも押すので、窓が出る直前に点いていたボタンを押す(旧実装はここで黙って捨てていた)
          var rw = [].slice.call(document.querySelectorAll('.hsp')).filter(function(x){ return lastRdy.indexOf(x.dataset.mv) >= 0; });
          if(rw.length && rnd() < .7){ var b3 = rw[Math.floor(rnd()*rw.length)]; log('press', b3.dataset.mv + ' (シールドの窓)'); b3.click();
            if(rnd() < .3){ log('press', b3.dataset.mv + ' (シールドの窓・連打)'); b3.click(); } }
          return setTimeout(drive, 300);
        }
        var bs =[].slice.call(w.querySelectorAll('.rwb button')).filter(function(x){ return !x.classList.contains('wdet') && !x.disabled; });
        if(bs.length){ var pick = bs[Math.floor(rnd()*bs.length)]; log('answer', pick.textContent.replace(/\s+/g,' ').trim().slice(0,20)); pick.click(); }
        return setTimeout(drive, 120);
      }
      lastRdy = [].slice.call(document.querySelectorAll('.hsp.rdy')).filter(function(x){ return !x.disabled; }).map(function(x){ return x.dataset.mv; });
      if(CFG.rt && !document.getElementById('spqwin')){
        var rdy = [].slice.call(document.querySelectorAll('.hsp.rdy')).filter(function(x){ return !x.disabled; });
        if(rdy.length && rnd() < CFG.pressP){
          var b2 = rdy[Math.floor(rnd()*rdy.length)];
          var before = Object.keys(RB.ans).filter(function(k){ return k.indexOf(':0:msp:') > 0; }).length;
          log('press', b2.dataset.mv); b2.click();
          log('mspN', before + '→' + Object.keys(RB.ans).filter(function(k){ return k.indexOf(':0:msp:') > 0; }).length + ' late=' + Object.keys(RB.ans).filter(function(k){ return RB.ans[k] && RB.ans[k].late; }).length);
          if(rnd() < .15){ log('press', b2.dataset.mv); b2.click(); }   // 連打
        }
        var sw = [].slice.call(document.querySelectorAll('.hmsw')).filter(function(x){ return !x.disabled && x.style.display !== 'none'; });
        if(sw.length && rnd() < .006){ log('swap'); sw[0].click(); }
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
                inj = INJECT.replace('__CFG__', json.dumps(cfg))
                m = re.search(r'</body>', t, re.I)
                t = (t[:m.start()] + inj + t[m.start():]) if m else (t + inj)
                data = t.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', ct); self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(data)
    return H


def find_browser():
    c = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))
    return c[-1] if c else None


def run_one(cfg, gt, budget):
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), make_handler(cfg))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/gbl/?md=mock&gt={urllib.parse.quote(gt)}'
    prof = tempfile.mkdtemp(prefix='gonavi-sp-')
    try:
        r = subprocess.run([find_browser(), '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}',
                            f'--virtual-time-budget={budget}', '--dump-dom', url], capture_output=True, text=True, timeout=1500)
    finally:
        shutil.rmtree(prof, ignore_errors=True); httpd.shutdown()
    m = re.search(r'id="__spout"[^>]*>(.*?)</div>', r.stdout, re.S)
    if not m: return {'err': ['結果を取り出せませんでした'], 'battles': [], 'done': False}
    return json.loads(H2.unescape(m.group(1)))


def judge(b, rt):
    """1戦の記録から、決まりが破れていないかを調べる。戻り値は問題の一覧"""
    ev = b['ev']; bad = []
    ends = [e for e in ev if e[1] == 'end']
    if not ends: bad.append('G 最後まで終わっていない')
    if any(e[2] == 'timeout' for e in ends): bad.append('G 時間切れまで終わらない(検査の上限)')
    for i, e in enumerate(ev):
        k = e[1]
        if k == 'STUCK': bad.append(f'F 再生が止まった(ターン{e[2]})')
        if k == 'start':
            # A: 直前(同じ時刻)に押した・答えた記録がある
            prev = [x for x in ev[max(0, i - 3):i] if x[1] in ('press', 'answer')]
            if not prev or e[0] - prev[-1][0] > 30: bad.append(f'A 押していないのに「SPが始まる」演出(ターン{e[3]})')
        if k == 'meter':
            rest = ev[i + 1:]
            nxt = next((x for x in rest if x[1] in ('fxsp0', 'fxsp1', 'meter', 'end')), None)
            cancelled = next((x for x in rest[:2] if x[1] == 'meterX'), None)
            if cancelled: continue
            if not nxt or nxt[1] == 'end' or nxt[1] == 'meter': bad.append(f'B メーターのあとにじぶんのSPが出ない(ターン{e[3]}) 前後:\n        ' + '\n        '.join(f'{x[1]}:{str(x[2])[:260]}@{x[3]}' for x in ev[max(0, i - 8):i + 8]))
            elif nxt[1] == 'fxsp1': bad.append(f'C メーターとじぶんのSPのあいだにあいてのSP(ターン{e[3]}) 前後: ' + '\n        ' + '\n        '.join(f'{x[1]}:{x[2]}@{x[3]}' for x in ev[max(0, i - 6):i + 8]))
    # D: じぶんのSPの演出の前にはメーター(直前のじぶんのSPより後)
    last_sp = -1; used_st = 0
    for i, e in enumerate(ev):
        if e[1] == 'fxsp0':
            seg = ev[last_sp + 1:i]
            has_meter = any(x[1] == 'meterOK' for x in seg)
            # 選択式で「おまかせ」「撃たない」系を選んだ発はメーターを通らない(威力100%のまま)。撃つ答え・リアルタイムの入力だけ見る
            fired_by_user = any(x[1] == 'press' for x in seg) or any(x[1] == 'answer' and re.search(r'即打ち|最適|ため|⏸|▶', x[2]) for x in seg)
            # I: 押した・撃つと答えたSPには、押した瞬間の「SPが始まる」演出がある(2026-09-24タダシさん報告「同時発動で後攻のとき出なかった」)
            # ⚠ 連打で予約した2発目は、演出が1発目より前(押した瞬間)に出ている。区間だけで見ると取り違えるので、
            #   「ここまでに出た演出の数」が「ここまでにじぶんが撃ったSPの数」以上かで見る
            if fired_by_user: used_st += 1
            if fired_by_user and sum(1 for x in ev[:i] if x[1] == 'start') < used_st:
                bad.append(f'I 押したのに「SPが始まる」演出が出ていない(ターン{e[3]}) 前後:\n        ' + '\n        '.join(f'{x[1]}:{str(x[2])[:200]}@{x[3]}' for x in ev[max(last_sp + 1, i - 12):i + 2]))
            if fired_by_user and not has_meter: bad.append(f'D じぶんのSPなのにメーターが出ていない(ターン{e[3]}) 前後:\n        ' + '\n        '.join(f'{x[1]}:{str(x[2])[:200]}@{x[3]}' for x in ev[max(last_sp + 1, i - 12):i + 2]))
            last_sp = i
    # Q: たおれた側から次に出てくるポケモンは「くりだした」(in)。「交代した」(swap)にならない(2026-09-24タダシさん報告)
    lastk = {0: None, 1: None}
    for i, e in enumerate(ev):
        m = re.match(r'fx(ko|in|swap)([01])$', e[1])
        if not m: continue
        k, sd = m.group(1), int(m.group(2))
        if k == 'ko': lastk[sd] = 'ko'; continue
        if k == 'swap' and lastk[sd] == 'ko':
            bad.append(f'Q {"あいて" if sd else "じぶん"}がたおれたあとに出てきたのに「交代した！」(ターン{e[3]}・{e[2]}) 前後:\n        ' + '\n        '.join(f'{x[1]}:{str(x[2])[:120]}@{x[3]}' for x in ev[max(0, i - 10):i + 3]))
        lastk[sd] = k
    # H: 同じターンに「SPが始まる」演出が3回以上(押しても撃てない入力で演出だけが出ている)
    from collections import Counter
    c = Counter(e[3] for e in ev if e[1] == 'start')
    for t, n in c.items():
        if n >= 3: bad.append(f'H 同じターンに「SPが始まる」演出が{n}回(ターン{t})')
    return bad


def main():
    quick = '--quick' in sys.argv
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
    ]
    def foe_str(t): return ','.join(f"{p['key']}~0~{p['fast']}~{p['c1']}~{p['c2']}" for p in t)
    R = random.Random(int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 20260924)
    runs = []
    n_pages = 2 if quick else 8
    for i in range(n_pages):
        rt = i % 2 == 0
        if i < 2:   # ミラー(同時発動が起きやすい)
            party = [POOL[0], POOL[1], POOL[6]]; foes = [POOL[0], POOL[1], POOL[6]]
        else:
            party = R.sample(POOL, 3); foes = R.sample(POOL, 3)
        ai = ['easy', 'normal', 'hard'][i % 3]
        cfg = {'id': f'sp{i}-{R.random()}', 'rt': rt, 'ai': ai, 'party': party, 'seed': R.randrange(1, 2**31),
               'n': 1 if quick else 2, 'pressP': [.2, .45, .8][i % 3]}
        runs.append((cfg, foe_str(foes)))
    if '--only' in sys.argv:
        pick = {int(x) for x in sys.argv[sys.argv.index('--only') + 1].split(',')}
        runs = [r for i, r in enumerate(runs) if i in pick]
    total_bad = 0; total_b = 0; summary = []
    for cfg, gt in runs:
        budget = 1200000 if cfg['rt'] else 600000
        res = run_one(cfg, gt, budget)
        tag = f"{'リアルタイム' if cfg['rt'] else '選択式'}・{cfg['ai']}・押す確率{cfg['pressP']}・" + '/'.join(p['key'] for p in cfg['party']) + ' 対 ' + '/'.join(x.split('~')[0] for x in gt.split(','))
        probs = []
        if res.get('err'): probs += ['E エラー: ' + x[:120] for x in res['err'][:5]]
        if res.get('boot'): probs.append('E 起動の赤い帯: ' + res['boot'][:120])
        if not res.get('done'): probs.append('G 決められた数の対戦が終わらなかった')
        cnt = {}
        for b in res.get('battles', []):
            total_b += 1
            for x in b['ev']: cnt[x[1]] = cnt.get(x[1], 0) + 1
            # シールドの窓で押した回数・そのとき演出が出た回数・そのあとじぶんのSPが出た回数(次のじぶんのSPより前にあいてのSPが1回だけ)
            ev = b['ev']
            for i, x in enumerate(ev):
                if x[1] == 'press' and '(シールドの窓)' in str(x[2]):
                    cnt['窓で押す'] = cnt.get('窓で押す', 0) + 1
                    # J(2026-09-25): 窓のあいだの入力は「間に合わなかった」扱い＝演出は出ず、押し直すまでじぶんのSPは撃たれない
                    if any(y[1] == 'start' and y[0] - x[0] <= 30 for y in ev[i + 1:i + 4]):
                        probs.append(f'J 窓のあいだに押したSPに「SPが始まる」演出が出た(ターン{x[3]})')
                    nx = next((y for y in ev[i + 1:] if y[1] in ('fxsp0', 'end') or (y[1] == 'press' and '(シールドの窓' not in str(y[2]))), None)
                    # 同じターン(同時発動)は、窓が出る前に押していた入力が通ったもの＝正しい。あとのターンに撃たれたら違反
                    if nx and nx[1] == 'fxsp0' and nx[3] > x[3]: probs.append(f'J 窓のあいだに押したSPが、押し直していないのにあいてのSPのあとに撃たれた(ターン{x[3]}→{nx[3]})')
                    else: cnt['窓→撃たれない'] = cnt.get('窓→撃たれない', 0) + 1
            if b.get('fxMiss'): probs.append('R 流れなかった演出(取りこぼし): ' + ', '.join(b['fxMiss'][:8]))
            if not b.get('panel'): probs.append('P 決着パネル(再戦・入れ替えて再戦・終了)が出ない')
            elif not all(w in b.get('panelTxt', '') for w in ('再戦', '入れ替えて再戦', '終了')): probs.append('P 決着パネルのボタンが足りない: ' + b.get('panelTxt', ''))
            if b.get('viaRe') and not b.get('reStarted'): probs.append('P 「再戦」を押しても、すぐに新しいバトルが始まらない')
            # たおれたあと、くりだしてすぐ(同じターン)に交代した(見た目は「交代した！」が主役に見える)
            for a2, b2 in zip(ev, ev[1:]):
                if a2[1][:4] == 'fxin' and b2[1] == 'fxswap' + a2[1][-1] and b2[3] - a2[3] <= 2:
                    cnt['くりだし直後に交代'] = cnt.get('くりだし直後に交代', 0) + 1
                    print('    くりだし直後に交代:', a2, b2)
            if os.environ.get('SP_DUMP'):
                print('   --- 出来事', b['i'])
                for x in ev:
                    if x[1][:4] in ('fxko', 'fxin', 'fxsw') or x[1] in ('end', 'answer'): print('     ', x[1], str(x[2])[:30], '@', x[3])
            probs += judge(b, cfg['rt'])
        total_bad += len(probs)
        summary.append((tag, probs, cnt, res.get('warn', [])[:3], [b.get('pend') for b in res.get('battles', [])]))
    for tag, probs, cnt, warn, pend in summary:
        print(('✅ ' if not probs else '❌ ') + tag)
        print('   ', {k: cnt.get(k, 0) for k in ('press', 'answer', 'start', 'meter', 'meterOK', 'meterX', 'fxsp0', 'fxsp1', 'swap', 'end', '窓で押す', '窓→撃たれない', 'fxko1', 'fxin1', 'fxswap1', 'fxko0', 'fxin0', 'fxswap0', 'くりだし直後に交代')},
              '未確定のまま残った答え:', pend)
        for w in warn: print('    (時系列の守りで断った入力)', w)
        for p in probs[:12]: print('    ', p)
    print(f'対戦 {total_b}戦・問題 {total_bad}件')
    return 0 if total_bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
