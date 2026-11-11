// SCPランキング（スーパー /scp/ ・ハイパー /scp/hyper/ の共通の処理）。どちらのページかは <body data-cap="1500|2500">。
// ⚠ 計算は GBLシミュレーター（assets/gbl-app.js の rank1／ivFloorOf／lvFloorOf）・個体値チェッカー・
//   ステータス図鑑の最大SCPと同じ。食い違いは答え合わせ scp-rank（.claude/checks/scp-check.html）が保存の前に見つける。
//   ここを直したら、向こうも同じかを必ず確かめる（向こうを直したらここも）。
const CAP = +document.body.dataset.cap || 1500;
const PAGES = { 1500: '/scp/', 2500: '/scp/hyper/' };
const [PV, GO] = await Promise.all([
  fetch('/pvp_data.json').then(r => r.json()),
  fetch('/godata.json').then(r => r.json()),
]);
const $ = id => document.getElementById(id);
const PVP_BAN = new Set(['ditto', 'shedinja']);   // GBLシミュレーターと同じ（戦えないポケモン）
const isMega = key => key.includes('_mega') || key.includes('_primal');

// ---- 最終進化・伝説の印は ジム・レイド側のデータ(godata)から名前で借りる（ステータス図鑑と同じ流儀）。
//      対戦側にしか無いすがたは括弧を除いた名前で探す。それでも無ければ最終進化・伝説は幻の印だけで見る
const goByName = new Map(Object.values(GO.pokemon).map(v => [v.n, v]));
const FLAG = {};
for (const [k, p] of Object.entries(PV.pokemon)) {
  const g = goByName.get(p.n) || goByName.get(p.n.replace(/（[^）]*）/g, ''));
  FLAG[k] = { fe: g ? !!g.fe : true, lg: g ? !!g.lg : !!p.myth };
}
// 戦えるポケモン（実装済み・バトル中だけのすがたと重複を除く・ノーマルアタックを覚える）
const KEYS = Object.keys(PV.pokemon).filter(k => {
  const p = PV.pokemon[k];
  return p.r && !p.hid && !PVP_BAN.has(k) && [...p.q, ...p.eq].some(m => PV.moves[m]);
});

// ---- 理想個体（CP上限に収まる中で SCP が最大の個体値・PL）。gbl-app.js の rank1Calc と同じ式 ----
const LEVELS_ALL = Object.keys(PV.cpm).map(Number).filter(l => l <= 55).sort((a, b) => a - b);
const cpOf = (p, a, d, h, c) => Math.max(10, Math.floor((p.a + a) * Math.sqrt(p.df + d) * Math.sqrt(p.h + h) * c * c / 10));
// 個体値の下限: 交換できないポケモンは10（pvp_data の ivf）。シャドウだけ下限が違うもの（ivfs）はこの一覧では通常の個体で数える
const ivFloorOf = key => PV.pokemon[key].ivf || 0;
// PLの下限(ジガルデ20など)。メガ・ゲンシはバトル中にPLが自動で下がるので下限を見ない(gbl-app.js と同じ)
const lvFloorOf = key => (!isMega(key) && PV.pokemon[key].lvf) || 1;
function best(key, maxLv) {
  const p = PV.pokemon[key], minIv = ivFloorOf(key), LV = LEVELS_ALL.filter(l => l <= maxLv), lf = lvFloorOf(key);
  let b = null;
  for (let a = minIv; a <= 15; a++) for (let d = minIv; d <= 15; d++) for (let h = minIv; h <= 15; h++) {
    let lo = 0, hi = LV.length - 1, li = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cpOf(p, a, d, h, PV.cpm[String(LV[mid])]) <= CAP) { li = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (li < 0 || LV[li] < lf) continue;   // PL下限未満の個体は存在しない
    const c = PV.cpm[String(LV[li])];
    const prod = (p.a + a) * c * (p.df + d) * c * Math.floor((p.h + h) * c);
    if (!b || prod > b.prod) b = { prod, ivs: [a, d, h], lv: LV[li], cp: cpOf(p, a, d, h, c) };
  }
  return b;   // null＝この上限に収まる個体がいない（交換できない幻・ジガルデなど）
}
const scpOf = prod => Math.floor(Math.pow(prod, 2 / 3) / 10);
const BEST = { 50: new Map(), 51: new Map() };
const bestOf = (k, pl) => { const m = BEST[pl]; if (!m.has(k)) m.set(k, best(k, pl)); return m.get(k); };

// ---- 状態(共有URL: mg=1 メガ・ゲンシ / nl=1 伝説系除く / pre=1 進化前も / pl=51 / n=件数 / v=bar メーターを個体値に) ----
const Q = new URLSearchParams(location.search);
let fMega = Q.get('mg') === '1', fNoLg = Q.get('nl') === '1', fPre = Q.get('pre') === '1';
let pl = Q.get('pl') === '51' ? 51 : 50;
let view = Q.get('v') === 'bar' ? 'bar' : 'num';
let showN = [30, 50, 100].includes(+Q.get('n')) ? +Q.get('n') : 30;
let query = '', extra = 0;

