/* レイドバトル(PvE)エンジン — /raid/ が使う。対戦用(pvp-engine.js)とはわざの数値から別物なので共用しない。
   仕様の根拠は CLAUDE.md「レイドバトル(PvE)の戦闘仕様」(2026-08-20確定・実測で裏取り):
   ・こちらの1手目は0.7秒。以後わざの長さの間隔で撃ち続け、ゲージがたまり次第SPアタックを撃つ
   ・ボスは1.6秒・2.6秒・4.6秒に撃ち始め(開幕3発はわざの性能を無視)、4発目以降は「わざの長さ+2秒」ごと
   ・ダメージが入るのは「撃ち始め + そのわざのダメージ発生時間(w)」
   ・ゲージ: わざぶんも被弾ぶんも「ダメージが入った瞬間」に入る(被弾は0.5×ダメージ)。
     ボスは参加者全員の与ダメージ×0.5でためる
   ・ボスのSPアタックは「即打ち」か「ランダム(撃てるとき1/2・外れたら次の攻撃で再判定)」
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
     me     … {types, atk, def, hp, fast, chg, mult}  mult=シャドウ1.2など攻撃補正
     N      … 人数(全員が同じアタッカーの想定。ボスの被ダメ・ゲージに掛かる)
     spMode … 'asap'(即打ち・既定) | 'coin'(撃てるとき1/2)
     rejoin … 全滅→再突入の秒数
     seed   … 乱数の種(coin用)
     wantLog… タイムラインを返すか */
  function simulate(cfg) {
    var LB = cfg.limit, me = cfg.me, bs = cfg.boss, N = cfg.N;
    var rng = mulberry32(cfg.seed || 1);
    var eff = cfg.eff;
    function stab(p, mv) { return p.types.indexOf(mv.t) >= 0 ? 1.2 : 1; }
    function dmgOf(a, d, mv, ap, dp, mult) {
      return damage(mv.p, a, d, stab(ap, mv), eff(mv.t, dp.types), mult);
    }
    var myF = dmgOf(me.atk, bs.def, me.fast, me, bs, me.mult);
    var myC = me.chg ? dmgOf(me.atk, bs.def, me.chg, me, bs, me.mult) : 0;
    var bF = dmgOf(bs.atk, me.def, bs.fast, bs, me, 1);
    var bC = bs.chg ? dmgOf(bs.atk, me.def, bs.chg, bs, me, 1) : 0;

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
    var myHP = me.hp, myE = 0, bE = 0, total = 0, win = false, endT = null;
    var activeFrom = 0;   // この時刻までこちらのポケモンは場にいない(交代・再突入の待ち)
    var log = [];
    function L(o) { if (cfg.wantLog) log.push(o); }

    ev.push({ t: PLAYER_START, pr: 0, k: 'act', g: 0 });
    ev.push({ t: BOSS_STARTS[0], pr: 0.5, k: 'bact', n: 1 });

    while (ev.length) {
      var e = pop(); t = e.t;
      if (t > LB + 1e-9) break;
      if (e.k === 'act') {                       // こちらの行動(わざを選んで撃ち始める)
        if (e.g !== myGen) continue;             // ひんし前に予約した行動は無効
        var useC = me.chg && myE >= Math.abs(me.chg.e);
        var mv = useC ? me.chg : me.fast;
        if (useC) myE -= Math.abs(me.chg.e);
        ev.push({ t: t + mv.w, pr: 1, k: 'hit', g: myGen, mv: mv, dmg: useC ? myC : myF, sp: useC });
        ev.push({ t: t + mv.d, pr: 0, k: 'act', g: myGen });
      } else if (e.k === 'hit') {                // こちらのダメージが入る(ゲージもこの瞬間に入る)
        if (e.g !== myGen) continue;             // 撃っている途中で倒れたぶんは消える
        total += e.dmg;
        if (!e.sp) myE = Math.min(MAX_ENERGY, myE + e.mv.e);
        bE = Math.min(MAX_ENERGY, bE + e.dmg * ENERGY_PER_HP * N);   // ボスは全員ぶんでためる
        L({ t: t, side: 'me', mv: e.mv, dmg: e.dmg, sp: e.sp });
        if (total * N >= bs.hp) { win = true; endT = t; break; }
      } else if (e.k === 'bact') {               // ボスの行動
        var canC = bs.chg && bE >= Math.abs(bs.chg.e);
        var bUseC = canC && (cfg.spMode === 'coin' ? rng() < 0.5 : true);
        var bmv = bUseC ? bs.chg : bs.fast;
        if (bUseC) bE -= Math.abs(bs.chg.e);
        ev.push({ t: t + bmv.w, pr: 1.5, k: 'bhit', mv: bmv, dmg: bUseC ? bC : bF, sp: bUseC });
        var nt = e.n < 3 ? BOSS_STARTS[e.n] : t + bmv.d + BOSS_GAP;
        ev.push({ t: nt, pr: 0.5, k: 'bact', n: e.n + 1 });
      } else if (e.k === 'bhit') {               // ボスのダメージが入る
        if (t < activeFrom - 1e-9) {             // 交代・再突入の待ちの間は当たらない
          L({ t: t, side: 'boss', mv: e.mv, dmg: 0, sp: e.sp, miss: true });
          continue;
        }
        myHP -= e.dmg;
        myE = Math.min(MAX_ENERGY, myE + e.dmg * ENERGY_PER_HP);
        if (!e.sp) bE = Math.min(MAX_ENERGY, bE + e.mv.e);   // ボスも自分のわざぶんをためる
        L({ t: t, side: 'boss', mv: e.mv, dmg: e.dmg, sp: e.sp });
        if (myHP <= 0) {
          myGen++; faints++;
          myHP = me.hp; myE = 0;
          if (mon < 5) {
            mon++;
            activeFrom = t + SWAP_SEC;
            L({ t: t, side: 'sys', note: 'ひんし → 次のポケモン(1秒)' });
          } else {
            wipes++; mon = 0;
            activeFrom = t + cfg.rejoin;
            L({ t: t, side: 'sys', note: '全滅 → 再突入(' + cfg.rejoin + '秒)' });
          }
          ev.push({ t: activeFrom, pr: 0, k: 'act', g: myGen });
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
