/* 模擬戦の効果音（2026-09-18・タダシさん選択）
   ねらいは「ノーマルアタックの回数を耳で数えられるようにする」こと。
   実戦は映像・振動・音がそろって数えられるが、シミュレーターは音でしか補えない（iPhoneは振動が使えない）。

   ⚠ 音声ファイルは使わない。波形をその場で計算して鳴らす（読み込み0バイト・オフラインでも鳴る）。
   ⚠ ノーマルアタックは**乱数の種を固定**して、1発ごとの大きさを完全にそろえる（数えるための音なので粒がそろわないと意味がない）。
   ⚠ 音の長さは模擬戦のカットインの長さに合わせてある（交代2.55秒／SP2.88秒（着弾1.05秒）／撃退2.33秒（ズドン0.47秒）／勝敗3.15秒）。

   使い方: GonaviSound.isOn()/setOn(b) で入り切り、atk(turns, rate)・sp(eff)・swap()・ko()・win()・lose() で鳴らす。
   保存キーは gbl_snd（gbl_ なので「データの引っ越し」に入る）。既定はOFF。 */
(function () {
  'use strict';
  var KEY = 'gbl_snd';
  var on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { }

  var AC = null, BUS = null, MASTER = null, CONV = null, DLYIN = null, LIVE = [];

  function ac() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      MASTER = AC.createGain(); MASTER.gain.value = 1;
      // 圧縮は穏やかに（強くかけると音が波打って荒く聞こえる）＋仕上げに「はみ出しを丸める」
      var comp = AC.createDynamicsCompressor();
      comp.threshold.value = -6; comp.knee.value = 16; comp.ratio.value = 3;
      comp.attack.value = .003; comp.release.value = .22;
      var lim = AC.createWaveShaper(), n = 4096, cv = new Float32Array(n);
      for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; cv[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
      lim.curve = cv; lim.oversample = '4x';
      var hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 34; hp.Q.value = .7;
      var head = AC.createGain(); head.gain.value = .93;   // これが無いと数サンプルだけ上限を超える
      BUS = AC.createGain(); BUS.gain.value = .46;
      BUS.connect(hp).connect(comp).connect(lim).connect(head).connect(MASTER).connect(AC.destination);
      // 残響
      CONV = AC.createConvolver();
      var sec = 1.5, len = Math.floor(AC.sampleRate * sec), buf = AC.createBuffer(2, len, AC.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        for (var j = 0; j < len; j++) { var t = j / len; d[j] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.6) * (j < 200 ? j / 200 : 1); }
      }
      CONV.buffer = buf;
      var wet = AC.createGain(); wet.gain.value = .9; CONV.connect(wet).connect(BUS);
      // エコー（左右で時間差＝広がり）
      DLYIN = AC.createGain();
      [[.19, -.6], [.27, .6]].forEach(function (a) {
        var dl = AC.createDelay(1.5); dl.delayTime.value = a[0];
        var fb = AC.createGain(); fb.gain.value = .18;
        var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        var p = AC.createStereoPanner ? AC.createStereoPanner() : null;
        if (p) p.pan.value = a[1];
        DLYIN.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
        if (p) { lp.connect(p); p.connect(BUS); } else lp.connect(BUS);
      });
      // iPhoneのマナーモードでも鳴らす（対応ブラウザのみ）
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
    }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) { } }
    return AC;
  }

  function route(node, o) {
    o = o || {};
    var c = ac(); if (!c) return;
    var n = node;
    if (o.lo) { var f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = o.lo; f1.Q.value = .8; n.connect(f1); n = f1; }
    if (o.hi) { var f2 = c.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = o.hi; f2.Q.value = .7; n.connect(f2); n = f2; }
    if (o.pan != null && c.createStereoPanner) {
      var p = c.createStereoPanner(), t = c.currentTime + (o.at || 0);
      p.pan.setValueAtTime(o.pan, t);
      if (o.pan2 != null) p.pan.linearRampToValueAtTime(o.pan2, t + (o.dur || .3));
      n.connect(p); n = p;
    }
    n.connect(BUS);
    if (o.rev > 0) { var g1 = c.createGain(); g1.gain.value = o.rev; n.connect(g1); g1.connect(CONV); }
    if (o.dly > 0) { var g2 = c.createGain(); g2.gain.value = o.dly; n.connect(g2); g2.connect(DLYIN); }
  }
  function bufOf(dur, fill) {
    var c = ac(), sr = c.sampleRate, len = Math.max(2, Math.floor(sr * dur));
    var b = c.createBuffer(2, len, sr);
    fill(b.getChannelData(0), b.getChannelData(1), sr, len);
    return b;
  }
  function playBuf(b, o) {
    o = o || {};
    var c = ac(), s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = o.vol == null ? 1 : o.vol;
    s.connect(g);
    var oo = {}; for (var k in o) oo[k] = o[k];
    if (oo.dur == null) oo.dur = b.duration;
    route(g, oo);
    s.start(c.currentTime + (o.at || 0)); LIVE.push(s);
  }
  function fade(i, sr, ms) { return Math.min(1, i / (sr * (ms || 3) / 1000)); }
  // 種を決めると毎回まったく同じ波形になる乱数（ノーマルアタックの粒をそろえる）
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    };
  }
  // 状態変数フィルタ。⚠ 高い周波数で発散して無音になるので、上限・2段処理・暴走時の初期化つき
  function svf() {
    var lp = 0, bp = 0;
    return function (x, f, q) {
      var F = 2 * Math.sin(Math.PI * Math.min(.22, Math.max(.0004, f))) * .5, Q = 1 / Math.max(.7, q);
      for (var k = 0; k < 2; k++) { var hp = x - lp - Q * bp; bp += F * hp; lp += F * bp; }
      if (!isFinite(lp) || !isFinite(bp) || Math.abs(lp) > 8 || Math.abs(bp) > 8) { lp = 0; bp = 0; }
      return { lp: lp, bp: bp };
    };
  }
  // 弦・木をはじく音（物理モデル）
  function ks(freq, dur, o) {
    o = o || {};
    var damp = o.damp == null ? .996 : o.damp, tone = o.tone == null ? .5 : o.tone, decay = o.decay || 2, seed = o.seed || 0;
    var rnd = seed ? rng(seed) : null;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var N = Math.max(2, Math.round(sr / freq)), buf = new Float32Array(N), last = 0, mx = 0, i;
      for (i = 0; i < N; i++) {
        var w = rnd ? rnd() : Math.random() * 2 - 1;
        last += (w - last) * tone; buf[i] = last;
        if (Math.abs(last) > mx) mx = Math.abs(last);
      }
      if (mx > 0) for (i = 0; i < N; i++) buf[i] /= mx;   // 1発ごとの大きさをそろえる
      var idx = 0, prev = 0;
      for (i = 0; i < len; i++) {
        var cur = buf[idx];
        buf[idx] = (cur + prev) * .5 * damp; prev = cur; idx = (idx + 1) % N;
        var v = cur * Math.exp(-decay * i / sr) * fade(i, sr);
        L[i] = v; R[i] = v;
      }
    }), o);
  }
  // FM合成（ベル・金属・マリンバ）
  function fm(freq, dur, o) {
    o = o || {};
    var ratio = o.ratio == null ? 3.5 : o.ratio, index = o.index == null ? 5 : o.index;
    var decay = o.decay == null ? 4 : o.decay, idecay = o.idecay == null ? 7 : o.idecay, wide = o.wide || 0;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var w = 2 * Math.PI * freq / sr, wm = w * ratio, wr = w * (1 + wide * .004);
      for (var i = 0; i < len; i++) {
        var t = i / sr, env = Math.exp(-decay * t) * fade(i, sr, 2), ie = Math.exp(-idecay * t);
        L[i] = Math.sin(w * i + Math.sin(wm * i) * index * ie) * env;
        R[i] = wide ? Math.sin(wr * i + Math.sin(wm * i * 1.002) * index * ie) * env : L[i];
      }
    }), o);
  }
  // 太鼓（低音の芯）。低い音はこれ1つに任せる（爆発と重ねると荒れる）
  function kick(dur, o) {
    o = o || {};
    var f0 = o.f0 == null ? 200 : o.f0, f1 = o.f1 == null ? 45 : o.f1, k = o.k == null ? 22 : o.k;
    var click = o.click == null ? .2 : o.click, drive = o.drive == null ? .8 : o.drive, decay = o.decay == null ? 5 : o.decay;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var ph = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, f = f1 + (f0 - f1) * Math.exp(-k * t);
        ph += 2 * Math.PI * f / sr;
        var v = Math.sin(ph) * Math.exp(-decay * t);
        v += (Math.random() * 2 - 1) * click * Math.exp(-140 * t);
        v = Math.tanh(v * (1 + drive)) / (1 + drive * .5);
        L[i] = v * fade(i, sr, 1); R[i] = L[i];
      }
    }), o);
  }
  // 衝撃（中〜高音のみ）
  function burst(dur, o) {
    o = o || {};
    var cut = o.cut == null ? 6000 : o.cut, cut2 = o.cut2 == null ? 700 : o.cut2, q = o.q == null ? .9 : o.q;
    var decay = o.decay == null ? 4.5 : o.decay, drive = o.drive == null ? .6 : o.drive;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var fl = svf(), fr = svf();
      for (var i = 0; i < len; i++) {
        var t = i / sr, k = i / len, f = (cut * Math.pow(cut2 / cut, k)) / sr;
        var nl = fl(Math.random() * 2 - 1, f, q).lp, nr = fr(Math.random() * 2 - 1, f, q).lp;
        var env = Math.exp(-decay * t) * fade(i, sr, 1);
        L[i] = Math.tanh(nl * 1.5 * env * (1 + drive)) / (1 + drive * .6);
        R[i] = Math.tanh(nr * 1.5 * env * (1 + drive)) / (1 + drive * .6);
      }
    }), o);
  }
  // ためる音（上がるノイズ）
  function riser(dur, o) {
    o = o || {};
    var f0 = o.f0 == null ? 300 : o.f0, f1 = o.f1 == null ? 5000 : o.f1, q = o.q == null ? 6 : o.q, tone = o.tone == null ? .25 : o.tone;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var fl = svf(), fr = svf(), ph = 0;
      for (var i = 0; i < len; i++) {
        var k = i / len, t = i / sr, f = (f0 * Math.pow(f1 / f0, k)) / sr;
        var nl = fl(Math.random() * 2 - 1, f, q).bp, nr = fr(Math.random() * 2 - 1, f, q).bp;
        ph += 2 * Math.PI * (120 * Math.pow(6, k)) / sr;
        var env = Math.pow(k, .6) * fade(i, sr, 8) * (1 - Math.max(0, (t - (dur - .03)) / .03));
        L[i] = (nl * 1.4 + Math.sin(ph) * tone) * env;
        R[i] = (nr * 1.4 + Math.sin(ph) * tone) * env;
      }
    }), o);
  }
  // 風切り（左右に動かせる）
  function whoosh(dur, o) {
    o = o || {};
    var f0 = o.f0 == null ? 700 : o.f0, f1 = o.f1 == null ? 3200 : o.f1, q = o.q == null ? 3.5 : o.q;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var fl = svf(), fr = svf();
      for (var i = 0; i < len; i++) {
        var k = i / len, f = (f0 * Math.pow(f1 / f0, Math.sin(Math.PI * k))) / sr;
        var env = Math.sin(Math.PI * k) * fade(i, sr, 5);
        L[i] = fl(Math.random() * 2 - 1, f, q).bp * env * 1.4;
        R[i] = fr(Math.random() * 2 - 1, f, q).bp * env * 1.4;
      }
    }), o);
  }
  // きらめきの粒
  function shimmer(n, o) {
    o = o || {};
    var base = o.base || 1568, spread = o.spread == null ? 1.2 : o.spread, span = o.span == null ? .9 : o.span;
    var dur = o.dur == null ? .5 : o.dur, vol = o.vol == null ? .16 : o.vol, at = o.at || 0;
    var sc = [0, 2, 4, 7, 9, 12, 16, 19];
    for (var i = 0; i < n; i++) {
      var st = sc[Math.floor(Math.random() * sc.length)] + (Math.random() < .3 ? 12 : 0);
      fm(base * Math.pow(2, st / 12) * (1 + (Math.random() - .5) * .02), dur * (.7 + Math.random() * .6), {
        ratio: 2.01, index: 3.2, decay: 3.4, idecay: 8, vol: vol * (.6 + Math.random() * .7),
        at: at + Math.random() * span, rev: .5, dly: .25, pan: (Math.random() * 2 - 1) * spread * .8, wide: 1
      });
    }
  }
  // ゴング・鐘（金属の板の振動。整数でない倍音を重ね、高い倍音ほど速く減衰させるのが金属らしさの正体）
  function gong(freq, dur, o) {
    o = o || {};
    var ratios = o.ratios || [1, 1.62, 2.11, 2.68, 3.24, 3.91, 4.52, 5.31, 6.12, 7.03, 8.21, 9.48];
    var decay = o.decay == null ? 1.1 : o.decay, hiDecay = o.hiDecay == null ? 5.5 : o.hiDecay;
    var beat = o.beat == null ? 1 : o.beat, strike = o.strike == null ? .5 : o.strike;
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var n = ratios.length, g = 1 / (n * .42), i, k;
      var w = [], wr = [], dc = [], am = [];
      for (k = 0; k < n; k++) {
        w.push(2 * Math.PI * freq * ratios[k] / sr);
        wr.push(2 * Math.PI * freq * ratios[k] * (1 + beat * .0006 * ((k % 3) - 1)) / sr);
        dc.push(decay + (hiDecay - decay) * (k / (n - 1)));
        am.push(1 / (1 + k * .38));
      }
      for (i = 0; i < len; i++) {
        var t = i / sr, vl = 0, vr = 0;
        for (k = 0; k < n; k++) {
          var e = Math.exp(-dc[k] * t) * am[k];
          if (e < .0004) continue;
          vl += Math.sin(w[k] * i) * e; vr += Math.sin(wr[k] * i) * e;
        }
        var hit = (Math.random() * 2 - 1) * strike * Math.exp(-70 * t), f = fade(i, sr, .8);
        L[i] = (vl * g + hit) * f; R[i] = (vr * g + hit) * f;
      }
    }), o);
  }
  // 持続する和音
  function pad(freqs, dur, o) {
    o = o || {};
    var c = ac(); if (!c) return;
    var t = c.currentTime + (o.at || 0);
    var g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(o.open || 2600, t + Math.min(.6, dur * .4));
    lp.frequency.linearRampToValueAtTime(900, t + dur);
    var v = Math.max(.002, o.vol == null ? .18 : o.vol);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.atk || .12));
    g.gain.setValueAtTime(v, t + dur * .6);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    freqs.forEach(function (f, i) {
      [-7, 0, 7].forEach(function (d) {
        var os = c.createOscillator();
        os.type = o.type || 'sawtooth'; os.frequency.setValueAtTime(f, t); os.detune.setValueAtTime(d + (i % 2 ? 3 : -3), t);
        os.connect(lp); os.start(t); os.stop(t + dur + .1); LIVE.push(os);
      });
    });
    var oo = {}; for (var k in o) oo[k] = o[k];
    oo.dur = dur;
    lp.connect(g); route(g, oo);
  }
  function tone(o) {
    var c = ac(); if (!c) return;
    var f = o.f == null ? 440 : o.f, dur = o.dur == null ? .1 : o.dur, vol = o.vol == null ? .3 : o.vol;
    var t = c.currentTime + (o.at || 0), g = c.createGain();
    var mk = function (cents) {
      var os = c.createOscillator();
      os.type = o.type || 'triangle'; os.frequency.setValueAtTime(f, t); os.detune.setValueAtTime(cents, t);
      if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
      os.connect(g); os.start(t); os.stop(t + dur + .05); LIVE.push(os);
    };
    mk(0); if (o.det) { mk(o.det); mk(-o.det); }
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + (o.attack || .004));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    route(g, o);
  }
  function noise(o) {
    var c = ac(); if (!c) return;
    var f = o.f == null ? 2000 : o.f, q = o.q == null ? 4 : o.q, dur = o.dur == null ? .05 : o.dur;
    var t = c.currentTime + (o.at || 0), rnd = o.seed ? rng(o.seed) : null;
    var len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (rnd ? rnd() : Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t);
    if (o.f2) bp.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t + dur);
    bp.Q.value = q; g.gain.value = o.vol == null ? .4 : o.vol;
    s.connect(bp).connect(g); route(g, o); s.start(t); s.stop(t + dur + .05); LIVE.push(s);
  }

  /* ---------------- 場面ごとの音（2026-09-18タダシさん選択） ---------------- */
  // ノーマルアタック（1ターン目の「カチ」と、2ターン目以降の小さな音）
  function kachi() {
    noise({ f: 3300, q: 9, dur: .04, vol: 1.5, seed: 12345 });
    ks(2400, .09, { damp: .986, tone: .8, decay: 22, vol: .3, seed: 777 });
  }
  var SUBV = .25;
  function kachiSub() {
    noise({ f: 1950, q: 8, dur: .04, vol: 1.5 * SUBV, rev: .3, seed: 4242 });
    ks(1500, .07, { damp: .984, tone: .8, decay: 26, vol: .28 * SUBV, rev: .25, seed: 909 });
  }
  // 交代「合図とスイッチ」
  function seSwap() {
    kick(.3, { f0: 125, f1: 58, vol: .44, drive: .3, decay: 8 });
    kick(.3, { f0: 125, f1: 58, vol: .44, at: .32, drive: .3, decay: 8 });
    noise({ f: 4200, q: 9, dur: .04, vol: .8, at: 1.1, seed: 5501 });
    ks(3000, .12, { damp: .98, tone: .9, decay: 18, vol: .3, at: 1.1, seed: 6602 });
    [523, 784].forEach(function (f, i) { fm(f, .6, { ratio: 2.01, index: 2.4, decay: 4, vol: .16, at: 1.2 + i * .08, rev: .5, dly: .25, wide: 1 }); });
    pad([330, 440, 523], .7, { vol: .12, at: 1.25, rev: .55, open: 2200, type: 'triangle' });
  }
  // SPアタック「斬撃（鋭い）」。eff: 's'=こうかばつぐん / 'w'=いまひとつ / それ以外=等倍
  // 着弾は3種類とも1.05秒（カットインの画面が揺れる瞬間）にそろえてある
  function seSp(eff) {
    var i;
    if (eff === 's') {
      whoosh(.26, { f0: 1800, f1: 7000, vol: .4, pan: -1, pan2: .2, dur: .26, rev: .2 });
      whoosh(.24, { f0: 6500, f1: 1600, vol: .38, at: .34, pan: .9, pan2: -.3, dur: .24, rev: .2 });
      riser(.4, { f0: 900, f1: 6500, q: 11, tone: .12, vol: .3, at: .64, dly: .12 });
      whoosh(.16, { f0: 2600, f1: 9000, vol: .4, at: .96, pan: -.5, pan2: .5, dur: .16 });
      for (i = 0; i < 5; i++) ks(2600 + i * 700, .35, { damp: .99, tone: .95, decay: 8, vol: .08, at: 1.05 + i * .01, pan: (i % 2 ? 1 : -1) * .6, rev: .45, dly: .2 });
      burst(.4, { cut: 9000, cut2: 2200, decay: 7, drive: .3, vol: .32, at: 1.05, hi: 1400, rev: .4 });
      kick(.4, { f0: 260, f1: 60, vol: .36, at: 1.05, drive: .6, decay: 6 });
      tone({ f: 2093, f2: 700, type: 'triangle', dur: .5, vol: .13, at: 1.08, rev: .5, dly: .25 });
      shimmer(9, { base: 2637, dur: .5, span: .8, vol: .09, at: 1.18, spread: 1.4 });
      pad([330, 494, 659], 1, { vol: .1, at: 1.2, rev: .6, open: 3000, type: 'triangle' });
      return;
    }
    if (eff === 'w') {
      whoosh(.28, { f0: 900, f1: 2600, vol: .3, pan: -.7, pan2: .3, dur: .28, lo: 3200 });
      riser(.4, { f0: 400, f1: 1200, q: 7, tone: .2, vol: .2, at: .6, lo: 2000 });
      ks(1600, .18, { damp: .966, tone: .95, decay: 20, vol: .42, at: 1.05, lo: 3400 });
      burst(.18, { cut: 2600, cut2: 900, decay: 11, drive: .2, vol: .26, at: 1.05, hi: 700, lo: 4000 });
      tone({ f: 330, f2: 262, type: 'triangle', dur: .35, vol: .14, at: 1.12, lo: 1800 });
      return;
    }
    whoosh(.3, { f0: 1400, f1: 5200, vol: .38, pan: -1, pan2: .3, dur: .3, rev: .2 });
    riser(.5, { f0: 700, f1: 4200, q: 10, tone: .15, vol: .26, at: .55, dly: .12 });
    for (i = 0; i < 3; i++) ks(2200 + i * 620, .3, { damp: .988, tone: .95, decay: 10, vol: .14, at: 1.05 + i * .012, pan: (i % 2 ? 1 : -1) * .5, rev: .4 });
    burst(.34, { cut: 7000, cut2: 1600, decay: 8, drive: .3, vol: .42, at: 1.05, hi: 900, rev: .35 });
    kick(.35, { f0: 240, f1: 62, vol: .42, at: 1.05, drive: .5, decay: 7 });
    pad([294, 392, 494], .7, { vol: .1, at: 1.15, rev: .5, open: 2400, type: 'triangle' });
  }
  // 撃退「叩きつける」（打った音が左右の壁に跳ね返って戻る）
  function seKo() {
    whoosh(.35, { f0: 700, f1: 2600, vol: .3, pan: -.6, pan2: .2, dur: .35 });
    kick(.7, { f0: 300, f1: 40, vol: .58, at: .47, drive: .9, decay: 3.2 });
    burst(.6, { cut: 4200, cut2: 400, decay: 4, drive: .4, vol: .42, at: .47, rev: .5, hi: 180 });
    burst(.3, { cut: 2600, cut2: 500, decay: 7, drive: .2, vol: .2, at: .75, pan: -.85, rev: .4 });
    burst(.25, { cut: 2000, cut2: 450, decay: 8, drive: .2, vol: .14, at: .98, pan: .85, rev: .4 });
    noise({ f: 1200, f2: 300, q: 1.6, dur: .9, vol: .12, at: 1.05, rev: .5 });
    pad([98, 131, 165], 1, { vol: .13, at: .9, rev: .75, open: 1000 });
  }
  // 勝利「ファンファーレ」
  function seWin() {
    var B = function (f, a, d, v) {
      fm(f, d, { ratio: 3.01, index: 4, decay: 5.5, vol: v, at: a, rev: .4, dly: .2, wide: 1 });
      ks(f, d, { damp: .992, decay: 6, vol: v * .5, at: a });
    };
    B(784, 0, .18, .26); B(784, .12, .18, .26); B(1046, .24, .3, .26);
    B(880, .52, .18, .26); B(1175, .64, .34, .26);
    [1046, 1319, 1568, 2093].forEach(function (f, i) { B(f, .95 + i * .04, .9, .24); });
    pad([523, 659, 784, 1046], 1.9, { vol: .16, at: .95, rev: .75, open: 3200 });
    shimmer(14, { base: 2093, dur: .7, span: 1.6, vol: .12, at: 1.1, spread: 1.4 });
    kick(.5, { f0: 200, f1: 55, vol: .4, at: .95 });
  }
  // 敗北「冷たく残る」
  function seLose() {
    fm(1568, 1.6, { ratio: 1.41, index: 3.4, decay: 1.6, vol: .13, rev: .8, dly: .35, wide: 1 });
    fm(1046, 1.8, { ratio: 1.41, index: 3, decay: 1.4, vol: .12, at: .5, rev: .85, dly: .35, wide: 1 });
    pad([131, 196, 233], 2.2, { vol: .15, at: .5, rev: .9, open: 900, atk: .6 });
    shimmer(4, { base: 2093, dur: .9, span: 1.4, vol: .06, at: 1.2, spread: 1.4 });
  }

  // バトルスタート「開始のコール」（演出2.1秒。0.53秒でVSが決まる）
  function seVs() {
    [523, 659, 784].forEach(function (f, i) {
      fm(f, .14, { ratio: 1.01, index: 3, decay: 12, vol: .3, at: i * .14, dly: .18 });
    });
    fm(1046, .9, { ratio: 1.01, index: 5, decay: 3, vol: .36, at: .5, rev: .55, dly: .25, wide: 1 });
    gong(1046, 1.2, { decay: 2.2, hiDecay: 8, strike: .25, vol: .45, rev: .5, at: .5 });
    noise({ f: 6000, f2: 2400, q: 1.6, dur: .3, vol: .2, at: .5, rev: .4 });
    pad([262, 392, 523], 1.1, { vol: .12, at: .55, rev: .6, open: 2600, type: 'triangle' });
  }
  // ポケモンをくりだす「水が弾ける」（演出2.1秒。0.53秒で着地・0.95秒で弾けて光が散る）
  function seIn() {
    noise({ f: 1600, f2: 400, q: 2.2, dur: .5, vol: .26, rev: .3, pan: -.4, pan2: .2 });
    for (var i = 0; i < 6; i++) fm(700 + i * 160, .2, { ratio: 2.01, index: 2.2, decay: 10, vol: .08, at: .2 + i * .07, pan: (i % 2 ? 1 : -1) * .5, dly: .3, rev: .4 });
    noise({ f: 400, f2: 2600, q: 1.8, dur: .45, vol: .3, at: .53, rev: .4 });
    burst(.45, { cut: 6000, cut2: 1200, decay: 6, drive: .25, vol: .3, at: .95, hi: 600, rev: .5 });
    shimmer(6, { base: 1568, dur: .45, span: .5, vol: .1, at: .97 });
    pad([262, 349, 440], .9, { vol: .12, at: .97, rev: .7, open: 2000, type: 'triangle' });
  }

  var subTimers = [];
  function clearSub() { subTimers.forEach(clearTimeout); subTimers = []; }

  var api = {
    isOn: function () { return on; },
    setOn: function (b) {
      on = !!b;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { }
      if (on) ac(); else { clearSub(); api.stop(); }
      return on;
    },
    toggle: function () { return api.setOn(!on); },
    // ユーザーの操作の中で呼んでおく（そうしないとブラウザが音を出させてくれない）
    unlock: function () { if (on) ac(); },
    // ノーマルアタック。turns=わざのターン数（1〜5）・rate=再生の速さ（×2なら2）
    atk: function (turns, rate) {
      if (!on || !ac()) return;
      kachi();
      var step = 500 / (rate || 1);
      for (var k = 1; k < (turns || 1); k++) {
        subTimers.push(setTimeout(kachiSub, k * step));
      }
    },
    sp: function (eff) { if (on && ac()) seSp(eff); },
    vs: function () { if (on && ac()) seVs(); },       // バトルスタート
    intro: function () { if (on && ac()) seIn(); },    // ポケモンをくりだす
    swap: function () { if (on && ac()) seSwap(); },
    ko: function () { if (on && ac()) seKo(); },
    win: function () { if (on && ac()) seWin(); },
    lose: function () { if (on && ac()) seLose(); },
    stop: function () {
      clearSub();
      LIVE.forEach(function (s) { try { s.stop(); } catch (e) { } });
      LIVE = [];
    }
  };
  window.GonaviSound = api;
})();
