/* レイドバトル(PvE)エンジン — /raid/ が使う。対戦用(pvp-engine.js)とはわざの数値から別物なので共用しない。
   仕様の根拠は CLAUDE.md「レイドバトル(PvE)の戦闘仕様」(2026-08-20確定・実測で裏取り):
   ・こちらの1手目は0.7秒。以後わざの長さの間隔で撃ち続け、ゲージがたまり次第SPアタックを撃つ
   ・ボスは1.6秒・2.6秒・4.6秒に撃ち始め(開幕3発はわざの性能を無視)、4発目以降は「わざの長さ+2秒」ごと
   ・ダメージが入るのは「撃ち始め + そのわざのダメージ発生時間(w)」
   ・ゲージ: わざぶんも被弾ぶんも「ダメージが入った瞬間」に入る(被弾は0.5×ダメージ)。
     ボスは参加者全員の与ダメージ×0.5でためる
   ・ボスのSPアタックは「即打ち」「2回に1回(交互・乱数なし)」「ランダム(撃てるとき1/2)」
   ・SPのみ回避(cfg.dodgeSp): ボスのSPだけ回避する。被ダメージ75%カット(最低1)・
     回避に0.5秒かかるぶん、こちらの次の攻撃が0.5秒遅れる(公開データの回避仕様)
   ・ひんし→次のポケモンは1秒固定。全滅→再突入は既定10秒(設定で変更可)
   検証: 外部シミュレータのタイムライン5例(タダシさん提供のスクショ)と完全一致 */
