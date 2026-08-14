// ダーク⇄ライトの切り替え（全ツール共通）
//
// 使い方: ページの右上に <div id="themesw"></div> を置き、
//   ・<head> に theme.css を読み込む
//   ・<head> の早い位置で次のインラインscriptを実行する（画面を描く前にテーマを当てるため。
//     あとから当てるとダークが一瞬光る）
//       <script>try{if(localStorage.getItem('site_theme')==='light')document.documentElement.className='light';}catch(e){}</script>
//   ・このファイルを読み込む
// 色そのものは各ツールのCSSが :root(ダーク＝既定) と :root.light(ライト) の2ブロックで持つ。
//
// 選んだテーマは端末に覚えさせる。キーは全ツール共通なので、
// サイト内のどのツールへ移っても同じ見た目になる（localStorageは同一オリジンで共有される）。
// OSの設定(prefers-color-scheme)には従わない: 従うとOSがライトの人だけ白くなり、
// ツールごとの見た目が食い違うため。既定はダーク。
(function () {
  var KEY = 'site_theme';
  var root = document.documentElement;

  function apply(light, save) {
    root.classList.toggle('light', light);
    var d = document.getElementById('thDark'), l = document.getElementById('thLight');
    if (d) d.setAttribute('aria-pressed', String(!light));
    if (l) l.setAttribute('aria-pressed', String(light));
    // スマホのアドレスバーの色。各ツールが :root / :root.light に --tcolor で持つ
    var meta = document.querySelector('meta[name=theme-color]');
    var c = getComputedStyle(root).getPropertyValue('--tcolor').trim();
    if (meta && c) meta.setAttribute('content', c);
    if (save) { try { localStorage.setItem(KEY, light ? 'light' : 'dark'); } catch (e) {} }
  }

  function build() {
    var box = document.getElementById('themesw');
    if (!box) return;
    box.className = 'themesw';
    box.innerHTML =
      '<button id="thDark" type="button" aria-label="ダークモード" title="ダークモード">🌙</button>' +
      '<button id="thLight" type="button" aria-label="ライトモード" title="ライトモード">☀️</button>';
    document.getElementById('thDark').onclick = function () { apply(false, true); };
    document.getElementById('thLight').onclick = function () { apply(true, true); };
    apply(root.classList.contains('light'), false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
