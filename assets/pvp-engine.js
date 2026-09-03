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
  // ロケット団(NPC)のポケモンだけは決まり方が違うので cfg.statMult=[攻,防,HP] で種別係数を渡す
  // (したっぱ=1・リーダー=1.05・サカキ=1.15)。ステータスは専用CPM(RCPM)方式:
  //   攻撃 = floor((攻種族値+15)×2÷1.2) × RCPM × 係数
  //   防御 = (防種族値+15) × RCPM × 係数
  //   HP   = floor( floor((HP種族値+15)÷2×1.2) × RCPM × 係数 )
  //   CP   = floor(攻 × √防 × √HP(切り捨て前) ÷ 10)
  // 攻撃・HPは基礎値の段階で切り捨てるため、ポケモンごとに端数の出方が異なる。
  // 2026-08-10に外部シミュレーターの表示値と20例(3種別)で完全一致を確認した実測準拠の式。
  // シャドウ補正(攻×1.2・防÷1.2)は通常のポケモンと同じく戦闘計算で別途かかる
  const RCPM = 1.31502077;
  function buildStats(D, cfg) {
    const p = D.pokemon[cfg.key];
    if (cfg.statMult) {
      const bA = Math.floor((p.a + 15) * 5 / 3) * RCPM * cfg.statMult[0];
      const bD = (p.df + 15) * RCPM * cfg.statMult[1];
      const hpRaw = Math.floor((p.h + 15) * 3 / 5) * RCPM * cfg.statMult[2];
      const hp = Math.floor(hpRaw);
      const cp = Math.max(10, Math.floor(bA * Math.sqrt(bD) * Math.sqrt(hpRaw) / 10));
      const sA = cfg.shadow ? D.settings.shadowAtkMult : 1;
      const sD = cfg.shadow ? D.settings.shadowDefMult : 1;
      return { atk: bA * sA, def: bD * sD, hp, cp, baseAtk: bA, baseDef: bD, types: p.ty, name: p.n };
    }
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

  /* わざの「能力変化ぶんの価値」。ダメージ効率に掛けて使う(1.0で影響なし)。
     ・相手の能力を下げる / 自分の能力を上げる → 以後ずっと有利なので割り増す
     ・自分の能力が下がる → 以後ずっと不利を背負うので割り引く
     1段階につき BUFF_RATE、発動確率(bc)のぶんだけ効かせる。
     わざの候補を絞るとき(gbl-app.js の dpeOf)にも同じものを使う。
     値は実測で決めた(2026-08-18タダシさん承認・25%): 環境上位の該当9匹×環境49匹×シールド3通りの
     勝ち数合計が 0%=558 / 10%=649 / 25%=657。デバフわざを積極的に使う戦術は
     タイミング「溜め打ち」で明示できるので、自動の撃ち分けは慎重側(25%)に寄せる */
  const BUFF_RATE = 0.25;
  function buffAdj(mv) {
    if (!mv || !mv.bf) return 1;
    const p = mv.bc == null ? 1 : mv.bc;
    const sum = (mv.bf[0] + mv.bf[1]) * p;
    // 相手が対象なら、下がるぶんがこちらの得(上げるわざは存在しない)
    if (mv.bt === 'opponent') return 1 + Math.max(0, -sum) * BUFF_RATE;
    // 自分が対象: 上がるなら割り増し、下がるなら割り引き
    return (1 + Math.max(0, sum) * BUFF_RATE) / (1 + Math.max(0, -sum) * BUFF_RATE);
  }

  /* 確率で能力が上下するわざ(ねっとう30%など)の扱い。opt.buffMode で切り替える
       'none'   … 不発として扱う(最低保証・安全側)
       'avg'    … 確率のぶんを平均で反映(30%で攻-1なら-0.3段階)
       'always' … 毎回必ず発動する前提(最大値・危険側)
       'rng'    … 乱数で判定(既定・opt.rng があればそれを使う) */
  function applyBuffs(mv, self, opp, opt) {
    if (!mv.bf) return null;
    let scale = 1;
    if (mv.bc < 1) {
      const mode = (opt && opt.buffMode) || 'rng';
      if (mode === 'none') return null;
      else if (mode === 'avg') scale = mv.bc;
      else if (mode !== 'always') {
        const rng = opt && opt.rng;
        if ((rng ? rng() : Math.random()) >= mv.bc) return null;
      }
    }
    const target = mv.bt === 'opponent' ? opp : self;
    const before = target.buffs.slice();
    const clamp = v => Math.max(-4, Math.min(4, Math.round(v * 1000) / 1000));
    target.buffs[0] = clamp(target.buffs[0] + mv.bf[0] * scale);
    target.buffs[1] = clamp(target.buffs[1] + mv.bf[1] * scale);
    if (target.buffs[0] === before[0] && target.buffs[1] === before[1]) return null;
    return { target: mv.bt || 'self', from: before, to: target.buffs.slice() };
  }

  // ---- バトル中フォルムチェンジ持ち(ギルガルド/モルペコ/ミミッキュ/ウッウ)の特殊仕様 ----
  // ウッウ: なみのり・ダイビングを撃つと獲物を咥える(HP50%以上=うのみ / 50%未満=まるのみ)。
  // フォルム中に**相手のSPアタックを受ける**と獲物を吐き出し、相手にダメージ＋能力ダウンを与えて
  // 通常の姿に戻る。**シールドで防いだときは発動せず、すがたも維持**。**ひんしになっても発動する**。
  // **交代するとリセット**(場を離れた時点で通常の姿。再度なみのり/ダイビングが必要)
  const CRAM_SPIT = {
    // 吐き出しのダメージ＝**相手の最大HPの15%**(固定割合・端数切り捨て・最低1)。
    // 2026-08-20タダシさんの実測2件で「固定割合」と確定(同じウッウ10/14/12・CP1355から):
    //  ①ガラルマッギョ0/13/13(CP1497・HP175・防127.72): 満タンからの1発目が残り約84〜85%
    //  ②マイナン14/5/15(CP1212・HP115・防105.58): 同じく残り約83〜85%
    // マイナンは防御が大きく低いのに減り幅が同じ＝攻防を使う通常のダメージ式ではない
    // (途中で試した威力45説なら②は33=28.7%になるはずだった)。
    // 15%(②で17)と1/6(②で19)はHPバーの読みでは区別できないので、タダシさんの見立て15%を採用。
    // より精密な実測(高HPの相手ほど差が開く)が出たらここを直す
    hpPct: 0.15,
    gulping: [0, -1],   // うのみ(サシカマス): 相手の[攻撃, 防御]の段階変化 → 防御を1段階ダウン
    gorging: [-2, 0],   // まるのみ(ピカチュウ): 攻撃を2段階ダウン
  };
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
    // opt.stopAt: このターンを終えたところで打ち切る。交代(場が仕切り直しになる場面)に使う。
    // 打ち切った場合は winner=null・stopped=true で返り、final[].resume から続きを始められる。
    // 注意: resume はHP・ゲージ・能力変化・硬直までで、打ちかけの通常技(cd)やタイミングAIの
    // 内部カウンタは引き継がない。したがって「同じ対面の途中から続ける」用途には使えない
    // (その場合は決定を書き換えて1ターン目から回し直すこと。1回のシミュは0.02ms未満と軽い)
    const stopAt = opt.stopAt || 0;
    const sides = [cfgL, cfgR].map(cfg => {
      const st = buildStats(D, cfg);
      const s = {
        cfg, ...st,
        hp: st.hp, hpMax: st.hp, en: 0, cd: 0, buffs: [0, 0],
        shields: cfg.shields != null ? cfg.shields : 2,
        fast: D.moves[cfg.fast],
        fastId: cfg.fast,
        plan: (cfg.plan || []).slice(),
        used: {},
        // ロケット団戦: NPC側は、どちらかがSPアタックを撃つたびに stallSp ターンのあいだ動けない。
        // stallStart は「2体目以降として出てきたとき」の登場直後の硬直。
        // spMult はSPアタックのダメージ倍率(したっぱは手加減して撃つため1倍未満)
        npc: !!cfg.npc,
        stallSp: cfg.stallSp || 0,
        stall: cfg.stallStart || 0,
        spMult: cfg.spMult || 1,
      };
      // 連戦(2体目以降)の引き継ぎ: 開始HP割合と開始ゲージを指定できる
      if (cfg.startHpPct != null && cfg.startHpPct < 100)
        s.hp = Math.max(1, Math.round(st.hp * cfg.startHpPct / 100));
      if (cfg.startEn) s.en = Math.max(0, Math.min(100, cfg.startEn));
      if (cfg.key === 'aegislash_shield') {        // 開始はシールドフォルム
        s.form = 'shield';
        s.shieldStats = { atk: st.atk, def: st.def };
        s.bladeSt = bladeStats(D, cfg);
      } else if (cfg.key === 'mimikyu') {          // ばけのかわ未使用
        s.disguise = true;
      } else if (cfg.key === 'morpeko_full_belly') {  // まんぷくで開始
        s.mform = 'full';
      } else if (cfg.key === 'cramorant') {        // ウッウ: 通常の姿で開始
        s.cram = true;
        s.gulp = null;
      }
      // 3匹の連戦: 前の対面を生き延びた側は、その続きの状態(HP・ゲージ・能力変化・硬直・
      // ばけのかわ/フォルム)から始める。cfg.resume には前の対面の res.final[].resume を渡す
      const rs = cfg.resume;
      if (rs) {
        if (rs.hp != null) s.hp = Math.max(1, Math.min(st.hp, rs.hp));
        if (rs.en != null) s.en = Math.max(0, Math.min(100, rs.en));
        if (rs.buffs) s.buffs = rs.buffs.slice();
        if (rs.stall != null) s.stall = Math.max(s.stall, rs.stall);
        if (rs.disguise === false) s.disguise = false;
        if (rs.mform) s.mform = rs.mform;
        // ウッウ: 咥えたまま次の相手を迎える(交代で下がったときは呼び出し側がリセットする)
        if (s.cram && rs.gulp) s.gulp = rs.gulp;
        if (rs.form === 'blade' && s.bladeSt) {   // ギルガルド: ブレードのまま次の相手を迎える
          s.form = 'blade';
          s.atk = s.bladeSt.atk; s.def = s.bladeSt.def;
          const bid = AEGIS_FAST_BLADE[s.fastId];
          if (bid) { s.fastId = bid; s.fast = D.moves[bid]; }
        }
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

    // SPアタックを2本持っているときの「自動」選択(実戦の考え方に合わせる)
    //  1. シールドが無い相手を倒しきれるわざがあればそれを撃つ(消費が軽いほうを優先)
    //  2. 相手にシールド(またはばけのかわ)が残っているなら、消費が軽いほうを撃つ＝ブラフ
    //     (cfg.bluff === false ならブラフをせず、常に効率が高いほうを撃つ)
    //  3. シールドが無いなら、ダメージ効率(ダメージ÷消費ゲージ)が高いほうを撃つ。
    //     ただし**能力変化のぶんを効率に足し引きする**(2026-08-13追加)。
    //     ダメージの数字だけで選ぶと、以後の有利不利がまったく効かない:
    //      - 自分の能力が下がるわざ(ブレイブバードの防御-3)は、撃つと以後ずっと不利を背負う。
    //        実戦では「倒しきれるとき(ルール1)や交代の直前」に使うので、割り引く
    //      - 相手の能力を下げる/自分の能力を上げるわざ(がんせきふうじ・グロウパンチ)は
    //        以後ずっと有利になるので、割り増す
    //     **1段階につき25%**(2026-08-13に10%へ下げたが、2026-08-18に実測比較のうえ25%へ戻した。
    //     「割り引かない戦術」はタイミング「溜め打ち」で明示できるようになったため)。
    //     **発動確率のぶんだけ効かせる**(ねっとう30%なら0.3段階ぶん)
    const autoMove = (s, o) => {
      let list = (s.cfg.charged || []).map(id => D.moves[rmv(s, id)]).filter(Boolean);
      // **同じターン数の対面は充電待ちをしない**(2026-08-20タダシさん指示・「最適」の即打ち仕様)。
      // おたがいのノーマルアタックが同じターン数なら、タイミングを合わせる意味が無い＝
      // 撃てるようになったら即打ちが正しい。自動選択も「いま撃てるわざ」の中から選び、
      // 大きいわざのためにゲージをため続けない(1本も撃てないときは従来どおり=どうせ撃てない)
      if (s.fast && o.fast && s.fast.tn === o.fast.tn) {
        const avail = list.filter(m => s.en >= m.e);
        if (avail.length) list = avail;
      }
      if (list.length <= 1) return list[0];
      const att = s.form === 'shield' ? { ...s, atk: s.bladeSt.atk } : s;
      const dmg = m => damage(D, m, att, o);
      const blocked = o.shields > 0 || o.disguise;
      if (!blocked) {
        const lethal = list.filter(m => s.en >= m.e && dmg(m) >= o.hp).sort((a, b) => a.e - b.e)[0];
        if (lethal) return lethal;
      }
      const bluff = blocked && s.cfg.bluff !== false;
      const eff = m => dmg(m) * buffAdj(m) / m.e;
      return list.slice().sort(bluff
        ? (a, b) => a.e - b.e || dmg(b) - dmg(a)                 // ブラフ: 消費が軽い順
        : (a, b) => eff(b) - eff(a))[0];                         // 効率が高い順(自分デバフは割引)
    };

    // 最適(CCT)の発動判断: 相手の通常技の最終ターン(cd===1)を狙って撃つ(差し込みで相手を得させない)。
    // 倒しきれる場合はタイミングを待たず即撃ち。
    // **技周期(ターン数)が同じ対面は「最適も何もない」ので即打ち**(2026-08-20タダシさん指示。
    // タイミングを合わせる意味が無い。従来は同時開始(cd===0)を待っていたが、常に撃つに変更)。
    // 保険: 撃てるのに最適タイミングが来ないまま3回待ったら発動する(周期のズレ等での硬直防止)。
    // true=このターンに撃つ。false のときは待ちを1回数える(呼び出し側は通常技を開始する)
    const optWindow = (s, o, mv) => {
      if (s.fast.tn === o.fast.tn) return true;   // 同じターン数=即打ち
      // 発動時にブレード化する場合はブレードの攻撃、ばけのかわ未使用の相手には1ダメージで読む
      const att = s.form === 'shield' ? { ...s, atk: s.bladeSt.atk } : s;
      const dealt = (o.shields > 0 || o.disguise) ? 1 : damage(D, mv, att, o);
      const oppFinal = o.cd === 1 || (o.cd === 0 && o.fast.tn === 1);
      const stuck = (s.waitCnt || 0) >= 3;
      if (dealt >= o.hp || oppFinal || stuck) return true;
      s.waitCnt = (s.waitCnt || 0) + 1;
      return false;
    };

    // 何発目にどのわざを撃つ予定かを決める(マニュアル指定 > 固定指定 > 自動選択)
    const plannedMove = (s, o) => {
      let mvId = null;
      if (s.cfg.throwSeq) {   // 何発目にどのわざを打つかの指定(マニュアル)
        const idx = s.thrown || 0;
        mvId = idx < s.cfg.throwSeq.length ? s.cfg.throwSeq[idx] : s.cfg.throwRest;
      }
      return mvId ? D.moves[rmv(s, mvId)]
        : s.cfg.throw ? D.moves[rmv(s, s.cfg.throw)]
        : autoMove(s, o);
    };

    while (turn < maxTurn && winner === null) {
      turn++;
      // 行動決定: 待機中の側は「ゲージ技を使う」か「通常技を開始」
      // ゲージ技は1ターンを消費して発動し、その間も相手の通常技は進行する
      const charging = [null, null];
      const sync = [null, null];   // 「同時」待ち: 相手が撃つかどうかを見てから決める(下の2周目)
      const stalled = [false, false];   // ロケット団戦の硬直(このターンは何もしない)
      for (let i = 0; i < 2; i++) {
        const s = sides[i];
        if (s.stall > 0) { s.stall--; stalled[i] = true; continue; }   // 硬直中
        if (s.cd !== 0) continue;               // 通常技の途中
        if (s.cfg.timing === 'sync') {
          // 同時: 相手がSPアタックを撃つターンに合わせて撃つ(先後は攻撃実数値=CMPで決まる)
          const mv = plannedMove(s, sides[1 - i]);
          if (mv && s.en >= mv.e) { sync[i] = mv; continue; }
        } else if (s.cfg.timing === 'asap') {
          // 最短: 撃てるゲージ技ができた瞬間に撃つ(複数撃てるなら消費が軽い技)
          const avail = (s.cfg.charged || []).map(id => D.moves[rmv(s, id)]).filter(m => s.en >= m.e);
          if (avail.length) {
            avail.sort((a, b) => a.e - b.e);
            charging[i] = avail[0];
            continue;
          }
        } else if (s.cfg.timing === 'optimal') {
          // 最適(CCT): 待つターンは通常技を開始する(判断本体は optWindow)
          const o = sides[1 - i];
          const mv = plannedMove(s, o);
          if (mv && s.en >= mv.e && optWindow(s, o, mv)) { s.waitCnt = 0; charging[i] = mv; continue; }
        } else if (s.cfg.timing === 'stock') {
          // 溜め打ち: 自分の能力が下がるわざを2発分ためてから2連射する実戦テク(2026-08-18タダシさん指示)。
          // 溜め目標は「2発分」。ただしゲージ上限100で2発分に届かないわざ(消費55以上)は、
          // 次の通常技でゲージが100を超えて無駄になる「一歩手前」まで溜める(オーバーチャージ回避)。
          // 1発目は目標まで溜めてから最適と同じタイミングで撃つ(今撃てば倒しきれるなら待たない)。
          // 2発目はたまっているのですぐ連射。2連射を終えたら以後は「最適」と同じ撃ち方に戻る。
          const o = sides[1 - i];
          const fired = s.stockFired || 0;
          // 2連射の対象=確定で自分の能力が下がるわざ(2本ともそうなら消費が軽いほう)
          const debuf = (s.cfg.charged || []).map(id => D.moves[rmv(s, id)])
            .filter(m => m && m.bf && m.bt !== 'opponent' && (m.bc == null || m.bc >= 1) && (m.bf[0] < 0 || m.bf[1] < 0))
            .sort((a, b) => a.e - b.e)[0];
          const mv = fired < 2 && debuf ? debuf : plannedMove(s, o);
          if (mv && s.en >= mv.e) {
            if (fired >= 2 || !debuf) {   // 3発目以降(対象わざが無いときも)は最適と同じ
              if (optWindow(s, o, mv)) { s.waitCnt = 0; charging[i] = mv; continue; }
            } else if (fired === 1) {     // 2発目: すぐ連射
              s.stockFired = 2; charging[i] = mv; continue;
            } else {
              // 1発目: 目標(2発分 or オーバーチャージ直前)まで溜める
              const att = s.form === 'shield' ? { ...s, atk: s.bladeSt.atk } : s;
              const dealt = (o.shields > 0 || o.disguise) ? 1 : damage(D, mv, att, o);
              const goal = s.en >= 2 * mv.e || s.en + s.fast.eg > 100;
              if (dealt >= o.hp || (goal && optWindow(s, o, mv))) {
                s.waitCnt = 0; s.stockFired = 1; charging[i] = mv; continue;
              }
            }
          }
        } else if (s.cfg.timing === 'shots') {
          // 発ごとの設定: n発目のSPをどのタイミング(最適/最短/+N発)でどのわざで打つか
          const idx = s.thrown || 0;
          const sh = idx < (s.cfg.shotPlan || []).length ? s.cfg.shotPlan[idx] : s.cfg.shotRest;
          if (sh) {
            const o = sides[1 - i];
            // わざ指定なし(自動)のときは相手の状況に合わせて選ぶ(ブラフ→効率)
            const mv = sh.move ? D.moves[rmv(s, sh.move)] : autoMove(s, o);
            // ＋Nで待ってから「最適」を選んだ発(after): 待ちの数え始めは
            // **いちばん軽いSPが撃てるようになった時点**(=質問が出た位置)。
            // 選んだわざの充電が終わってから数えると、重いわざでは充電＋待ちの二重数えになり
            // 「ドラゴンテール+2で溜まるのに最適が+3」とずれる(2026-08-30タダシさん指摘で修正)。
            // 充電中のノーマルアタックも待ちのぶんとして消化する
            if (mv && sh.after && (s.shotWait || 0) < sh.after && sh.mode !== 'sync'
                && sh.mode !== 'min' && typeof sh.mode !== 'number') {
              const minE = Math.min(...(s.cfg.charged || [])
                .map(id => { const m = D.moves[rmv(s, id)]; return m ? m.e : Infinity; }));
              if (s.en >= minE) s.shotWait = (s.shotWait || 0) + 1;
            } else if (mv && s.en >= mv.e) {
              let fire = false;
              if (sh.mode === 'sync') { sync[i] = mv; continue; }   // 同時: 2周目で相手に合わせる
              if (sh.mode === 'min') fire = true;   // 最短: 撃てた瞬間
              else if (sh.mode === 'en') {
                // ためてブラフ(2026-08-30): 指定ゲージ(until=重いわざの消費)までためてから、
                // この(軽い)わざを撃つ。これ以上ためられない(オーバーフロー)ときも撃つ
                fire = s.en >= Math.min(sh.until || 0, 100) || s.en + (s.fast.eg || 0) > 100;
              }
              else if (typeof sh.mode === 'number') {
                // +N発: ゲージが貯まってから通常技を余分にN発打ってから発動
                if ((s.shotWait || 0) >= sh.mode) fire = true;
                else s.shotWait = (s.shotWait || 0) + 1;
              } else {
                // 最適: 通常タイミングAIと同じ判断
                fire = optWindow(s, o, mv);
              }
              if (fire) { s.waitCnt = 0; s.shotWait = 0; charging[i] = mv; continue; }
            }
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
      // 「同時」の判定(2周目): 相手がこのターンにSPアタックを撃つなら合わせて撃つ。
      // 両者とも「同時」なら、二人とも撃てるようになったターンに撃ち合う。
      // 相手が撃たないままゲージが満タン(これ以上ためられない)になったら合わせるのをあきらめて撃つ
      for (let i = 0; i < 2; i++) {
        if (!sync[i]) continue;
        const s = sides[i];
        const together = sync[1 - i] ? true : !!charging[1 - i];
        if (together || s.en >= 100) { s.waitCnt = 0; s.shotWait = 0; charging[i] = sync[i]; }
        else { s.cd = s.fast.tn; s.startedNow = true; }
      }
      // ターン経過 → 完了した通常技の発生
      // 相手がゲージ技のターンに打ち始めた通常技は差し込み(前倒し)扱いなのでここでは進めない
      const row = { tn: turn, ev: [null, null], stalled };
      for (let i = 0; i < 2; i++) {
        const s = sides[i];
        if (charging[i] || stalled[i]) continue;
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
        // ウッウ: なみのり・ダイビングを撃つと獲物を咥える。**撃った時点のHP**で姿が決まる
        // (50%以上=うのみ / 50%未満=まるのみ)。相手がシールドで防いでも姿は変わる
        let gulpOn = null;
        if (s.cram && (mv === D.moves.SURF || mv === D.moves.DIVE))
          gulpOn = s.gulp = s.hp / s.hpMax >= 0.5 ? 'gulping' : 'gorging';
        // ギルガルド: SPアタック使用の直前にブレードフォルム化(このSPからブレードの攻撃で計算)
        if (s.form === 'shield') {
          s.form = 'blade';
          s.atk = s.bladeSt.atk; s.def = s.bladeSt.def;
          const bid = AEGIS_FAST_BLADE[s.fastId];
          if (bid) { s.fastId = bid; s.fast = D.moves[bid]; }
        }
        // ロケット団のしたっぱはSPアタックを弱い威力で撃ってくる(spMult)
        const full = s.spMult === 1 ? damage(D, mv, s, o) : Math.max(1, Math.floor(damage(D, mv, s, o) * s.spMult));
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
        // ウッウ: 咥えているときに相手のSPアタックを受けたら吐き出す(シールドで防いだときは
        // 発動せず、すがたも維持)。**ひんしになっても発動する**ので、HPが尽きていても処理する
        let gulp = null;
        if (!shielded && o.gulp) {
          // 固定割合ダメージ(能力変化や攻防のステータスには影響されない)
          const spitDmg = Math.max(1, Math.floor(CRAM_SPIT.hpPct * s.hpMax));
          const bf = CRAM_SPIT[o.gulp], before = s.buffs.slice();
          s.buffs[0] = Math.max(-4, Math.min(4, s.buffs[0] + bf[0]));
          s.buffs[1] = Math.max(-4, Math.min(4, s.buffs[1] + bf[1]));
          s.hp -= spitDmg;
          gulp = { form: o.gulp, dmg: spitDmg,
                   buff: { target: 'opponent', from: before, to: s.buffs.slice() } };
          // 吐き出したら通常の姿に戻る。**再度なみのり/ダイビングを撃てばまた咥えられる**
          // (咥える→吐き出す、の繰り返しに回数制限は無い)
          o.gulp = null;
        }
        // ロケット団戦: どちらがSPアタックを撃っても、相手(NPC)は一定ターン動けなくなる(硬直)
        for (const x of sides) if (x.npc && x.stallSp) { x.stall = x.stallSp; x.cd = 0; }
        const buff = applyBuffs(mv, s, o, opt);
        const ev = [null, null];
        ev[i] = { move: mv.n, dmg: dealt, full, shielded, disguised, buff };
        if (gulp) ev[i].gulp = gulp;      // 吐き出し(撃った側が受ける)
        if (gulpOn) ev[i].gulpOn = gulpOn;   // 獲物を咥えた(撃った側の姿が変わる)
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
        if (o.hp <= 0 || s.hp <= 0) break;   // 吐き出しのダメージで撃った側が倒れることもある
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
      if (stopAt && turn >= stopAt) break;   // 途中で打ち切る(交代・分岐のため)
    }
    if (sides[0].hp <= 0 && sides[1].hp <= 0) winner = 'draw';
    else if (sides[1].hp <= 0) winner = 0;
    else if (sides[0].hp <= 0) winner = 1;

    return {
      winner, turns: turn, rows,
      // 決着ではなく opt.stopAt で打ち切った場合は true(続きは final[].resume から始められる)
      stopped: !!(stopAt && winner === null && turn >= stopAt),
      final: sides.map(s => ({
        name: s.name, cp: s.cp, hp: Math.max(0, s.hp), hpMax: buildStats(D, s.cfg).hp,
        en: s.en, shields: s.shields, buffs: s.buffs,
        // 3匹の連戦で次の対面へ引き継ぐ状態(生き残った側だけ使う)
        resume: { hp: Math.max(0, s.hp), en: s.en, buffs: s.buffs.slice(), stall: s.stall,
                  disguise: !!s.disguise, form: s.form, mform: s.mform, gulp: s.gulp || null },
      })),
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

  window.PvpEngine = { buildStats, damage, effectiveness, buffMult, buffAdj, simulate, chooseThrows, simulateAuto };
})();
