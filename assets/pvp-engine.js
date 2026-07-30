/* ================================================================
   GOバトルリーグ 対面シミュレート エンジン (フェーズ2)
   - 1ターン(0.5秒)刻みで通常技・ゲージ技・シールド・能力変化を再現
   - ゲージ技はターン計数を消費しない「ポーズ」として扱う(みんポケ表示と同モデル)
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

  function simulate(D, cfgL, cfgR, opt) {
    opt = opt || {};
    const maxTurn = opt.maxTurn || 480;
    const sides = [cfgL, cfgR].map(cfg => {
      const st = buildStats(D, cfg);
      return {
        cfg, ...st,
        hp: st.hp, en: 0, cd: 0, buffs: [0, 0],
        shields: cfg.shields != null ? cfg.shields : 2,
        fast: D.moves[cfg.fast],
        fastId: cfg.fast,
        plan: (cfg.plan || []).slice(),
        used: {},
      };
    });
    const rows = [];   // タイムライン(みんポケ互換: 数字ターン行と'-'行)
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
          const avail = (s.cfg.charged || []).map(id => D.moves[id]).filter(m => s.en >= m.e);
          if (avail.length) {
            avail.sort((a, b) => a.e - b.e);
            charging[i] = avail[0];
            continue;
          }
        } else {
          const planIdx = s.plan.findIndex(p => p.on === turn);
          if (planIdx >= 0) {
            const mv = D.moves[s.plan[planIdx].move];
            s.plan.splice(planIdx, 1);          // エネルギー不足は見送り
            if (s.en >= mv.e) { charging[i] = mv; continue; }
          }
        }
        s.cd = s.fast.tn;                       // 通常技を開始
      }
      // ターン経過 → 完了した通常技の発生
      const row = { tn: turn, ev: [null, null] };
      for (let i = 0; i < 2; i++) {
        const s = sides[i];
        if (charging[i]) continue;
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
      if (sides[0].hp <= 0 || sides[1].hp <= 0) break;

      // ゲージ技の発動(同時の場合は攻撃実数値が高い側が先=CMP)
      const order = sides[0].atk * buffMult(sides[0].buffs[0]) >= sides[1].atk * buffMult(sides[1].buffs[0]) ? [0, 1] : [1, 0];
      for (const i of order) {
        const mv = charging[i];
        if (!mv) continue;
        const s = sides[i], o = sides[1 - i];
        if (s.hp <= 0) continue;                // 発動前に倒れた
        s.en -= mv.e;
        const full = damage(D, mv, s, o);
        const shielded = o.shields > 0;
        const dealt = shielded ? 1 : full;
        if (shielded) o.shields--;
        o.hp -= dealt;
        const buff = applyBuffs(mv, s, o, opt.rng);
        const ev = [null, null];
        ev[i] = { move: mv.n, dmg: dealt, full, shielded, buff };
        rows.push({ tn: '-', ev, state: sides.map(x => ({ hp: Math.max(0, x.hp), en: x.en })) });
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

  window.PvpEngine = { buildStats, damage, effectiveness, buffMult, simulate };
})();
