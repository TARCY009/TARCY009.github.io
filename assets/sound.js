/* 模擬戦の効果音（2026-09-18・タダシさん選択）
   ねらいは「ノーマルアタックの回数を耳で数えられるようにする」こと。
   実戦は映像・振動・音がそろって数えられるが、シミュレーターは音でしか補えない（iPhoneは振動が使えない）。

   ⚠ 音声ファイルは使わない。波形をその場で計算して鳴らす（読み込み0バイト・オフラインでも鳴る）。
   ⚠ ノーマルアタックは**乱数の種を固定**して、1発ごとの大きさを完全にそろえる（数えるための音なので粒がそろわないと意味がない）。
   ⚠ 音の長さは模擬戦のカットインの長さに合わせてある（交代2.55秒／SP2.88秒（着弾1.05秒）／撃退2.33秒（ズドン0.47秒）／勝敗3.15秒）。

   使い方: GonaviSound.isOn()/setOn(b) で入り切り、atk(turns, rate)・sp(eff, side, at)・swap(at)・ko(at)・
   pivot(side, at)・shield(at)・form(at)・spit(at)・ready(i)・tick(last, i)・buff(up, side, at)・win()・lose() で鳴らす
   （at＝何秒あとに鳴らすか・省略でいますぐ）。
   ⚠ SPアタックは**じぶんとあいてで別の音**（side=1 があいて）。どちらが撃ったか音だけで分かるようにするため。
   保存キーは gbl_snd（gbl_ なので「データの引っ越し」に入る）。既定はOFF。 */
