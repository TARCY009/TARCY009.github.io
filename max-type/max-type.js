// マックスバトル タイプ別ランキング（アタッカー /max-type/ ・タンク /max-type/tank/ の共通の処理）
(function(){
  const D = MAX_DATA;
  const $ = id => document.getElementById(id);
  const cpm = D.cpm50;
  const GUARD = 180;   // ダイウォール(レベル3)1回で壁60 × ダイマックスフェイズの3回(重ねがけの上限なし)
  const PAGE = 30;
  // タイプの英語名(共有URL用・MAX_DATA の並び=ゲーム内の番号順)
  const EN = ['normal','fighting','flying','poison','ground','rock','bug','ghost','steel',
              'fire','water','grass','electric','psychic','ice','dragon','dark','fairy'];
  const TYPE_IDX = sortTypes([...Array(18).keys()], ti => D.types_jp[ti]);

  // ---- 状態(共有URL: t=タイプ, m=tank, g=1, lg=0) ----
  const Q = new URLSearchParams(location.search);
  let curT = EN.indexOf(Q.get('t')); if(curT < 0) curT = TYPE_IDX[0];
  // アタッカーとタンクは別のページ（検索で別々に出るように）。どちらかは body の data-mode で決まる
  const mode = document.body.dataset.mode === 'tank' ? 'tank' : 'atk';
  let guardOn = Q.get('g') === '1';
  let includeLegacy = Q.get('lg') !== '0';
  let shown = PAGE;

  // ---- 共通 ----
  function chip(ti, size){ return typeIconHTML(D.types_jp[ti], size || 14); }
  function chips(tys, size){
    return `<span class="tgroup">${typePairHTML(tys.map(ti => D.types_jp[ti]), size || 18)}</span>`;
  }
  function effVs(att, defTypes){
    let m = 1;
    for(const dt of defTypes) m *= D.chart[att][dt];
    return m;
  }
  function defChip(m){
    if(m <= 0.3)  return '<span class="chip effres">3重耐性 ×0.24</span>';
    if(m <= 0.5)  return '<span class="chip effres">2重耐性 ×0.39</span>';
    if(m < 0.99)  return '<span class="chip effres2">耐性 ×0.63</span>';
    if(m >= 2.5)  return '<span class="chip eff256">二重弱点 ×2.56</span>';
    if(m >= 1.5)  return '<span class="chip eff16">弱点 ×1.6</span>';
    return '<span class="chip eff1">等倍</span>';
  }
  const T_SP = '特別わざ・レガシーわざです（イベント限定やすごいわざマシンスペシャルなどで習得）';
  function mvName(f){
    return f.e ? `<b class="sp" title="${T_SP}">${f.jp}*</b>` : `<b>${f.jp}</b>`;
  }
  function halfTag(f){
    return f.q
      ? '<span class="chip halfchip" title="発生0.5秒のノーマルアタックです。連打でマックスメーターをいちばん速く溜められます">0.5秒</span>'
      : '<span class="chip nohalf" title="発生0.5秒のノーマルアタックではありません（マックスメーターの溜まりがおそくなります）">0.5秒技なし</span>';
  }
  function catTag(cat){
    if(cat === 'G') return '<span class="cattag G">キョダイマックス</span>';
    if(cat === 'D') return '<span class="cattag D">ダイマックス</span>';
    return '<span class="cattag S">特別</span>';
  }
  function rankCls(r){ return r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : ''; }
  // 同じ値は同順位(重なったぶん次の順位を飛ばす)
  function withRanks(rows, key){
    rows.sort((a,b) => b[key] - a[key]);
    const top = rows.length ? rows[0][key] : 1;
    let prev = null, rank = 0;
    rows.forEach((r,i) => {
      const v = Math.round(r[key] * 1000);
      if(v !== prev){ rank = i + 1; prev = v; }
      r.rank = rank; r.pts = 100 * r[key] / top;
    });
    return rows;
  }
  const tanks = [];
  { const seen = new Set();
    for(const p of D.roster){ if(!seen.has(p.n)){ seen.add(p.n); tanks.push(p); } } }

  // ---- アタッカー: 選んだタイプのマックスわざの与ダメージ(マックスバトル対策と同じ式・相手の相性は全員同じなので省く) ----
  function atkRows(){
    const rows = [];
    for(const p of D.roster){
      // 開発者だけの除外（未実装の先行収録を動画用に外す・ふつうの人には効かない）
      if(window.GonaviDevEx && GonaviDevEx.has(p.n)) continue;
      const atkStat = (p.atk + 15) * cpm;
      const power = D.power[p.cat];
      let fast, moveName;
      if(p.cat === 'D'){
        const pool = (p.fm || []).filter(f => f.t === curT && (includeLegacy || !f.e));
        if(!pool.length) continue;
        const stab0 = p.ty.includes(curT) ? D.stab : 1;
        pool.sort((a,b) => (b.q?1:0) - (a.q?1:0) || (a.e?1:0) - (b.e?1:0) || (b.p||0) - (a.p||0));
        fast = pool[0];
        moveName = D.generic_max_jp[curT];
      }else{
        if(p.ft !== curT) continue;
        const pool = (p.fm || []).filter(f => includeLegacy || !f.e);
        const dmg = f => (f.p||0) * (p.ty.includes(f.t) ? D.stab : 1);
        pool.sort((a,b) => (b.q?1:0) - (a.q?1:0) || dmg(b) - dmg(a) || (a.e?1:0) - (b.e?1:0));
        fast = pool[0] || null;
        moveName = p.gm;
      }
      const stab = p.ty.includes(curT) ? D.stab : 1;
      rows.push({p, fast, moveName, stab, dmg: power * atkStat * stab});
    }
    return withRanks(rows, 'dmg');
  }

  // ---- タンク: 耐久指数 ÷ 選んだタイプから受けるダメージの倍率(交代受けと同じ式) ----
  //  ダイウォール込みは、壁180(実HP)を種族値に換算(÷PL50の係数)してHPに足す。
  //  ザマゼンタの登場時の壁60もマックスバトル対策と同じく足す
  function tankRows(){
    const rows = [];
    for(const p of tanks){
      if(window.GonaviDevEx && GonaviDevEx.has(p.n)) continue;   // 開発者だけの除外
      const hp0 = p.st + (p.wall ? (D.wall_hp || 60) / cpm : 0);
      const bulk = hp0 * p.df;
      const gbulk = (hp0 + (guardOn ? GUARD / cpm : 0)) * p.df;
      const mult = effVs(curT, p.ty);
      const half = (p.fm || []).filter(f => f.q).sort((a,b) => (a.e?1:0) - (b.e?1:0))[0] || null;
      rows.push({p, bulk, gbulk, mult, half, score: gbulk / mult});
    }
    return withRanks(rows, 'score');
  }

  // ---- 描画 ----
  function renderTypeGrid(){
    $('typeGrid').innerHTML = TYPE_IDX.map(ti => {
      const ja = D.types_jp[ti];
      const tc = typeColorOf(ja); const c = tc ? tc.top : '#8b5cf6';
      return `<button class="tbtn" type="button" data-t="${ti}" aria-pressed="${ti === curT}"
        style="--tc:${c}" title="${ja}タイプのランキングを表示します">${typeIconHTML(ja, 28)}</button>`;
    }).join('');
    document.querySelectorAll('.tbtn').forEach(b => b.onclick = () => {
      curT = +b.dataset.t; shown = PAGE; sync();
    });
  }
  function atkRowHtml(r){
    const fastInfo = r.fast ? `<span>ノーマルアタック: ${mvName(r.fast)}</span> ${halfTag(r.fast)}` : '';
    return `<div class="row${r.rank <= 3 ? ' no' + r.rank : ''}">
      <div class="prow">
        <div class="rank ${rankCls(r.rank)}">${r.rank}位</div>
        <span class="gname" hidden>${r.p.n}${r.p.cat === 'G' ? '(キョダイ)' : ''}</span>
        <div class="pname"><span class="nameplate">${catTag(r.p.cat)}<span class="nm">${r.p.n}</span>${chips(r.p.ty, 24)}</span></div>
      </div>
      <div class="top">
        <div class="namebox">
          <div class="moves"><b>${r.moveName}</b> ${chip(curT)}</div>
          <div class="moves">${fastInfo}</div>
        </div>
        <div class="pts" title="ダイマックスフェイズの与ダメージを、1位を100として換算したポイントです"><b>${r.pts >= 99.95 ? '100' : r.pts.toFixed(1)}</b><small>ポイント</small></div>
      </div>
      <div class="meter"><i style="width:${Math.max(2, r.pts).toFixed(1)}%"></i></div>
      <div class="detail">
        <span>攻撃種族値 <b>${r.p.atk}</b></span>
        <span>タイプ一致 <b>${r.stab > 1 ? '○ ×1.2' : 'なし'}</b></span>
        <span>マックスわざの威力 <b>${D.power[r.p.cat]}</b></span>
      </div>
    </div>`;
  }
  function tankRowHtml(r){
    const halfInfo = r.half
      ? `<span class="chip halfchip" title="発生0.5秒のノーマルアタックです。連打でマックスメーターをいちばん速く溜められます">0.5秒技 <span${r.half.e?' class="sp"':''}>${r.half.jp}${r.half.e?'*':''}</span></span>`
      : '<span class="chip nohalf" title="発生0.5秒のノーマルアタックを覚えません（マックスメーターの溜まりがおそくなります）">0.5秒技なし</span>';
    const wallChip = r.p.wall ? '<span class="chip wallb" title="登場時に壁60を持っています">開始時ウォール+60</span>' : '';
    const bulkTxt = guardOn
      ? `<span title="HP種族値×防御種族値に、ダイウォールの壁180ぶんを足した値です">耐久指数 <b>${Math.round(r.bulk).toLocaleString('ja-JP')}</b> <span class="arrow">→</span> 壁込み <b>${Math.round(r.gbulk).toLocaleString('ja-JP')}</b></span>`
      : `<span title="HP種族値×防御種族値です">耐久指数 <b>${Math.round(r.bulk).toLocaleString('ja-JP')}</b>${r.p.wall ? '(開始時ウォール込み)' : ''}</span>`;
    return `<div class="row${r.rank <= 3 ? ' no' + r.rank : ''}">
      <div class="prow">
        <div class="rank ${rankCls(r.rank)}">${r.rank}位</div>
        <div class="pname"><span class="nameplate"><span class="nm">${r.p.n}</span>${chips(r.p.ty, 24)}</span></div>
      </div>
      <div class="top">
        <div class="namebox">
          <div class="moves">${defChip(r.mult)} ${wallChip}</div>
          <div class="moves">${halfInfo}</div>
        </div>
        <div class="pts" title="${guardOn ? '壁180込みの耐久指数' : '耐久指数'}を、${D.types_jp[curT]}タイプから受けるダメージの倍率で割り、1位を100として換算したポイントです"><b>${r.pts >= 99.95 ? '100' : r.pts.toFixed(1)}</b><small>ポイント</small></div>
      </div>
      <div class="meter"><i style="width:${Math.max(2, r.pts).toFixed(1)}%"></i></div>
      <div class="detail">
        ${bulkTxt}
        <span>防御種族値 <b>${r.p.df}</b></span>
        <span>HP種族値 <b>${r.p.st}</b></span>
      </div>
    </div>`;
  }
  function render(){
    const ja = D.types_jp[curT];
    const rows = mode === 'atk' ? atkRows() : tankRows();
    $('curType').innerHTML = `<span id="curTypeName">${typeIconHTML(ja, 26)}${ja}タイプ</span><small>${mode === 'atk' ? 'のアタッカー' : 'を受けるタンク'} ${rows.length}匹</small>`;
    const list = $('list');
    list.classList.toggle('tank', mode === 'tank');
    list.innerHTML = rows.slice(0, shown).map(mode === 'atk' ? atkRowHtml : tankRowHtml).join('');
    const empty = $('empty');
    empty.style.display = rows.length ? 'none' : 'block';
    empty.textContent = `${ja}タイプのマックスわざを撃てるポケモンがいません`;
    $('more').style.display = rows.length > shown ? 'block' : 'none';
  }

  // ---- 操作 ----
  function syncUrl(){
    const q = new URLSearchParams();
    if(curT !== TYPE_IDX[0]) q.set('t', EN[curT]);
    if(guardOn) q.set('g', '1');
    if(!includeLegacy) q.set('lg', '0');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    // もう一方のページへのタブにも、いまのタイプと設定を引き継ぐ
    const lq = new URLSearchParams(q); lq.delete(mode === 'atk' ? 'lg' : 'g');
    const ls = lq.toString() ? '?' + lq.toString() : '';
    const sw = $('swLink');
    if(sw) sw.href = (mode === 'atk' ? '/max-type/tank/' : '/max-type/') + ls;
  }
  function sync(){
    $('atkOpts').style.display = mode === 'atk' ? '' : 'none';
    $('tankOpts').style.display = mode === 'tank' ? '' : 'none';
    $('tankNote').style.display = mode === 'tank' ? '' : 'none';
    document.querySelectorAll('.tbtn').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.t === curT)));
    $('fLegacy').setAttribute('aria-pressed', String(includeLegacy));
    $('gOff').setAttribute('aria-pressed', String(!guardOn));
    $('gOn').setAttribute('aria-pressed', String(guardOn));
    render(); syncUrl();
  }
  $('fLegacy').onclick = () => { includeLegacy = !includeLegacy; sync(); };
  $('gOff').onclick = () => { guardOn = false; sync(); };
  $('gOn').onclick = () => { guardOn = true; sync(); };
  $('more').onclick = () => { shown += PAGE; render(); };
  { const tab = $('helptab'), body = $('helpbody');
    tab.onclick = () => { const o = body.hidden; body.hidden = !o; tab.setAttribute('aria-expanded', String(o)); }; }
  renderTypeGrid();
  // 開発者だけの「🚫 除外」（未実装の先行収録を動画用に外す）。置き場所は一覧の直前
  if(window.GonaviDevEx){
    const host = document.createElement('div');
    const list = $('list'); list.parentNode.insertBefore(host, list);
    GonaviDevEx.mount(host, () => D.roster.map(p => p.n));
    GonaviDevEx.on(render);
  }
  sync();
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
})();
