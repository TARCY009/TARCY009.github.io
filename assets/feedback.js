// 「フィードバックを送る」ボタン（全ツール共通・2026-09-06・テスト期間だけ出す）
//
// テスターに使ってもらって、気づいたことをその場で送ってもらうための案内。
// theme・explain・home と同じ**自己完結の共通部品**なので、ページ側の追加は2行だけ:
//   1. <head> に feedback.css を読み込む（home.css の直後）
//   2. home.js の直後に feedback.js を読み込む
//
// ボタンを押すと、フォーム（別のサービス）を新しいタブで開く。そのとき
// **どのツールを見ていたか・端末・画面幅・テーマ・そのときのURL**を一緒に渡すので、
// テスターは「気づいたこと」と「スクリーンショット」だけ書けばよい。
//
// ⚠ 送る先（FORM）を入れるまでは何も出さない。設定はこのファイルの先頭だけを直せばよい。
(function () {
  // ============================ 設定 ============================
  // フォームのURL。空のあいだは案内そのものを出さない（入れ忘れても本番が壊れない）
  var FORM = '';

  // この日を過ぎたら自動で消える（日本時間・「フィードバックをもらう期間だけ」出すため）
  var UNTIL = '2026-10-31';

  // false = 案内のURL（末尾に ?fb=1 を付けたもの）を開いた人にだけ出す
  // true  = サイトに来た全員に出す
  var ALL = false;

  // フォームの「隠しフィールド」の名前。フォーム側で同じ名前を作っておく
  var F_TOOL = 'tool';   // どのツールか
  var F_CTX = 'ctx';     // 端末・画面幅・テーマ・そのときのURL をまとめた1行
  // ==============================================================

  var KEY = 'site_feedback';   // 案内を受け取った人の印（端末に残す）

  // 案内のURL（?fb=1）で来たら印を付けて、住所からは消す
  // （そのまま残すと、その人が共有したリンクからも案内が広がってしまう）
  try {
    if (/[?&]fb=1(&|$)/.test(location.search)) {
      localStorage.setItem(KEY, '1');
      var q = location.search.replace(/(^\?|&)fb=1(?=&|$)/, '$1').replace(/^\?$/, '').replace(/^\?&/, '?');
      history.replaceState(null, '', location.pathname + (q === '?' ? '' : q) + location.hash);
    }
  } catch (e) {}

  if (!FORM) return;                                   // 送り先が未設定
  if (new Date() > new Date(UNTIL + 'T23:59:59+09:00')) return;   // 期間が終わった
  var ok = ALL;
  try { ok = ok || localStorage.getItem(KEY) === '1'; } catch (e) {}
  if (!ok) return;

  // ---- どのツールを見ているか ----
  var NAMES = {
    '/': 'トップページ',
    '/dps/': 'レイド火力チェッカー',
    '/raid/': 'レイドシミュレーター',
    '/type-dps/': 'タイプ別火力ランキング',
    '/max-battle/': 'マックスバトル対策',
    '/gym-attack/': 'ジム挑戦',
    '/gym-defense/': 'ジム防衛',
    '/gbl/': 'GBL対面シミュレーター',
    '/battlelog/': 'GBL対戦記録',
    '/breakpoint/': 'ブレイクポイント',
    '/rocket/': 'ロケット団対策',
    '/iv-checker/': '個体値チェッカー',
    '/pokedex/': 'ステータス図鑑'
  };
  var path = location.pathname.replace(/index\.html$/, '');
  if (path.charAt(path.length - 1) !== '/') path += '/';
  var isTop = (path === '/');
  var tool = NAMES[path] || path;

  // ---- 端末のあらまし（不具合の再現に要る最小限だけ） ----
  function device() {
    var u = navigator.userAgent;
    if (/iPhone/.test(u)) return 'iPhone';
    if (/iPad/.test(u)) return 'iPad';
    if (/Android/.test(u)) return /Mobile/.test(u) ? 'Android' : 'Androidタブレット';
    if (/Macintosh/.test(u)) return 'Mac';
    if (/Windows/.test(u)) return 'Windows';
    return 'その他';
  }
  function browser() {
    var u = navigator.userAgent;
    if (/CriOS|Chrome/.test(u) && !/Edg/.test(u)) return 'Chrome';
    if (/Edg/.test(u)) return 'Edge';
    if (/Firefox|FxiOS/.test(u)) return 'Firefox';
    if (/Safari/.test(u)) return 'Safari';
    return '';
  }
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function ctx() {
    var light = document.documentElement.classList.contains('light');
    return [
      device() + (browser() ? '／' + browser() : ''),
      '画面 ' + window.innerWidth + '×' + window.innerHeight,
      light ? 'ライト' : 'ダーク',
      stamp(),
      location.href
    ].join('｜');
  }

  function open_() {
    var sep = FORM.indexOf('?') >= 0 ? '&' : '?';
    var url = FORM + sep + F_TOOL + '=' + encodeURIComponent(tool)
      + '&' + F_CTX + '=' + encodeURIComponent(ctx());
    window.open(url, '_blank', 'noopener');
  }

  function build() {
    if (document.getElementById('fbbar')) return;
    var el = document.createElement('div');
    el.id = 'fbbar';
    el.className = 'fbbar' + (isTop ? ' big' : '');
    el.innerHTML = isTop
      ? '<div class="fbin"><span class="fbeb">Tester Feedback</span>'
        + '<p class="fbttl">気づいたことを教えてください</p>'
        + '<p class="fbsub">使いにくかったところ・数字がおかしいところ・見た目の崩れ。'
        + 'ひとことでも助かります。スクリーンショットも付けられます。</p>'
        + '<button type="button" class="fbbtn">フィードバックを送る</button></div>'
      : '<div class="fbin"><span class="fbtag">テスト中</span>'
        + '<span class="fbtx">気づいた点を教えてください</span>'
        + '<button type="button" class="fbbtn">送る</button></div>';
    el.querySelector('.fbbtn').addEventListener('click', open_);
    document.body.insertBefore(el, document.body.firstChild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
