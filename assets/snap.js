// 画面の一部を画像にして保存する（全ツール共通・2026-09-12タダシさん指示）
//
// ① 一般の人向け: ランキングに「📷 画像を保存」ボタン（下の PUB の設定があるページだけ）。
//    保存される画像は「ツール名・条件の見出し＋上位10件＋GOナビのロゴ」の枠つき1枚（幅720で作るので端末によらず同じ形）。
// ② 開発者向け（home.js の site_dev＝一度 ?dev=1 を開いた端末）: 画面の左下に📷ボタン。押すと「撮影モード」になり、
//    画面のどこでもタップした部分をロゴなしで保存できる（ひと回り外側・内側／背景あり・透明）。動画の素材づくり用。
//    ランキングの「画像を保存」も、開発者の端末ではロゴなしになる。
// ⚠ GBL対戦記録・フィードバック一覧では何も出さない（タダシさん指示で対戦記録は対象外）。
//
// しくみ: 選んだ要素を複製し、ページのCSSを書き写して SVG の foreignObject に入れ、canvas に描いて PNG にする
//   （ブラウザ自身の描画をそのまま使うので見た目が崩れにくい）。
// ⚠ SVGを画像にするとき外部のファイルは読まれないので、画像・書体は data: の形にして埋め込む。
// ⚠ 親要素のクラスで効くCSSがあるので、親は「箱の飾りを消した浅い複製」で包んで残す（.snapanc）。
// ⚠ :root / html / body を狙ったCSSは .snaproot / .snapbody に書き換える。
// ⚠ 一般向けは幅720で作り、@media はその幅で判定させる。撮影モードは画面の見た目どおりにするため、
//   @media をいまのブラウザの幅で判定して中身だけ残す。
(function () {
  'use strict';
  var PATH = location.pathname.replace(/index\.html$/, '');
  if (/^\/(battlelog|feedback)\//.test(PATH)) return;

  function isDev() { try { return localStorage.getItem('site_dev') === '1'; } catch (e) { return false; } }
  var LIMIT = 10;

  // ---------------------------------------------------------------- 一般向けボタンの設定
  // target=画像にする要素 / rows=1行の要素(上位LIMIT件だけ残す) / drop=画像から外す要素 /
  // ctx=見出しの下に出す条件の文字 / tags=点灯中の絞り込みボタン(ピルで出す) / barIn=ボタンを置く場所(無ければtargetの直前)
  var PUB = {
    '/dps/': { target: '#rankList', rows: '.rank-row', drop: '.more', ctx: ['#bossView .bossname'],
               tags: '.c-rank .modes [aria-pressed="true"]', title: 'レイド火力ランキング' },
    '/bulk/': { target: '#rankList', rows: '.rank-row', drop: '.more,#moreBtn',
                tags: '.rhead [aria-pressed="true"]:not(#cntSeg *)', title: '耐久指数ランキング' },
    '/gym-attack/': { target: '#ranklist', rows: '.card', ctx: ['#defender .dname'],
                      tags: '.gtabs [aria-pressed="true"]', title: 'ジム挑戦オススメ' },
    '/gym-defense/': { target: '#list', rows: '.row', tags: '.gtabs [aria-pressed="true"]', title: 'ジム防衛オススメ' },
    '/max-battle/': { target: '#list', rows: '.row', ctx: ['#bname'],
                      tags: '#tabs [aria-selected="true"],#filters [aria-pressed="true"]', title: 'マックスバトル対策' },
    '/iv-checker/': { target: '#result .tblwrap', rows: 'tbody tr',
                      ctx: ['#lgtitle > span:first-child', '#lgtabs .lgc.act .lgc-n', '#lgtabs .lgc.act .lgc-r', '#lgtstats'],
                      barIn: '#result .tophead', title: '個体値チェッカー TOP10' }
  };

  // ---------------------------------------------------------------- ファイルを data: にする
  var urlCache = {};
  function toDataURL(url) {
    if (urlCache[url]) return urlCache[url];
    urlCache[url] = fetch(url).then(function (r) { if (!r.ok) throw 0; return r.blob(); })
      .then(function (b) {
        if (b.size > 1600000) return null;
        return new Promise(function (res) {
          var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); };
          fr.readAsDataURL(b);
        });
      }).catch(function () { return null; });
    return urlCache[url];
  }
  async function inlineUrls(css, base) {
    var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, m, found = {};
    while ((m = re.exec(css))) {
      var u = m[2];
      if (/^(data:|#|about:)/.test(u)) continue;
      try { found[u] = new URL(u, base).href; } catch (e) {}
    }
    var keys = Object.keys(found);
    var datas = await Promise.all(keys.map(function (k) { return toDataURL(found[k]); }));
    keys.forEach(function (k, i) {
      if (!datas[i]) return;
      css = css.split(k).join(datas[i]);
    });
    return css;
  }
  // 別のサイトから読む書体のCSS（Google Fonts）。文字を絞っていない日本語書体は数百のファイルに分かれるので取らない
  var fontCss = {};
  function fetchFontCSS(href) {
    if (fontCss[href]) return fontCss[href];
    fontCss[href] = fetch(href).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      if ((t.match(/url\(/g) || []).length > 24) return '';
      return inlineUrls(t, href);
    }).catch(function () { return ''; });
    return fontCss[href];
  }

  // ---------------------------------------------------------------- ページのCSSを書き写す
  function rwSel(sel) {
    return sel.replace(/:root/g, '.snaproot')
      .replace(/(^|[\s,>+~(])html(?=$|[\s.#:\[>+~,)])/g, '$1.snaproot')
      .replace(/(^|[\s,>+~(])body(?=$|[\s.#:\[>+~,)])/g, '$1.snapbody');
  }
  // ⚠ Chromeの不具合: 「background:var(--x)」のような変数入りの省略形のあとに background-clip:text などの個別指定があると、
  //   cssText が「background-image: ;」と中身の空な形で出てくる（マックスバトルのポイントの数字が消えた・2026-09-12）。
  //   空になったときは、省略形を getPropertyValue で元の書き方のまま取り出して先に書き、そのあと中身のある個別指定を書く
  var SHORT = ['background', 'font', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color',
    'border-width', 'border-style', 'border-radius', 'margin', 'padding', 'inset', 'outline', 'flex', 'flex-flow', 'grid',
    'grid-template', 'grid-area', 'grid-row', 'grid-column', 'gap', 'place-items', 'place-content', 'place-self',
    'transition', 'animation', 'list-style', 'text-decoration', 'columns', 'overflow', 'mask', '-webkit-mask', 'offset',
    'background-position', 'mask-position', 'text-emphasis', 'border-image', 'scroll-margin', 'scroll-padding'];
  // ⚠ getPropertyValue('background') も空で返る（中身がブラウザの内部表現から消えている）ので、
  //   CSSファイルの元の文章から同じ見出し(セレクタ)の塊を探し、変数入りの省略形の指定だけをそこから取り戻す
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function findBlock(raw, sel) {
    if (!raw) return '';
    var pat = sel.split(/\s*([>+~,])\s*|\s+/).filter(function (x) { return x !== undefined && x !== ''; })
      .map(function (tok) { return /^[>+~,]$/.test(tok) ? '\\s*' + escRe(tok) + '\\s*' : escRe(tok); });
    // 並びを「子孫の空白」と「結合子」で組み直す
    var src = '', prev = null;
    pat.forEach(function (p) {
      var isComb = /^\\s\*/.test(p);
      if (prev !== null && !isComb && !prev) src += '\\s+';
      src += p; prev = isComb;
    });
    var m = new RegExp('(?:^|[}\\s;])' + src + '\\s*\\{([^}]*)\\}').exec(raw);
    return m ? m[1] : '';
  }
  function parseDecls(block) {
    var out = [], cur = '', depth = 0, q = '';
    for (var i = 0; i < block.length; i++) {
      var c = block[i];
      if (q) { cur += c; if (c === q) q = ''; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      if (c === ';' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out.map(function (d) {
      var k = d.indexOf(':'); if (k < 0) return null;
      return [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()];
    }).filter(Boolean);
  }
  function ser(st, sel, raw) {
    var t = st.cssText;
    if (!/:\s*;/.test(t) && !/:\s*$/.test(t)) return t;
    var parts = [];
    var decls = parseDecls(findBlock(raw, sel));
    decls.forEach(function (d) {
      if (SHORT.indexOf(d[0]) >= 0 && /var\(/.test(d[1])) parts.push(d[0] + ':' + d[1]);
    });
    SHORT.forEach(function (sh) {
      var v = st.getPropertyValue(sh);
      if (v && /var\(/.test(v) && !decls.some(function (d) { return d[0] === sh; })) parts.push(sh + ':' + v + (st.getPropertyPriority(sh) ? ' !important' : ''));
    });
    for (var i = 0; i < st.length; i++) {
      var p = st[i], v = st.getPropertyValue(p);
      if (v === '') continue;
      parts.push(p + ':' + v + (st.getPropertyPriority(p) ? ' !important' : ''));
    }
    return parts.join(';');
  }
  // CSSファイルの元の文章（ser の取り戻しに使う）。<style> はその中身、同じサイトのファイルは取りに行く
  var rawCache = {};
  function rawOf(sheet) {
    try {
      if (sheet.ownerNode && sheet.ownerNode.tagName === 'STYLE') return Promise.resolve(sheet.ownerNode.textContent || '');
      var h = sheet.href; if (!h || new URL(h).origin !== location.origin) return Promise.resolve('');
      if (!rawCache[h]) rawCache[h] = fetch(h).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
      return rawCache[h];
    } catch (e) { return Promise.resolve(''); }
  }
  async function walk(rules, base, mode, raw) {
    var s = '';
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (r.type === 1) {
          s += rwSel(r.selectorText) + '{' + ser(r.style, r.selectorText, raw) + '}\n';
        } else if (r.type === 4) {
          if (mode === 'window') {
            if (window.matchMedia(r.media.mediaText).matches) s += await walk(r.cssRules, base, mode, raw);
          } else {
            s += '@media ' + r.media.mediaText + '{' + (await walk(r.cssRules, base, mode, raw)) + '}\n';
          }
        } else if (r.type === 3) {
          var ok = false;
          if (r.styleSheet) {
            try { s += await walk(r.styleSheet.cssRules, r.styleSheet.href || base, mode, await rawOf(r.styleSheet)); ok = true; } catch (e) {}
          }
          if (!ok) s += await fetchFontCSS(new URL(r.href, base).href);
        } else if (r.type === 12) {
          if (window.CSS && CSS.supports(r.conditionText)) s += await walk(r.cssRules, base, mode, raw);
        } else {
          s += r.cssText + '\n';
        }
      } catch (e) {}
    }
    return s;
  }
  var cssCache = {};
  async function collectCSS(mode) {
    var key = mode + '|' + (mode === 'window' ? innerWidth + 'x' + innerHeight : '');
    if (cssCache[key]) return cssCache[key];
    var out = [];
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var sh = sheets[i];
      if (sh.ownerNode && sh.ownerNode.id === 'snapui-css') continue;
      var rules = null;
      try { rules = sh.cssRules; } catch (e) { rules = null; }
      if (!rules) { if (sh.href) out.push(await fetchFontCSS(sh.href)); continue; }
      out.push(await walk(rules, sh.href || location.href, mode, await rawOf(sh)));
    }
    var css = await inlineUrls(out.join('\n'), location.href);
    cssCache[key] = css;
    return css;
  }

  // ---------------------------------------------------------------- 要素を複製する
  var NEUTRAL = 'margin:0!important;padding:0!important;border:0!important;background:none!important;' +
    'box-shadow:none!important;width:auto!important;max-width:none!important;min-width:0!important;' +
    'height:auto!important;min-height:0!important;max-height:none!important;position:static!important;' +
    'transform:none!important;overflow:visible!important;filter:none!important;opacity:1!important;';

  async function prepClone(el, o) {
    var c = el.cloneNode(true);
    // 入力欄の中身（複製では消える）
    var sIn = el.querySelectorAll('input,select,textarea'), dIn = c.querySelectorAll('input,select,textarea');
    for (var i = 0; i < sIn.length; i++) {
      var s = sIn[i], d = dIn[i]; if (!d) continue;
      if (s.tagName === 'SELECT') {
        for (var j = 0; j < d.options.length; j++) {
          if (j === s.selectedIndex) d.options[j].setAttribute('selected', ''); else d.options[j].removeAttribute('selected');
        }
      } else if (s.type === 'checkbox' || s.type === 'radio') {
        if (s.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked');
      } else if (s.tagName === 'TEXTAREA') { d.textContent = s.value; }
      else d.setAttribute('value', s.value);
    }
    // canvas は画像に置きかえる
    var sCv = el.querySelectorAll('canvas'), dCv = c.querySelectorAll('canvas');
    for (i = 0; i < sCv.length; i++) {
      try {
        var im = document.createElement('img');
        im.src = sCv[i].toDataURL(); im.className = sCv[i].className;
        im.setAttribute('style', (sCv[i].getAttribute('style') || '') + ';width:' + sCv[i].clientWidth + 'px;height:' + sCv[i].clientHeight + 'px');
        dCv[i].replaceWith(im);
      } catch (e) {}
    }
    c.querySelectorAll('script,.snapbar,[data-snap-skip],#snapui').forEach(function (x) { x.remove(); });
    if (o.drop) c.querySelectorAll(o.drop).forEach(function (x) { x.remove(); });
    if (o.rows && o.limit) {
      Array.prototype.slice.call(c.querySelectorAll(o.rows), o.limit).forEach(function (x) { x.remove(); });
    }
    // 画像を data: に
    var imgs = c.querySelectorAll('img');
    await Promise.all(Array.prototype.map.call(imgs, async function (im) {
      var src = im.getAttribute('src'); if (!src || /^data:/.test(src)) return;
      var d = await toDataURL(new URL(src, location.href).href);
      if (d) im.setAttribute('src', d); else im.remove();
      im.removeAttribute('loading'); im.removeAttribute('srcset');
    }));
    var styled = c.querySelectorAll('[style*="url("]');
    for (i = 0; i < styled.length; i++) styled[i].setAttribute('style', await inlineUrls(styled[i].getAttribute('style'), location.href));
    // 画像にする要素そのもの: 幅を固定し、画面の上での位置取り(固定表示など)を外す
    var w = o.width;
    c.style.setProperty('width', w + 'px', 'important');
    c.style.setProperty('max-width', 'none', 'important');
    c.style.setProperty('min-width', '0', 'important');
    c.style.setProperty('box-sizing', 'border-box', 'important');
    c.style.setProperty('margin', '0', 'important');
    c.style.setProperty('position', 'relative', 'important');
    c.style.setProperty('inset', 'auto', 'important');
    c.style.setProperty('transform', 'none', 'important');
    if (getComputedStyle(el).display === 'none') c.style.setProperty('display', 'block', 'important');
    return c;
  }
  // 親要素の浅い複製で包む（親のクラスで効くCSSを生かしつつ、親の箱の飾りは消す）
  function wrapChain(el, clone) {
    var node = clone;
    for (var a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      var sh = a.cloneNode(false);
      var disp = getComputedStyle(a).display;
      sh.setAttribute('style', NEUTRAL + (/^table/.test(disp) ? '' : 'display:block!important;'));
      sh.classList.add('snapanc');
      sh.appendChild(node);
      node = sh;
    }
    return node;
  }

  var EXTRA = '.snaproot{margin:0!important;padding:0!important}' +
    '.snapanc::before,.snapanc::after{display:none!important}' +
    '.snaproot *{animation:none!important;transition:none!important;caret-color:transparent!important}';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 要素を画像(canvas)にする。戻り値 {canvas, w, h, s}
  async function renderEl(el, o) {
    var W = Math.max(40, Math.round(o.width));
    var P = o.pad || 0;
    var css = await collectCSS(o.mode);
    var clone = await prepClone(el, { width: W, drop: o.drop, rows: o.rows, limit: o.limit });
    var chain = wrapChain(el, clone);
    var bcs = getComputedStyle(document.body);
    var bodyStyle = 'margin:0!important;padding:' + P + 'px!important;min-height:0!important;height:auto!important;' +
      'width:' + (W + P * 2) + 'px!important;box-sizing:border-box!important;background-attachment:scroll!important;' +
      'overflow:visible!important;' + (o.bg ? '' : 'background:none!important;');
    var rootCls = 'snaproot ' + (o.rootCls || '');
    var bodyCls = 'snapbody ' + (o.bodyCls || '');
    // 高さを測る（同じ中身をいったん見えない枠で組む）
    var TW = W + P * 2;
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;left:-100000px;top:0;width:' + TW + 'px;height:50px;border:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(f);
    var d = f.contentDocument;
    d.open(); d.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0"></body></html>'); d.close();
    var st = d.createElement('style'); st.textContent = css + EXTRA; d.head.appendChild(st);
    var root = d.createElement('div'); root.className = rootCls; root.setAttribute('style', 'width:' + TW + 'px');
    var body = d.createElement('div'); body.className = bodyCls; body.setAttribute('style', bodyStyle);
    body.appendChild(d.importNode(chain, true)); root.appendChild(body); d.body.appendChild(root);
    try { await d.fonts.ready; } catch (e) {}
    await Promise.all(Array.prototype.map.call(d.images, function (im) { return im.decode ? im.decode().catch(function () {}) : 0; }));
    await sleep(30);
    var H0 = Math.ceil(root.getBoundingClientRect().height);
    // ⚠ ここで測った高さと、SVGの中で描いたときの高さは少し違うことがある（書体の選ばれ方の差で行が高くなる。
    //   個体値チェッカーの表で10位の行が切れた・2026-09-12）。高さは多めに取って描き、下の空白を切り落として決める。
    //   背景ありのときは空白が見分けられないので、背景なしで一度描いて高さを決めてから、背景ありで描き直す
    var HX = Math.ceil(H0 * 1.25) + 80;
    function svgOf(h, withBg) {
      var xroot = d.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      xroot.className = rootCls; xroot.setAttribute('style', 'width:' + TW + 'px;height:' + h + 'px');
      var xst = d.createElementNS('http://www.w3.org/1999/xhtml', 'style'); xst.textContent = css + EXTRA;
      xroot.appendChild(xst);
      var b2 = body.cloneNode(true);
      if (!withBg) b2.setAttribute('style', b2.getAttribute('style') + 'background:none!important;');
      xroot.appendChild(b2);
      var xml = new XMLSerializer().serializeToString(xroot);
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + TW + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xml + '</foreignObject></svg>';
    }
    async function draw(svg, h, s) {
      var img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await new Promise(function (res, rej) { img.onload = res; img.onerror = function () { rej(new Error('svg')); }; });
      var cv = document.createElement('canvas');
      cv.width = Math.round(TW * s); cv.height = Math.round(h * s);
      var cx = cv.getContext('2d');
      // 書体が間に合わないことがあるので、少し待って描き直す
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      await sleep(160);
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      return cv;
    }
    // 大きすぎると描けないので倍率を下げる
    var s = o.scale || 2;
    s = Math.min(s, Math.sqrt(2.0e8 / (TW * HX)), 15000 / HX, 15000 / TW);
    var probe = await draw(svgOf(HX, false), HX, s);
    // 下から見て、何か描かれている最後の行を探す（ほぼ透明の画素は無視）
    var pc = probe.getContext('2d'), last = -1, step = 64;
    for (var yEnd = probe.height; yEnd > 0 && last < 0; yEnd -= step) {
      var y0 = Math.max(0, yEnd - step), hh = yEnd - y0;
      var data = pc.getImageData(0, y0, probe.width, hh).data;
      for (var yy = hh - 1; yy >= 0 && last < 0; yy--) {
        for (var xx = 0, base = yy * probe.width * 4; xx < probe.width; xx++) {
          if (data[base + xx * 4 + 3] > 8) { last = y0 + yy; break; }
        }
      }
    }
    var H = last < 0 ? H0 : Math.max(10, Math.ceil((last + 1) / s) + P);
    var out;
    try {
      if (o.bg) out = await draw(svgOf(H, true), H, s);
      else {
        out = document.createElement('canvas'); out.width = probe.width; out.height = Math.round(H * s);
        out.getContext('2d').drawImage(probe, 0, 0);
      }
    } finally { f.remove(); }
    return { canvas: out, w: TW, h: H, s: s };
  }

  // ---------------------------------------------------------------- 一般向けの枠
  var logoImg = null;
  function loadLogo() {
    if (logoImg) return logoImg;
    logoImg = new Promise(function (res) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = '/assets/icons/home/icon-192.png';
    });
    return logoImg;
  }
  var JP = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
  function txt(sel) {
    var e = document.querySelector(sel); if (!e) return '';
    var t = (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 58) + '…' : t;
  }
  function toolColor() {
    var w = document.querySelector('header .wmk') || document.querySelector('.wmk');
    var c = w ? getComputedStyle(w).getPropertyValue('--wmk-d').trim() : '';
    return c || '#7fb4ff';
  }
  function rrect(cx, x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }
  function wrapText(cx, t, maxW) {
    var lines = [], cur = '';
    for (var ch of t) { if (cx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur); return lines;
  }
  function tagLabels(sel) {
    if (!sel) return [];
    var out = [];
    document.querySelectorAll(sel).forEach(function (b) {
      if (b.offsetParent === null) return;
      var t = (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) t = (b.getAttribute('aria-label') || '').trim();
      if (!t && b.querySelector('.shadowmark')) t = 'シャドウ';
      if (t && t.length <= 16 && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }

  async function publicImage(cfg) {
    var el = document.querySelector(cfg.target);
    if (!el) throw new Error('target');
    var dev = isDev();
    var W = 720, P = 30, S = 2;
    var content = await renderEl(el, { width: W, mode: 'native', rootCls: '', bodyCls: '', bg: false, pad: 0,
                                       rows: cfg.rows, limit: LIMIT, drop: cfg.drop, scale: S });
    var col = toolColor();
    var eyebrow = txt('header .eyebrow').toUpperCase();
    var title = cfg.title;
    var ctxs = (cfg.ctx || []).map(txt).filter(Boolean);
    var tags = tagLabels(cfg.tags);
    // 見出しの高さを先に測る
    var cv0 = document.createElement('canvas').getContext('2d');
    var TW = W + P * 2;
    cv0.font = '700 17px ' + JP;
    var ctxLines = ctxs.length ? wrapText(cv0, ctxs.join('　／　'), W) : [];
    var headH = 28 + (eyebrow ? 22 : 0) + 38 + (ctxLines.length ? 10 + ctxLines.length * 26 : 0) + (tags.length ? 14 + 30 : 0) + 22;
    var footH = dev ? 26 : 74;
    var TH = headH + content.h + footH;
    var cv = document.createElement('canvas');
    cv.width = TW * S; cv.height = TH * S;
    var cx = cv.getContext('2d'); cx.scale(S, S);
    // 地（濃紺・ツールの色をごく淡く）と角丸・細い枠
    rrect(cx, 1, 1, TW - 2, TH - 2, 22); cx.save(); cx.clip();
    var g = cx.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, '#131c3a'); g.addColorStop(1, '#0a0f22');
    cx.fillStyle = g; cx.fillRect(0, 0, TW, TH);
    var rg = cx.createRadialGradient(TW * 0.08, 0, 0, TW * 0.08, 0, TW * 0.9);
    rg.addColorStop(0, hexA(col, 0.18)); rg.addColorStop(1, hexA(col, 0));
    cx.fillStyle = rg; cx.fillRect(0, 0, TW, TH);
    var bar = cx.createLinearGradient(0, 0, TW * 0.85, 0); bar.addColorStop(0, col); bar.addColorStop(1, hexA(col, 0));
    cx.fillStyle = bar; cx.fillRect(0, 0, TW, 5);
    cx.restore();
    rrect(cx, 1, 1, TW - 2, TH - 2, 22); cx.lineWidth = 1.5; cx.strokeStyle = 'rgba(140,170,255,.28)'; cx.stroke();
    // 見出し
    var y = 28;
    cx.textBaseline = 'alphabetic';
    if (eyebrow) {
      cx.font = '600 13px Oswald,"Avenir Next","Helvetica Neue",Arial,sans-serif';
      cx.fillStyle = col;
      var ex = P; for (var ch of eyebrow) { cx.fillText(ch, ex, y + 13); ex += cx.measureText(ch).width + 2.2; }
      y += 22;
    }
    cx.font = '900 28px ' + JP; cx.fillStyle = '#ffffff';
    cx.fillText(title, P, y + 29);
    y += 38;
    if (ctxLines.length) {
      y += 10; cx.font = '700 17px ' + JP; cx.fillStyle = '#c4d0f0';
      ctxLines.forEach(function (ln) { cx.fillText(ln, P, y + 18); y += 26; });
    }
    if (tags.length) {
      y += 14; cx.font = '800 13px ' + JP;
      var tx = P;
      tags.forEach(function (t) {
        var tw = cx.measureText(t).width + 22;
        if (tx + tw > P + W) return;
        rrect(cx, tx, y, tw, 26, 13); cx.fillStyle = hexA(col, 0.22); cx.fill();
        cx.strokeStyle = hexA(col, 0.55); cx.lineWidth = 1; cx.stroke();
        cx.fillStyle = '#ffffff'; cx.fillText(t, tx + 11, y + 18); tx += tw + 8;
      });
      y += 30;
    }
    y += 22;
    cx.drawImage(content.canvas, P, y, content.w, content.h);
    y += content.h;
    // 下: GOナビのロゴとアドレス・日付（開発者の端末では出さない）
    if (!dev) {
      y += 16;
      cx.fillStyle = 'rgba(140,170,255,.18)'; cx.fillRect(P, y, W, 1);
      y += 16;
      var logo = await loadLogo();
      var lx = P;
      if (logo) { rrect(cx, lx, y, 32, 32, 8); cx.save(); cx.clip(); cx.drawImage(logo, lx, y, 32, 32); cx.restore(); lx += 42; }
      cx.font = '900 19px ' + JP; cx.fillStyle = '#ffffff'; cx.fillText('GOナビ', lx, y + 23);
      var bw = cx.measureText('GOナビ').width;
      cx.font = '600 14px ' + JP; cx.fillStyle = '#93a3cf'; cx.fillText('gonavi.jp', lx + bw + 10, y + 22);
      var dt = new Date(), ds = dt.getFullYear() + '.' + (dt.getMonth() + 1) + '.' + dt.getDate();
      cx.textAlign = 'right'; cx.fillStyle = '#7c8ab4'; cx.fillText(ds, P + W, y + 22); cx.textAlign = 'left';
    }
    return cv;
  }
  function hexA(hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); if (isNaN(n)) return 'rgba(127,180,255,' + a + ')';
    return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ---------------------------------------------------------------- 見本を見せて保存
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function preview(canvas, filename) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) { alert('画像を作れませんでした'); resolve(); return; }
        var url = URL.createObjectURL(blob);
        var ov = document.createElement('div'); ov.className = 'snapov'; ov.id = 'snapui';
        ov.innerHTML = '<div class="snapbox"><div class="snapimg"><img alt="保存する画像"></div>' +
          '<p class="snaphint">スマホは画像を長押しでも保存できます</p>' +
          '<div class="snapbtns"><button type="button" class="snapgo">保存する</button><button type="button" class="snapno">閉じる</button></div></div>';
        ov.querySelector('img').src = url;
        document.body.appendChild(ov);
        var close = function () { ov.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); resolve(); };
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        ov.querySelector('.snapno').onclick = close;
        ov.querySelector('.snapgo').onclick = async function () {
          var file = new File([blob], filename, { type: 'image/png' });
          var touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
          if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file] }); close(); return; } catch (e) { if (e && e.name === 'AbortError') return; }
          }
          var a = document.createElement('a'); a.href = url; a.download = filename;
          document.body.appendChild(a); a.click(); a.remove();
          close();
        };
      }, 'image/png');
    });
  }
  function busy(on) {
    var b = document.getElementById('snapbusy');
    if (on && !b) { b = document.createElement('div'); b.id = 'snapbusy'; b.textContent = '画像を作っています…'; document.body.appendChild(b); }
    if (!on && b) b.remove();
  }

  // ---------------------------------------------------------------- 一般向けのボタンを置く
  function setupPublic() {
    var cfg = PUB[PATH]; if (!cfg) return;
    var tries = 0;
    (function place() {
      var target = document.querySelector(cfg.target);
      var holder = cfg.barIn ? document.querySelector(cfg.barIn) : null;
      if (!target || (cfg.barIn && !holder)) { if (tries++ < 40) setTimeout(place, 250); return; }
      if (document.querySelector('.snapbar')) return;
      var bar = document.createElement(cfg.barIn ? 'span' : 'div');
      bar.className = 'snapbar' + (cfg.barIn ? ' inl' : '');
      bar.innerHTML = '<button type="button" class="snapbtn">📷 画像を保存</button>';
      if (holder) holder.appendChild(bar); else target.parentNode.insertBefore(bar, target);
      var btn = bar.querySelector('button');
      var sync = function () {
        var n = cfg.rows ? target.querySelectorAll(cfg.rows).length : target.children.length;
        bar.hidden = !n || target.offsetParent === null;
        btn.textContent = isDev() ? '📷 画像を保存（ロゴなし・開発者）' : '📷 画像を保存';
      };
      sync();
      new MutationObserver(sync).observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      setInterval(sync, 1500);
      btn.onclick = async function () {
        if (btn.disabled) return;
        btn.disabled = true; busy(true);
        try {
          var cv = await publicImage(cfg);
          busy(false);
          await preview(cv, 'GOナビ_' + cfg.title.replace(/\s+/g, '') + '_' + stamp().slice(0, 8) + '.png');
        } catch (e) { busy(false); console.warn('snap', e); alert('画像を作れませんでした。このブラウザでは対応していない可能性があります'); }
        btn.disabled = false;
      };
    })();
  }

  // ---------------------------------------------------------------- 開発者の撮影モード
  var pick = { on: false, el: null, locked: false, stack: [], bg: 'page' };
  var fab, hi, bar;
  function ui() {
    if (fab) return;
    fab = document.createElement('button'); fab.type = 'button'; fab.id = 'snapfab'; fab.className = 'snapui';
    fab.title = '撮影モード（開発者だけ）: 画面のどこでも画像にして保存'; fab.textContent = '📷';
    fab.onclick = function (e) { e.stopPropagation(); pick.on ? stopPick() : startPick(); };
    document.body.appendChild(fab);
  }
  function startPick() {
    pick.on = true; pick.el = null; pick.locked = false; pick.stack = [];
    fab.classList.add('on');
    hi = document.createElement('div'); hi.className = 'snaphi snapui'; document.body.appendChild(hi);
    bar = document.createElement('div'); bar.className = 'snaptool snapui';
    bar.innerHTML = '<span class="snapdesc">撮りたい所をタップ</span>' +
      '<button type="button" data-a="up" title="ひと回り外側">▲外側</button>' +
      '<button type="button" data-a="down" title="ひと回り内側">▼内側</button>' +
      '<button type="button" data-a="bg">背景あり</button>' +
      '<button type="button" data-a="save" class="go">保存</button>' +
      '<button type="button" data-a="x">✕</button>';
    document.body.appendChild(bar);
    bar.addEventListener('click', onTool);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', drawHi, true);
    window.addEventListener('resize', drawHi);
    syncTool();
  }
  function stopPick() {
    pick.on = false; fab.classList.remove('on');
    if (hi) hi.remove(); if (bar) bar.remove(); hi = bar = null;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', drawHi, true);
    window.removeEventListener('resize', drawHi);
  }
  function isUI(n) { return n && n.closest && n.closest('.snapui,#snapui'); }
  function pickable(n) {
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.nodeType === 1 && !isUI(n)) {
        var r = n.getBoundingClientRect();
        if (r.width >= 40 && r.height >= 22) return n;
      }
      n = n.parentElement;
    }
    return null;
  }
  function drawHi() {
    if (!hi) return;
    if (!pick.el) { hi.style.display = 'none'; return; }
    var r = pick.el.getBoundingClientRect();
    hi.style.display = 'block';
    hi.style.left = r.left + 'px'; hi.style.top = r.top + 'px'; hi.style.width = r.width + 'px'; hi.style.height = r.height + 'px';
    hi.classList.toggle('locked', pick.locked);
  }
  function syncTool() {
    if (!bar) return;
    var d = bar.querySelector('.snapdesc');
    if (pick.el) {
      var r = pick.el.getBoundingClientRect();
      var nm = pick.el.tagName.toLowerCase() + (pick.el.id ? '#' + pick.el.id : '') +
        (pick.el.classList.length ? '.' + Array.prototype.slice.call(pick.el.classList, 0, 2).join('.') : '');
      d.textContent = (pick.locked ? '選択中 ' : '') + nm + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
    } else d.textContent = '撮りたい所をタップ';
    bar.querySelector('[data-a="bg"]').textContent = pick.bg === 'page' ? '背景あり' : '背景透明';
    bar.querySelector('[data-a="save"]').disabled = !pick.el;
  }
  function onMove(e) {
    if (pick.locked || isUI(e.target)) return;
    var n = pickable(e.target); if (n !== pick.el) { pick.el = n; pick.stack = []; drawHi(); syncTool(); }
  }
  function onClick(e) {
    if (isUI(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var n = pickable(e.target);
    if (!n) return;
    pick.el = n; pick.locked = true; pick.stack = []; drawHi(); syncTool();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); stopPick(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); act('up'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); act('down'); }
    else if (e.key === 'Enter' && pick.el) { e.preventDefault(); act('save'); }
  }
  function onTool(e) {
    var b = e.target.closest('button'); if (!b) return;
    e.stopPropagation(); act(b.getAttribute('data-a'));
  }
  async function act(a) {
    if (a === 'x') { stopPick(); return; }
    if (a === 'bg') { pick.bg = pick.bg === 'page' ? 'clear' : 'page'; syncTool(); return; }
    if (a === 'up' && pick.el) {
      var p = pick.el.parentElement;
      if (p && p !== document.body && p !== document.documentElement) { pick.stack.push(pick.el); pick.el = p; pick.locked = true; }
    }
    if (a === 'down' && pick.stack.length) { pick.el = pick.stack.pop(); pick.locked = true; }
    if (a === 'save' && pick.el) {
      var el = pick.el;
      hi.style.display = 'none'; bar.style.visibility = 'hidden';
      busy(true);
      try {
        var r = el.getBoundingClientRect();
        var res = await renderEl(el, { width: r.width, mode: 'window', rootCls: document.documentElement.className,
                                       bodyCls: document.body.className.replace(/\bbfull\b/, ''), bg: pick.bg === 'page',
                                       pad: pick.bg === 'page' ? 16 : 10, scale: 2 });
        busy(false);
        var h1 = txt('header h1') || document.title.split('｜')[0];
        await preview(res.canvas, h1.replace(/\s+/g, '') + '_' + stamp() + '.png');
      } catch (e) { busy(false); console.warn('snap', e); alert('画像を作れませんでした'); }
      if (bar) bar.style.visibility = '';
    }
    drawHi(); syncTool();
  }

  // ---------------------------------------------------------------- 見た目
  var css = document.createElement('style'); css.id = 'snapui-css';
  css.textContent =
    '.snapbar{display:flex;justify-content:flex-end;margin:6px 0 8px}' +
    '.snapbar.inl{display:inline-flex;margin:0 0 0 auto}' +
    '.snapbar[hidden]{display:none!important}' +
    '.snapbtn{font:inherit;font-size:.78rem;font-weight:800;cursor:pointer;border:0;border-radius:999px;padding:6px 14px;' +
      'color:#241800;background:linear-gradient(160deg,#ffe9a3 0%,#ffc83d 55%,#e0a200 100%);' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 2px 0 rgba(0,0,0,.35);transition:transform .15s}' +
    '.snapbtn:hover{transform:translateY(-1px)}.snapbtn:disabled{opacity:.6;cursor:wait}' +
    '#snapbusy{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483600;padding:9px 18px;border-radius:999px;' +
      'background:rgba(10,16,34,.94);color:#fff;font:700 13px/1.2 ' + JP + ';box-shadow:0 6px 20px rgba(0,0,0,.4)}' +
    '.snapov{position:fixed;inset:0;z-index:2147483500;background:rgba(4,8,20,.72);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.snapbox{max-width:min(94vw,820px);max-height:92vh;display:flex;flex-direction:column;gap:10px;align-items:center}' +
    '.snapimg{overflow:auto;max-height:74vh;border-radius:14px;background:repeating-conic-gradient(#1b2340 0% 25%,#141a31 0% 50%) 0 0/20px 20px}' +
    '.snapimg img{display:block;max-width:min(92vw,800px);height:auto}' +
    '.snaphint{margin:0;color:#b8c3e6;font:600 12px/1.4 ' + JP + '}' +
    '.snapbtns{display:flex;gap:10px}' +
    '.snapbtns button{font:800 14px/1 ' + JP + ';border:0;border-radius:999px;padding:11px 22px;cursor:pointer}' +
    '.snapgo{color:#241800;background:linear-gradient(160deg,#ffe9a3,#ffc83d 55%,#e0a200)}' +
    '.snapno{color:#dfe6ff;background:#26304f}' +
    '#snapfab{position:fixed;left:12px;bottom:12px;z-index:2147483400;width:46px;height:46px;border-radius:50%;border:1px solid rgba(160,190,255,.4);' +
      'background:rgba(12,18,40,.88);font-size:22px;line-height:1;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45)}' +
    '#snapfab.on{background:#ffc83d;border-color:#ffe9a3}' +
    '.snaphi{position:fixed;z-index:2147483300;pointer-events:none;border:2px dashed #5ee7ff;background:rgba(94,231,255,.10);border-radius:6px}' +
    '.snaphi.locked{border-style:solid;border-color:#ffc83d;background:rgba(255,200,61,.10)}' +
    '.snaptool{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483450;display:flex;flex-wrap:wrap;gap:6px;align-items:center;' +
      'max-width:calc(100vw - 20px);padding:8px 10px;border-radius:14px;background:rgba(10,16,34,.95);border:1px solid rgba(160,190,255,.3);' +
      'box-shadow:0 8px 24px rgba(0,0,0,.45);font:700 12px/1.2 ' + JP + ';color:#dfe6ff}' +
    '.snapdesc{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9fb2e6;margin-right:4px}' +
    '.snaptool button{font:800 12px/1 ' + JP + ';border:0;border-radius:999px;padding:8px 12px;cursor:pointer;color:#e6ecff;background:#26304f}' +
    '.snaptool button.go{color:#241800;background:linear-gradient(160deg,#ffe9a3,#ffc83d 55%,#e0a200)}' +
    '.snaptool button:disabled{opacity:.45;cursor:default}';
  document.head.appendChild(css);

  function boot() {
    setupPublic();
    var sync = function () { if (isDev()) ui(); else if (fab) { if (pick.on) stopPick(); fab.remove(); fab = null; } };
    sync();
    setInterval(sync, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.GonaviSnap = { renderEl: renderEl, publicImage: publicImage };
})();