(function (root) {
  'use strict';

  var PLAYER_START = 0.7;          // こちらの1手目
  var BOSS_STARTS = [1.6, 2.6, 4.6]; // ボスの開幕3発の撃ち始め(性能無視)
  var BOSS_GAP = 2.0;              // 4発目以降の硬直(ジム防衛と同じ)
  var SWAP_SEC = 1.0;              // ひんし→次のポケモン(固定)
  var ENERGY_PER_HP = 0.5;         // 被弾1ダメージあたりのゲージ(両者共通)
  var MAX_ENERGY = 100;
  var DODGE_SEC = 0.5;             // 回避モーション(公開データ dodgeDurationMs=500)
  var DODGE_CUT = 0.25;            // 回避時に受けるダメージの割合(75%カット)

  // 再現できる乱数(同じseedなら同じ結果)。ランダムSPの試行に使う
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // PvEのダメージ式: floor(0.5×威力×攻÷防×タイプ一致×相性×補正)+1
  function damage(pow, atk, def, stab, eff, mult) {
    return Math.floor(0.5 * pow * (atk / def) * stab * eff * (mult || 1)) + 1;
  }

  /* cfg:
     limit  … 制限時間(秒)
     eff    … function(わざタイプ, まもり側タイプ[]) → 相性倍率
     boss   … {types, atk, def, hp, fast, chg}   わざ={n,t,p,d,e,w}
     team   … こちらのパーティ(最大6匹・上から順に出す)。各={types, atk, def, hp, fast, chg, mult}
              mult=シャドウ1.2など攻撃補正。全滅したら同じ6匹で再突入する
     N      … 人数(全員が同じパーティの想定。ボスの被ダメ・ゲージに掛かる)
     spMode … 'asap'(即打ち・既定) | 'alt'(撃てる機会の2回に1回・交互) | 'coin'(撃てるとき1/2)
     rejoin … 全滅→再突入の秒数
     seed   … 乱数の種(coin用)
     wantLog… タイムラインを返すか */
  function simulate(cfg) {
    var LB = cfg.limit, team = cfg.team, bs = cfg.boss, N = cfg.N;
    var rng = mulberry32(cfg.seed || 1);
    var eff = cfg.eff;
    function stab(p, mv) { return p.types.indexOf(mv.t) >= 0 ? 1.2 : 1; }
    function dmgOf(a, d, mv, ap, dp, mult) {
      return damage(mv.p, a, d, stab(ap, mv), eff(mv.t, dp.types), mult);
    }
    // 6匹ぶんのダメージを前計算(与ダメ2種・被ダメ2種)
    var myF = [], myC = [], bF = [], bC = [];
    for (var i = 0; i < team.length; i++) {
      var m = team[i];
      myF[i] = dmgOf(m.atk, bs.def, m.fast, m, bs, m.mult);
      myC[i] = m.chg ? dmgOf(m.atk, bs.def, m.chg, m, bs, m.mult) : 0;
      bF[i] = dmgOf(bs.atk, m.def, bs.fast, bs, m, 1);
      bC[i] = bs.chg ? dmgOf(bs.atk, m.def, bs.chg, bs, m, 1) : 0;
    }

    // イベント処理: 同じ時刻なら pr の小さい順。
    //   行動判断(こちら0 → ボス0.5) → ダメージ(こちら1 → ボス1.5)
    // 行動判断がダメージより先＝同じ瞬間に入るゲージはその判断に間に合わない(実測どおり)。
    // 同時刻のダメージは「こちらが先」(外部シミュレータの表示順と同じ)
    var ev = [];
    function pop() {
      var bi = 0;
      for (var i = 1; i < ev.length; i++) {
        if (ev[i].t < ev[bi].t - 1e-9 || (Math.abs(ev[i].t - ev[bi].t) < 1e-9 && ev[i].pr < ev[bi].pr)) bi = i;
      }
      return ev.splice(bi, 1)[0];
    }

    var t = 0, myGen = 0, mon = 0, faints = 0, wipes = 0;
    var myHP = team[0].hp, myE = 0, bE = 0, total = 0, win = false, endT = null;
    var spOpp = 0;        // 'alt'用: SPを撃てた機会の数(2回に1回撃つ)
    var activeFrom = 0;   // この時刻までこちらのポケモンは場にいない(交代・再突入の待ち)
    var pendAct = null;   // 予約中のこちらの行動(回避したらこの開始を0.5秒うしろへずらす)
    var log = [];
    function L(o) { if (cfg.wantLog) log.push(o); }
    function pushAct(tt, g) { pendAct = { t: tt, pr: 0, k: 'act', g: g }; ev.push(pendAct); }

    pushAct(PLAYER_START, 0);
    ev.push({ t: BOSS_STARTS[0], pr: 0.5, k: 'bact', n: 1 });

    while (ev.length) {
      var e = pop(); t = e.t;
      if (t > LB + 1e-9) break;
      if (e.k === 'act') {                       // こちらの行動(わざを選んで撃ち始める)
        if (e.g !== myGen) continue;             // ひんし前に予約した行動は無効
        var cur = team[mon];
        var useC = cur.chg && myE >= Math.abs(cur.chg.e);
        var mv = useC ? cur.chg : cur.fast;
        if (useC) myE -= Math.abs(cur.chg.e);
        ev.push({ t: t + mv.w, pr: 1, k: 'hit', g: myGen, mv: mv, dmg: useC ? myC[mon] : myF[mon], sp: useC, mi: mon });
        pushAct(t + mv.d, myGen);
      } else if (e.k === 'hit') {                // こちらのダメージが入る(ゲージもこの瞬間に入る)
        if (e.g !== myGen) continue;             // 撃っている途中で倒れたぶんは消える
        total += e.dmg;
        if (!e.sp) myE = Math.min(MAX_ENERGY, myE + e.mv.e);
        bE = Math.min(MAX_ENERGY, bE + e.dmg * ENERGY_PER_HP * N);   // ボスは全員ぶんでためる
        L({ t: t, side: 'me', mv: e.mv, dmg: e.dmg, sp: e.sp, mi: e.mi });
        if (total * N >= bs.hp) { win = true; endT = t; break; }
      } else if (e.k === 'bact') {               // ボスの行動
        var canC = bs.chg && bE >= Math.abs(bs.chg.e);
        var bUseC = false;
        if (canC) {
          if (cfg.spMode === 'coin') bUseC = rng() < 0.5;
          else if (cfg.spMode === 'alt') { spOpp++; bUseC = spOpp % 2 === 0; }  // 2回に1回(交互)
          else bUseC = true;                                                    // 即打ち
        }
        var bmv = bUseC ? bs.chg : bs.fast;
        if (bUseC) bE -= Math.abs(bs.chg.e);
        // 被ダメージは当たった瞬間に「そのとき場にいるポケモン」で計算する
        ev.push({ t: t + bmv.w, pr: 1.5, k: 'bhit', mv: bmv, sp: bUseC });
        var nt = e.n < 3 ? BOSS_STARTS[e.n] : t + bmv.d + BOSS_GAP;
        ev.push({ t: nt, pr: 0.5, k: 'bact', n: e.n + 1 });
      } else if (e.k === 'bhit') {               // ボスのダメージが入る
        if (t < activeFrom - 1e-9) {             // 交代・再突入の待ちの間は当たらない
          L({ t: t, side: 'boss', mv: e.mv, dmg: 0, sp: e.sp, miss: true });
          continue;
        }
        var d = e.sp ? bC[mon] : bF[mon];
        var dodged = false;
        if (e.sp && cfg.dodgeSp) {               // SPのみ回避: 75%カット+次の攻撃が0.5秒遅れる
          d = Math.max(1, Math.floor(d * DODGE_CUT));
          if (pendAct && pendAct.g === myGen && pendAct.t > t - 1e-9) pendAct.t += DODGE_SEC;
          dodged = true;
        }
        myHP -= d;
        myE = Math.min(MAX_ENERGY, myE + d * ENERGY_PER_HP);
        if (!e.sp) bE = Math.min(MAX_ENERGY, bE + e.mv.e);   // ボスも自分のわざぶんをためる
        L({ t: t, side: 'boss', mv: e.mv, dmg: d, sp: e.sp, mi: mon, dodged: dodged });
        if (myHP <= 0) {
          myGen++; faints++;
          myE = 0;
          if (mon < team.length - 1) {
            mon++;
            activeFrom = t + SWAP_SEC;
            L({ t: t, side: 'sys', note: 'ひんし → 次のポケモン(1秒)' });
          } else {
            wipes++; mon = 0;
            activeFrom = t + cfg.rejoin;
            L({ t: t, side: 'sys', note: '全滅 → 再突入(' + cfg.rejoin + '秒)' });
          }
          myHP = team[mon].hp;
          pushAct(activeFrom, myGen);
        }
      }
    }
    return {
      win: win, t: win ? endT : LB, faints: faints, wipes: wipes,
      dmg: total, bossLeft: Math.max(0, bs.hp - total * N), log: log
    };
  }

  root.RaidEngine = { simulate: simulate, damage: damage,
    PLAYER_START: PLAYER_START, BOSS_STARTS: BOSS_STARTS, BOSS_GAP: BOSS_GAP };
})(typeof window !== 'undefined' ? window : globalThis);