const cache = new Map();
let noFit = 0;
function buildRows() {
  const key = [fMega, fNoLg, fPre, pl, window.GonaviDevEx ? GonaviDevEx.sig() : ''].join('|');
  if (cache.has(key)) return cache.get(key);
  const rows = []; let nf = 0;
  for (const k of KEYS) {
    const p = PV.pokemon[k], mega = isMega(k), f = FLAG[k];
    if (window.GonaviDevEx && GonaviDevEx.has(p.n)) continue;   // 開発者だけの除外（ふつうの人には効かない）
    if (mega && !fMega) continue;
    if (!mega && !f.fe && !fPre) continue;
    if (fNoLg && f.lg) continue;
    const b = bestOf(k, pl);
    if (!b) { nf++; continue; }
    // 上限に届かない＝個体値15/15/15・PLの上限でもCPが上限以下（その値がそのポケモンの最大のSCP）
    const low = cpOf(p, 15, 15, 15, PV.cpm[String(pl)]) <= CAP;
    rows.push({ k, p, mega, lg: f.lg, low, ...b, scp: scpOf(b.prod) });
  }
  rows.sort((a, b) => b.prod - a.prod || a.p.n.localeCompare(b.p.n, 'ja'));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.scp !== prev) { rank = i + 1; prev = r.scp; } r.rank = rank; });
  rows.noFit = nf;
  cache.set(key, rows);
  return rows;
}

// ---- 表示 ----
const T_RANK = 'SCPが同じポケモンは同順位です（重なったぶんの順位は飛ばします）';
const T_VAL = 'SCP＝攻撃・防御・HPの実数値を総合した対戦向けの評価値。この個体値・PLのときの値です';
const T_LOW = 'PLの上限まで上げてもCPの上限に届きません（この値がそのポケモンの最大のSCPです）';
const badge = r => r.mega ? `<span class="tag-m2${/^ゲンシ/.test(r.p.n) ? ' tag-p2' : ''}">${/^ゲンシ/.test(r.p.n) ? 'ゲンシ' : 'メガ'}</span>` : '';
const ivNum = r => `<span>個体値 <b>${r.ivs.join('/')}</b></span><span>PL <b>${r.lv}</b></span><span>CP <b>${r.cp}</b></span>`;
const IVN = ['攻撃', '防御', 'HP'];
const ivBar = r => `<div class="ivb">${r.ivs.map((v, j) => `<span class="${v === 15 ? 'full' : ''}">${IVN[j]}<b>${v}</b><u><s style="width:${(v / 15 * 100).toFixed(1)}%"></s></u></span>`).join('')}</div>`;
function renderRank() {
  const all = buildRows();
  const max = all.length ? all[0].prod : 1;
  const q = query.trim().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  let rows, note;
  if (q) {
    // ⚠ 100件で切るときは必ず「本当の件数」を出す(全ツール共通の決まり)
    const hit = all.filter(r => r.p.n.includes(q));
    rows = hit.slice(0, 100);
    note = rows.length ? `「${q}」に当てはまる ${hit.length}件${hit.length > rows.length ? `のうち上位${rows.length}件` : ''}（順位は${all.length}件の中での順位）` : `「${q}」に当てはまるポケモンがいません`;
  } else {
    rows = all.slice(0, showN + extra);
    note = `${all.length}件のうち上位${Math.min(all.length, showN + extra)}件を表示中`;
  }
  $('cnt').textContent = note;
  const list = $('rankList');
  if (!rows.length) { list.innerHTML = '<div class="empty">当てはまるポケモンがいません</div>'; return; }
  list.innerHTML = rows.map(r => `
    <div class="rank-row${r.rank <= 3 ? ' md' + r.rank : ''}">
      <div class="rk" title="${T_RANK}">${r.rank}位</div>
      <div class="rmain">
        <div class="rname">${badge(r)}<span class="nm">${r.p.n}</span><span class="ty">${typePairHTML(r.p.ty.map(t => PV.typeJa[t] || t), 16)}</span>${r.lg ? '<span class="tag-lg" title="伝説・幻・ウルトラビースト">伝説</span>' : ''}${r.low ? `<span class="tag-low" title="${T_LOW}">上限に届かない</span>` : ''}</div>
        ${view === 'bar' ? ivBar(r) + `<div class="rsub"><span>PL <b>${r.lv}</b></span><span>CP <b>${r.cp}</b></span></div>`
          : `<div class="rsub">${ivNum(r)}</div><div class="bar"><i style="width:${(Math.pow(r.prod / max, 2 / 3) * 100).toFixed(1)}%"></i></div>`}
      </div>
      <div class="rval" title="${T_VAL}">${r.scp}<small>SCP</small></div>
    </div>`).join('')
    + (!q && all.length > showN + extra ? `<button class="more" type="button" id="moreBtn">さらに${Math.min(50, all.length - showN - extra)}件見る</button>` : '');
  const mb = $('moreBtn'); if (mb) mb.onclick = () => { extra += 50; renderRank(); };
}

