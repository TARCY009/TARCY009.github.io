/* 広告の枠に中身を入れる（全ツール共通・自己完結）。見た目と高さの確保は ads.css。
   ページ側: <head> に ads.css とこのファイル（ふつうの script・defer や async を付けない＝描画の前に枠の有無を決める）、
   本文に <div class="adslot" data-ad="top" data-snap-skip></div>（タイトルのすぐ下）と
         <div class="adslot" data-ad="mid" data-snap-skip></div>（ランキング＝主な結果の下）。
   ボスを選ぶまで結果が空のページは mid に data-ad-when="#結果の要素" を付ける（結果が入ってから枠を出す）。
   決まり:
   - CLIENT と SLOTS が空のあいだは何も出さない（審査の合格後に入れる）
   - 自動広告（全面・画面の下に貼り付く型）は使わない。出すのは決めた枠だけ
   - 開発者の端末（GonaviDev）には出さない（動画の素材に写さない・自分の広告を誤って押さない）
   - ?adtest=1 で開くと、本物の代わりに同じ大きさの点線の箱を出す（配置の確認用・そのタブだけ・?adtest=0 で解除） */
(function(){
  var CLIENT = '';                      // 例: 'ca-pub-0000000000000000'
  var SLOTS  = { top:'', mid:'' };      // 広告ユニットの番号（アドセンスの管理画面で作る）

  var root = document.documentElement;
  function firstUrl(){
    try{ var n = performance.getEntriesByType('navigation')[0]; return (n && n.name) || ''; }catch(e){ return ''; }
  }
  var test = false;
  try{
    var u = location.search + ' ' + firstUrl();
    if (/[?&]adtest=1\b/.test(u)) sessionStorage.setItem('site_adtest','1');
    if (/[?&]adtest=0\b/.test(u)) sessionStorage.removeItem('site_adtest');
    test = sessionStorage.getItem('site_adtest') === '1';
  }catch(e){}
  var live = !test && !!CLIENT;
  if (!test && !live) return;
  root.classList.add(test ? 'adtest' : 'adson');   // 描画の前に付ける＝枠の高さが最初から確保される

  function sizeOf(el){
    if (el.getAttribute('data-ad') === 'mid') return [300,250];
    return el.clientWidth >= 728 ? [728,90] : [320,100];
  }
  function loadLib(){
    if (document.getElementById('adsbygoogle-js')) return;
    var sc = document.createElement('script'); sc.id = 'adsbygoogle-js'; sc.async = true; sc.crossOrigin = 'anonymous';
    sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CLIENT);
    document.head.appendChild(sc);
  }
  function fillOne(el){
    if (el.firstChild) return;
    var kind = el.getAttribute('data-ad'), s = sizeOf(el);
    if (test){
      var ph = document.createElement('div'); ph.className = 'adph';
      ph.style.width = s[0]+'px'; ph.style.height = s[1]+'px';
      ph.textContent = (kind === 'mid' ? 'B ' : 'A ') + s[0] + '×' + s[1];
      el.appendChild(ph); return;
    }
    if (!SLOTS[kind]) return;
    var ins = document.createElement('ins'); ins.className = 'adsbygoogle';
    ins.style.width = s[0]+'px'; ins.style.height = s[1]+'px';
    ins.setAttribute('data-ad-client', CLIENT); ins.setAttribute('data-ad-slot', SLOTS[kind]);
    el.appendChild(ins);
    try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
    loadLib();
  }
  // 結果が入っているか: 「空です」の案内（.empty）以外の要素が1つでもあれば入っている
  function hasResult(t){
    for (var c = t.firstElementChild; c; c = c.nextElementSibling) if (!c.classList.contains('empty')) return true;
    return false;
  }
  function waitFor(el){
    var t = document.querySelector(el.getAttribute('data-ad-when'));
    if (!t){ el.classList.add('adshow'); fillOne(el); return; }
    function check(){
      if (!hasResult(t)) return false;
      el.classList.add('adshow'); fillOne(el); return true;   // 一度出したら出したまま（出し入れで画面を動かさない）
    }
    if (check()) return;
    var mo = new MutationObserver(function(){ if (check()) mo.disconnect(); });
    mo.observe(t, {childList:true});
  }
  function fill(){
    // 開発者の端末では枠ごと消す（home.js が読み込まれたあとでないと判定できない）
    if (live && window.GonaviDev && window.GonaviDev()){ root.classList.remove('adson'); return; }
    var els = document.querySelectorAll('.adslot');
    for (var i=0;i<els.length;i++){
      if (els[i].hasAttribute('data-ad-when')) waitFor(els[i]); else fillOne(els[i]);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
