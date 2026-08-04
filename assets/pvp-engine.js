/* ================================================================
   GOバトルリーグ 対面シミュレート エンジン (フェーズ2)
   - 1ターン(0.5秒)刻みで通常技・ゲージ技・シールド・能力変化を再現
   - ゲージ技はターン計数を消費しない「ポーズ」として扱う
   - 使い方: PvpEngine.simulate(PVP_DATA, cfgL, cfgR)
     cfg = { key, ivs:[a,d,h], level, shadow, fast, charged:[id...],
             shields, plan:[{after:ターン数, move:id}] }
   ================================================================ */
(function () {
  const BONUS = 1.3;   // トレーナーバトル補正
  const STAB  = 1.2;   // タイプ一致補正

  // 能力変化(-4〜+4)の倍率: +n=(4+n)/4, -n=4/(4+n)
  function buffMult(stage) {
    return stage >= 0 ? (4 + stage) / 4 : 4 / (4 - stage);
  }

  // タイプ相性(攻撃タイプ×防御タイプ配列)
  function effectiveness(D, moveType, defTypes) {
    const row = D.chart[moveType];
    let m = 1;
    for (const t of defTypes) m *= row[D.types.indexOf(t)];
    return m;
  }

  // 実ステータス(種族値+個体値, レベル補正, シャドウ補正)
  function buildStats(D, cfg) {
    const p = D.pokemon[cfg.key];
    const c = D.cpm[String(cfg.level)];
    const sA = cfg.shadow ? D.settings.shadowAtkMult : 1;
    const sD = cfg.shadow ? D.settings.shadowDefMult : 1;
    const atk = (p.a + cfg.ivs[0]) * c * sA;
    const def = (p.df + cfg.ivs[1]) * c * sD;
    const hp  = Math.floor((p.h + cfg.ivs[2]) * c);
    const cp  = Math.max(10, Math.floor((p.a + cfg.ivs[0]) * Math.sqrt(p.df + cfg.ivs[1]) * Math.sqrt(p.h + cfg.ivs[2]) * c * c / 10));
    return { atk, def, hp, cp, types: p.ty, name: p.n };
  }

  // ダメージ = floor(0.5 × 威力 × 攻/防 × 相性 × タイプ一致 × 1.3) + 1
  function damage(D, mv, att, dfn) {
    const eff  = effectiveness(D, mv.t, dfn.types);
    const stab = att.types.includes(mv.t) ? STAB : 1;
    const a = att.atk * buffMult(att.buffs[0]);
    const d = dfn.def * buffMult(dfn.buffs[1]);
    return Math.floor(0.5 * mv.p * (a / d) * eff * stab * BONUS) + 1;
  }

  function applyBuffs(mv, self, opp, rng) {
    if (!mv.bf) return null;
    if (mv.bc < 1 && (rng ? rng() : Math.random()) >= mv.bc) return null;
    const target = mv.bt === 'opponent' ? opp : self;
    const before = target.buffs.slice();
    target.buffs[0] = Math.max(-4, Math.min(4, target.buffs[0] + mv.bf[0]));
    target.buffs[1] = Math.max(-4, Math.min(4, target.buffs[1] + mv.bf[1]));
    return { target: mv.bt || 'self', from: before, to: target.buffs.slice() };
  }

  // ---- バトル中フォルムチェンジ持ち(ギルガルド/モルペコ/ミミッキュ)の特殊仕様 ----
  const AEGIS_FAST_BLADE = { AEGISLASH_CHARGE_PSYCHO_CUT: 'PSYCHO_CUT', AEGISLASH_CHARGE_AIR_SLASH: 'AIR_SLASH' };
  const AEGIS_FAST_SHIELD = { PSYCHO_CUT: 'AEGISLASH_CHARGE_PSYCHO_CUT', AIR_SLASH: 'AEGISLASH_CHARGE_AIR_SLASH' };

  // ブレードフォルムの実ステータス: リーグ上限に収まるレベルへ換算して計算する(HPは変えない)
  function bladeStats(D, cfg) {
    const bl = D.pokemon['aegislash_blade'];
    const cap = cfg.cap || 0;
    let lvl = cfg.level;
    if (cap === 1500) lvl = Math.ceil(cfg.level * 0.5) + 1;
    else if (cap === 2500) lvl = Math.ceil(cfg.level * 0.75);
    const cpAt = l => {
      const c = D.cpm[String(l)];
      return Math.max(10, Math.floor((bl.a + cfg.ivs[0]) * Math.sqrt(bl.df + cfg.ivs[1]) * Math.sqrt(bl.h + cfg.ivs[2]) * c * c / 10));
    };
    while (cap && lvl > 1 && cpAt(lvl) > cap) lvl -= 0.5;
    const c = D.cpm[String(lvl)];
    return { atk: (bl.a + cfg.ivs[0]) * c, def: (bl.df + cfg.ivs[1]) * c };
  }

  function simulate(D, cfgL, cfgR, opt) {
    opt = opt || {};
    const maxTurn = opt.maxTurn || 480;
    const sides = [cfgL, cfgR].map(cfg => {
      const st = buildStats(D, cfg);
      const s = {
        cfg, ...st,
        hp: st.hp, en: 0, cd: 0, buffs: [0, 0],
        shields: cfg.shields != null ? cfg.shields : 2,
        fast: D.moves[cfg.fast],
        fastId: cfg.fast,
        plan: (cfg.plan || []).slice(),
        used: {},
      };
      if (cfg.key === 'aegislash_shield') {        // 開始はシールドフォルム
        s.form = 'shield';
        s.shieldStats = { atk: st.atk, def: st.def };
        s.bladeSt = bladeStats(D, cfg);
      } else if (cfg.key === 'mimikyu') {          // ばけのかわ未使用
        s.disguise = true;
      } else if (cfg.key === 'morpeko_full_belly') {  // まんぷくで開始
        s.mform = 'full';
      }
      return s;
    });
    // モルペコのフォルムに応じてオーラぐるまのタイプを差し替える
    const rmv = (s, id) => {
      if (s.mform === 'hangry' && id === 'AURA_WHEEL_ELECTRIC') return 'AURA_WHEEL_DARK';
      if (s.mform === 'full' && id === 'AURA_WHEEL_DARK') return 'AURA_WHEEL_ELECTRIC';
      return id;
    };
    const rows = [];   // タイムライン(数字ターン行と'-'行)
    let winner = null, turn = 0;

    const fastDamage = s => damage(D, sides[s].fast, sides[s], sides[1 - s]);

    while (turn < maxTurn && winner === null) {
      turn++;
      // 行動決定: 待機中の側は「ゲージ技を使う」か「通常技を開始」
      // ゲージ技は1ターンを消費して発動し、その間も相手の通常技は進行する
      const charging = [null, null];
      for (let i = 0; i < 2; i++) {
        const s = sides[i];
        if (s.cd !== 0) continue;               // 通常技の途中
        if (s.cfg.timing === 'asap') {
          // 最短: 撃てるゲージ技ができた瞬間に撃つ(複数撃てるなら消費が軽い技)
          const avail = (s.cfg.charged || []).map(id => D.moves[rmv(s, id)]).filter(m => s.en >= m.e);
          if (avail.length) {
            avail.sort((a, b) => a.e - b.e);
            charging[i] = avail[0];
            continue;
          }
        } else if (s.cfg.timing === 'optimal') {
          // 最適(CCT): 相手の通常技の最終ターンを狙って撃つ(差し込みで相手を得させない)。
          // 倒しきれる場合はタイミングを待たず即撃ち。待つターンは通常技を開始する。
          const o = sides[1 - i];
          let mvId = null;
          if (s.cfg.throwSeq) {   // 何発目にどのわざを打つかの指定(マニュアル)
            const idx = s.thrown || 0;
            mvId = idx < s.cfg.throwSeq.length ? s.cfg.throwSeq[idx] : s.cfg.throwRest;
          }
          const mv = mvId ? D.moves[rmv(s, mvId)]
            : s.cfg.throw ? D.moves[rmv(s, s.cfg.throw)]
            : (s.cfg.charged || []).map(id => D.moves[rmv(s, id)])
                .sort((a, b) => damage(D, b, s, o) / b.e - damage(D, a, s, o) / a.e)[0];
          if (mv && s.en >= mv.e) {
            // 発動時にブレード化する場合はブレードの攻撃、ばけのかわ未使用の相手には1ダメージで読む
            const att = s.form === 'shield' ? { ...s, atk: s.bladeSt.atk } : s;
            const dealt = (o.shields > 0 || o.disguise) ? 1 : damage(D, mv, att, o);
            // 相手の最終ターン(cd===1)か1ターン技の開始が最適。技周期が同じ対面(ミラー等)は
            // 最終ターンが永遠に来ないため、同時開始(cd===0)のタイミングで発動する(最新シミュレータ実測準拠)
            const sameTn = s.fast.tn === o.fast.tn;
            const oppFinal = o.cd === 1 || (o.cd === 0 && (o.fast.tn === 1 || sameTn));
            // 保険: 撃てるのに最適タイミングが来ないまま待ち続けたら発動する(周期のズレ等での硬直防止)
            const stuck = (s.waitCnt || 0) >= 3;
            if (dealt >= o.hp || oppFinal || stuck) { s.waitCnt = 0; charging[i] = mv; continue; }
            s.waitCnt = (s.waitCnt || 0) + 1;
          }
        } else {
          // 台本(plan): 指定ターン以降で最初に撃てるタイミングで発動する
          const planIdx = s.plan.findIndex(p => p.on <= turn);
          if (planIdx >= 0) {
            const mv = D.moves[rmv(s, s.plan[planIdx].move)];
            if (s.en >= mv.e) { s.plan.splice(planIdx, 1); charging[i] = mv; continue; }
          }
        }
        s.cd = s.fast.tn;                       // 通常技を開始
        s.startedNow = true;
      }
      // ターン経過 → 完了した通常技の発生
      // 相手がゲージ技のターンに打ち始めた通常技は差し込み(前倒し)扱いなのでここでは進めない
      const row = { tn: turn, ev: [null, null] };
      for (let i = 0; i < 2; i++) {
        const s = sides[i];
        if (charging[i]) continue;
        if (charging[1 - i] && s.startedNow) { s.startedNow = false; continue; }
        s.startedNow = false;
        s.cd--;
        if (s.cd === 0) {
          const dmg = fastDamage(i);
          sides[1 - i].hp -= dmg;
          s.en = Math.min(100, s.en + s.fast.eg);
          row.ev[i] = { move: s.fast.n, dmg };
        }
      }
      row.state = sides.map(s => ({ hp: Math.max(0, s.hp), en: s.en }));
      rows.push(row);
      // 2026年新システム: 同ターンにノーマルアタックで倒れてもそのターンのゲージ技は解決される
      const koByFast = [sides[0].hp <= 0, sides[1].hp <= 0];
      if ((sides[0].hp <= 0 || sides[1].hp <= 0) && !charging[0] && !charging[1]) break;

      // ゲージ技の発動(同時の場合は攻撃実数値が高い側が先=CMP)
      const order = sides[0].atk * buffMult(sides[0].buffs[0]) >= sides[1].atk * buffMult(sides[1].buffs[0]) ? [0, 1] : [1, 0];
      for (const i of order) {
        const mv = charging[i];
        if (!mv) continue;
        const s = sides[i], o = sides[1 - i];
        if (s.hp <= 0 && !koByFast[i]) continue;   // 同ターンの相手ゲージ技で倒れた場合のみ不発
        s.en -= mv.e;
        // ギルガルド: SPアタック使用の直前にブレードフォルム化(このSPからブレードの攻撃で計算)
        if (s.form === 'shield') {
          s.form = 'blade';
          s.atk = s.bladeSt.atk; s.def = s.bladeSt.def;
          const bid = AEGIS_FAST_BLADE[s.fastId];
          if (bid) { s.fastId = bid; s.fast = D.moves[bid]; }
        }
        const full = damage(D, mv, s, o);
        // シールド判断: shieldPlan(相手のSP何発目で使うかの配列)があればそれに従う
        // shieldRest=trueなら6発目以降はすべて使う
        o.spSeen = (o.spSeen || 0) + 1;
        const shielded = o.cfg.shieldPlan
          ? (o.shields > 0 && (o.cfg.shieldPlan.includes(o.spSeen) || (o.cfg.shieldRest && o.spSeen > 5)))
          : o.shields > 0;
        let dealt = shielded ? 1 : full;
        let disguised = false;
        if (shielded) {
          o.shields--;
          // ギルガルド: シールドを使うとシールドフォルムに戻る
          if (o.form === 'blade') {
            o.form = 'shield';
            o.atk = o.shieldStats.atk; o.def = o.shieldStats.def;
            const sid = AEGIS_FAST_SHIELD[o.fastId];
            if (sid) { o.fastId = sid; o.fast = D.moves[sid]; }
          }
        } else if (o.disguise) {
          // ミミッキュ: シールドを使わずに受けた最初の敵SPをばけのかわで無効化(ダメージ1)。
          // 以後は「ばれた」姿になり防御-1段階がバトル中ずっと適用される
          o.disguise = false;
          dealt = 1;
          disguised = true;
          o.buffs[1] = Math.max(-4, o.buffs[1] - 1);
        }
        s.thrown = (s.thrown || 0) + 1;
        o.hp -= dealt;
        const buff = applyBuffs(mv, s, o, opt.rng);
        const ev = [null, null];
        ev[i] = { move: mv.n, dmg: dealt, full, shielded, disguised, buff };
        // モルペコ: SPアタックを打つたびに まんぷく⇄はらぺこ が切り替わる(オーラぐるまのタイプが変化)
        if (s.mform) s.mform = s.mform === 'full' ? 'hangry' : 'full';
        // 表示規則: 番号行が空(通常技の自然完了なし)ならゲージ技は番号行に入る
        if (!row._merged && !row.ev[0] && !row.ev[1]) {
          row._merged = true;
          row.ev = ev;
          row.state = sides.map(x => ({ hp: Math.max(0, x.hp), en: x.en }));
        } else {
          rows.push({ tn: '-', ev, state: sides.map(x => ({ hp: Math.max(0, x.hp), en: x.en })) });
        }
        s.used[mv.n] = (s.used[mv.n] || 0) + 1;
        if (o.hp <= 0) break;
        // 差し込み: 発動側の演出中に、相手の打ちかけ(未完了)の通常技が前倒しで完了する
        // (このターンに自然完了する技は通常処理で発生済み。完了後、相手は次ターンに仕切り直し)
        if (!charging[1 - i] && o.cd > 0) {
          const dmg = fastDamage(1 - i);
          s.hp -= dmg;
          o.en = Math.min(100, o.en + o.fast.eg);
          o.cd = 0;
          const fev = [null, null];
          fev[1 - i] = { move: o.fast.n, dmg, forwarded: true };
          rows.push({ tn: '-', ev: fev, state: sides.map(x => ({ hp: Math.max(0, x.hp), en: x.en })) });
          if (s.hp <= 0) break;
        }
      }
      if (sides[0].hp <= 0 || sides[1].hp <= 0) break;
    }
    if (sides[0].hp <= 0 && sides[1].hp <= 0) winner = 'draw';
    else if (sides[1].hp <= 0) winner = 0;
    else if (sides[0].hp <= 0) winner = 1;

    return {
      winner, turns: turn, rows,
      final: sides.map(s => ({ name: s.name, cp: s.cp, hp: Math.max(0, s.hp), hpMax: buildStats(D, s.cfg).hp, en: s.en, shields: s.shields, buffs: s.buffs })),
    };
  }

  /* ---- 技のオート選択 ----
     どのゲージ技を撃ち続けるかの組み合わせを総当たりでシミュレートし、
     互いに最善手を取り合う組み合わせ(均衡)を返す。評価は与ダメ割合+残HP割合。 */
  function battleScore(res, side) {
    const own = res.final[side], opp = res.final[1 - side];
    return 500 * (1 - opp.hp / opp.hpMax) + 500 * (own.hp / own.hpMax);
  }

  function chooseThrows(D, cfgL, cfgR, opt) {
    const movesL = cfgL.charged || [], movesR = cfgR.charged || [];
    if (movesL.length <= 1 && movesR.length <= 1)
      return { left: movesL[0] || null, right: movesR[0] || null };
    // 全組み合わせのスコア表を作る
    const score = movesL.map(() => movesR.map(() => null));
    for (let a = 0; a < movesL.length; a++)
      for (let b = 0; b < movesR.length; b++) {
        const res = simulate(D, { ...cfgL, throw: movesL[a], timing: 'optimal' },
                                { ...cfgR, throw: movesR[b], timing: 'optimal' }, opt);
        score[a][b] = [battleScore(res, 0), battleScore(res, 1)];
      }
    // 相互最善応答の反復(小さな表なので必ず短時間で安定するか循環する)
    let a = 0, b = 0;
    const seen = new Set();
    for (let it = 0; it < 20; it++) {
      const key = a + ',' + b;
      if (seen.has(key)) break;   // 循環 → 現在の組で確定
      seen.add(key);
      let bestA = a;
      for (let x = 0; x < movesL.length; x++) if (score[x][b][0] > score[bestA][b][0]) bestA = x;
      let bestB = b;
      for (let y = 0; y < movesR.length; y++) if (score[bestA][y][1] > score[bestA][bestB][1]) bestB = y;
      if (bestA === a && bestB === b) break;
      a = bestA; b = bestB;
    }
    return { left: movesL[a] || null, right: movesR[b] || null, score: score[a][b] };
  }

  /* オート選択つきシミュレート: throw未指定の側は総当たりで技を決めてから対戦 */
  function simulateAuto(D, cfgL, cfgR, opt) {
    const sel = chooseThrows(D, cfgL, cfgR, opt);
    const L = { timing: 'optimal', ...cfgL }, R = { timing: 'optimal', ...cfgR };
    if (!L.throw) L.throw = sel.left;
    if (!R.throw) R.throw = sel.right;
    const res = simulate(D, L, R, opt);
    res.selected = { left: L.throw, right: R.throw };
    return res;
  }

  window.PvpEngine = { buildStats, damage, effectiveness, buffMult, simulate, chooseThrows, simulateAuto };
})();