// ---- 操作 ----
function qs(cap) {
  const q = new URLSearchParams();
  if (fMega) q.set('mg', '1');
  if (fNoLg) q.set('nl', '1');
  if (fPre) q.set('pre', '1');
  if (pl !== 50) q.set('pl', String(pl));
  if (showN !== 30) q.set('n', showN);
  if (view === 'bar') q.set('v', 'bar');
  const s = q.toString();
  return PAGES[cap] + (s ? '?' + s : '');
}
function sync() {
  $('fMega').setAttribute('aria-pressed', String(fMega));
  $('fNoLg').setAttribute('aria-pressed', String(fNoLg));
  $('fPre').setAttribute('aria-pressed', String(fPre));
  document.querySelectorAll('#plSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.pl === pl)));
  document.querySelectorAll('#cntSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.n === showN)));
  document.querySelectorAll('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === view)));
  renderRank();
  history.replaceState(null, '', qs(CAP));
}
$('fMega').onclick = () => { fMega = !fMega; extra = 0; sync(); };
$('fNoLg').onclick = () => { fNoLg = !fNoLg; extra = 0; sync(); };
$('fPre').onclick = () => { fPre = !fPre; extra = 0; sync(); };
document.querySelectorAll('#plSeg button').forEach(b => b.onclick = () => { pl = +b.dataset.pl; sync(); });
document.querySelectorAll('#cntSeg button').forEach(b => b.onclick = () => { showN = +b.dataset.n; extra = 0; sync(); });
document.querySelectorAll('#viewSeg button').forEach(b => b.onclick = () => { view = b.dataset.v; sync(); });
// リーグの切り替え＝もう一方のページへ（絞り込みは引き継ぐ）
document.querySelectorAll('#lgSeg button').forEach(b => {
  b.setAttribute('aria-pressed', String(+b.dataset.cap === CAP));
  b.onclick = () => { if (+b.dataset.cap !== CAP) location.href = qs(+b.dataset.cap); };
});
{
  // 入力中(変換中)は書き換えない(恒久ルール)。変換中も絞り込む
  const inp = $('q'), box = $('sbox');
  const apply = () => { query = inp.value; box.classList.toggle('has', !!inp.value); renderRank(); };
  if (window.GonaviDevEx) {
    GonaviDevEx.mount($('devexbox'), () => KEYS.map(k => PV.pokemon[k].n));
    GonaviDevEx.on(() => { cache.clear(); renderRank(); });
  }
  // 開発者だけの「＋ 未実装」（まだ実装されていないポケモンを動画用に足す・devex の逆）。
  // 候補は対戦データにある未実装のポケモン（r が 0・バトル中だけのすがたと戦えないポケモンを除く）。
  // 対戦データはもう読んであるので、候補だけを手元で包んで渡す（ふつうの人には mount が何もしない）
  if (window.GonaviDevAdd) {
    const U = { pokemon: {} };
    for (const [k, p] of Object.entries(PV.pokemon)) if (!p.r && !p.hid && !PVP_BAN.has(k)) U.pokemon[k] = p;
    const url = URL.createObjectURL(new Blob([JSON.stringify(U)], { type: 'application/json' }));
    GonaviDevAdd.mount($('devexbox'), url, (D, on) => {
      for (const [k, p] of Object.entries(D.pokemon || {})) {
        const i = KEYS.indexOf(k);
        if (on(p.n)) { if (i < 0) KEYS.push(k); }
        else if (i >= 0) KEYS.splice(i, 1);
      }
      cache.clear(); renderRank();
    });
  }
  inp.addEventListener('input', apply);
  inp.addEventListener('compositionend', apply);
  box.querySelector('.clr').onclick = () => { inp.value = ''; apply(); inp.focus(); };
}
{
  const tab = $('helptab'), body = $('helpbody');
  tab.onclick = () => { const o = body.hidden; body.hidden = !o; tab.setAttribute('aria-expanded', String(o)); };
}
// ---- 出口: 全順位をデータで返す（答え合わせ・1ポケモン1ページの集計用。画面と同じ buildRows を呼ぶ・画面は変えない） ----
// pl50／pl51 それぞれ、base=既定（最終進化だけ）／all=メガ・ゲンシ＋進化前も
window.GonaviExport = function () {
  const sv = [fMega, fNoLg, fPre, pl], out = { cap: CAP };
  try {
    fNoLg = false;
    for (const L of [50, 51]) {
      pl = L; out['pl' + L] = {};
      for (const [name, on] of [['base', false], ['all', true]]) {
        fMega = on; fPre = on;
        out['pl' + L][name] = buildRows().map(r => ({ k: r.k, rank: r.rank, scp: r.scp, ivs: r.ivs.join('/'), lv: r.lv, cp: r.cp }));
      }
    }
  } finally { [fMega, fNoLg, fPre, pl] = sv; }
  return out;
};
sync();
