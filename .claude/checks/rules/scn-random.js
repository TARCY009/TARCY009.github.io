// PARTY: [{"key":"medicham","fast":"COUNTER","c1":"ICE_PUNCH","c2":"POWER_UP_PUNCH"},{"key":"azumarill","fast":"BUBBLE","c1":"ICE_BEAM","c2":"PLAY_ROUGH"},{"key":"bastiodon","fast":"SMACK_DOWN","c1":"STONE_EDGE","c2":"FLAMETHROWER"}]
// FOES: altaria~0~DRAGON_BREATH~SKY_ATTACK~MOONBLAST,azumarill~0~BUBBLE~ICE_BEAM~PLAY_ROUGH,venusaur~0~VINE_WHIP~FRENZY_PLANT~SLUDGE_BOMB
// ---- バトルルールのランダム検査(2026-09-22) ----
// 編成・難易度・決断(SP・シールド・交代・次のポケモン・開幕交代・⇄交代)をランダムに決めて何戦も回し、
// バトルルールの下書き(.claude/drafts/gbl-battle-rules-draft.md)の「検査 できる」の項目を機械で照合する。
// 数字は模擬戦の通し(gbPlay)が返す対面ごとの結果(legs)から読み、こちらで独立に追跡した状態と突き合わせる。
//   A1 ターンの通し番号 ／ A2 制限時間270秒 ／ A6 次のポケモン選びの時間 ／ B1 ダメージ式 ／ B5 能力変化の段階と帳簿
//   B6 シールドで防ぐと1 ／ B7 ゲージ0〜100 ／ B8 シールド2枚 ／ C6 同時発動は素の攻撃実数値が高い側が先 ／ C8 倒れた側は動かない
//   C15 ゲージが足りなければ撃てない ／ D1 交代のクールタイム45秒 ／ D2 倒れて出す交代はクールタイムを消費しない
//   D3/D3' 交代の1ターン(SP直後は無し) ／ D5 打ちかけの1発は交代先に ／ D6 その1発で倒れる ／ D7 交代で能力変化が消える(ばれたミミッキュは-1のまま)
//   D8 生き残りの引き継ぎ ／ E1/E2 ギルガルド ／ E4/E5 ばけのかわ ／ E6 モルペコ(交代でまんぷくに戻る) ／ E8 うのミサイル ／ G6 時間切れの勝敗 ／ G8/B13 編成 ／ 同じ入力なら同じ結果
// 使い方: window.__RAND_OPTS__ = { n:何戦, seed:種, ms:打ち切り(ミリ秒), ai:['easy','normal','hard'] } を先に置く(無ければ既定)
window.__scenario = function (orig) {
  const O = Object.assign({ n: 30, seed: 1, ms: 45000, ai: ['easy', 'normal', 'hard'], caps: [1500, 2500] }, window.__RAND_OPTS__ || {});
  const t0 = performance.now();
  // ---- 乱数(種から必ず同じ列) ----
  let rs = (O.seed >>> 0) || 1;
  const rng = () => { rs += 0x6D2B79F5; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rint = n => Math.floor(rng() * n);
  const pick = a => a[rint(a.length)];
  const V = [];
  const viol = (b, rule, msg) => { if (V.length < 300) V.push({ b, rule, msg }); };
  const stats = base => PvpEngine.buildStats(D, base);
  const cmpAtk = base => stats(base).atk / (base.shadow ? D.settings.shadowAtkMult : 1);
  const eq = (a, b) => Math.abs((+a) - (+b)) < 1e-6;
  const eqArr = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => eq(x, b[i]));
  const mvByName = {};
  for (const id in D.moves) { const m = D.moves[id]; if (m && m.n) (mvByName[m.n] = mvByName[m.n] || []).push(m); }
  const egOf = P => { const fm = D.moves[P.pol.fast]; return fm ? (fm.eg || 0) : 0; };
  // ギルガルド: シールドフォルムのノーマルは「チャージ版」(ダメージ1固定・ゲージ+6)、ブレードでふつうの版に替わる
  const AEG_B = { AEGISLASH_CHARGE_PSYCHO_CUT: 'PSYCHO_CUT', AEGISLASH_CHARGE_AIR_SLASH: 'AIR_SLASH' };
  const AEG_S = { PSYCHO_CUT: 'AEGISLASH_CHARGE_PSYCHO_CUT', AIR_SLASH: 'AEGISLASH_CHARGE_AIR_SLASH' };
  const isAeg = P => P.m.key === 'aegislash_shield';
  const fastIdOf = (P, form) => {
    if (!isAeg(P)) return P.pol.fast;
    const f = P.pol.fast;
    const chg = AEG_B[f] ? f : (AEG_S[f] || f), bld = AEG_B[f] || f;
    return form === 'blade' ? bld : chg;
  };
  // モルペコのオーラぐるまは すがた で でんき⇄あく の別IDに替わる
  const AURA = { AURA_WHEEL_ELECTRIC: 'AURA_WHEEL_DARK', AURA_WHEEL_DARK: 'AURA_WHEEL_ELECTRIC' };
  const spCands = (P, name) => {
    const ids = new Set(P.pol.charged || []);
    for (const id of P.pol.charged || []) if (AURA[id]) ids.add(AURA[id]);
    const own = [...ids].map(id => D.moves[id]).filter(m => m && m.n === name);
    return own.length ? own : (mvByName[name] || []);
  };
  const lastTurnHasSp = res => { const tl = rbTurns(res); return spAt(tl.find(t => t.tn === res.turns)); };

  // ---- 編成をランダムに作る(同じポケモン不可・メガはメガカップ以外で使えないので入れない) ----
  const pool = KEYS.filter(k => canFight(k) && !isMega(k));
  const SPECIAL = ['mimikyu', 'cramorant', 'aegislash_shield', 'morpeko_full_belly'].filter(k => pool.includes(k));
  const mkTeam = (cap, n) => {
    const arr = [], out = [];
    let guard = 0;
    while (out.length < n && guard++ < 200) {
      const k = (rng() < 0.18 && SPECIAL.length) ? pick(SPECIAL) : pick(pool);
      if (partyNg(arr, k, -1)) continue;
      const shadow = rng() < 0.25;
      const mp = movePool(k);
      let { fast, c1, c2 } = mockDefaultMoves(k, shadow);
      if (rng() < 0.4 && mp.fasts.length && mp.chargeds.length) {
        fast = pick(mp.fasts); c1 = pick(mp.chargeds);
        const rest = mp.chargeds.filter(x => x !== c1);
        c2 = (rest.length && rng() < 0.85) ? pick(rest) : '';
      }
      if (!fast) continue;
      const m = { key: k, shadow, fast, c1, c2 };
      arr.push(m);
      out.push({ m, base: ptBase(m, cap), pol: { fast, charged: spOf(k, [c1, c2]) }, name: ptName(m) });
    }
    return out;
  };
  const slim = o => { const a = { a: o.a }; for (const f of ['mv', 'n', 'to', 'until', 'after']) if (o[f] != null) a[f] = o[f]; return a; };
  const sig = bt => JSON.stringify([bt.outcome, bt.clock, bt.turns, bt.legs.map(l => [l.myIdx, l.foeIdx, l.res.turns,
    l.res.final.map(f => [f.hp, f.en, f.shields, f.buffs]), !!l.swapped0, !!l.swapped1, !!l.meDown, !!l.foeDown])]);

  // ---- 1戦の結果をルールと突き合わせる ----
  const check = (bt, picks, foes, b) => {
    const ros = [picks, foes];
    if (bt.pending) viol(b, 'END', '決断が残ったまま終わった');
    if (!['win', 'lose', 'draw', 'timeout'].includes(bt.outcome)) viol(b, 'END', '勝敗が不明: ' + bt.outcome);
    const legs = bt.legs;
    if (!legs.length) { viol(b, 'END', '対面が1つも無い'); return; }
    // 側ごと・番号ごとの状態(こちらで追跡)
    const S = ros.map(r => r.map(P => { const st = stats(P.base); return { hp: st.hp, max: st.hp, en: 0, buffs: [0, 0], busted: false, alive: true }; }));
    let sh = [2, 2], spCum = 0;
    // 開幕交代: 交代先に相手の打ちかけ1発(HPは1以上で受ける・開幕は対象外の決まり)、相手はそのぶんゲージ
    const L0 = legs[0];
    const leadTo = [0, 1].map(sd => { const lp = L0.leadPts && L0.leadPts[sd]; return lp && lp.ans && lp.ans.a === 'to' ? lp.ans.to : null; });
    [0, 1].forEach(sd => {
      const hit = L0.leadHits && L0.leadHits[sd];
      if (leadTo[sd] == null) { if (hit) viol(b, 'D13', `側${sd}は開幕交代していないのに打ちかけの1発が入った`); return; }
      const od = 1 - sd, odIdx = leadTo[od] != null ? leadTo[od] : 0;
      if (leadTo[od] != null) { if (hit) viol(b, 'D13', '両者が開幕交代したのに打ちかけの1発が入った'); return; }
      if (!hit) { viol(b, 'D13', `側${sd}だけ開幕交代したのに打ちかけの1発が無い`); return; }
      S[sd][leadTo[sd]].hp = Math.max(1, S[sd][leadTo[sd]].max - hit.dmg);
      S[od][odIdx].en = Math.min(100, egOf(ros[od][odIdx]));
    });
    for (let k = 0; k < legs.length; k++) {
      const L = legs[k], res = L.res, rows = res.rows, N = legs[k + 1], Pv = k ? legs[k - 1] : null;
      const idx = [L.myIdx, L.foeIdx], P = [ros[0][idx[0]], ros[1][idx[1]]];
      if (!P[0] || !P[1]) { viol(b, 'END', `対面${k}: 場のポケモンが不明`); return; }
      const aeg = P.some(x => x.m.key === 'aegislash_shield');   // ギルガルドはフォルムで実数値が変わるのでダメージ・CMPの検算は飛ばす
      const legStartClock = L.base + GB_SP_TURNS * spCum + L.extra;
      if (legStartClock >= GB_ROUND_TURNS) viol(b, 'A2', `対面${k}が制限時間のあとに始まった(時計${legStartClock})`);
      if (Pv && L.base !== Pv.base + Pv.res.turns) viol(b, 'A1', `対面${k}: ターンの通し番号がずれた`);
      // 前の対面の終わり方(交代の種類)
      let single = false, sdSw = -1, prevSp = false;
      if (Pv) { single = !!Pv.swapped0 !== !!Pv.swapped1; sdSw = Pv.swapped0 ? 0 : 1; prevSp = lastTurnHasSp(Pv.res); }
      // 打ちかけの1発(D5): 片方だけの交代で、SP直後でなく、相手のノーマルが本当に途中だったときだけ
      if (L.swapHit) {
        const s = L.swapHit.side, o = 1 - s;
        S[s][idx[s]].hp -= L.swapHit.dmg;
        S[o][idx[o]].en = Math.min(100, S[o][idx[o]].en + egOf(P[o]));
      }
      // 頭の状態(HUD)と追跡の突き合わせ(D7・D8・D6)
      const cur = [0, 1].map(s => {
        const hh = s ? { hp: L.hud.hp1, en: L.hud.en1, b: L.hud.b1 } : { hp: L.hud.hp0, en: L.hud.en0, b: L.hud.b0 };
        const ex = S[s][idx[s]];
        if (!eq(hh.hp, ex.hp)) viol(b, 'D7/D8', `対面${k} 側${s}(${P[s].name}) 頭のHP ${hh.hp}≠追跡${ex.hp}`);
        if (!eq(hh.en, ex.en)) viol(b, 'D7/D8', `対面${k} 側${s}(${P[s].name}) 頭のゲージ ${hh.en}≠追跡${ex.en}`);
        if (!eqArr(hh.b, ex.buffs)) viol(b, 'D7', `対面${k} 側${s}(${P[s].name}) 頭の能力変化 [${hh.b}]≠追跡[${ex.buffs}]`);
        if (hh.hp <= 0) viol(b, 'D6', `対面${k} 側${s}: HP${hh.hp}で場に出た`);
        return { hp: hh.hp, en: hh.en, buffs: hh.b.slice(), sh: sh[s], busted: ex.busted, form: ex.form || 'shield', mform: ex.mform || 'full' };
      });
      // 1ターン目の硬直(交代にかかる1ターン・D3/D3'/D4)
      const expStall = [false, false];
      if (!Pv) { if ((leadTo[0] != null) !== (leadTo[1] != null)) expStall[leadTo[0] != null ? 0 : 1] = true; }
      else if (single && !prevSp) expStall[sdSw] = true;
      [0, 1].forEach(s => {
        const st = !!(rows[0] && rows[0].stalled && rows[0].stalled[s]);
        if (st !== expStall[s]) viol(b, 'D3', `対面${k} 側${s}: 1ターン目の硬直が ${st}(期待${expStall[s]}・片方だけ交代=${single}・SP直後=${prevSp})`);
      });
      if (Pv) {
        const isKo = !L.swapHit && res.turns === 1 && (sdSw === 0 ? L.meDown : L.foeDown) && rows[0] && !!rows[0].ev[1 - sdSw]
          && rows[0].ev[1 - sdSw].full === undefined && !rows[0].ev[sdSw];
        if (single && !prevSp) {
          const od = 1 - sdSw;
          const lastT = rbTurns(Pv.res).find(t => t.tn === Pv.res.turns);
          // 打ちかけがあるのは「切れ目でない」とき。ただし交代のターンに硬直していた(まだ打ち始めていない)側には打ちかけは無い
          const stalledOd = !!(lastT && lastT.sub && lastT.sub.some(r => r.stalled && r.stalled[od]));
          const inProg = !cutAt(lastT, od) && !stalledOd;
          // ⚠ 「入ってきた1発でその場で倒れた対面」(isKo)は、HPの少ないポケモンが1ターン目に1ターンわざで倒された対面と
          //   結果の形が同じで見分けられない。なので「途中なのに無い」だけ isKo を代わりに認め、「切れ目なのに入った」は swapHit があるときだけ見る
          if (inProg && !L.swapHit && !isKo) viol(b, 'D5', `対面${k}: 相手のノーマルが途中だったのに打ちかけの1発が交代先に入っていない`);
          if (!inProg && L.swapHit) viol(b, 'D5', `対面${k}: 相手のノーマルは切れ目だったのに1発が入った`);
          if (L.swapHit && L.swapHit.side !== sdSw) viol(b, 'D5', `対面${k}: 1発が交代していない側に入った`);
          if (L.swapHit && !aeg) {
            const dmg = PvpEngine.damage(D, D.moves[P[od].pol.fast], { ...stats(P[od].base), buffs: S[od][idx[od]].buffs }, { ...stats(P[sdSw].base), buffs: cur[sdSw].buffs });
            if (dmg !== L.swapHit.dmg) viol(b, 'D5', `対面${k}: 打ちかけの1発 ${L.swapHit.dmg}≠計算${dmg}`);
          }
        } else if (L.swapHit) viol(b, "D3'", `対面${k}: SP直後・両方同時・倒れて出した対面なのに打ちかけの1発が入った(前の対面: 交代${!!Pv.swapped0}/${!!Pv.swapped1}・SP直後${prevSp}・倒れ${!!Pv.meDown}/${!!Pv.foeDown}・1発=${JSON.stringify(L.swapHit)})`);
      }
      // ---- 行を順に追う ----
      let curTn = 0, turnSp = [];
      for (const r of rows) {
        if (r.tn !== '-') { curTn = r.tn; turnSp = []; }
        for (const i of [0, 1]) {
          const e = r.ev[i]; if (!e) continue;
          const o = 1 - i;
          if (cur[i].hp <= 0 && (e.full !== undefined || e.forwarded)) viol(b, 'C8', `対面${k} T${curTn}: 倒れた側${i}(${P[i].name})が${e.move}を出した`);
          if (e.full !== undefined) {
            // SPアタック
            if (isAeg(P[i]) && cur[i].form === 'shield') cur[i].form = 'blade';   // E1: 撃つ直前にブレード
            if (P[i].m.key === 'morpeko_full_belly') {   // E6: オーラぐるまのタイプはいまのすがた、撃つたびに切り替わる
              if (e.move.startsWith('オーラぐるま')) {
                const want = cur[i].mform === 'full' ? 'オーラぐるま（でんき）' : 'オーラぐるま（あく）';
                if (e.move !== want) viol(b, 'E6', `対面${k} T${curTn}: モルペコは${cur[i].mform === 'full' ? 'まんぷく' : 'はらぺこ'}のはずなのに${e.move}を撃った`);
              }
              cur[i].mform = cur[i].mform === 'full' ? 'hangry' : 'full';
            }
            const cands = spCands(P[i], e.move);
            const costs = cands.map(m => m.e);
            if (!costs.length) viol(b, 'DATA', `${e.move}の消費ゲージが不明`);
            else {
              const used = cur[i].en - r.state[i].en;   // この行で減ったゲージ(SPの行にノーマルは無い)
              if (!costs.some(c => eq(c, used))) viol(b, 'C15', `対面${k} T${curTn}: ${e.move}でゲージが${cur[i].en}→${r.state[i].en}(消費${used}・わざの消費は${costs.join('/')})`);
              if (!costs.some(c => cur[i].en + 1e-9 >= c)) viol(b, 'C15', `対面${k} T${curTn}: ゲージ${cur[i].en}で${e.move}(${costs.join('/')})を撃った`);
              cur[i].en = r.state[i].en;
            }
            if (!aeg) {
              const att = { ...stats(P[i].base), buffs: cur[i].buffs, megaMult: MEGA_MULT[megaLvOf(P[i].base)] };
              const dfn = { ...stats(P[o].base), buffs: cur[o].buffs };
              if (!cands.length) viol(b, 'DATA', `${e.move}がわざの一覧に無い`);
              else if (!cands.some(m => PvpEngine.damage(D, m, att, dfn, e.pw || 1) === e.full))
                viol(b, 'B1', `対面${k} T${curTn}: ${e.move}の威力計算 ${e.full}≠${cands.map(m => PvpEngine.damage(D, m, att, dfn, e.pw || 1)).join('/')}(能力[${cur[i].buffs}]/[${cur[o].buffs}]・出来${e.pw || 1})`);
              if (i === 1 && e.pw != null) viol(b, 'G13', `対面${k} T${curTn}: あいてのSPに出来(${e.pw})が付いた(AIは常にEXCELLENT)`);
              if (e.pw != null && ![.25, .5, .75].includes(e.pw)) viol(b, 'G13', `対面${k} T${curTn}: 出来の倍率が不正 ${e.pw}`);
            }
            const expDealt = (e.shielded || e.disguised) ? 1 : e.full;
            if (e.dmg !== expDealt) viol(b, 'B6', `対面${k} T${curTn}: ${e.move}のダメージ ${e.dmg}≠${expDealt}`);
            if (e.shielded) {
              if (cur[o].sh <= 0) viol(b, 'B8', `対面${k} T${curTn}: 側${o}はシールドが無いのに防いだ`);
              cur[o].sh--;
              if (isAeg(P[o]) && cur[o].form === 'blade') cur[o].form = 'shield';   // E1: 自分がシールドを使うと戻る
            }
            if (e.disguised) {
              if (P[o].m.key !== 'mimikyu') viol(b, 'E4', `対面${k}: ミミッキュでないのにばけのかわ`);
              if (cur[o].busted) viol(b, 'E4', `対面${k}: ばけのかわが2回はがれた`);
              if (e.shielded) viol(b, 'E4', `対面${k}: 防いだのにばけのかわがはがれた`);
              cur[o].buffs[1] = Math.max(-4, cur[o].buffs[1] - 1); cur[o].busted = true;
            }
            turnSp.push(i);
            if (turnSp.length === 2 && !aeg) {
              const f = turnSp[0], g = turnSp[1], af = cmpAtk(P[f].base), ag = cmpAtk(P[g].base);
              if (af < ag - 1e-9) viol(b, 'C6', `対面${k} T${curTn}: 素の攻撃が低い側${f}(${af.toFixed(2)})のSPが先に解決した(相手${ag.toFixed(2)})`);
            }
            cur[o].hp -= e.dmg;
            if (e.gulp) {
              if (P[o].m.key !== 'cramorant') viol(b, 'E8', `対面${k}: ウッウでないのに吐き出した`);
              if (e.shielded) viol(b, 'E8', `対面${k}: 防いだのに吐き出した`);
              const expSpit = Math.max(1, Math.floor(0.15 * stats(P[i].base).hp));
              if (e.gulp.dmg !== expSpit) viol(b, 'E8', `対面${k}: 吐き出しのダメージ ${e.gulp.dmg}≠${expSpit}`);
              cur[i].hp -= e.gulp.dmg;
              const g = e.gulp.buff;
              if (g) { if (!eqArr(g.from, cur[i].buffs)) viol(b, 'E8', `対面${k}: 吐き出しの能力変化の前の値 [${g.from}]≠[${cur[i].buffs}]`); cur[i].buffs = g.to.slice(); }
            }
            if (e.buff) {
              const t = e.buff.target === 'opponent' ? o : i;
              if (!eqArr(e.buff.from, cur[t].buffs)) viol(b, 'B5', `対面${k} T${curTn}: ${e.move}の能力変化の前の値 [${e.buff.from}]≠追跡[${cur[t].buffs}]`);
              cur[t].buffs = e.buff.to.slice();
              if (cur[t].buffs.some(v => v < -4 || v > 4)) viol(b, 'B5', `対面${k}: 段階が±4を超えた [${cur[t].buffs}]`);
            }
          } else {
            // ノーマルアタック
            if (!(e.dmg >= 1)) viol(b, 'B1', `対面${k} T${curTn}: ノーマルのダメージが1未満(${e.dmg})`);
            const fm = D.moves[fastIdOf(P[i], cur[i].form)];
            if (isAeg(P[i]) && cur[i].form === 'shield' && e.dmg !== 1) viol(b, 'E2', `対面${k} T${curTn}: シールドフォルムのノーマルのダメージが${e.dmg}(1固定のはず)`);
            if (fm && fm.n !== e.move) viol(b, 'DATA', `対面${k} T${curTn}: ノーマルの名前 ${e.move}≠${fm.n}(フォルム${cur[i].form})`);
            if (!aeg && fm) {
              const exp = PvpEngine.damage(D, fm, { ...stats(P[i].base), buffs: cur[i].buffs }, { ...stats(P[o].base), buffs: cur[o].buffs });
              if (exp !== e.dmg) viol(b, 'B1', `対面${k} T${curTn}: ${e.move}のダメージ ${e.dmg}≠計算${exp}(能力[${cur[i].buffs}]/[${cur[o].buffs}])`);
            }
            cur[o].hp -= e.dmg;
            cur[i].en = Math.min(100, cur[i].en + (fm ? (fm.eg || 0) : 0));
          }
        }
        for (const i of [0, 1]) {
          if (r.state[i].hp !== Math.max(0, cur[i].hp)) viol(b, 'STATE', `対面${k} T${curTn} 側${i}(${P[i].name}): HPの表示${r.state[i].hp}≠追跡${cur[i].hp}`);
          if (!eq(r.state[i].en, cur[i].en)) viol(b, 'B7', `対面${k} T${curTn} 側${i}(${P[i].name}): ゲージの表示${r.state[i].en}≠追跡${cur[i].en}`);
          if (cur[i].en < -1e-9 || cur[i].en > 100 + 1e-9) viol(b, 'B7', `対面${k} T${curTn}: ゲージが範囲外 ${cur[i].en}`);
        }
      }
      // ---- 対面の終わり ----
      for (const s of [0, 1]) {
        const f = res.final[s];
        if (f.hp !== Math.max(0, cur[s].hp)) viol(b, 'STATE', `対面${k} 側${s}: 終わりのHP ${f.hp}≠追跡${cur[s].hp}`);
        if (!eq(f.en, cur[s].en)) viol(b, 'B7', `対面${k} 側${s}: 終わりのゲージ ${f.en}≠追跡${cur[s].en}`);
        if (f.shields !== cur[s].sh) viol(b, 'B8', `対面${k} 側${s}: シールドの残り ${f.shields}≠追跡${cur[s].sh}`);
        if (!eqArr(f.buffs, cur[s].buffs)) viol(b, 'B5', `対面${k} 側${s}: 終わりの能力変化 [${f.buffs}]≠追跡[${cur[s].buffs}]`);
        if (isAeg(P[s]) && !(s ? L.swapped1 : L.swapped0) && (f.resume.form || 'shield') !== cur[s].form) viol(b, 'E1', `対面${k} 側${s}: ギルガルドのフォルム ${f.resume.form}≠追跡${cur[s].form}`);
      }
      const down = [res.final[0].hp <= 0, res.final[1].hp <= 0];
      if (down[0] !== !!L.meDown || down[1] !== !!L.foeDown) viol(b, 'END', `対面${k}: 倒れた印がHPと食い違う`);
      if (N && !down[0] && !down[1] && !L.swapped0 && !L.swapped1 && !L.timeUp) viol(b, 'END', `対面${k}: 理由なく対面が切れた`);
      const spInLeg = gbSpAt(gbSpc(res), res.turns);
      const clockEnd = L.base + res.turns + GB_SP_TURNS * (spCum + spInLeg) + L.extra;
      if (!L.timeUp && clockEnd >= GB_ROUND_TURNS && !bt.timeUp) viol(b, 'A2', `対面${k}: 時計${clockEnd}が制限時間に達したのに時間切れになっていない`);
      for (const s of [0, 1]) {
        const swapped = s ? L.swapped1 : L.swapped0, swOkS = s ? L.fswOk : L.swOk, to = s ? L.swapTo1 : L.swapTo0;
        const nOk = N ? (s ? N.fswOk : N.swOk) : null, nIdx = N ? (s ? N.foeIdx : N.myIdx) : null;
        if (swapped) {
          if (clockEnd + 1e-9 < swOkS) viol(b, 'D1', `対面${k} 側${s}: クールタイム中に交代した(時計${clockEnd}<解禁${swOkS})`);
          if (to == null || !S[s][to] || !S[s][to].alive || to === idx[s]) viol(b, 'D1', `対面${k} 側${s}: 交代先が不正(${to})`);
          if (down[0] || down[1]) viol(b, 'D2', `対面${k} 側${s}: 倒れた対面が交代扱い`);
          if (N) {
            if (!eq(nOk, clockEnd + GB_SWAP_CD)) viol(b, 'D1', `対面${k} 側${s}: 次の交代の解禁 ${nOk}≠${clockEnd}+${GB_SWAP_CD}`);
            if (nIdx !== to) viol(b, 'D1', `対面${k} 側${s}: 交代先(${to})と次の対面の頭(${nIdx})が違う`);
          }
          // 場を離れた側: 能力変化は消える(ミミッキュの「ばれた」の防御-1は残る)
          S[s][idx[s]] = { ...S[s][idx[s]], hp: res.final[s].hp, en: res.final[s].en, buffs: [0, cur[s].busted ? -1 : 0], busted: cur[s].busted, form: 'shield', mform: 'full' };
        } else {
          if (N && !eq(nOk, swOkS)) viol(b, 'D2', `対面${k} 側${s}: 交代していないのに解禁が ${swOkS}→${nOk} に変わった`);
          if (down[s]) {
            S[s][idx[s]].alive = false;
            if (N && nIdx === idx[s]) viol(b, 'END', `対面${k} 側${s}: 倒れたポケモンがまた出た`);
          } else {
            S[s][idx[s]] = { ...S[s][idx[s]], hp: res.final[s].hp, en: res.final[s].en, buffs: res.final[s].buffs.slice(), busted: cur[s].busted, form: cur[s].form, mform: cur[s].mform };
            if (N && !L.timeUp && nIdx !== idx[s]) viol(b, 'D8', `対面${k} 側${s}: 生き残りが入れ替わった`);
          }
        }
      }
      sh = [res.final[0].shields, res.final[1].shields];
      spCum += spInLeg;
      if (N) {
        const tAns = L.nextPoint && L.nextPoint.ans && L.nextPoint.ans.t != null ? +L.nextPoint.ans.t : null;
        const exp = tAns != null ? Math.round(Math.min(GB_NEXT_WAIT / 1000, Math.max(0, tAns)) * 2) : 0;
        if (N.extra - L.extra !== exp) viol(b, 'A6', `対面${k}: 次のポケモン選びの時間 ${N.extra - L.extra}ターン≠${exp}(答え${tAns}秒)`);
      }
      if (L.timeUp) {
        if (N) viol(b, 'A2', `対面${k}: 制限時間のあとに対面が続いた`);
        if (clockEnd < GB_ROUND_TURNS) viol(b, 'A2', `対面${k}: 時計${clockEnd}で時間切れになった`);
      }
    }
    // ---- 全体の勝敗 ----
    const meLeft = S[0].filter(x => x.alive).length, foeLeft = S[1].filter(x => x.alive).length;
    if (meLeft !== bt.meLeft || foeLeft !== bt.foeLeft) viol(b, 'END', `残りの匹数 ${bt.meLeft}/${bt.foeLeft}≠追跡${meLeft}/${foeLeft}`);
    const hpSum = s => S[s].reduce((t, x) => t + (x.alive ? Math.max(0, x.hp) / x.max : 0), 0);
    let exp;
    if (bt.timeUp) {
      if (!eq(bt.hpLeft, hpSum(0)) || !eq(bt.foeHpLeft, hpSum(1))) viol(b, 'G6', `時間切れの残りHP割合 ${bt.hpLeft}/${bt.foeHpLeft}≠追跡${hpSum(0)}/${hpSum(1)}`);
      exp = meLeft !== foeLeft ? (meLeft > foeLeft ? 'win' : 'lose') : (!eq(hpSum(0), hpSum(1)) ? (hpSum(0) > hpSum(1) ? 'win' : 'lose') : 'draw');
      const tie = meLeft !== foeLeft ? 'count' : (!eq(hpSum(0), hpSum(1)) ? 'hp' : null);
      if (bt.tieBy !== tie) viol(b, 'G6', `時間切れの決め手 ${bt.tieBy}≠${tie}`);
    } else exp = foeLeft === 0 ? (meLeft > 0 ? 'win' : 'draw') : (meLeft === 0 ? 'lose' : 'timeout');
    if (bt.outcome !== exp) viol(b, 'G6', `勝敗 ${bt.outcome}≠${exp}`);
    if (bt.outcome === 'timeout' && !bt.timeUp) viol(b, 'A2?', `制限時間(時計${bt.clock}<540)の前に「決着なし」で終わった(対面が480ターンで打ち切られる)`);
  };

  // ---- 何戦も回す ----
  const dumps = [];
  const counts = { battles: 0, win: 0, lose: 0, draw: 0, timeout: 0, timeUp: 0, legs: 0, swaps: 0, msw: 0, lead: 0, sp: 0, shields: 0, decisions: 0, pw: 0, spEvPw: 0, byAi: {} };
  const saveAi = MK.ai, saveBuff = SIMOPT.buffMode, saveSeed = RB.rseed, saveRt = MK.rt, saveFa = MK.foeAuto;
  MK.rt = false; MK.foeAuto = false;
  try {
    for (let b = 0; b < O.n && performance.now() - t0 < O.ms; b++) {
      const cap = pick(O.caps);
      const picks = mkTeam(cap, 3), foes = mkTeam(cap, 3);
      const ai = pick(O.ai);
      MK.ai = ai; SIMOPT.buffMode = rng() < 0.3 ? 'always' : 'none';
      RB.rseed = (O.seed * 7919 + b * 104729) >>> 0;
      counts.byAi[ai] = (counts.byAi[ai] || 0) + 1;
      // 編成のルール(G8・B13)
      for (const r of [picks, foes]) r.forEach((P, i) => { const ng = partyNg(r.map(x => x.m), P.m.key, i); if (ng) viol(b, 'G8', `編成が不正: ${P.name} ${ng}`); });
      const ans = {};
      if (rng() < 0.25) { ans[gbKey(0, 0, 'lead', 0, 0)] = { a: 'to', to: 1 + rint(2) }; counts.lead++; }
      let bt = null, lastKey = null, sameKey = 0, mswDone = new Set();
      try {
        for (let step = 0; step < 300; step++) {
          bt = orig(picks, foes, ans, true);
          const p = bt.pending;
          if (!p) break;
          counts.decisions++;
          sameKey = p.key === lastKey ? sameKey + 1 : 0; lastKey = p.key;
          if (sameKey > 3) { viol(b, 'LOOP', `同じ決断が何度も出る: ${p.key}`); break; }
          const li = +p.key.split(':')[0];
          // たまに、SPの質問の代わりにHUDの⇄交代(その切れ目で交代)を押す
          if (p.kind === 'sp' && p.side === 0 && !mswDone.has(li) && p.ctx && p.ctx.swTo[0].length && rng() < 0.15
              && p.ctx.ck && p.ctx.ck(p.tn) >= p.ctx.swOk[0]) {
            mswDone.add(li);
            ans[gbKey(li, 0, 'msw', p.tn, 0)] = { a: 'toq', to: pick(p.ctx.swTo[0]), p: Math.max(0, p.tn - 1) };
            counts.msw++;
            continue;
          }
          if (!p.opts || !p.opts.length) { viol(b, 'END', `選択肢が無い決断: ${p.key}`); break; }
          const a = slim(pick(p.opts));
          if (p.kind === 'next' && rng() < 0.5) a.t = rint(16);
          if (p.kind === 'sp' && ['opt', 'fire', 'hold1', 'bluff'].includes(a.a) && rng() < 0.6) { a.pw = pick([1, .75, .5, .25]); counts.pw++; }   // SPの出来(入力メーターの代わり)
          ans[p.key] = a;
        }
      } catch (e) { viol(b, 'ERR', `${ai}: ${String(e && e.stack || e).slice(0, 300)}`); continue; }
      if (!bt) continue;
      if (O.dump && O.dump.includes(b)) dumps.push({ b, ai, buff: SIMOPT.buffMode, cap,
        picks: picks.map(P => [P.name, P.pol.fast, P.pol.charged.join('+')]), foes: foes.map(P => [P.name, P.pol.fast, P.pol.charged.join('+')]),
        ans: Object.keys(ans).map(k => k + '=' + JSON.stringify(ans[k])),
        legs: bt.legs.map(l => ({ li: l.li, me: l.meName, foe: l.foeName, base: l.base, turns: l.res.turns, hud: l.hud, swOk: [l.swOk, l.fswOk],
          sw: [l.swapped0, l.swapped1], down: [l.meDown, l.foeDown], swapHit: l.swapHit, extra: l.extra, timeUp: l.timeUp,
          final: l.res.final.map(f => [f.hp, f.en, f.shields, f.buffs, f.resume && f.resume.form]),
          rows: l.res.rows.map(r => [r.tn, r.stalled && r.stalled.some(Boolean) ? 'stall' + r.stalled.map(x => x ? 1 : 0).join('') : '',
            [0, 1].map(i => r.ev[i] ? `${r.ev[i].move}${r.ev[i].full !== undefined ? '(SP' + r.ev[i].full + (r.ev[i].shielded ? '🛡' : '') + (r.ev[i].disguised ? '👻' : '') + ')' : r.ev[i].forwarded ? '(差込)' : ''}-${r.ev[i].dmg}${r.ev[i].buff ? ' bf' + JSON.stringify(r.ev[i].buff) : ''}${r.ev[i].gulp ? ' gulp' + JSON.stringify(r.ev[i].gulp) : ''}${r.ev[i].gulpOn ? ' on:' + r.ev[i].gulpOn : ''}` : '').join(' | '),
            r.state.map(x => x.hp + '/' + x.en).join(' ')]) })) });
      try { check(bt, picks, foes, b); } catch (e) { viol(b, 'ERR', '検査中の例外: ' + String(e && e.stack || e).slice(0, 300)); }
      // 同じ入力なら同じ結果(決定的)
      try { const bt2 = orig(picks, foes, ans, true); if (sig(bt2) !== sig(bt)) viol(b, 'DET', '同じ入力で結果が変わった'); }
      catch (e) { viol(b, 'ERR', '2回目の例外: ' + String(e && e.stack || e).slice(0, 200)); }
      counts.battles++;
      counts[bt.outcome] = (counts[bt.outcome] || 0) + 1;
      if (bt.timeUp) counts.timeUp++;
      counts.legs += bt.legs.length;
      bt.legs.forEach(l => { counts.swaps += (l.swapped0 ? 1 : 0) + (l.swapped1 ? 1 : 0);
        l.res.rows.forEach(r => [0, 1].forEach(i => { const e = r.ev[i]; if (e && e.full !== undefined) { counts.sp++; if (e.shielded) counts.shields++; if (e.pw != null) counts.spEvPw++; } })); });
    }
  } finally { MK.ai = saveAi; SIMOPT.buffMode = saveBuff; RB.rseed = saveSeed; MK.rt = saveRt; MK.foeAuto = saveFa; }
  if (counts.pw > 20 && !counts.spEvPw) viol(-1, 'G13', `出来を答えに入れた(${counts.pw}回)のに、出来つきのSPが1発も無い(答えの pw がエンジンに届いていない)`);
  return { opts: O, elapsed: Math.round(performance.now() - t0), counts, viol: V, dumps };
};
