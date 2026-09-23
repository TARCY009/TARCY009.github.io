/* 最適撃ち早見表クイズ（2026-09-23・タダシさん指示）
   ・問題の数字は、同じページの早見表（table.cctt）から読む＝表と食い違わない
   ・スタートを押すと10問。形式は1問ごとにランダム（A 4択／B 最初の1発／C 表の穴うめ／D わざの名前／E タイムライン）
   ・正解の横には説明を書かない（答えの並びだけ） */
(function () {
  const root = document.getElementById('cctquiz');
  const table = document.querySelector('table.cctt');
  if (!root || !table) return;

  const N = 10;
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);

  // ---- 早見表から25マスを読む ----
  const CELLS = [];
  table.querySelectorAll('tbody tr').forEach((tr, i) => {
    tr.querySelectorAll('td').forEach((td, j) => {
      const a = i + 1, b = j + 1;
      const any = td.classList.contains('any');
      const text = any ? 'いつでも' : td.textContent.replace(/\s/g, '');
      const nums = any ? [] : text.split('/').map(Number);
      const period = b / gcd(a, b);
      if (!any && nums.length > 1 && nums[1] - nums[0] !== period) console.warn('早見表の間隔が合いません', a, b, text);
      CELLS.push({
        a, b, any, text, first: any ? 0 : nums[0], period,
        bg: td.style.getPropertyValue('--bg'), fg: td.style.getPropertyValue('--fg'),
      });
    });
  });
  const cellAt = (a, b) => CELLS[(a - 1) * 5 + (b - 1)];
  const inSeq = (c, k) => !c.any && k >= c.first && (k - c.first) % c.period === 0;

  // ---- わざの名前（D）: 対戦データのノーマルアタックをターン数ごとに ----
  let MOVES = null;
  function loadMoves() {
    if (MOVES) return;
    MOVES = 'loading';
    fetch('/pvp_data.json').then(r => r.json()).then(d => {
      const used = new Set();
      Object.values(d.pokemon).forEach(p => { if (p.r) (p.q || []).concat(p.eq || []).forEach(m => used.add(m)); });
      const byTn = {};
      Object.entries(d.moves).forEach(([id, m]) => {
        if (!m.tn || !m.p || !used.has(id) || /[（(]/.test(m.n)) return;
        (byTn[m.tn] = byTn[m.tn] || []).push(m.n);
      });
      MOVES = byTn;
    }).catch(() => { MOVES = null; });
  }
  const movesReady = c => MOVES && typeof MOVES === 'object' && MOVES[c.a] && MOVES[c.b];

  // ---- 出題の状態 ----
  let S = null;
  const missCount = {};  // まちがえたマス（このページを開いているあいだ多めに出す）
  const filled = new Set();  // 表の穴うめで埋まったマス

  const rand = n => Math.floor(Math.random() * n);
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const key = c => c.a + '-' + c.b;

  function pickCell(prev) {
    const pool = [];
    CELLS.forEach(c => {
      if (prev && c === prev) return;
      const w = (c.any ? 1 : 3) + (missCount[key(c)] || 0) * 4;
      for (let i = 0; i < w; i++) pool.push(c);
    });
    return pool[rand(pool.length)];
  }
  function pickFormat(c, prev) {
    let fs = ['A', 'B', 'C', 'D', 'E'];
    if (c.any) fs = fs.filter(f => f !== 'E');
    if (!movesReady(c)) fs = fs.filter(f => f !== 'D');
    if (fs.length > 1) fs = fs.filter(f => f !== prev);
    return fs[rand(fs.length)];
  }

  // ---- 表示の部品 ----
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const seqHtml = t => esc(t).replace(/\//g, '<i>/</i>');
  const pill = c => c.any ? '<span class="qseq any">いつでも</span>'
    : `<span class="qseq" style="--bg:${c.bg};--fg:${c.fg}">${seqHtml(c.text)}</span>`;
  const sides = (c, f) => {
    if (f === 'D') {
      return `<div class="qvs"><div class="qside me"><small>自分</small><span class="mv">${esc(S.q.mv[0])}</span><span class="tn">${S.q.done ? c.a : '？'}ターン</span></div>`
        + `<span class="x">×</span><div class="qside foe"><small>相手</small><span class="mv">${esc(S.q.mv[1])}</span><span class="tn">${S.q.done ? c.b : '？'}ターン</span></div></div>`;
    }
    return `<div class="qvs"><div class="qside me"><small>自分</small><b>${c.a}<span>ターン</span></b></div>`
      + `<span class="x">×</span><div class="qside foe"><small>相手</small><b>${c.b}<span>ターン</span></b></div></div>`;
  };

  function choicesFor(c) {
    // 答え＋ほかのマスの並び（最初の数と間隔が答えと同じものは除く）＋「いつでも」
    const seen = new Set([c.first + ':' + c.period]);
    const others = shuffle(CELLS.filter(x => !x.any)).filter(x => {
      const k = x.first + ':' + x.period;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    const nums = shuffle((c.any ? [] : [c]).concat(others.slice(0, c.any ? 3 : 2)));
    return nums.map(x => ({ label: seqHtml(x.text), ok: !c.any && x === c }))
      .concat([{ label: 'いつでも', ok: c.any, any: true }]);
  }

  function miniTable(c) {
    let h = '<table class="qmini"><thead><tr><th class="corner">自分<br>相手</th>';
    for (let b = 1; b <= 5; b++) h += `<th>${b}</th>`;
    h += '</tr></thead><tbody>';
    for (let a = 1; a <= 5; a++) {
      h += `<tr><th>${a}</th>`;
      for (let b = 1; b <= 5; b++) {
        const x = cellAt(a, b);
        if (x === c) h += `<td class="${S.q.done ? 'done' : 'q'}"${S.q.done && !x.any ? ` style="--bg:${x.bg};--fg:${x.fg}"` : ''}>${S.q.done ? (x.any ? 'いつでも' : seqHtml(x.text)) : '？'}</td>`;
        else if (filled.has(key(x))) h += `<td class="done${x.any ? ' any' : ''}"${x.any ? '' : ` style="--bg:${x.bg};--fg:${x.fg}"`}>${x.any ? 'いつでも' : seqHtml(x.text)}</td>`;
        else h += '<td></td>';
      }
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }

  function timeline(c) {
    const hits = Math.max(c.first + 1, Math.ceil(12 / c.a));
    const L = hits * c.a;
    let foe = '', me = '';
    for (let t = 0; t < L; t += c.b) foe += `<i style="grid-column:span ${Math.min(c.b, L - t)}"></i>`;
    for (let k = 1; k <= hits; k++) {
      let cls = 'hit';
      if (S.q.done) { if (inSeq(c, k)) cls += ' ans'; if (S.q.pick === k) cls += ' pick'; }
      me += `<button class="${cls}" data-k="${k}" style="grid-column:span ${c.a}"${S.q.done ? ' disabled' : ''}>${k}</button>`;
    }
    return `<div class="qtl" style="--n:${L}"><div class="qrow foe"><span>相手</span><div class="trk">${foe}</div></div>`
      + `<div class="qrow me"><span>自分</span><div class="trk">${me}</div></div></div>`;
  }

  // ---- 画面 ----
  function renderStart() {
    root.innerHTML = '<p class="qlead">早見表から10問。出題の形式は1問ごとに変わります。</p>'
      + '<button class="qgo" data-act="start">スタート</button>';
  }

  function renderQ() {
    const q = S.q, c = q.cell, f = q.f;
    const no = q.done ? S.res.length : S.res.length + 1;  // いま何問目か
    const dots = S.res.map(r => `<i class="${r ? 'ok' : 'ng'}"></i>`).join('')
      + (q.done ? '' : '<i class="now"></i>') + '<i></i>'.repeat(N - no);
    let h = `<div class="qbar"><span>第 <b>${no}</b> / ${N}問</span><span>正解 <b>${S.res.filter(Boolean).length}</b></span></div>`
      + `<div class="qdots">${dots}</div>`;
    if (f === 'C') h += miniTable(c);
    h += sides(c, f);
    if (f === 'A' || f === 'C') {
      h += '<p class="qask">何発目で撃つ？</p><div class="qch">'
        + q.ch.map((x, i) => {
          let cls = x.any ? 'any' : '';
          if (q.done) { if (x.ok) cls += ' good'; else if (q.pick === i) cls += ' bad'; }
          return `<button class="${cls}" data-i="${i}"${q.done ? ' disabled' : ''}>${x.label}</button>`;
        }).join('') + '</div>';
    } else if (f === 'B' || f === 'D') {
      h += '<p class="qask">最初に撃つのは何発目？</p><div class="qnums">';
      for (let n = 1; n <= 5; n++) {
        let cls = '';
        if (q.done) { if (!c.any && n === c.first) cls = 'good'; else if (q.pick === n) cls = 'bad'; }
        h += `<button class="${cls}" data-n="${n}"${q.done ? ' disabled' : ''}>${n}</button>`;
      }
      let cls = 'any';
      if (q.done) { if (c.any) cls += ' good'; else if (q.pick === 0) cls += ' bad'; }
      h += `<button class="${cls}" data-n="0"${q.done ? ' disabled' : ''}>いつでも</button></div>`;
    } else {
      h += '<p class="qask">何発目で撃つ？　自分の発をタップ</p>' + timeline(c);
    }
    if (q.done) {
      h += q.ok ? `<div class="qfb ok"><b>正解</b>${pill(c)}</div>`
        : `<div class="qfb ng"><b>不正解</b><span class="lb">正解は</span>${pill(c)}</div>`;
      h += `<button class="qgo" data-act="next">${S.res.length >= N ? '結果を見る' : '次の問題'}</button>`;
    }
    root.innerHTML = h;
  }

  function renderEnd() {
    const ok = S.res.filter(Boolean).length;
    const miss = S.hist.filter(x => !x.ok);
    let h = `<div class="qscore"><b>${ok}</b><span>/ ${N}問 正解</span></div>`;
    if (miss.length) {
      const uniq = [...new Set(miss.map(x => x.cell))];
      h += '<p class="qask">まちがえたマス</p><div class="qmiss">'
        + uniq.map(c => `<div><span class="me">自分${c.a}</span><span class="x">×</span><span class="foe">相手${c.b}</span>${pill(c)}</div>`).join('')
        + '</div>';
    }
    h += '<button class="qgo" data-act="start">もう一度</button>';
    root.innerHTML = h;
  }

  function newQ() {
    const prev = S.q;
    const cell = pickCell(prev && prev.cell);
    const f = pickFormat(cell, prev && prev.f);
    const q = { cell, f, done: false, pick: null, ok: false };
    if (f === 'A' || f === 'C') q.ch = choicesFor(cell);
    if (f === 'D') q.mv = [MOVES[cell.a][rand(MOVES[cell.a].length)], MOVES[cell.b][rand(MOVES[cell.b].length)]];
    S.q = q;
    renderQ();
  }

  function answer(pick, ok) {
    const q = S.q;
    if (q.done) return;
    q.done = true; q.pick = pick; q.ok = ok;
    S.res.push(ok); S.hist.push({ cell: q.cell, ok });
    const k = key(q.cell);
    if (ok) { filled.add(k); if (missCount[k]) missCount[k]--; }
    else missCount[k] = (missCount[k] || 0) + 1;
    renderQ();
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    if (act === 'start') { loadMoves(); S = { res: [], hist: [], q: null }; newQ(); return; }
    if (act === 'next') { if (S.res.length >= N) renderEnd(); else newQ(); root.scrollIntoView({ block: 'nearest' }); return; }
    const q = S && S.q;
    if (!q || q.done) return;
    const c = q.cell;
    if (btn.dataset.i != null) { const i = +btn.dataset.i; answer(i, q.ch[i].ok); }
    else if (btn.dataset.n != null) { const n = +btn.dataset.n; answer(n, n === 0 ? c.any : (!c.any && n === c.first)); }
    else if (btn.dataset.k != null) { const k = +btn.dataset.k; answer(k, inSeq(c, k)); }
  });

  renderStart();
})();