(function () {
  'use strict';
  var KEY = 'gbl_snd';
  var on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { }

  var AC = null, BUS = null, MASTER = null, CONV = null, DLYIN = null, LIVE = [], KA = null;
  var GAIN = 1;   // 一時的な音量の倍率(威力調整の音で案ごとの大きさをそろえる。鳴らし終えたら1に戻す)
  var asleep = false;   // 画面を閉じているあいだの印（⚠ document.hidden を直接見ない・下の sleep/wake を参照）

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
      // ⚠ 音の出口の種類は「ほかの音と混ざる(ambient)」(2026-09-22タダシさん報告で変更)。
      //    以前の 'playback'(音楽の再生扱い・マナーモードでも鳴る)は、模擬戦を開いた瞬間にYouTubeなど
      //    **ほかのアプリの音楽を止めてしまう**。ambient なら音楽と混ざって鳴る。代わりにマナーモード中は鳴らない
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { }
      keepAlive();
    }
    // ⚠ iPhoneは「しばらく無音」「画面を離れた」「着信」などで音の出口が眠る
    //    （suspended だけでなく Safari 独自の interrupted にもなる）。
    //    眠ったまま鳴らそうとすると無音になり、「音ONなのに鳴らない」「交代したら鳴り出した」になる
    //    （2026-09-19タダシさん報告）。running 以外なら必ず起こしにいく
    if (AC.state !== 'running') { try { AC.resume(); } catch (e) { } }
    return AC;
  }
  // ⚠ 眠り対策その2: ごく小さな無音を流し続ける（iPhoneは無音が続くと出口を止めてしまう）
  function keepAlive() {
    if (!AC || KA) return;
    try {
      KA = AC.createBufferSource();
      KA.buffer = AC.createBuffer(1, Math.max(2, Math.round(AC.sampleRate * .5)), AC.sampleRate);
      KA.loop = true;
      var g = AC.createGain(); g.gain.value = .0001;
      KA.connect(g); g.connect(AC.destination); KA.start();
    } catch (e) { KA = null; }
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
    s.buffer = b; g.gain.value = (o.vol == null ? 1 : o.vol) * GAIN;
    s.connect(g);
    var oo = {}; for (var k in o) oo[k] = o[k];
    if (oo.dur == null) oo.dur = b.duration;
    route(g, oo);
    s.start(c.currentTime + (o.at || 0)); keep(s);
  }
  // 鳴らした音の控え。⚠ 長いバトルでたまり続けないよう上限をつける（止めるときに使うだけ）
  function keep(n) { LIVE.push(n); if (LIVE.length > 400) LIVE = LIVE.slice(-200); }
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
  // 掃きの音（riser の上下自由版。env: up=だんだん大きく / down=だんだん小さく / bell=山なり）
  function sweep(dur, o) {
    o = o || {};
    var f0 = o.f0 == null ? 4000 : o.f0, f1 = o.f1 == null ? 300 : o.f1, q = o.q == null ? 7 : o.q;
    var tn = o.tone == null ? .25 : o.tone, t0 = o.t0 == null ? 1200 : o.t0, t1 = o.t1 == null ? 90 : o.t1;
    var env = o.env || 'up';
    playBuf(bufOf(dur, function (L, R, sr, len) {
      var fl = svf(), fr = svf(), ph = 0;
      for (var i = 0; i < len; i++) {
        var k = i / len, t = i / sr, f = (f0 * Math.pow(f1 / f0, k)) / sr;
        var nl = fl(Math.random() * 2 - 1, f, q).bp, nr = fr(Math.random() * 2 - 1, f, q).bp;
        ph += 2 * Math.PI * (t0 * Math.pow(t1 / t0, k)) / sr;
        var e = env === 'down' ? Math.pow(1 - k, .8) : env === 'bell' ? Math.sin(Math.PI * k) : Math.pow(k, .6);
        e *= fade(i, sr, 8) * (1 - Math.max(0, (t - (dur - .03)) / .03));
        L[i] = (nl * 1.4 + Math.sin(ph) * tn) * e;
        R[i] = (nr * 1.4 + Math.sin(ph) * tn) * e;
      }
    }), o);
  }
  // はじける連打（機械的なチャージ）。左右に動かしながら n 発
  function stutter(n, o) {
    o = o || {};
    var f0 = o.f0 == null ? 1400 : o.f0, f1 = o.f1 == null ? 2600 : o.f1;
    var dur = o.dur == null ? .03 : o.dur, vol = o.vol == null ? .2 : o.vol;
    var at = o.at || 0, span = o.span == null ? .6 : o.span;
    var p0 = o.pan == null ? 0 : o.pan, p1 = o.pan2 == null ? p0 : o.pan2;
    for (var i = 0; i < n; i++) {
      var k = n < 2 ? 0 : i / (n - 1);
      noise({
        f: f0 * Math.pow(f1 / f0, k), q: 7, dur: dur, vol: vol * (.55 + k * .8),
        at: at + span * Math.pow(k, 1.45), pan: p0 + (p1 - p0) * k, rev: .25, dly: .15, seed: 2200 + i * 37
      });
    }
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
    var v = Math.max(.002, (o.vol == null ? .18 : o.vol) * GAIN);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.atk || .12));
    g.gain.setValueAtTime(v, t + dur * .6);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    freqs.forEach(function (f, i) {
      [-7, 0, 7].forEach(function (d) {
        var os = c.createOscillator();
        os.type = o.type || 'sawtooth'; os.frequency.setValueAtTime(f, t); os.detune.setValueAtTime(d + (i % 2 ? 3 : -3), t);
        os.connect(lp); os.start(t); os.stop(t + dur + .1); keep(os);
      });
    });
    var oo = {}; for (var k in o) oo[k] = o[k];
    oo.dur = dur;
    lp.connect(g); route(g, oo);
  }
  function tone(o) {
    var c = ac(); if (!c) return;
    var f = o.f == null ? 440 : o.f, dur = o.dur == null ? .1 : o.dur, vol = (o.vol == null ? .3 : o.vol) * GAIN;
    var t = c.currentTime + (o.at || 0), g = c.createGain();
    var mk = function (cents) {
      var os = c.createOscillator();
      os.type = o.type || 'triangle'; os.frequency.setValueAtTime(f, t); os.detune.setValueAtTime(cents, t);
      if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
      os.connect(g); os.start(t); os.stop(t + dur + .05); keep(os);
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
    bp.Q.value = q; g.gain.value = (o.vol == null ? .4 : o.vol) * GAIN;
    s.connect(bp).connect(g); route(g, o); s.start(t); s.stop(t + dur + .05); keep(s);
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
  // じぶんのSPアタック「斬撃（鋭い）」。eff: 's'=こうかばつぐん / 'w'=いまひとつ / それ以外=等倍
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
  // ---- じぶんのSPアタックの新しい候補5案（2026-09-22タダシさん指示「メーターの音と似ていて2回聴いている感覚になる」）----
  // ⚠ 威力調整メーターの音（電子ビープのスライド・ため→炸裂→和音のEXCELLENT）と作りを変える:
  //    上がるノイズ(riser)と「ため→炸裂」の形は使わない。着弾は従来どおり1.05秒・じぶんは左から。
  //    種類ごとに案を選ぶ（0=従来の「斬撃」・1〜5=新しい案。見本 scratchpad/mock-spsound2.html）。
  //    2026-09-22タダシさん決定: 等倍＝案4 射撃／こうかばつぐん＝案2 雷撃／いまひとつ＝案3 波動
  var SP_PAT = { n: 4, s: 2, w: 3 };
  function spPatOf(eff) { return SP_PAT[eff === 's' ? 's' : eff === 'w' ? 'w' : 'n'] || 0; }
  function seSp2(eff, pat, at) {
    var a = at || 0, i;
    switch (pat) {
      case 1:   // 打撃（重い一撃）: 布を切る風→ズドンと太鼓＋低い衝撃。ばつぐんは2発目と金属の割れ
        whoosh(.34, { f0: 500, f1: 2200, vol: .26, at: a, pan: -1, pan2: .1, dur: .34 });
        whoosh(.2, { f0: 800, f1: 3000, vol: .3, at: a + .78, pan: -.6, pan2: .3, dur: .2 });
        if (eff === 'w') {
          kick(.35, { f0: 170, f1: 55, vol: .5, at: a + 1.05, drive: .3, decay: 9, click: .05 });
          noise({ f: 700, f2: 250, q: 2, dur: .25, vol: .3, at: a + 1.05, lo: 1800 });
          return;
        }
        kick(.55, { f0: 280, f1: 45, vol: .68, at: a + 1.05, drive: .9, decay: 5, click: .3 });
        burst(.4, { cut: 3200, cut2: 500, decay: 6, drive: .5, vol: .34, at: a + 1.05, hi: 200, rev: .4 });
        pad([98, 147], .7, { vol: .12, at: a + 1.08, rev: .6, open: 900, type: 'sawtooth', atk: .02 });
        if (eff === 's') {
          kick(.5, { f0: 260, f1: 42, vol: .6, at: a + 1.24, drive: .9, decay: 5, click: .3 });
          gong(1760, .9, { decay: 3, hiDecay: 10, strike: .5, vol: .3, at: a + 1.05, rev: .45 });
          for (i = 0; i < 4; i++) ks(1800 + i * 500, .3, { damp: .99, tone: .95, decay: 9, vol: .09, at: a + 1.25 + i * .01, pan: (i % 2 ? 1 : -1) * .6, rev: .4, seed: 2100 + i });
        }
        return;
      case 2:   // 雷撃（放電）: パチパチと帯電→バチッと落雷＋高い割れ。ばつぐんは帯電が長く残響が散る／いまひとつは弱い放電だけ
        stutter(eff === 'w' ? 4 : 9, { f0: 3000, f1: 7000, dur: .018, vol: eff === 'w' ? .3 : .45, at: a + .25, span: .7, pan: -1, pan2: -.2 });
        if (eff === 'w') {
          tone({ f: 1800, f2: 400, type: 'sawtooth', dur: .18, vol: .45, at: a + 1.05, lo: 2600 });
          noise({ f: 2400, f2: 800, q: 3, dur: .16, vol: .7, at: a + 1.05, seed: 3301 });
          return;
        }
        tone({ f: 4200, f2: 90, type: 'sawtooth', dur: .3, vol: .3, at: a + 1.05, lo: 6000, dly: .15 });
        burst(.3, { cut: 10000, cut2: 2600, decay: 12, drive: .5, vol: .5, at: a + 1.05, hi: 1500, rev: .4 });
        kick(.4, { f0: 200, f1: 48, vol: .5, at: a + 1.06, drive: .7, decay: 6 });
        noise({ f: 6000, f2: 1500, q: 1.5, dur: .5, vol: .2, at: a + 1.1, rev: .6, pan: -.4, pan2: .5 });
        if (eff === 's') {
          stutter(7, { f0: 4000, f1: 8000, dur: .015, vol: .32, at: a + 1.12, span: .5, pan: -.5, pan2: .8 });
          shimmer(8, { base: 2637, dur: .5, span: .6, vol: .09, at: a + 1.15, spread: 1.4 });
          fm(2093, .7, { ratio: 1.41, index: 4, decay: 4, vol: .2, at: a + 1.12, rev: .5, dly: .25, wide: 1 });
        }
        return;
      case 3:   // 波動（うねり）: 低い和音がふくらむ→ドォンと深い一撃＋鐘の残り。ばつぐんは鐘が2つ重なる／いまひとつはこもる
        pad([110, 165, 220], 1.05, { vol: eff === 'w' ? .12 : .2, at: a, rev: .5, open: eff === 'w' ? 700 : 1800, type: 'triangle', atk: .5 });
        sweep(.5, { f0: 300, f1: 1400, q: 5, tone: .3, t0: 110, t1: 330, env: 'bell', vol: .22, at: a + .5, pan: -.8, pan2: 0, dur: .5 });
        if (eff === 'w') {
          kick(.4, { f0: 150, f1: 50, vol: .42, at: a + 1.05, drive: .3, decay: 7, click: .04 });
          fm(330, .5, { ratio: 1.5, index: 2, decay: 5, vol: .16, at: a + 1.06, lo: 1500 });
          return;
        }
        kick(.6, { f0: 300, f1: 40, vol: .62, at: a + 1.05, drive: .8, decay: 4, click: .15 });
        gong(392, 1.4, { decay: 1.6, hiDecay: 6, strike: .3, vol: .36, at: a + 1.05, rev: .55 });
        pad([131, 196, 262], .9, { vol: .14, at: a + 1.1, rev: .7, open: 1600, type: 'sawtooth', atk: .03 });
        if (eff === 's') {
          gong(784, 1.2, { decay: 2, hiDecay: 8, strike: .35, vol: .3, at: a + 1.1, rev: .55 });
          burst(.5, { cut: 5000, cut2: 800, decay: 6, drive: .4, vol: .3, at: a + 1.05, hi: 300, rev: .5 });
          shimmer(6, { base: 1568, dur: .6, span: .7, vol: .08, at: a + 1.2 });
        }
        return;
      case 4:   // 射撃（発射→飛翔→着弾）: 0.3秒でピュンと撃ち、左から右へ飛んで1.05秒で砕ける。ばつぐんは破片が多い／いまひとつはポスッ
        tone({ f: 2400, f2: 600, type: 'square', dur: .16, vol: .2, at: a + .3, lo: 5000, pan: -.9 });
        noise({ f: 3000, f2: 1200, q: 4, dur: .12, vol: .28, at: a + .3, pan: -.9, seed: 4401 });
        whoosh(.6, { f0: 900, f1: 2800, vol: .22, at: a + .42, pan: -.9, pan2: .7, dur: .6, q: 5 });
        if (eff === 'w') {
          noise({ f: 900, f2: 300, q: 2, dur: .22, vol: .3, at: a + 1.05, lo: 2200, pan: .5 });
          kick(.25, { f0: 160, f1: 60, vol: .3, at: a + 1.05, drive: .2, decay: 12 });
          return;
        }
        burst(.38, { cut: 8000, cut2: 1400, decay: 8, drive: .4, vol: .56, at: a + 1.05, hi: 700, rev: .4, pan: .5 });
        kick(.4, { f0: 230, f1: 55, vol: .62, at: a + 1.05, drive: .5, decay: 7 });
        for (i = 0; i < (eff === 's' ? 7 : 3); i++) ks(1600 + i * 430, .35, { damp: .99, tone: .95, decay: 8, vol: .1, at: a + 1.05 + i * .015, pan: .2 + (i % 2 ? .6 : -.3), rev: .45, dly: .15, seed: 5100 + i });
        if (eff === 's') {
          tone({ f: 1760, f2: 440, type: 'triangle', dur: .5, vol: .16, at: a + 1.08, rev: .5, dly: .25 });
          shimmer(8, { base: 2093, dur: .5, span: .7, vol: .09, at: a + 1.15, spread: 1.4 });
          pad([294, 440, 587], .8, { vol: .1, at: a + 1.15, rev: .6, open: 2800, type: 'triangle' });
        }
        return;
      case 5:   // 太鼓の連打（和）: ドン・ドン・ドンと3連→大太鼓＋銅鑼。ばつぐんは連打が5つ＋銅鑼が高く鳴る／いまひとつは小太鼓だけ
        var n5 = eff === 's' ? 5 : 3, sp5 = eff === 's' ? .13 : .2;
        for (i = 0; i < n5; i++) kick(.22, { f0: 210, f1: 70, vol: (eff === 'w' ? .3 : .42) * (.7 + i * .1), at: a + .38 + i * sp5, drive: .4, decay: 12, click: .12, pan: -.7 + i * .25 });
        if (eff === 'w') {
          kick(.35, { f0: 190, f1: 60, vol: .52, at: a + 1.05, drive: .3, decay: 9, click: .1 });
          noise({ f: 1500, f2: 500, q: 2, dur: .2, vol: .35, at: a + 1.05, lo: 3000 });
          return;
        }
        kick(.7, { f0: 320, f1: 38, vol: .78, at: a + 1.05, drive: 1, decay: 3.5, click: .35 });
        gong(eff === 's' ? 523 : 262, 1.5, { decay: 1.5, hiDecay: 6, strike: .45, vol: eff === 's' ? .52 : .44, at: a + 1.05, rev: .55 });
        burst(.35, { cut: 2600, cut2: 400, decay: 7, drive: .4, vol: .34, at: a + 1.05, hi: 150, rev: .45 });
        if (eff === 's') {
          gong(1046, 1, { decay: 2.4, hiDecay: 9, strike: .4, vol: .26, at: a + 1.12, rev: .5 });
          shimmer(6, { base: 1568, dur: .6, span: .6, vol: .08, at: a + 1.2 });
        }
        return;
      default: seSp(eff);
    }
  }
  // あいてのSPアタック「怪光線」（2026-09-19タダシさん選択・5案から案2）
  // ⚠ じぶんの音（明るい斬撃）と聞き分けられるように、①暗く低い音を土台にする ②音が右から来る
  //    （じぶんは左から）の2点でそろえてある。着弾だけ 1.05 秒でそろえる（カットインの揺れの瞬間）。
  // 3種類は高さ違いではなく作りが別物（ばつぐん＝放電が増えて金属が散る／いまひとつ＝しぼんで小さく弾けるだけ）。
  function seSpFoe(eff) {
    if (eff === 's') {
      pad([73, 110, 155, 185], 1.2, { vol: .198, rev: .45, open: 2400, type: 'sawtooth', atk: .25 });
      stutter(11, { f0: 1800, f1: 3000, dur: .025, vol: .264, at: .24, span: .76, pan: 1, pan2: -.6 });
      sweep(.42, { f0: 800, f1: 5200, q: 11, tone: .14, t0: 200, t1: 900, vol: .37, at: .63, dly: .18 });
      burst(.6, { cut: 9000, cut2: 1400, decay: 5, drive: .4, vol: .5, at: 1.05, hi: 800, rev: .5 });
      for (var i = 0; i < 6; i++) ks(1500 + i * 540, .4, { damp: .991, tone: .95, decay: 9, vol: .112, at: 1.05 + i * .012, pan: (i % 2 ? -1 : 1) * .7, rev: .45, dly: .2 });
      kick(.5, { f0: 240, f1: 45, vol: .554, at: 1.05, drive: .7, decay: 5 });
      shimmer(7, { base: 1175, dur: .55, span: .7, vol: .099, at: 1.18, spread: 1.5 });
      return;
    }
    if (eff === 'w') {
      pad([73, 98], .95, { vol: .171, rev: .35, open: 800, type: 'sawtooth', atk: .35 });
      stutter(4, { f0: 900, f1: 620, dur: .035, vol: .239, at: .5, span: .4, pan: .7, pan2: .3 });
      noise({ f: 520, f2: 240, q: 3, dur: .28, vol: .342, at: 1.05, lo: 1800 });
      tone({ f: 220, f2: 150, type: 'sawtooth', dur: .3, vol: .205, at: 1.06, lo: 1200 });
      return;
    }
    pad([73, 110, 146], 1.15, { vol: .245, rev: .4, open: 1300, type: 'sawtooth', atk: .3 });
    stutter(7, { f0: 1400, f1: 900, dur: .03, vol: .35, at: .34, span: .6, pan: 1, pan2: 0 });
    sweep(.35, { f0: 600, f1: 2400, q: 9, tone: .2, t0: 140, t1: 520, vol: .385, at: .7, dly: .15 });
    burst(.45, { cut: 4800, cut2: 900, decay: 6, drive: .35, vol: .595, at: 1.05, hi: 500, rev: .4 });
    tone({ f: 880, f2: 110, type: 'sawtooth', dur: .55, vol: .26, at: 1.05, lo: 2600, dly: .2 });
    kick(.4, { f0: 200, f1: 50, vol: .595, at: 1.05, drive: .6, decay: 6 });
  }
  // 交代受け「電気のスイッチ」（2026-09-19タダシさん選択・見本13の案3）
  // 演出1.73秒。⇄が回って 0.88 秒でカチッと止まるところに山を合わせてある。
  // side: 0=じぶんが決めた「交代受け成功！」（明るく上がる） / 1=あいてに決められた（暗く下がる）
  function sePivot(side) {
    if (side) {
      stutter(9, { f0: 2400, f1: 800, dur: .022, vol: .348, at: .06, span: .78, pan: .8, pan2: -.8 });
      burst(.34, { cut: 5200, cut2: 700, decay: 8, drive: .4, vol: .626, at: .88, hi: 400, rev: .4 });
      tone({ f: 784, f2: 196, type: 'square', dur: .2, vol: .261, at: .88, lo: 2600 });
      fm(523, .7, { ratio: 1.49, index: 3.4, decay: 2.8, vol: .383, at: .95, rev: .6, dly: .25, wide: 1 });
      kick(.4, { f0: 190, f1: 48, vol: .592, at: .9, drive: .6, decay: 6 });
      return;
    }
    stutter(9, { f0: 900, f1: 2600, dur: .02, vol: .426, at: .06, span: .78, pan: -.8, pan2: .8 });
    burst(.26, { cut: 9000, cut2: 2400, decay: 12, drive: .3, vol: .724, at: .88, hi: 1600, rev: .3 });
    tone({ f: 1568, f2: 3136, type: 'square', dur: .12, vol: .298, at: .88, lo: 5000 });
    fm(2093, .5, { ratio: 2.01, index: 3, decay: 4, vol: .511, at: .95, rev: .26, dly: .12, wide: 1 });
    shimmer(4, { base: 2637, dur: .26, span: .22, vol: .17, at: .96, spread: 1.4 });
  }
  // シールドのブロック「エネルギーの膜」（見本13の案3）。演出1.43秒・膜が張るのは0.43秒。
  // バトル中いちばん多く鳴るので、ほかより控えめ（ピーク .55前後）にしてある
  function seShield() {
    pad([147, 220, 294], .55, { vol: .146, rev: .35, open: 1200, type: 'sawtooth', atk: .1 });
    sweep(.4, { f0: 500, f1: 3000, q: 9, tone: .18, t0: 180, t1: 700, env: 'up', vol: .237, at: .04, dly: .15 });
    burst(.3, { cut: 6000, cut2: 1600, decay: 10, drive: .25, vol: .255, at: .42, hi: 900, rev: .4 });
    fm(1568, .5, { ratio: 2.01, index: 2, decay: 4.5, vol: .164, at: .43, rev: .5, dly: .2, wide: 1 });
    pad([294, 440, 587], .65, { vol: .091, at: .46, rev: .6, open: 2600, type: 'triangle' });
  }
  // フォルムチェンジ「電子のパルス」（見本13の案3）＝**すがたが変わる**音。
  // ⚠ ウッウ専用にしない（ギルガルド・モルペコ・ミミッキュにも使う）ので、水や生き物に寄せない。
  // ⚠ 音の山は先頭に置く（カットイン演出があるのはウッウだけなので、あるときだけ遅らせて鳴らす）
  function seForm() {
    tone({ f: 330, f2: 1760, type: 'square', dur: .1, vol: .397, lo: 4000 });
    noise({ f: 4200, q: 9, dur: .025, vol: .992, at: .1, seed: 4601 });
    tone({ f: 1760, f2: 880, type: 'square', dur: .14, vol: .446, at: .12, lo: 3600 });
    fm(1319, .4, { ratio: 3.01, index: 2.4, decay: 6, vol: .496, at: .14, rev: .4, dly: .2, wide: 1 });
    pad([294, 440], .5, { vol: .223, at: .16, rev: .45, open: 2200, type: 'triangle' });
  }
  // ウッウの反撃「ビリッ」（見本13の案4）＝獲物を吐き出したとき。**短い一撃**（0.8秒ほど）
  function seSpit() {
    stutter(4, { f0: 2600, f1: 1400, dur: .02, vol: .72, span: .12, pan: .5, pan2: -.5 });
    burst(.24, { cut: 9000, cut2: 1800, decay: 13, drive: .3, vol: .72, at: .03, hi: 1200, rev: .3 });
    tone({ f: 1174, f2: 294, type: 'square', dur: .18, vol: .384, at: .03, lo: 3200 });
    kick(.22, { f0: 180, f1: 56, vol: .576, at: .03, drive: .5, decay: 10 });
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

  // ---- 2026-09-21タダシさん選択（見本14）----
  // SPアタックが撃てるようになった合図「チャージのキュイン」（案2）。リアルタイム操作だけ。
  // i=0 がSP1本目（低め）・1 が2本目（長3度上）＝どちらが撃てるようになったか耳で分かる
  function seReady(i) {
    var m = i ? Math.pow(2, 4 / 12) : 1;
    sweep(.2, { f0: 900 * m, f1: 3400 * m, q: 10, tone: .2, t0: 400 * m, t1: 1400 * m, env: 'up', vol: .216 });
    fm(1568 * m, .4, { ratio: 3.01, index: 2, decay: 7, vol: .249, at: .19, rev: .35, dly: .2, wide: 1 });
  }
  // 残り3秒の合図「鼓動のドクッ」（案4）。シールド・次のポケモン選びの最後の3秒に1回ずつ・最後だけ強め
  function seTick(last) {
    kick(.22, { f0: 140, f1: 55, vol: last ? .768 : .589, drive: .3, decay: 14, click: .05 });
    kick(.18, { f0: 120, f1: 50, vol: last ? .538 : .384, drive: .2, decay: 16, click: .03, at: .13 });
  }
  // 能力変化「3音のアルペジオ」（案1）。上がる＝上がる3音／下がる＝下がる3音。
  // 変わった側から聞こえる（じぶん＝左・あいて＝右＝SPアタックの音と同じ向き）
  function seBuff(up, side) {
    var sc = up ? [659, 784, 1047] : [784, 622, 494], pan = side ? .6 : -.6;
    sc.forEach(function (f, i) { fm(f, .32, { ratio: 2.01, index: 2.2, decay: 7, vol: .338, at: i * .09, pan: pan, rev: .35, dly: .15, wide: 1 }); });
  }

  // ==== SPアタックの出来「威力調整」の入力メーターの音（2026-09-22タダシさん指示・見本は scratchpad/mock-spqsound.html）====
  // スライド音＝メーターのブロックが1つ点くたびに鳴る（指の動きに連動・pctで高さが上がる）。
  // 結果の音＝指を離したときの「NICE未満(base)／NICE／GREAT／EXCELLENT（少し豪華）」。
  // 5案ずつ作ってあり SPQ_PAT で案を選ぶ（見本のページで選べるよう残してある）
  // 2026-09-22タダシさん決定: スライド＝案2 電子ビープ／NICE未満＝案1 ボスッ／NICE＝案4 シュッ→ベル／GREAT＝案2 明るい鐘＋きらめき／EXCELLENT＝案3 ため→炸裂→和音
  var SPQ_PAT = { slide: 2, base: 1, nice: 4, great: 2, excellent: 3 };
  // 案ごとの音量の倍率(2026-09-22に OfflineAudioContext で測って、スライド≒.28・NICE未満≒.4・NICE≒.5・GREAT≒.62・EXCELLENT≒.72 にそろえた)
  var SPQ_GAIN = { slide: [1, 1.8, 1.7, 1.4, 1.35], base: [1.1, 1.8, 3.5, 1.6, 1.25], nice: [1.5, 1.45, 3.2, 1.1, 1.3], great: [1.15, 2.2, .9, 1, 1.7], excellent: [1, 1, 1, 1.2, 1.05] };
  function spqGain(kind, pat) { var a = SPQ_GAIN[kind] || []; return a[(pat || 1) - 1] || 1; }
  function seSpqSlide(pct, pat, at) {
    GAIN = spqGain('slide', pat);
    try { seSpqSlide0(pct, pat, at); } finally { GAIN = 1; }
  }
  function seSpqSlide0(pct, pat, at) {
    var k = Math.max(0, Math.min(1, pct / 100)), a = at || 0, sd = Math.round(k * 20);
    switch (pat) {
      case 2:   // 電子ビープ（短い矩形波が上がる）
        tone({ f: 600 * Math.pow(4, k), type: 'square', dur: .045, vol: .15, at: a, lo: 6000 }); break;
      case 3:   // ラチェット（カチカチと歯車を回す）
        noise({ f: 1800 * Math.pow(3.5, k), q: 12, dur: .03, vol: .6, at: a, seed: 3100 + sd }); break;
      case 4:   // 水滴（ベルの粒）
        fm(900 * Math.pow(3.3, k), .16, { ratio: 2.01, index: 2.6, decay: 16, vol: .2, at: a, rev: .25, wide: 1 }); break;
      case 5:   // チャージ（キュッと上がる音＋粒）
        tone({ f: 500 * Math.pow(3, k), f2: 500 * Math.pow(3, k) * 1.35, type: 'triangle', dur: .07, vol: .2, at: a, dly: .1 });
        noise({ f: 5000, q: 8, dur: .02, vol: .25, at: a, seed: 4400 }); break;
      default:  // 木琴（はじく音が左から右へ上がる）
        ks(420 * Math.pow(3.8, k), .12, { damp: .985, tone: .8, decay: 18, vol: .3, at: a, seed: 5000 + sd, pan: -.5 + k });
    }
  }
  function seSpqResult(tier, pat, at) {
    GAIN = spqGain(tier, pat);
    try { seSpqResult0(tier, pat, at); } finally { GAIN = 1; }
  }
  function seSpqResult0(tier, pat, at) {
    at = at || 0;
    var B;
    if (tier === 'base') {   // NICE未満（何も取れない25%）＝はずした音
      switch (pat) {
        case 2: tone({ f: 660, f2: 180, type: 'triangle', dur: .35, vol: .3, at: at, lo: 2400 }); break;            // ぴゅ〜と下がる
        case 3: noise({ f: 1200, f2: 300, q: 2, dur: .22, vol: .5, at: at, lo: 3000 }); break;                       // スカッ
        case 4: ks(180, .4, { damp: .994, tone: .3, decay: 7, vol: .5, at: at, lo: 1200, seed: 61 }); break;         // 鈍い弦
        case 5: [392, 311].forEach(function (f, i) { fm(f, .3, { ratio: 1.5, index: 2, decay: 9, vol: .3, at: at + i * .16, lo: 2500 }); }); break;   // 下がる2音
        default: kick(.3, { f0: 160, f1: 50, vol: .55, at: at, drive: .4, decay: 9, click: .1 });                    // ボスッ
      }
      return;
    }
    if (tier === 'nice') {
      switch (pat) {
        case 2: [784, 1046].forEach(function (f, i) { fm(f, .4, { ratio: 2.01, index: 2.4, decay: 7, vol: .3, at: at + i * .11, rev: .35, dly: .15, wide: 1 }); }); break;   // 上がる2音
        case 3: [1046, 1319, 1568].forEach(function (f, i) { ks(f, .5, { damp: .992, tone: .9, decay: 5, vol: .22, at: at + i * .03, rev: .4, seed: 700 + i }); }); break;   // 軽い和音
        case 4: sweep(.18, { f0: 900, f1: 3200, q: 9, tone: .2, t0: 500, t1: 1400, env: 'up', vol: .22, at: at });     // シュッ→ベル
          fm(1568, .45, { ratio: 3.01, index: 2, decay: 6, vol: .26, at: at + .17, rev: .35, dly: .15, wide: 1 }); break;
        case 5: shimmer(4, { base: 2093, dur: .35, span: .25, vol: .16, at: at, spread: 1.2 });                       // きらめき
          tone({ f: 1046, type: 'triangle', dur: .25, vol: .14, at: at, rev: .4 }); break;
        default: fm(1568, .55, { ratio: 2.01, index: 3, decay: 5, vol: .34, at: at, rev: .45, dly: .2, wide: 1 });   // ベル1つ
          noise({ f: 5000, q: 6, dur: .03, vol: .35, at: at, seed: 8801 });
      }
      return;
    }
    if (tier === 'great') {
      switch (pat) {
        case 2: gong(1319, .9, { decay: 2.6, hiDecay: 9, strike: .3, vol: .42, at: at, rev: .45 });                    // 明るい鐘＋きらめき
          shimmer(5, { base: 2093, dur: .4, span: .4, vol: .1, at: at + .1 }); break;
        case 3: pad([392, 494, 587], .8, { vol: .16, at: at, rev: .5, open: 2800, type: 'triangle', atk: .05 });       // 和音の広がり
          fm(1175, .6, { ratio: 2.01, index: 2.8, decay: 5, vol: .3, at: at + .05, rev: .4, dly: .2, wide: 1 }); break;
        case 4: riser(.28, { f0: 500, f1: 4000, q: 9, tone: .15, vol: .28, at: at });                                 // ため→弾ける
          burst(.3, { cut: 7000, cut2: 1800, decay: 9, drive: .3, vol: .32, at: at + .27, hi: 1000, rev: .4 });
          fm(1568, .6, { ratio: 3.01, index: 2.4, decay: 5, vol: .3, at: at + .28, rev: .45, dly: .2, wide: 1 }); break;
        case 5: [784, 988, 1175, 1568].forEach(function (f, i) { ks(f, .5, { damp: .992, tone: .9, decay: 5, vol: .24, at: at + i * .07, rev: .4, dly: .15, seed: 900 + i }); });   // 弦のアルペジオ
          pad([392, 494, 587], .7, { vol: .1, at: at + .25, rev: .5, open: 2400, type: 'triangle' }); break;
        default: [784, 988, 1175].forEach(function (f, i) { fm(f, .45, { ratio: 2.01, index: 3, decay: 5.5, vol: .3, at: at + i * .1, rev: .4, dly: .2, wide: 1 }); });   // 上がる3音
          kick(.3, { f0: 180, f1: 55, vol: .3, at: at + .2, drive: .3, decay: 9 });
      }
      return;
    }
    // EXCELLENT（少し豪華に）
    switch (pat) {
      case 2:   // 大きな鐘＋上がる風＋きらめきの雨
        gong(1046, 1.3, { decay: 2, hiDecay: 8, strike: .3, vol: .46, at: at, rev: .5 });
        sweep(.4, { f0: 800, f1: 6000, q: 10, tone: .15, t0: 300, t1: 1600, env: 'up', vol: .26, at: at });
        shimmer(12, { base: 2093, dur: .6, span: .9, vol: .11, at: at + .2, spread: 1.4 });
        pad([523, 659, 784, 1046], 1.2, { vol: .13, at: at + .25, rev: .7, open: 3200 }); break;
      case 3:   // ため→炸裂→和音
        riser(.35, { f0: 400, f1: 5000, q: 9, tone: .15, vol: .3, at: at });
        burst(.45, { cut: 9000, cut2: 2000, decay: 7, drive: .3, vol: .4, at: at + .34, hi: 1200, rev: .45 });
        kick(.4, { f0: 220, f1: 55, vol: .45, at: at + .34, drive: .5, decay: 6 });
        [1046, 1319, 1568, 2093].forEach(function (f, i) { fm(f, .9, { ratio: 2.01, index: 3, decay: 4, vol: .26, at: at + .36 + i * .03, rev: .5, dly: .25, wide: 1 }); });
        shimmer(10, { base: 2637, dur: .6, span: .8, vol: .1, at: at + .45, spread: 1.4 }); break;
      case 4:   // 連打のチャージ→高い和音
        stutter(8, { f0: 1200, f1: 3200, dur: .025, vol: .3, at: at, span: .4, pan: -.8, pan2: .8 });
        [523, 659, 784].forEach(function (f, i) { fm(f * 2, .8, { ratio: 3.01, index: 3.4, decay: 4, vol: .26, at: at + .42 + i * .05, rev: .5, dly: .25, wide: 1 }); });
        kick(.4, { f0: 200, f1: 55, vol: .42, at: at + .42, drive: .5, decay: 6 });
        shimmer(12, { base: 2093, dur: .6, span: .8, vol: .12, at: at + .5, spread: 1.5 });
        pad([523, 784, 1046], 1, { vol: .12, at: at + .5, rev: .7, open: 3000 }); break;
      case 5:   // 弦の駆け上がり→ベル
        [523, 659, 784, 1046, 1319, 1568].forEach(function (f, i) { ks(f, .7, { damp: .993, tone: .9, decay: 4, vol: .26, at: at + i * .06, rev: .45, dly: .2, seed: 1200 + i }); });
        fm(2093, .9, { ratio: 2.01, index: 3, decay: 4, vol: .3, at: at + .4, rev: .5, dly: .25, wide: 1 });
        shimmer(10, { base: 2637, dur: .6, span: .7, vol: .1, at: at + .45, spread: 1.4 });
        pad([523, 659, 784, 1046], 1.1, { vol: .13, at: at + .4, rev: .7, open: 3200 });
        kick(.4, { f0: 200, f1: 55, vol: .38, at: at + .4, drive: .4, decay: 7 }); break;
      default:  // ファンファーレ（勝利の音の短い版＋きらめき）
        B = function (f, a, d, v) {
          fm(f, d, { ratio: 3.01, index: 4, decay: 5.5, vol: v, at: at + a, rev: .4, dly: .2, wide: 1 });
          ks(f, d, { damp: .992, decay: 6, vol: v * .5, at: at + a, seed: 1300 + Math.round(f) });
        };
        B(784, 0, .16, .26); B(1046, .11, .16, .26); B(1319, .22, .16, .26); B(1568, .33, .8, .3);
        [1046, 1319, 1568, 2093].forEach(function (f, i) { B(f, .5 + i * .04, .8, .2); });
        pad([523, 659, 784, 1046], 1.2, { vol: .15, at: at + .5, rev: .7, open: 3200 });
        shimmer(12, { base: 2093, dur: .6, span: .9, vol: .12, at: at + .6, spread: 1.4 });
        kick(.4, { f0: 200, f1: 55, vol: .4, at: at + .5, drive: .4, decay: 7 });
    }
  }

  var subTimers = [];
  function clearSub() { subTimers.forEach(clearTimeout); subTimers = []; }
  // at 秒あとに鳴らす（1つの行に演出が複数あるとき、カットインと同じ間でずらすのに使う）。
  // ⚠ 予約は subTimers に積む＝🔊を切る・止めるで必ず消える
  function later(fn, at) {
    // ⚠ 画面を閉じている（ほかのアプリ・別のタブ・画面ロック）あいだは鳴らさないし予約もしない。
    //    予約すると、戻ってきた瞬間にためこんだ音がまとめて鳴る
    if (!on || asleep || !ac()) return;
    if (at > 0) subTimers.push(setTimeout(function () { if (on) fn(); }, at * 1000));
    else fn();
  }

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
    unlock: function () { wake(); },
    // ノーマルアタック。turns=わざのターン数（1〜5）・rate=再生の速さ（×2なら2）
    atk: function (turns, rate) {
      if (!on || asleep || !ac()) return;
      kachi();
      var step = 500 / (rate || 1);
      for (var k = 1; k < (turns || 1); k++) {
        subTimers.push(setTimeout(kachiSub, k * step));
      }
    },
    // side: 0/省略=じぶん（斬撃） / 1=あいて（怪光線）。音でどちらが撃ったか分かるようにする
    sp: function (eff, side, at) { later(function () { if (side) seSpFoe(eff); else { var pt = spPatOf(eff); if (pt) seSp2(eff, pt, 0); else seSp(eff); } }, at); },
    // じぶんのSPの音の案(種類ごと・0=従来の斬撃・1〜5=新しい候補)。見本と測定用: spRaw(eff, pat, at)
    spPattern: function (eff, n) { var k = eff === 's' ? 's' : eff === 'w' ? 'w' : 'n'; if (n == null) return SP_PAT[k]; SP_PAT[k] = +n; return SP_PAT[k]; },
    spRaw: function (eff, pat, at) { if (!ac()) return; if (pat) seSp2(eff, pat, at); else seSp(eff); },
    vs: function (at) { later(seVs, at); },            // バトルスタート
    intro: function (at) { later(seIn, at); },         // ポケモンをくりだす
    swap: function (at) { later(seSwap, at); },
    ko: function (at) { later(seKo, at); },
    pivot: function (side, at) { later(function () { sePivot(side); }, at); },   // 交代受け
    shield: function (at) { later(seShield, at); },    // シールドのブロック
    form: function (at) { later(seForm, at); },        // すがたが変わる
    spit: function (at) { later(seSpit, at); },        // ウッウの反撃
    ready: function (i, at) { later(function () { seReady(i); }, at); },            // SPアタックが撃てる（リアルタイム）
    tick: function (last, i, at) { later(function () { seTick(last); }, at); },     // 残り3秒（リアルタイム）
    buff: function (up, side, at) { later(function () { seBuff(up, side); }, at); }, // 能力変化（side 0=じぶん・1=あいて）
    win: function (at) { later(seWin, at); },
    lose: function (at) { later(seLose, at); },
    // 威力調整の入力メーター（2026-09-22）: スライド音（pct=いまの％）と結果の音（tier=base/nice/great/excellent）
    spqSlide: function (pct, at) { later(function () { seSpqSlide(pct, SPQ_PAT.slide, 0); }, at); },
    spqResult: function (tier, at) { later(function () { seSpqResult(tier, SPQ_PAT[tier] || 1, 0); }, at); },
    spqPattern: function (kind, n) { if (n == null) return SPQ_PAT[kind]; SPQ_PAT[kind] = +n; return SPQ_PAT[kind]; },
    // 見本・測定用: 予約を使わず、音の側の at で並べて鳴らす（OfflineAudioContext で1回のレンダリングにまとめるため）
    spqRaw: function (kind, arg, pat, at) { if (!ac()) return; if (kind === 'slide') seSpqSlide(arg, pat, at); else seSpqResult(arg, pat, at); },
    stop: function () {
      clearSub();
      LIVE.forEach(function (s) { try { s.stop(); } catch (e) { } });
      LIVE = [];
    }
  };
  // ⚠ ブラウザは「利用者が操作した瞬間」でないと音の出口を開けてくれない。
  //    どのタップ・キー操作でも起こしにいく（音がONのときだけ・何度呼んでも害はない）。
  //    これが無いと、眠ったあとは次に🔊を押し直すまで鳴らないままになる
  function wake() { asleep = false; if (on) { ac(); keepAlive(); } }
  ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown'].forEach(function (ev) {
    try { document.addEventListener(ev, wake, { capture: true, passive: true }); } catch (e) { document.addEventListener(ev, wake, true); }
  });
  // ⚠ 画面を閉じたら音を消す（2026-09-19タダシさん指示）。
  //    （以前 navigator.audioSession.type='playback' にしていたときは
  //    そのままだと**ほかのアプリに移っても・画面を消しても鳴り続ける**。
  //    鳴っている音と予約を捨てて、出口そのものを眠らせる（戻ってきたら wake が起こす）
  function sleep() {
    asleep = true;
    try { api.stop(); } catch (e) { }
    if (AC) { try { AC.suspend(); } catch (e) { } }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) sleep(); else wake(); });
  window.addEventListener('pagehide', sleep);
  window.addEventListener('pageshow', wake);
  window.addEventListener('focus', wake);

  window.GonaviSound = api;
})();
