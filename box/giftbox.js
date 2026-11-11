/* ゲーム内のセールボックス風のプレゼントボックスの絵（SVG）。
   GiftBox.svg(種類, {size}) が SVG の文字列を返す。種類は GiftBox.KINDS のキー。
   形はどの箱も同じ（角から見た立方体＋十字のリボン＋上の結び目）。色と柄だけを差し替える。
   面の模様は「面の座標（0〜100の正方形）」で描き、行列で面へ貼る＝遠近のゆがみが自動で付く。 */
(function(){
  'use strict';
  // 箱の頂点（viewBox 0 0 210 200）。L=左上 F=手前上 R=右上 B=奥上。高さ H
  const L = [38, 60], F = [120, 80], R = [172, 54], H = 100;
  const B = [L[0] + R[0] - F[0], L[1] + R[1] - F[1]];
  const C = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2];      // 上の面のまんなか＝結び目
  const M = {                                           // 0〜100 の正方形 → 面
    l: [(F[0] - L[0]) / 100, (F[1] - L[1]) / 100, 0, H / 100, L[0], L[1]],
    r: [(R[0] - F[0]) / 100, (R[1] - F[1]) / 100, 0, H / 100, F[0], F[1]],
    t: [(B[0] - L[0]) / 100, (B[1] - L[1]) / 100, (F[0] - L[0]) / 100, (F[1] - L[1]) / 100, L[0], L[1]],
  };
  const mx = m => 'matrix(' + m.map(v => +v.toFixed(4)).join(' ') + ')';
  const NS = 'vector-effect="non-scaling-stroke"';
  const RW = 9;                                        // リボンの半分の幅（面の座標）

  /* 箱の種類。手本はゲーム内のスクショ（~/Desktop/セールボックス）。
     l/r/t＝左・右・上の面の明るい色と暗い色／split＝面を斜めに分ける2つ目の色／
     line＝面の内側の細い線／trim＝角の縁取り／rib＝リボン（地・影・光）／deco＝面の飾り */
  const KINDS = {
    pink:   {ja:'ピンク',   l:['#f3c6ec','#cfa3e6'], r:['#c9a6ea','#9d86d8'], t:['#fbe3f6','#e9c5f0'], split:['#d9b8f4','#b49ae6'],
             line:'rgba(255,255,255,.75)', rib:['#a9dcf5','#6fb3e0','#e8f7ff'], ribKind:'satin'},
    mint:   {ja:'水色に赤', l:['#c6ecea','#93cfd0'], r:['#95cdd0','#6aaab4'], t:['#e4f7f5','#bfe6e4'],
             line:'rgba(255,255,255,.85)', rib:['#ef5a4c','#b8322b','#ff9a8c'], ribKind:'satin'},
    gold:   {ja:'金に紺',   l:['#f3cf5c','#d9a632'], r:['#d8a734','#b07f1d'], t:['#fbe7a0','#f0cf62'],
             line:'rgba(255,248,214,.85)', rib:['#26407e','#152551','#5a78c0'], ribKind:'satin'},
    legend: {ja:'赤に花',   l:['#e8312e','#b4171c'], r:['#c21e22','#8e1015'], t:['#f45a4e','#d42a2a'],
             rib:['#9ff0ef','#4fc7cf','#f2ffff'], ribKind:'glass', deco:'flowers', sparkle:true},
    remote: {ja:'青いガラス', l:['#5fb6ff','#1f63e0'], r:['#2b74e6','#1747b8'], t:['#9ed6ff','#5aa8f2'],
             trim:{c:'#a9e4ff', w:4}, rib:['#8fb6f0','#5a7fcf','#d6e6ff'], ribKind:'stripe', deco:'glass'},
    egg:    {ja:'タマゴ',   l:['#f0bf4a','#d39a2a'], r:['#d49b2c','#a8731a'], t:['#f7d77a','#e6b54a'],
             trim:{c:'#5b3324', w:6}, rib:['#4f7a2c','#30501a','#82a95a'], ribKind:'satin', deco:'stamps'},
    walk:   {ja:'白に橙',   l:['#f4f8ff','#cfdcf2'], r:['#d7e2f5','#aebfdf'], t:['#ffffff','#e4ecfa'],
             trim:{c:'#f28a1e', w:3.5}, rib:['#2d9fd6','#17709f','#86d3f5'], ribKind:'satin', deco:'gloss'},
    silver: {ja:'銀の菱形', l:['#f2f2f4','#c9cad2'], r:['#cfd0d8','#a2a4b0'], t:['#ffffff','#e3e3ea'],
             rib:['#e7c77a','#b8913c','#fff0c2'], ribKind:'satin', deco:'diamond'},
    black:  {ja:'黒に赤銅', l:['#47494e','#2a2b30'], r:['#2e3035','#1b1c20'], t:['#5c5e64','#3d3f45'],
             line:'rgba(190,196,210,.45)', rib:['#d9643a','#9c3b1d','#ff9b6e'], ribKind:'satin'},
  };

  let uid = 0;
  function svg(kind, opt){
    opt = opt || {};
    const k = KINDS[kind] || KINDS.pink, id = 'gb' + (++uid) + '_';
    const g = (n, c) => '<linearGradient id="' + id + n + '" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">' +
      '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient>';
    let defs = g('l', k.l) + g('r', k.r) + g('t', k.t) +
      (k.split ? g('s', k.split) : '') +
      '<linearGradient id="' + id + 'gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>' +
      '<radialGradient id="' + id + 'gr"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + 'rb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + k.rib[1] + '"/><stop offset=".5" stop-color="' + k.rib[0] + '"/><stop offset="1" stop-color="' + k.rib[1] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + k.rib[2] + '"/><stop offset=".55" stop-color="' + k.rib[0] + '"/><stop offset="1" stop-color="' + k.rib[1] + '"/></linearGradient>';
    if (k.sparkle) defs += '<pattern id="' + id + 'sp" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#fff" opacity=".35"/><circle cx="3.6" cy="3.2" r=".6" fill="#000" opacity=".18"/></pattern>';
    if (k.deco === 'diamond') defs += '<pattern id="' + id + 'dm" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M12.5 1 24 12.5 12.5 24 1 12.5z" fill="#fff" fill-opacity=".38" stroke="#8a8c99" stroke-opacity=".55" stroke-width=".6"/><path d="M12.5 1 24 12.5H1z" fill="#fff" fill-opacity=".35"/></pattern>';

    const ribRect = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (k.ribKind === 'glass' ? k.rib[0] : 'url(#' + id + 'rbf)') + '"' + (k.ribKind === 'glass' ? ' fill-opacity=".72"' : '') + '/>';
    // 面1枚（左・右）の中身。vert=縦のリボンの位置
    function side(face){
      const grad = 'url(#' + id + face + ')';
      let s = '<rect width="100" height="100" fill="' + grad + '"/>';
      if (k.split) s += '<path d="M0 ' + (face === 'l' ? '64' : '30') + ' L100 ' + (face === 'l' ? '22' : '88') + ' V100 H0z" fill="url(#' + id + 's)" opacity=".9"/>';
      if (k.sparkle) s += '<rect width="100" height="100" fill="url(#' + id + 'sp)"/>';
      if (k.deco === 'diamond') s += '<rect width="100" height="100" fill="url(#' + id + 'dm)"/>';
      if (k.deco === 'flowers') s += (face === 'l' ? [[22, 30], [22, 80], [80, 62]] : [[78, 26], [24, 74]]).map(p => flower(p[0], p[1])).join('');
      if (k.deco === 'stamps') s += face === 'l'
        ? stamp(26, 34, 9, '#7b5a2a') + '<rect x="12" y="66" width="22" height="12" rx="1.5" fill="none" stroke="#a0442c" stroke-width="1.3" ' + NS + ' opacity=".7" transform="rotate(-12 23 72)"/>'
        : stamp(30, 62, 12, '#7b5a2a') + '<path d="M86 6 L96 6 L96 16z" fill="#d6292b"/>';
      if (k.deco === 'glass'){
        s += '<path d="M8 8 L60 8 L22 92 L8 92z" fill="#fff" opacity=".18"/><path d="M64 8 L74 8 L36 92 L26 92z" fill="#fff" opacity=".12"/>';
        if (face === 'l') s += [0, 1, 2, 3].map(i => '<rect x="' + (70 + i * 4.5) + '" y="78" width="2.4" height="10" rx=".6" fill="#6ff2a0"/>').join('');
        else s += '<rect x="20" y="70" width="52" height="16" rx="2" fill="#ff8ad8" opacity=".55"/><path d="M82 8 L92 8 L92 18z" fill="#7ff2b0"/>';
      }
      if (k.deco === 'gloss') s += '<path d="M6 90 L46 6 L58 6 L18 90z" fill="#fff" opacity=".55"/><path d="M60 94 L92 26 L96 34 L68 94z" fill="#fff" opacity=".35"/>';
      if (k.line) s += '<path d="M9 9 H91 V91 H9 Z" fill="none" stroke="' + k.line + '" stroke-width="1.4" ' + NS + '/>' +
        '<path d="M' + (face === 'l' ? '9 70 L30 91' : '70 91 L91 70') + '" fill="none" stroke="' + k.line + '" stroke-width="1.4" ' + NS + '/>';
      if (k.trim) s += trimOf(k.trim);
      s += '<rect width="100" height="100" fill="url(#' + id + 'gl)" opacity="' + (face === 'l' ? '.9' : '.45') + '"/>' +
        '<rect width="100" height="100" fill="url(#' + id + 'sh)"/>';
      s += ribRect(50 - RW, 0, RW * 2, 100) + ribEdge(50 - RW, 50 + RW, true);
      if (face === 'r') s += '<rect width="100" height="100" fill="#0b1030" opacity=".10"/>';
      return '<g transform="' + mx(M[face]) + '">' + s + '<rect width="100" height="100" fill="none" stroke="rgba(10,14,40,.28)" stroke-width="1" ' + NS + '/></g>';
    }
    function top(){
      let s = '<rect width="100" height="100" fill="url(#' + id + 't)"/>';
      if (k.sparkle) s += '<rect width="100" height="100" fill="url(#' + id + 'sp)"/>';
      if (k.deco === 'diamond') s += '<rect width="100" height="100" fill="url(#' + id + 'dm)"/>';
      if (k.trim) s += trimOf(k.trim);
      s += ribRect(0, 50 - RW, 100, RW * 2) + ribRect(50 - RW, 0, RW * 2, 100) + ribEdge(50 - RW, 50 + RW, false) + ribEdge(50 - RW, 50 + RW, true);
      return '<g transform="' + mx(M.t) + '">' + s + '<rect width="100" height="100" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1" ' + NS + '/></g>';
    }
    function ribEdge(a, b, vert){
      const ln = (x1, y1, x2, y2, c, w) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + w + '" ' + NS + '/>';
      const c = k.ribKind === 'glass' ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.18)';
      let s = vert ? ln(a, 0, a, 100, c, .9) + ln(b, 0, b, 100, c, .9) : ln(0, a, 100, a, c, .9) + ln(0, b, 100, b, c, .9);
      const m = (a + b) / 2, hl = k.ribKind === 'glass' ? 'rgba(255,255,255,.85)' : k.rib[2];
      s += vert ? ln(m - 1.6, 0, m - 1.6, 100, hl, .8) : ln(0, m - 1.6, 100, m - 1.6, hl, .8);
      if (k.ribKind === 'stripe') s += vert ? ln(a + 3, 0, a + 3, 100, 'rgba(255,255,255,.6)', .6) + ln(b - 3, 0, b - 3, 100, 'rgba(255,255,255,.6)', .6)
                                            : ln(0, a + 3, 100, a + 3, 'rgba(255,255,255,.6)', .6) + ln(0, b - 3, 100, b - 3, 'rgba(255,255,255,.6)', .6);
      return s;
    }
    function trimOf(t){
      const w = t.w;
      return '<path d="M0 0H100V100H0Z M' + w + ' ' + w + 'V' + (100 - w) + 'H' + (100 - w) + 'V' + w + 'Z" fill="' + t.c + '" fill-rule="evenodd"/>' +
        '<path d="M0 0H22L0 22Z M100 0V22L78 0Z" fill="' + t.c + '" opacity=".85"/>';
    }
    function flower(x, y){
      const p = a => '<ellipse cx="' + x + '" cy="' + (y - 5.2) + '" rx="3.2" ry="4.6" transform="rotate(' + a + ' ' + x + ' ' + y + ')" fill="#fff"/>';
      return '<g opacity=".95">' + p(0) + p(90) + p(180) + p(270) + '<circle cx="' + x + '" cy="' + y + '" r="2.2" fill="' + k.l[1] + '"/></g>';
    }
    function stamp(x, y, r, c){
      return '<g fill="none" stroke="' + c + '" opacity=".55" ' + NS + '><circle cx="' + x + '" cy="' + y + '" r="' + r + '" stroke-width="1.4" ' + NS + '/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="' + (r * .7) + '" stroke-width=".8" ' + NS + '/>' +
        '<path d="M' + (x - r * .45) + ' ' + y + 'h' + (r * .9) + '" stroke-width="1.6" ' + NS + '/></g>';
    }
    defs += '<linearGradient id="' + id + 'rbf" gradientUnits="userSpaceOnUse" x1="42" y1="0" x2="58" y2="0"><stop offset="0" stop-color="' + k.rib[1] + '"/><stop offset=".45" stop-color="' + k.rib[0] + '"/><stop offset="1" stop-color="' + k.rib[1] + '"/></linearGradient>';

    // 結び目（画面の座標）。輪が2つ・垂れが2本・まんなかの結び
    const cx = C[0], cy = C[1];
    const op = k.ribKind === 'glass' ? ' fill-opacity=".85"' : '';
    const bow =
      '<path d="M' + (cx - 2) + ' ' + (cy + 1) + ' C' + (cx - 6) + ' ' + (cy + 10) + ' ' + (cx - 12) + ' ' + (cy + 20) + ' ' + (cx - 19) + ' ' + (cy + 27) + ' L' + (cx - 12) + ' ' + (cy + 26) + ' L' + (cx - 10) + ' ' + (cy + 32) + ' C' + (cx - 4) + ' ' + (cy + 22) + ' ' + (cx + 1) + ' ' + (cy + 11) + ' ' + (cx + 3) + ' ' + (cy + 2) + 'z" fill="url(#' + id + 'lp)"' + op + ' stroke="rgba(0,0,0,.2)" stroke-width=".7"/>' +
      '<path d="M' + (cx + 3) + ' ' + (cy + 1) + ' C' + (cx + 9) + ' ' + (cy + 8) + ' ' + (cx + 17) + ' ' + (cy + 16) + ' ' + (cx + 26) + ' ' + (cy + 21) + ' L' + (cx + 20) + ' ' + (cy + 23) + ' L' + (cx + 22) + ' ' + (cy + 29) + ' C' + (cx + 13) + ' ' + (cy + 23) + ' ' + (cx + 4) + ' ' + (cy + 12) + ' ' + (cx - 1) + ' ' + (cy + 3) + 'z" fill="url(#' + id + 'lp)"' + op + ' stroke="rgba(0,0,0,.2)" stroke-width=".7"/>' +
      loop(-1) + loop(1) +
      '<ellipse cx="' + cx + '" cy="' + (cy - 1) + '" rx="8.5" ry="6" fill="url(#' + id + 'lp)" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>' +
      '<ellipse cx="' + (cx - 1.5) + '" cy="' + (cy - 3) + '" rx="4.5" ry="2" fill="#fff" opacity=".55"/>';
    function loop(sgn){
      const x = v => (cx + sgn * v).toFixed(1), y = v => (cy + v).toFixed(1);
      return '<path d="M' + x(1) + ' ' + y(-1) + ' C' + x(8) + ' ' + y(-22) + ' ' + x(30) + ' ' + y(-40) + ' ' + x(43) + ' ' + y(-36) +
        ' C' + x(53) + ' ' + y(-33) + ' ' + x(50) + ' ' + y(-17) + ' ' + x(38) + ' ' + y(-9) +
        ' C' + x(26) + ' ' + y(-2) + ' ' + x(12) + ' ' + y(1) + ' ' + x(1) + ' ' + y(-1) + 'z" fill="url(#' + id + 'lp)"' + op + ' stroke="rgba(0,0,0,.22)" stroke-width=".8"/>' +
        '<path d="M' + x(7) + ' ' + y(-5) + ' C' + x(14) + ' ' + y(-20) + ' ' + x(30) + ' ' + y(-31) + ' ' + x(39) + ' ' + y(-29) +
        ' C' + x(45) + ' ' + y(-27) + ' ' + x(43) + ' ' + y(-18) + ' ' + x(35) + ' ' + y(-13) +
        ' C' + x(26) + ' ' + y(-7) + ' ' + x(15) + ' ' + y(-4) + ' ' + x(7) + ' ' + y(-5) + 'z" fill="' + k.rib[1] + '" opacity=".55"/>' +
        '<path d="M' + x(6) + ' ' + y(-12) + ' C' + x(14) + ' ' + y(-28) + ' ' + x(28) + ' ' + y(-37) + ' ' + x(40) + ' ' + y(-35) + '" fill="none" stroke="' + (k.ribKind === 'glass' ? '#fff' : k.rib[2]) + '" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>';
    }

    const size = opt.size || 120;
    return '<svg class="giftbox" viewBox="0 0 210 200" width="' + size + '" height="' + Math.round(size * 200 / 210) + '" aria-hidden="true" focusable="false">' +
      '<defs>' + defs + '</defs>' +
      '<ellipse cx="' + (F[0] - 6) + '" cy="' + (F[1] + H + 6) + '" rx="86" ry="14" fill="url(#' + id + 'gr)"/>' +
      side('l') + side('r') + top() +
      '<path d="M' + L + ' L' + F + ' L' + R + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"/>' +
      // 縦の角の光
      '<line x1="' + F[0] + '" y1="' + F[1] + '" x2="' + F[0] + '" y2="' + (F[1] + H) + '" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<g transform="translate(' + cx + ' ' + cy + ') scale(1.22) translate(' + (-cx) + ' ' + (-cy) + ')">' + bow + '</g></svg>';
  }
  window.GiftBox = {svg, KINDS};
})();
