// GBL対面シミュレーター(/gbl/)とロケット団対策(/rocket/)の共通アプリ本体。
// 2ページは見た目・入口が別のツールだが、計算と画面の中身はこの1ファイルを共有する。
// ページの違いは PAGE_ROCKET で分岐する(rocket/index.html が読み込み前に window.PAGE_ROCKET = true を立てる)
const PAGE_ROCKET = !!window.PAGE_ROCKET;

// ---- 画面の骨組み(両ページ共通。ここで注入して二重管理を防ぐ) ----
document.getElementById('app').innerHTML = `
<div class="wrap">
<header>
  <h1>GOバトルリーグ <b>対面シミュレーター</b></h1>
</header>

<div class="leagues" id="leagues">
  <button class="lgbtn" data-cap="1500" aria-pressed="true">スーパー</button>
  <button class="lgbtn" data-cap="2500" aria-pressed="false">ハイパー</button>
  <button class="lgbtn" data-cap="0" aria-pressed="false">マスター</button>
  <button class="lgbtn" id="cupTab" aria-pressed="false" title="特殊レギュレーションの一覧を開く">特殊カップ</button>
</div>
<div class="popwin cupwin" id="cupwin" style="display:none">
  <div class="popttl">特殊カップを選ぶ</div>
  <div class="slots cupslots" id="cupslots"></div>
</div>

<div class="modes" id="modes">
  <button data-m="duel" aria-pressed="true">1対1シミュ</button>
  <button data-m="multi" aria-pressed="false" title="じぶんのポケモンを環境上位50匹と一括対戦">環境一覧</button>
  <button data-m="counter" aria-pressed="false" title="あいてに勝てるポケモン（対策）を環境上位から総当たりで探す">対策さがし</button>
  <button data-m="party" aria-pressed="false" title="パーティ3匹で環境上位に何匹勝てるかを調べ、穴(3匹とも負ける相手)を洗い出す">パーティ診断</button>
  <button data-m="rocket" aria-pressed="false" title="GOロケット団(したっぱ/リーダー/サカキ)との戦いを再現する。相手はSPアタックのあと動けなくなる(硬直)">ロケット団戦</button>
</div>

<div class="rocket" id="rocket" style="display:none">
  <div class="rkrow rkmoderow">
    <div class="opts rkmode" id="rkmode">
      <button data-v="0" aria-pressed="true" title="1匹どうしの対面だけを計算します">1対1モード</button><button data-v="1" aria-pressed="false" title="じぶんの3匹とあいての手持ちを、倒れたら次…と通しで戦います。SPアタックを撃つ・温存する・シールドを使う・交代するを、決断の場面ごとに自分で選べます">模擬戦モード</button>
    </div>
  </div>
  <div class="rkrow">
    <span class="lbl">あいて</span>
    <div class="opts rkkind" id="rkkind">
      <button data-v="grunt" aria-pressed="true" title="したっぱ・ムサシ・コジロウ。シールドを使いません">したっぱ</button><button data-v="leader" aria-pressed="false" title="シエラ・クリフ・アルロ。こちらの最初の2発のSPアタックを必ずシールドで防ぎます">リーダー</button><button data-v="boss" aria-pressed="false" title="サカキ。こちらの最初の2発のSPアタックを必ずシールドで防ぎます">サカキ</button>
    </div>
  </div>
  <div class="rkroster" id="rkroster" style="display:none">
    <div class="rkrow">
      <span class="lbl">だれと</span>
      <div class="opts rkwho" id="rkwho"></div>
    </div>
    <div class="rklineup" id="rklineup"></div>
  </div>
  <div class="rkrow rksep" id="rkenterrow">
    <span class="lbl" title="この対面が始まった時点で、あいてが動けない状態かどうか">敵硬直</span>
    <div class="opts rkenter" id="rkenter">
      <button data-v="first" aria-pressed="true" title="開幕から出ている1匹目。硬直なしで動き出します">開幕</button><button data-v="ko" aria-pressed="false" title="前のポケモンが倒されて次が出てきた直後。あいては4秒(8ターン)動けません">撃破後</button><button data-v="swap" aria-pressed="false" title="自分から交代した直後。あいては4.5秒(9ターン)動けませんが、自分も0.5秒(1ターン)動けません">交代後</button>
    </div>
  </div>
  <!-- 1対1のときだけ: 見かた(おすすめランキング / シミュレート)と絞り込み -->
  <div class="rkrow rkviewrow rksep" id="rkviewrow" style="display:none">
    <span class="lbl">見かた</span>
    <div class="opts" id="rkviewbtns">
      <button data-v="power" aria-pressed="true" title="ノーマルアタックだけで殴ったとき、火力が高い順に並べます">火力</button><button data-v="safe" aria-pressed="false" title="あいてのノーマルアタックで先に倒されない中から、火力が高い順に並べます">高火力＋安定</button><button data-v="sim" aria-pressed="false" title="1匹どうしの対面を1ターンずつ詳しく計算します">シミュレート</button>
    </div>
  </div>
  <div class="rkrow rkfiltrow" id="rkfiltrow" style="display:none">
    <span class="lbl">含める</span>
    <div class="opts rkfilt" id="rkfilt">
      <button data-f="shadow" aria-pressed="true" aria-label="シャドウを含める" title="シャドウを含める"><i class="shadowmark"></i>シャドウ</button><button data-f="mega" aria-pressed="false" title="メガ・ゲンシを含める">メガ・ゲンシ</button>
    </div>
  </div>
</div>


<div class="duel">
  <div class="side mine" id="sideL">
    <h2>じぶん<button class="shadowtab" aria-pressed="false" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする"><i class="shadowmark"></i></button></h2>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="opts mypkbar"><button class="mypktab" aria-pressed="false" title="★登録したポケモンの一覧を開く">★登録リスト</button></div>
    <div class="popwin mypklist" style="display:none"></div>
    <div class="pkview" style="display:none">
      <div class="pkhead"><span class="nm"></span><span class="ticons"></span><span class="scp"></span><button class="savepk" title="このポケモン(個体値・わざ込み)を登録し、「★登録リスト」タブから1タップで呼び出せます">★登録</button></div>
      <div class="ivline"></div>
      <div class="smaxwrap" style="display:none">
        <div class="opts smax">
          <button data-lv="52" title="メガLv4(スーパーマックスレベル)でPL上限+2(52まで)">メガLv4</button><button data-lv="53" title="メガLv4+最高の相棒でPL上限53まで">メガLv4＋相棒</button>
        </div>
      </div>
      <select class="selFast" title="ノーマルアタック"></select>
      <select class="selC1" title="SPアタック"></select>
      <select class="selC2" title="SPアタック2（わざ開放で覚えさせた2本目。選ぶと対面ごとに2本を使い分けます）"></select>
      <div class="bluffwrap" style="display:none">
        <label class="f" title="消費ゲージの少ないSPアタックを撃って、相手にシールドを使わせる駆け引き">ブラフ</label>
        <div class="opts bluff">
          <button data-v="0" aria-pressed="true" title="ブラフはせず、常にダメージ効率が高いSPを撃つ">しない</button><button data-v="1" aria-pressed="false" title="相手にシールドが残っている間は、消費の軽いSPを撃ってシールドを使わせにいく">する</button>
        </div>
      </div>
      <label class="f">個体値・PL</label>
      <div class="opts ivmode">
        <button data-v="auto" aria-pressed="true" title="リーグ上限内でSCPが最大になる理想個体値を自動計算">理想(自動)</button><button data-v="manual" aria-pressed="false" title="手持ちポケモンの個体値とPLを入力">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custIv" style="display:none">
        <div class="popttl ivpresetttl">入手別の1位個体（タップで反映）</div>
        <div class="slots ivpresets">
          <button data-f="5" title="交換入手(個体値の下限5)の中での1位個体">大親友交換</button><button data-f="6" title="シャドウレイド産(下限6)の中での1位個体">シャドウレイド</button><button data-f="10" title="レイド・ふか・リワード産(下限10)の中での1位個体">レイド,ふか,リワード</button>
        </div>
        <div class="popttl" style="margin-top:10px">手動入力（PLは自動調整）</div>
        <div class="ivgrid">
          <label>攻撃<input type="number" class="ivA" min="0" max="15" inputmode="numeric"></label>
          <label>防御<input type="number" class="ivD" min="0" max="15" inputmode="numeric"></label>
          <label>HP<input type="number" class="ivH" min="0" max="15" inputmode="numeric"></label>
          <label>PL<input type="number" class="ivL" min="1" max="51" step="0.5" inputmode="decimal"></label>
        </div>
        <div class="ivnote"></div>
      </div>
      <label class="f">シールド</label>
      <div class="opts sh shields">
        <button data-v="2" aria-pressed="true">2枚</button><button data-v="1" aria-pressed="false">1枚</button><button data-v="0" aria-pressed="false">0枚</button><button data-v="plan" aria-pressed="false" title="敵のSPアタック何発目で使うかを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custShield" style="display:none">
        <div class="popttl">SPアタック何発目で使う？</div>
        <div class="slots shslots">
          <button data-slot="1">1発目</button><button data-slot="2">2発目</button><button data-slot="3">3発目</button><button data-slot="4">4発目</button><button data-slot="5">5発目</button><button data-slot="6">6発目〜</button>
        </div>
      </div>
      <label class="f">SPアタックタイミング</label>
      <div class="opts timing">
        <button data-v="never" aria-pressed="false" style="display:none" title="SPアタックを撃たずにノーマルアタックだけで戦う">撃たない</button><button data-v="optimal" aria-pressed="true" title="相手のノーマルアタックの最終ターンに合わせて撃つ(上級者の動き)">最適</button><button data-v="asap" aria-pressed="false" title="ゲージが溜まりしだいすぐ撃つ">最短</button><button data-v="sync" aria-pressed="false" title="相手がSPアタックを撃つターンに合わせて撃つ(先に当たるのは攻撃の実数値が高いほう)。相手が撃たないままゲージが満タンになったら合わせるのをやめて撃つ">同時</button><button data-v="plan" aria-pressed="false" title="打つターンを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <label class="f">連戦</label>
      <div class="opts carry">
        <button data-v="off" aria-pressed="true" title="満タン・ゲージ0の状態から開始する">なし</button><button data-v="on" aria-pressed="false" title="前の対面から引き継いだHP・ゲージで開始する">設定する</button>
      </div>
      <div class="popwin custCarry" style="display:none">
        <div class="popttl">開始HP％とゲージを指定</div>
        <div class="cgrid">
          <label>開始HP（％）<input type="number" class="cHp" min="1" max="100" inputmode="numeric"></label>
          <label>開始ゲージ<input type="number" class="cEn" min="0" max="100" inputmode="numeric"></label>
        </div>
        <div class="slots cpre">
          <button data-hp="100">HP満タン</button><button data-hp="75">HP75%</button><button data-hp="50">HP50%</button><button data-hp="25">HP25%</button>
        </div>
      </div>
      <div class="popwin custSp" style="display:none">
        <div class="popttl">発ごとのSP設定</div>
        <div class="legend"></div>
        <div class="sprows"></div>
      </div>
    </div>
  </div>
  <div class="side foe" id="sideR">
    <h2>あいて<button class="shadowtab" aria-pressed="false" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする"><i class="shadowmark"></i></button></h2>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="opts mypkbar"><button class="mypktab" aria-pressed="false" title="★登録したポケモンの一覧を開く">★登録リスト</button></div>
    <div class="popwin mypklist" style="display:none"></div>
    <div class="pkview" style="display:none">
      <div class="pkhead"><span class="nm"></span><span class="ticons"></span><span class="scp"></span><button class="savepk" title="このポケモン(個体値・わざ込み)を登録し、「★登録リスト」タブから1タップで呼び出せます">★登録</button></div>
      <div class="ivline"></div>
      <div class="smaxwrap" style="display:none">
        <div class="opts smax">
          <button data-lv="52" title="メガLv4(スーパーマックスレベル)でPL上限+2(52まで)">メガLv4</button><button data-lv="53" title="メガLv4+最高の相棒でPL上限53まで">メガLv4＋相棒</button>
        </div>
      </div>
      <select class="selFast" title="ノーマルアタック"></select>
      <select class="selC1" title="SPアタック"></select>
      <select class="selC2" title="SPアタック2（わざ開放で覚えさせた2本目。選ぶと対面ごとに2本を使い分けます）"></select>
      <div class="bluffwrap" style="display:none">
        <label class="f" title="消費ゲージの少ないSPアタックを撃って、相手にシールドを使わせる駆け引き">ブラフ</label>
        <div class="opts bluff">
          <button data-v="0" aria-pressed="true" title="ブラフはせず、常にダメージ効率が高いSPを撃つ">しない</button><button data-v="1" aria-pressed="false" title="相手にシールドが残っている間は、消費の軽いSPを撃ってシールドを使わせにいく">する</button>
        </div>
      </div>
      <label class="f">個体値・PL</label>
      <div class="opts ivmode">
        <button data-v="auto" aria-pressed="true" title="リーグ上限内でSCPが最大になる理想個体値を自動計算">理想(自動)</button><button data-v="manual" aria-pressed="false" title="手持ちポケモンの個体値とPLを入力">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custIv" style="display:none">
        <div class="popttl ivpresetttl">入手別の1位個体（タップで反映）</div>
        <div class="slots ivpresets">
          <button data-f="5" title="交換入手(個体値の下限5)の中での1位個体">大親友交換</button><button data-f="6" title="シャドウレイド産(下限6)の中での1位個体">シャドウレイド</button><button data-f="10" title="レイド・ふか・リワード産(下限10)の中での1位個体">レイド,ふか,リワード</button>
        </div>
        <div class="popttl" style="margin-top:10px">手動入力（PLは自動調整）</div>
        <div class="ivgrid">
          <label>攻撃<input type="number" class="ivA" min="0" max="15" inputmode="numeric"></label>
          <label>防御<input type="number" class="ivD" min="0" max="15" inputmode="numeric"></label>
          <label>HP<input type="number" class="ivH" min="0" max="15" inputmode="numeric"></label>
          <label>PL<input type="number" class="ivL" min="1" max="51" step="0.5" inputmode="decimal"></label>
        </div>
        <div class="ivnote"></div>
      </div>
      <label class="f">シールド</label>
      <div class="opts sh shields">
        <button data-v="2" aria-pressed="true">2枚</button><button data-v="1" aria-pressed="false">1枚</button><button data-v="0" aria-pressed="false">0枚</button><button data-v="plan" aria-pressed="false" title="敵のSPアタック何発目で使うかを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <div class="popwin custShield" style="display:none">
        <div class="popttl">SPアタック何発目で使う？</div>
        <div class="slots shslots">
          <button data-slot="1">1発目</button><button data-slot="2">2発目</button><button data-slot="3">3発目</button><button data-slot="4">4発目</button><button data-slot="5">5発目</button><button data-slot="6">6発目〜</button>
        </div>
      </div>
      <label class="f">SPアタックタイミング</label>
      <div class="opts timing">
        <button data-v="never" aria-pressed="false" style="display:none" title="SPアタックを撃たずにノーマルアタックだけで戦う">撃たない</button><button data-v="optimal" aria-pressed="true" title="相手のノーマルアタックの最終ターンに合わせて撃つ(上級者の動き)">最適</button><button data-v="asap" aria-pressed="false" title="ゲージが溜まりしだいすぐ撃つ">最短</button><button data-v="sync" aria-pressed="false" title="相手がSPアタックを撃つターンに合わせて撃つ(先に当たるのは攻撃の実数値が高いほう)。相手が撃たないままゲージが満タンになったら合わせるのをやめて撃つ">同時</button><button data-v="plan" aria-pressed="false" title="打つターンを自由に指定">ﾏﾆｭｱﾙ</button>
      </div>
      <label class="f">連戦</label>
      <div class="opts carry">
        <button data-v="off" aria-pressed="true" title="満タン・ゲージ0の状態から開始する">なし</button><button data-v="on" aria-pressed="false" title="前の対面から引き継いだHP・ゲージで開始する">設定する</button>
      </div>
      <div class="popwin custCarry" style="display:none">
        <div class="popttl">開始HP％とゲージを指定</div>
        <div class="cgrid">
          <label>開始HP（％）<input type="number" class="cHp" min="1" max="100" inputmode="numeric"></label>
          <label>開始ゲージ<input type="number" class="cEn" min="0" max="100" inputmode="numeric"></label>
        </div>
        <div class="slots cpre">
          <button data-hp="100">HP満タン</button><button data-hp="75">HP75%</button><button data-hp="50">HP50%</button><button data-hp="25">HP25%</button>
        </div>
      </div>
      <div class="popwin custSp" style="display:none">
        <div class="popttl">発ごとのSP設定</div>
        <div class="legend"></div>
        <div class="sprows"></div>
      </div>
    </div>
  </div>
</div>

<div class="multi" id="multi" style="display:none"></div>
<div class="multi" id="counter" style="display:none"></div>
<div class="multi" id="party" style="display:none">
  <div class="phead">
    <!-- 見出しは「自分のパーティ」(2026-08-13タダシさん指示)。
         旧「パーティ3匹の穴チェック」の"穴チェック"は下の図の見出しに移ったので、この画面の
         入り口としては「自分のパーティを入れる場所」であることだけを言う。
         「0匹＝穴」は図の凡例が説明するようになったため、「マスをタップ→1対1シミュ」とともに削除 -->
    <h3>自分のパーティ</h3>
    <button class="ptauto" aria-pressed="false" title="マニュアル＝下の欄で選んだわざで計算します。オート＝環境上位にいちばん多く勝てるわざ構成を自動で選びます。タップで切り替わります"><span class="k">わざ</span><span class="v m">マニュアル</span><span class="v a">オート</span></button>
  </div>
  <div class="pslots"></div>
  <div class="pctl">
    <span class="lbl">シールド</span>
    <div class="opts ptsh">
      <button data-v="2" aria-pressed="true">🛡2-2</button><button data-v="1" aria-pressed="false">🛡1-1</button><button data-v="0" aria-pressed="false">🛡0-0</button>
    </div>
  </div>
  <div class="pbody"></div>
</div>

<div class="multi" id="rkteam" style="display:none">
  <div class="rksuggbar" id="rksuggbar"><span class="lbl">おすすめ</span>
    <button data-m="power" aria-pressed="false" title="じぶんの枠の入力欄をタップすると、同じ順番のあいてをいちばん速く倒せるポケモン トップ5を出します">高火力</button><button data-m="safe" aria-pressed="false" title="あいてのどのわざでも先に倒されないポケモンだけに絞って、火力トップ5を出します">高火力＋安定</button>
    <button class="rkdetailtab" id="rkdetailtab" aria-expanded="false" title="こまかい設定（確率で上下するわざ・じぶんの個体値とPL・あいてのわざランダム）を開きます">⚙ 詳細</button></div>
  <div class="rkdetail" id="rkdetail" style="display:none">
    <div class="rkdbody"></div>
    <div class="rkdprob"></div>
  </div>
  <div class="rkteams">
    <div class="rkteamcol">
      <div class="rkcolttl" title="上から順に出します。パーティ診断と共通の3枠です">じぶん</div>
      <div class="pslots myslots"></div>
    </div>
    <div class="rkteamcol">
      <div class="rkcolttl foe" title="上から順に出てきます。リーダー・サカキは上の「だれと」からタップで入ります">あいて</div>
      <div class="pslots foeslots"></div>
    </div>
  </div>
  <div class="rkbody"></div>
</div>

<!-- ロケット団戦 1対1: おすすめランキング(あいてを決めると出る) -->
<div class="multi" id="rkrank" style="display:none">
  <h3 id="rkranktitle">ノーマルアタック火力ランキング</h3>
  <div class="rkmy" id="rkmy">
    <button class="rkmytab" id="rkmytab" aria-expanded="false" title="CPと個体値を入れると、自分の個体の実力でランキングに並びます">＋ 自分のポケモン</button>
    <div class="rkmybody" id="rkmybody" style="display:none"></div>
  </div>
  <div class="rkrbody"></div>
</div>

<!-- 一覧系3モードの「⚙ 詳細」。ブラフ・能力変化わざはここへ畳んで、画面の幅と文字を減らす -->
<div class="mdet" id="mdet" style="display:none">
  <button class="mdettab" id="mdettab" aria-expanded="false" title="こまかい設定（ブラフ・能力変化わざ）を開きます">⚙ 詳細</button>
  <div class="mdetbody" id="mdetbody" style="display:none"></div>
</div>

<div class="gopt" id="gopt">
  <span class="lbl" title="「ねっとう」「かみくだく」など、決まった確率で能力が上下するわざの計算方法。全モード共通で使われます">能力変化わざ</span>
  <div class="goptmain">
    <div class="opts prob" id="prob">
      <button data-v="none" aria-pressed="true" title="効果は起きない前提で計算する（運に頼らない結果・既定）">不発</button><button data-v="avg" aria-pressed="false" title="確率のぶんを平均して反映する（例: 30%で攻⬇なら0.3段階ぶん下がる）">期待値</button><button data-v="always" aria-pressed="false" title="毎回必ず発動する前提で計算する（いちばん効果が出た場合）">必ず発動</button>
    </div>
    <div class="goptnote" id="goptnote"></div>
  </div>
</div>
<div class="gopt" id="gbluff" style="display:none">
  <span class="lbl" title="安いSPアタックをわざと撃ってシールドを使わせる駆け引き。この画面では、じぶんとあいての両方に同じ前提を使います（1対1シミュでは左右のパネルで別々に指定できます）">ブラフ</span>
  <div class="goptmain">
    <div class="opts bluffmeta" id="bluffmeta">
      <button data-v="0" aria-pressed="true" title="ブラフをせず、いつも効率のよいSPアタックを撃つ前提（運に頼らない結果・既定）">しない</button><button data-v="1" aria-pressed="false" title="シールドが残っているあいだは軽いSPアタックを撃ってくる前提（引っ掛かると不利になる厳しめの見方）">する</button>
    </div>
    <div class="goptnote" id="gbluffnote"></div>
  </div>
</div>
<div class="result" id="result"></div>
<div class="tl" id="tl"></div>

<div class="share" id="share" style="display:none">
  <button id="copyUrl">🔗 URLをコピー</button>
</div>

<div class="loading" id="loading">データ読み込み中…</div>
<!-- 使い方・見かたの説明。画面の中には結論だけを置き、説明はすべてここにまとめる -->
<div class="helpwrap">
  <button id="helptab" aria-expanded="false">？ 使い方・マークの見かた</button>
  <div id="helpbody" style="display:none"></div>
</div>

<footer>データ: ゲーム内公開データ / 判定基準は独自集計。ポケモンおよびポケモンGOの名称・データは各権利者に帰属します。</footer>
</div>
`;

// ページごとの入口の違いを整える
if (PAGE_ROCKET) {
  // ロケット団対策ページ: モードは固定なのでタブ行ごと隠し、見出しを差し替える
  document.querySelector('header h1').innerHTML = 'GOロケット団 <b>対策シミュレーター</b>';
  document.getElementById('modes').style.display = 'none';
  document.querySelector('header').insertAdjacentHTML('beforeend',
    '<a class="pagelink" href="/gbl/" title="GOバトルリーグ(対人戦)の対面シミュレーターへ">GBL対面シミュ ↗</a>');
} else {
  // GBLページ: ロケット団戦は別ページになったので、タブを同じ位置のリンクに差し替える
  const rb = document.querySelector('#modes button[data-m="rocket"]');
  if (rb) rb.outerHTML = '<a class="modelink" href="/rocket/" title="GOロケット団(したっぱ/リーダー/サカキ)対策の専用ページへ">ロケット団戦 ↗</a>';
}

// 交代マーク(黄色い循環矢印の画像・assets/gbl.css の .swapmark)。「⇄」の文字の代わりに全箇所で使う
const SWAPMK = '<i class="swapmark"></i>';

const D = window.PVP_DATA;
document.getElementById('loading').style.display = 'none';

// ---- 環境リストのわざ構成を、人が確認した確定値(assets/meta_moves.js)で上書きする ----
// 情報元の推奨構成は約7割しか実戦の定番と一致しないため、上位100匹はタダシさんが確認した
// 構成を使う(pvp-tests/answer-key.html で作る)。載っていないポケモンは従来どおり情報元の推奨。
// 読み込んだ直後に一度だけ書き換えるので、環境一覧・パーティ診断・対策さがし・カップの
// すべてが同じ構成を見る＝画面ごとに結果が食い違わない
(function applyMetaMoves() {
  const MM = window.META_MOVES;
  if (!MM) return;
  const put = (list, tbl) => (list || []).forEach(m => {
    const mv = tbl[m.k + (m.s ? '|s' : '')];
    if (!mv) return;
    m.f = mv[0] || m.f;
    m.c1 = mv[1] || m.c1;
    if (mv[2]) m.c2 = mv[2]; else delete m.c2;
  });
  Object.keys(MM).forEach(lg => {
    put((window.META_LISTS || {})[lg], MM[lg]);
    put((window.META_EXT || {})[lg], MM[lg]);
  });
  // カップはCP上限が同じリーグの確定値を使う(マスター相当のカップは "0")
  (window.CUP_LISTS || []).forEach(c => {
    const tbl = MM[c.cp >= 10000 ? '0' : String(c.cp)];
    if (!tbl) return;
    put(c.list, tbl);
    put(c.ext, tbl);
  });
})();

// ---- 検索対象(実装済み・メガ除外) ----
// 実装済み(r)は全て検索可能にする。メガ・ゲンシもメガバージョン系カップ用に含める
const KEYS = Object.keys(D.pokemon).filter(k => D.pokemon[k].r);
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const typeIcons = (p, size) => typePairHTML(p.ty.map(t => D.typeJa[t]), size || 18);
const MOVE_TYPE = {};
const MOVE_COST = {};
const NAME_TYPES = {};
Object.values(D.moves).forEach(m => {
  MOVE_TYPE[m.n] = m.t;
  if (m.e) MOVE_COST[m.n] = m.e;
  (NAME_TYPES[m.n] = NAME_TYPES[m.n] || new Set()).add(m.t);
});
// チップ表示ではギルガルド専用わざの「（独自性能）」を「（独自）」に縮める(タイムライン等の省スペース用。
// タイプアイコンの参照はフルネームで行うので縮めるのは表示文字だけ)
const mvChip = (name, size) => `<span class="mvname">${typeIconHTML(D.typeJa[MOVE_TYPE[name]] || '', size || 13)}${name.replace('（独自性能）', '（独自）')}</span>`;

// ---- リーグ上限内の理想個体値(SCP最大)を求める ----
// 通常はPL51(相棒込み)まで。メガのスーパーマックスLvは52、+最高の相棒で53まで
const LEVELS_ALL = Object.keys(D.cpm).map(Number).filter(l => l <= 53).sort((a, b) => a - b);
const LEVELS = LEVELS_ALL.filter(l => l <= 51);
const levelsUpTo = maxLv => (maxLv || 51) > 51 ? LEVELS_ALL.filter(l => l <= maxLv) : LEVELS;
const isMega = key => !!key && (key.includes('_mega') || key.includes('_primal'));
// ロケット団はメガ・ゲンシを使ってこないので、あいて側(i=1)の候補からは外す。
// こちらは使えるので、じぶん側(i=0)は今までどおり全部出す
const rkFoeOk = (i, key) => !(mode === 'rocket' && i === 1 && isMega(key));
function cpOf(p, a, d, h, c) {
  return Math.max(10, Math.floor((p.a + a) * Math.sqrt(p.df + d) * Math.sqrt(p.h + h) * c * c / 10));
}
// 同じ条件なら答えは変わらないので覚えておく(全ポケモンを回す「対策さがし(全ポケモン)」で
// 1匹あたり4096通りの計算を毎回やり直すと1秒以上かかるため)
const R1C = new Map();
function rank1(key, cap, minIv, maxLv) {
  const ck = key + '|' + cap + '|' + (minIv || 0) + '|' + (maxLv || '');
  if (R1C.has(ck)) return R1C.get(ck);
  const v = rank1Calc(key, cap, minIv, maxLv);
  R1C.set(ck, v);
  return v;
}
function rank1Calc(key, cap, minIv, maxLv) {
  const p = D.pokemon[key];
  minIv = minIv || 0;   // 入手方法による個体値の下限(大親友交換5/シャドウレイド6/レイド系10)
  const LV = levelsUpTo(maxLv);
  if (!cap) return { ivs: [15, 15, 15], level: (maxLv || 51) > 51 ? maxLv : 50 };  // マスター
  let best = null;
  for (let a = minIv; a <= 15; a++) for (let d = minIv; d <= 15; d++) for (let h = minIv; h <= 15; h++) {
    // capを超えない最大レベルを二分探索
    let lo = 0, hi = LV.length - 1, li = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cpOf(p, a, d, h, D.cpm[String(LV[mid])]) <= cap) { li = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (li < 0) continue;
    const c = D.cpm[String(LV[li])];
    const prod = (p.a + a) * c * (p.df + d) * c * Math.floor((p.h + h) * c);
    if (!best || prod > best.prod) best = { prod, ivs: [a, d, h], level: LV[li] };
  }
  return best || { ivs: [15, 15, 15], level: 50 };
}

// ---- 技構成の自動最適化(通常技×ゲージ技の総当たり+相互最善応答) ----
const scoreOf = (res, side) => {
  const own = res.final[side], opp = res.final[1 - side];
  return 500 * (1 - opp.hp / opp.hpMax) + 500 * (own.hp / own.hpMax);
};
// 全モード共通の計算設定。確率で能力が上下するわざの扱い(不発/期待値/必ず発動)
// ここを1つの設定にまとめて、一覧系と1対1シミュの結果が食い違わないようにする
const SIMOPT = { buffMode: 'none' };
function movePool(key) {
  // 通常枠と特別枠の両方に載っているわざがあるため重複除去する
  const p = D.pokemon[key];
  const fasts = [...new Set([...p.q, ...p.eq])].filter(m => D.moves[m]);
  const chargeds = [...new Set([...p.c, ...p.ec])].filter(m => D.moves[m] && m !== 'RETURN' && m !== 'FRUSTRATION');
  return { fasts, chargeds };
}
// ロケット団のあいてが使ってくるわざ。おぼえるわざの中からランダムに打ってくるが、
// 特別なわざ(レガシー技)は打ってこないので、通常枠(q/c)だけに絞る
function rkPool(key) {
  const p = D.pokemon[key];
  return {
    fasts: [...new Set(p.q)].filter(m => D.moves[m]),
    chargeds: [...new Set(p.c)].filter(m => D.moves[m] && m !== 'RETURN' && m !== 'FRUSTRATION'),
  };
}
// ロケット団戦で「こちらにいちばんキツいわざ」を選ぶための評価。低いほどキツい。
// 勝ち負けがまず最優先。勝つ場合は、ロケット団戦でいちばん大事な「早さ」を先に見る
// (決着が遅いほどキツい)＝最悪ケースの秒数が主結果より短く見える逆転を防ぐ。
// 同じ速さなら残りHPが少ないほどキツい。負け(と決着せず)は従来どおり scoreOf で比べる。
// scoreOf は最大1000なので、勝ちはどれも2000以上になり負けと混ざらない
const rkWorstScore = res => {
  if (res.winner !== 0) return scoreOf(res, 0);
  return 2000 + (1000 - res.turns) * 10 + res.final[0].hp / res.final[0].hpMax;
};
// ロケット団のあいてかどうかは statMult(倍率でステータスが決まる)の有無で見分ける
const poolOf = cfg => (cfg && cfg.statMult ? rkPool(cfg.key) : movePool(cfg.key));
// わざ構成の候補を作る。cfg = { fast:固定するノーマル, c1:固定するSP1, c2:指定されたSP2 }
// c2があるときは「SP1候補+SP2」の2本セットを返し、どちらを撃つかはエンジンが相手に合わせて選ぶ
function policies(key, cfg) {
  const { fasts, chargeds } = cfg && cfg.statMult ? rkPool(key) : movePool(key);
  const st = { atk: 1, def: 1, types: D.pokemon[key].ty, buffs: [0, 0] };
  const dpe = m => D.moves[m].p / D.moves[m].e;
  const top = chargeds.sort((a, b) => dpe(b) - dpe(a)).slice(0, 8);
  const out = [];
  for (const f of (cfg.fast ? [cfg.fast] : fasts.slice(0, 5))) {
    for (const t of (cfg.c1 ? [cfg.c1] : top)) {
      if (cfg.c2) out.push({ fast: f, charged: t === cfg.c2 ? [t] : [t, cfg.c2] });
      else out.push({ fast: f, throw: t });
    }
  }
  // SPアタックを覚えないポケモン(進化前など)はノーマルアタックだけの構成にする
  if (!out.length) for (const f of (cfg.fast ? [cfg.fast] : fasts.slice(0, 5))) out.push({ fast: f });
  return out;
}
// 画面で選んでいるわざ(ノーマル/SP1/SP2)を policies 用の指定に変換する。
// 手動で選んだわざが最優先、なければ以前の自動選出で決まったわざ(pin)を使い続ける
// (設定をいじるたびに構成が勝手に変わらないようにする。どちらも無いときだけ自動最適化)
const polOpts = i => ({ fast: S[i].fast || S[i].pin.fast || undefined,
  c1: S[i].c1 || S[i].pin.c1 || undefined, c2: S[i].c2 || undefined });
// 自動選出のわざを未確定に戻す(ポケモンを替えた・リーグを替えたときに呼ぶ)
const resetPin = i => { S[i].pin = { fast: null, c1: null }; };

function optimize(cfgL, cfgR) {
  const PL = policies(cfgL.key, cfgL), PR = policies(cfgR.key, cfgR);
  const cache = new Map();
  const play = (a, b) => {
    const k = a + ':' + b;
    if (!cache.has(k)) {
      const res = PvpEngine.simulate(D, { ...cfgL, ...PL[a], timing: cfgL.timing || 'optimal' },
                                        { ...cfgR, ...PR[b], timing: cfgR.timing || 'optimal' }, SIMOPT);
      cache.set(k, [scoreOf(res, 0), scoreOf(res, 1)]);
    }
    return cache.get(k);
  };
  let a = 0, b = 0;
  const seen = new Set();
  for (let it = 0; it < 24; it++) {
    const key = a + ',' + b;
    if (seen.has(key)) break;
    seen.add(key);
    let bestA = a;
    for (let x = 0; x < PL.length; x++) if (play(x, b)[0] > play(bestA, b)[0]) bestA = x;
    let bestB = b;
    for (let y = 0; y < PR.length; y++) if (play(bestA, y)[1] > play(bestA, bestB)[1]) bestB = y;
    if (bestA === a && bestB === b) break;
    a = bestA; b = bestB;
  }
  return { left: PL[a], right: PR[b] };
}

// ---- ブレイクポイント検出(ノーマルアタックのダメージ境界) ----
// 全個体値×リーグ上限内最大PLの実ステータス表(ポケモン×リーグごとに1回だけ計算)
const ivTableCache = new Map();
function ivTable(key, capV, maxLv) {
  const ck = key + ':' + capV + ':' + (maxLv || 51);
  if (!ivTableCache.has(ck)) {
    const LV = levelsUpTo(maxLv);
    const rows = [];
    for (let a = 0; a <= 15; a++) for (let d = 0; d <= 15; d++) for (let h = 0; h <= 15; h++) {
      let lo = 0, hi = LV.length - 1, li = -1;
      while (lo <= hi) {   // CP上限内で最大のPLを二分探索
        const mid = (lo + hi) >> 1;
        const st = PvpEngine.buildStats(D, { key, ivs: [a, d, h], level: LV[mid] });
        if (!capV || st.cp <= capV) { li = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (li < 0) continue;
      const st = PvpEngine.buildStats(D, { key, ivs: [a, d, h], level: LV[li] });
      rows.push({ ivs: [a, d, h], level: LV[li], atk: st.atk, def: st.def, hp: st.hp, cp: st.cp });
    }
    ivTableCache.set(ck, rows);
  }
  return ivTableCache.get(ck);
}
// 指定個体値でCP上限を超えない最大PLを返す
function maxLevelFor(key, ivs, capV, maxLv) {
  const LV = levelsUpTo(maxLv);
  let lo = 0, hi = LV.length - 1, li = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const st = PvpEngine.buildStats(D, { key, ivs, level: LV[mid] });
    if (!capV || st.cp <= capV) { li = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return LV[li];
}
// 必要な攻撃/防御実数値を満たす個体値・PLの例を探す(なければnull)
// 条件を満たす中で「残りのステータス積」が最大の組み合わせを例として返す
function findIvFor(key, need, capV, maxLv) {
  let best = null;
  for (const r of ivTable(key, capV, maxLv)) {
    if (need.atk && r.atk < need.atk) continue;
    if (need.def && r.def <= need.def) continue;
    const score = need.atk ? r.def * r.hp : r.atk * r.hp;
    if (!best || score > best.score) best = { ...r, score };
  }
  return best;
}

// ---- 画面状態 ----
let cap = 1500;
const mkSide = () => ({ key: null, shields: 2, timing: 'optimal', fast: null, c1: null, c2: null,
  pin: { fast: null, c1: null },   // 自動選出で決まったわざの控え(一度決まったら固定するため)
  shieldMode: null, shieldSlots: [true, true, false, false, false], shieldRest: false,
  spMode: ['opt', 'opt', 'opt', 'opt', 'opt'], spModeRest: 'opt',
  spMv: ['auto', 'auto', 'auto', 'auto', 'auto'], spMvRest: 'auto',
  ivMode: 'auto', mIvs: null, mLevel: null, shadow: false, maxLv: 51,
  carry: false, cHp: 100, cEn: 0, bluff: false });
const S = [mkSide(), mkSide()];
const sideEl = [document.getElementById('sideL'), document.getElementById('sideR')];
// 側のタイミング設定 → 発ごとのSP設定で使う記号(最短=min / 同時=sync / それ以外=最適)
const spModeOf = i => S[i].timing === 'asap' ? 'min' : S[i].timing === 'sync' ? 'sync' : 'opt';

// ---- 検索候補 ----
sideEl.forEach((el, i) => {
  const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
  inp.addEventListener('compositionend', () => {
    const v = toKata(inp.value);
    if (v !== inp.value) inp.value = v;
    inp.dispatchEvent(new Event('input'));
  });
  inp.addEventListener('input', e => {
    if (!e.isComposing) {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
    }
    const q = toKata(inp.value.trim());
    if (!q) { list.style.display = 'none'; return; }
    const hits = searchPk(q, k => rkFoeOk(i, k));
    if (!hits.length) { list.style.display = 'none'; return; }
    list.innerHTML = hits.map(k =>
      `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
    list.style.display = 'block';
    list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
      list.style.display = 'none';
      inp.value = D.pokemon[d.dataset.k].n;
      pick(i, d.dataset.k);
    });
  });
  document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
  // シールド・タイミング(ﾏﾆｭｱﾙ選択時は入力欄を表示)
  el.querySelectorAll('.shields button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.shields button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].shieldMode = b.dataset.v === 'plan' ? 'plan' : null;
    if (!S[i].shieldMode) S[i].shields = +b.dataset.v;
    el.querySelector('.custShield').style.display = S[i].shieldMode ? 'block' : 'none';
    run();
  });
  el.querySelectorAll('.timing button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.timing button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].timing = b.dataset.v;
    // 最適/最短/同時を押したら発ごとの設定も一括でそのタイミングに揃える
    if (S[i].timing !== 'plan') {
      const m = spModeOf(i);
      S[i].spMode = [m, m, m, m, m];
      S[i].spModeRest = m;
    }
    el.querySelector('.custSp').style.display = (S[i].timing === 'plan' || S[i].c2) ? 'block' : 'none';
    run();
  });
  // シールドの小窓(何発目で使うか)
  const syncShieldSlots = () => {
    el.querySelectorAll('.shslots button').forEach(b => {
      const k = +b.dataset.slot;
      b.setAttribute('aria-pressed', k === 6 ? !!S[i].shieldRest : !!S[i].shieldSlots[k - 1]);
    });
  };
  syncShieldSlots();
  el.querySelectorAll('.shslots button').forEach(b => b.onclick = () => {
    const k = +b.dataset.slot;
    if (k === 6) S[i].shieldRest = !S[i].shieldRest;
    else S[i].shieldSlots[k - 1] = !S[i].shieldSlots[k - 1];
    syncShieldSlots();
    run();
  });
  // 個体値: 理想(自動)/マニュアル切替。マニュアルを開いたら現在の理想値を初期値に入れる
  const ivInputs = ['ivA', 'ivD', 'ivH', 'ivL'].map(c => el.querySelector('.' + c));
  el.querySelectorAll('.ivmode button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].ivMode = b.dataset.v;
    el.querySelector('.custIv').style.display = S[i].ivMode === 'manual' ? 'block' : 'none';
    if (S[i].ivMode === 'manual' && S[i].key && !S[i].mIvs) {
      const r1 = rank1(S[i].key, cap, 0, S[i].maxLv);
      S[i].mIvs = r1.ivs.slice(); S[i].mLevel = r1.level;
    }
    if (S[i].mIvs) {
      ivInputs[0].value = S[i].mIvs[0]; ivInputs[1].value = S[i].mIvs[1];
      ivInputs[2].value = S[i].mIvs[2]; ivInputs[3].value = S[i].mLevel;
    }
    run();
  });
  // パターン別最適個体: 入手方法の個体値下限つきランク1個体を入力欄へ反映
  el.querySelectorAll('.ivpresets button').forEach(b => b.onclick = () => {
    if (!S[i].key) return;
    const r = rank1(S[i].key, cap, +b.dataset.f, S[i].maxLv);
    S[i].mIvs = r.ivs.slice(); S[i].mLevel = r.level;
    ivInputs[0].value = r.ivs[0]; ivInputs[1].value = r.ivs[1];
    ivInputs[2].value = r.ivs[2]; ivInputs[3].value = r.level;
    el.querySelectorAll('.ivpresets button').forEach(x => x.setAttribute('aria-pressed', x === b));
    run();
  });
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  ivInputs.forEach((inp, k) => inp.onchange = () => {
    if (!S[i].mIvs) S[i].mIvs = [15, 15, 15];
    el.querySelectorAll('.ivpresets button').forEach(x => x.setAttribute('aria-pressed', false));   // 手入力したらパターン選択を解除
    if (k < 3) {
      S[i].mIvs[k] = clamp(Math.round(+inp.value || 0), 0, 15); inp.value = S[i].mIvs[k];
      // 個体値に合わせてPLをCP上限内の最大(最適)レベルへ自動調整
      S[i].mLevel = maxLevelFor(S[i].key, S[i].mIvs, cap, S[i].maxLv);
      ivInputs[3].value = S[i].mLevel;
    } else { S[i].mLevel = clamp(Math.round((+inp.value || 1) * 2) / 2, 1, S[i].maxLv); inp.value = S[i].mLevel; }
    run();
  });
  // スーパーマックスレベル(メガ専用): PL上限を52/53へ拡張。同じタブ再タップで解除
  el.querySelectorAll('.smax button').forEach(b => b.onclick = () => {
    const lv = +b.dataset.lv;
    S[i].maxLv = S[i].maxLv === lv ? 51 : lv;
    syncSmax(i);
    if (S[i].ivMode === 'manual' && S[i].mIvs) {   // マニュアルPLも新上限で自動調整
      S[i].mLevel = maxLevelFor(S[i].key, S[i].mIvs, cap, S[i].maxLv);
      el.querySelector('.ivL').value = S[i].mLevel;
    }
    run();
  });
  // シャドウタブ: この側にシャドウ補正(攻撃1.2倍・防御5/6)をかける
  el.querySelector('.shadowtab').onclick = () => {
    // ロケット団戦のあいてはシャドウ固定(押しても切り替えない)
    if (el.querySelector('.shadowtab').getAttribute('aria-disabled') === 'true') return;
    S[i].shadow = !S[i].shadow;
    el.querySelector('.shadowtab').setAttribute('aria-pressed', S[i].shadow);
    if (S[i].key) {
      el.querySelector('input').value = (S[i].shadow ? 'シャドウ' : '') + D.pokemon[S[i].key].n;
      run();
    }
  };
  // ★登録: いまの構成(個体値・わざ込み)を登録リストへ。同じポケモンは上書き
  el.querySelector('.savepk').onclick = () => {
    if (!S[i].key) return;
    const l = loadMyPk().filter(m => m.key !== S[i].key);
    l.unshift({ key: S[i].key, ivMode: S[i].ivMode, mIvs: S[i].mIvs, mLevel: S[i].mLevel,
                fast: S[i].fast, c1: S[i].c1, c2: S[i].c2, shadow: S[i].shadow, maxLv: S[i].maxLv });
    saveMyPkList(l); renderMyPk();
    const b = el.querySelector('.savepk');
    b.textContent = '★登録した！'; setTimeout(() => { b.textContent = '★登録'; }, 1200);
  };
  // ★登録リストのタブ: タップで一覧を開閉
  el.querySelector('.mypktab').onclick = () => {
    const box = el.querySelector('.mypklist');
    const open = box.style.display === 'none';
    if (open) renderMyPk();
    box.style.display = open ? 'block' : 'none';
    el.querySelector('.mypktab').setAttribute('aria-pressed', open);
  };
  // ブラフ: 相手のシールドが残っている間、消費の軽いSPを撃ってシールドを使わせにいくか
  el.querySelectorAll('.bluff button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.bluff button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].bluff = b.dataset.v === '1';
    run();
  });
  // 連戦(引き継ぎ): 開始HP%と開始ゲージ
  el.querySelectorAll('.carry button').forEach(b => b.onclick = () => {
    el.querySelectorAll('.carry button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S[i].carry = b.dataset.v === 'on';
    el.querySelector('.custCarry').style.display = S[i].carry ? 'block' : 'none';
    el.querySelector('.cHp').value = S[i].cHp;
    el.querySelector('.cEn').value = S[i].cEn;
    run();
  });
  el.querySelector('.cHp').onchange = e => {
    S[i].cHp = Math.min(100, Math.max(1, Math.round(+e.target.value || 100)));
    e.target.value = S[i].cHp;
    el.querySelectorAll('.cpre button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.hp === S[i].cHp));
    run();
  };
  el.querySelector('.cEn').onchange = e => {
    S[i].cEn = Math.min(100, Math.max(0, Math.round(+e.target.value || 0)));
    e.target.value = S[i].cEn;
    run();
  };
  el.querySelectorAll('.cpre button').forEach(b => b.onclick = () => {
    S[i].cHp = +b.dataset.hp;
    el.querySelector('.cHp').value = S[i].cHp;
    el.querySelectorAll('.cpre button').forEach(x => x.setAttribute('aria-pressed', x === b));
    run();
  });
  el.querySelector('.selFast').onchange = e => { S[i].fast = e.target.value; run(); };
  el.querySelector('.selC1').onchange = e => { S[i].c1 = e.target.value; run(); };
  el.querySelector('.selC2').onchange = e => { S[i].c2 = e.target.value; run(); };
});

// リーグ/カップ切替の共通処理(わざ再選択とマニュアルPLの上限内再調整)
// 自動選出で確定したわざ(pin)だけ新リーグで選び直す。手動で選んだわざは変えない
function afterCapChange() {
  S.forEach((s, i) => resetPin(i));
  S.forEach((s, i) => {
    if (s.ivMode === 'manual' && s.mIvs && s.key) {
      s.mLevel = maxLevelFor(s.key, s.mIvs, cap, s.maxLv);
      sideEl[i].querySelector('.ivL').value = s.mLevel;
    }
  });
  run();
}
document.getElementById('leagues').querySelectorAll('.lgbtn[data-cap]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', x === b));
  cap = +b.dataset.cap;
  // 特殊カップの選択は解除
  cup = null;
  cupTab.textContent = '特殊カップ';
  cupwin.style.display = 'none';
  afterCapChange();
});

// ---- 特殊カップ(タップで一覧を開き、選ぶとそのカップの上限・環境リストに切替) ----
let cup = null;
const cupTab = document.getElementById('cupTab');
const cupwin = document.getElementById('cupwin');
function renderCups() {
  const box = document.getElementById('cupslots');
  box.innerHTML = (window.CUP_LISTS || []).map(c =>
    `<button data-slug="${c.slug}" aria-pressed="${!!(cup && cup.slug === c.slug)}">${c.label}<small>${c.cp === 10000 ? 'CP上限なし' : 'CP' + c.cp}</small></button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => selectCup(b.dataset.slug));
}
function selectCup(slug) {
  const c = (window.CUP_LISTS || []).find(x => x.slug === slug);
  if (!c) return;
  cup = c;
  cap = c.cp === 10000 ? 0 : c.cp;
  document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', false));
  cupTab.setAttribute('aria-pressed', true);
  cupTab.textContent = c.label;
  cupwin.style.display = 'none';
  afterCapChange();
}
cupTab.onclick = () => {
  const open = cupwin.style.display === 'none';
  renderCups();
  cupwin.style.display = open ? 'block' : 'none';
  // 一覧を開いているあいだは「特殊カップ」を選択中として光らせる(前のリーグが選ばれたままだと紛らわしい)。
  // 何も選ばずに閉じたら、いま実際に使っているリーグの表示へ戻す
  if (open) {
    document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', x === cupTab));
  } else if (!cup) {
    document.querySelectorAll('.lgbtn').forEach(x => x.setAttribute('aria-pressed', +x.dataset.cap === cap));
  }
};

// ---- 使い方・マークの見かた(ページ最下部) ----
// 画面の中には結論だけを置き、説明の文章はすべてここに集める。
// のちに「説明ありモード」を作るときは、ここの文章を画面内へ戻す形にする。
const HELP_HTML = `
  <h4>マークの見かた</h4>
  <div class="hlegend">
    <div><i>🛡</i>シールド（残り枚数・使った回数）</div>
    <div><i>⏱</i>かかった時間（秒）</div>
    <div><i>${SWAPMK}</i>交代する／した</div>
    <div><i>▶</i>SPアタックを撃つ指示</div>
    <div><i>🎲</i>ランダムで決まる</div>
    <div><i>📌</i>固定（必ずこれが出る）</div>
    <div><i>⏸️</i>硬直（あいてが動けない）</div>
    <div><i><i class="shadowmark"></i></i>シャドウ</div>
  </div>

${PAGE_ROCKET ? '' : `
  <h4>「ブラフ」の設定</h4>
  <p>ブラフ＝<b>軽いSPアタックをわざと撃ってシールドを使わせる駆け引き</b>。
  環境一覧・対策さがし・パーティ診断では、<b>じぶんとあいての両方に同じ前提</b>を使います。
  既定は<b>しない</b>（運に頼らない見方）。<b>する</b>にするとお互いが駆け引きしてくる見方になります。
  マスターリーグのようにSPを2本持つポケモンが多いほど差が出ます。
  1対1シミュでは、左右のパネルで別々に指定できます。</p>

  <h4>パーティ診断の「平均勝率」</h4>
  <p>環境上位の相手<b>1匹あたり</b>、パーティの何匹が勝てるかを割合で出したものです。
  3匹編成で<b>50％</b>なら「どの相手にも平均1.5匹が勝てる」という意味になります。
  数字が大きいほど、どの相手にも選べる手が多いパーティです（勝てるのが0匹の相手が<b>穴</b>）。</p>

  <h4>パーティ診断の「実戦想定」</h4>
  <p>平均勝率は環境上位50匹を<b>同じ重さ</b>で数えたものですが、実際は<b>上位の相手ほどよく当たります</b>。
  そこで順位の重みを掛けたものが<b>実戦想定</b>です（環境スコアと同じ重みの付け方）。
  よく当たる相手に強いパーティほど、平均勝率より高く出ます。</p>

  <h4>パーティ診断の「🎯 穴チェック」</h4>
  <p><b>1マス＝環境の1匹</b>で、色はその相手に<b>勝てるかどうか</b>です。
  <b>緑（2匹勝ち）</b>＝2匹以上が勝てる／<b>黄（1匹頼み）</b>＝1匹しか勝てない／<b>赤（穴）</b>＝3匹とも勝てない。
  <b>1匹頼み</b>は、その1匹を先に失うとそこが<b>穴になる</b>ということです。</p>
  <p>帯は<b>環境順位のグループ</b>に分かれていて、<b>上の帯ほどよく当たる相手</b>です。
  よく当たるグループほどマスを大きくしてあるので、<b>上に赤や黄があるほど深刻</b>だと形で分かります
  （同じ「穴1匹」でも、1位が相手なのか50位が相手なのかで重さがまるで違うため）。
  凡例をタップするとその相手だけに表を絞り込めます。</p>

  <h4>パーティ診断の「📋 診断」</h4>
  <p>いまの並びが<b>どれだけ弱いか・誰に弱いか・次に何をすればいいか</b>を文でまとめます。
  苦手な相手は<b>名前と環境順位</b>で出します（タイプだけ分かっても次の手は決まらないため）。
  深刻度は<b>環境上位10位に何匹いるか</b>で見ています（使用率の低い相手ばかりなら、急いで埋める必要はありません）。</p>

  <h4>パーティ診断の「3匹の働き」</h4>
  <p><b>横棒は勝ち数そのもの</b>です。環境上位50匹と戦って、
  <b>シールドが残っていれば何勝（序盤🛡⭕）／切れていれば何勝（終盤🛡❌）</b>かを並べています。
  <b>真ん中の線が半分（25匹）</b>なので、<b>線より右なら半分以上に勝てる</b>と読んでください。
  序盤と終盤は<b>同じ50匹と別々に戦った結果</b>なので、2本を足しても50にはなりません。</p>
  <p><b>役割</b>は、その線をどちら側で越えているかで決まります。
  <b>万能</b>＝どちらも半分以上／<b>序盤型</b>＝シールドがあるときだけ／<b>終盤型</b>＝切れてからだけ／
  <b>苦戦</b>＝どちらも半分未満。シールドは<b>SPアタックしか防げない</b>ので、
  実測では<b>高威力のSPを持つほど終盤型</b>、<b>安いSPを撃てる・ノーマルアタックが強いほど序盤型</b>になります。
  <b>3匹が同じ側に寄っていたら、逆の場面を任せられるポケモンがいない</b>ということなので、
  <b>🔧◯◯型を探す</b>を押すと、その型を優先した入れ替え候補が出ます。</p>
  <p>右端の<b>穴+◯</b>は、<b>そのポケモンを抜いたときに増える穴の数</b>です
  （＝その相手に勝てるのがそのポケモンしかいない）。<b>増えない</b>と出たら、
  他の2匹で代われるので入れ替えても穴は増えません。
  行をタップすると、そのポケモンだけが勝てる相手に表を絞り込みます。</p>

  <h4>パーティ診断のシールドの数字</h4>
  <p>🛡のボタンに付く数字は、<b>その枚数で戦ったときの穴の数</b>です。
  わざ構成はいま選んでいる枚数で決めたものを使い回すので、
  「同じ3匹のまま、シールドの枚数だけ変えたらどうなるか」が見られます。</p>

  <h4>パーティ診断の「🔧 入れ替え候補」</h4>
  <p>いまの<b>穴</b>（穴が無ければ<b>1匹頼み</b>以下の対面）を埋められるポケモンを探し、
  <b>どのポケモンと入れ替えると穴が何匹減り、勝率がどう変わるか</b>を出します。
  <b>枠ごとに「①マリルリを替えるなら…」とまとめて、それぞれ3つまで</b>候補を並べます。
  並びは「穴の減り」と「勝率の上がり」の合計順です（穴1匹 ≒ 勝率3ポイントとして扱います）。</p>
  <p>範囲は<b>環境上位</b>（100匹・実戦の定番のわざ構成で計算）と
  <b>全ポケモン</b>（シャドウ込み・約1600匹。わざはダメージ効率で選んだノーマル1本＋SP2本）。
  全ポケモンは数が多いので、<b>穴に強そうな順に絞ってから</b>くらべます（何匹くらべたかは下に出ます）。</p>
  <p>行をタップすると、<b>そこに出ているわざのまま</b>枠に入ります。
  提案の数字はそのわざ構成での結果なので、オートのままだと構成を選び直して数字が変わってしまいます。
  そのため<b>わざはマニュアルに切り替わり</b>、残る2匹も<b>いま出ている構成のまま固定</b>されます
  （＝入れ替えた結果が提案どおりの数字になります）。<b>↩ 元に戻す</b>で1つ前に戻せます。</p>
  <p>入れ替えると<b>続けて次の候補を出します</b>。提案が出なくなるまで繰り返せば、そのリーグでの仕上がりです
  （<b>✅</b>が出ます）。何匹替えて穴と勝率がどう変わったかは<b>入れ替えの記録</b>に残ります
  （リーグやカップを変えると消えます）。</p>

  <h4>パーティ診断の「わざ」ボタン</h4>
  <p><b>白く光っているほうが、いま効いている設定</b>です。タップで切り替わります。</p>
  <p><b>マニュアル</b>（既定）は、枠のわざ欄を自分で選びます。空のままなら効率のよいわざが入ります。
  <b>オート</b>にすると、<b>環境上位にいちばん多く勝てるわざ構成</b>を1匹につき1つ選んで枠に表示します
  （対面ごとに選び直しません）。オート中はわざ欄を操作できません。
  どちらも<b>画面に出ているわざでそのまま計算</b>するので、マスをタップして開く1対1シミュと結果が食い違いません。</p>

  <h4>対策さがしの「範囲」</h4>
  <p>既定は<b>上位50</b>。<b>上位100</b>で51〜100位まで、<b>全ポケモン</b>で順位に関係なく全部（シャドウ込み・約1500匹）から探します。
  あまり使われていないポケモンで刺しにいきたいときは全ポケモンをどうぞ。
  <b>環境一覧・パーティ診断・環境スコアは上位50のまま</b>なので、点数の基準は変わりません。</p>
  <p>全ポケモンのときは、わざを総当たりすると重すぎるので
  <b>そのあいてにいちばん効くノーマル／SPを1本ずつ</b>計算式で選び、名前の下に出しています。
  もっと詰めたいときは行をタップして1対1シミュでわざを変えてみてください。
  表は<b>並び順の上位200件</b>まで出します（全部の件数は表の上に出ます）。</p>`}

  <p style="margin-top:8px">※ 以下は<b>ロケット団戦</b>の説明です（他のモードの説明も順次ここへまとめます）</p>

  <h4>ロケット団戦の勝ち方</h4>
  <p>大事なのは<b>いかに早く倒せるか</b>です。SPアタックは発動に時間がかかるので、
  ノーマルアタックだけで押し切れるならそのほうが速く終わります。
  ただしリーダー戦は撃たないと苦しい場面が多く、サカキ戦は最後の伝説が強いのでほぼ必ず撃つことになります。</p>

  <h4>あいての条件</h4>
  <ul>
    <li>あいては<b>必ずシャドウ</b>です（切り替えできません）</li>
    <li>ステータスは<b>ロケット団専用の計算式</b>で決まります（個体値100%扱い・目安として「PL40の理想個体」の
      およそ攻2.8倍/防1.7倍。<b>リーダーはさらに1.05倍</b>、<b>サカキはさらに1.15倍</b>で、
      ここにシャドウ補正が別途かかります）。実際の数値（CP・攻・防・HP）は<b>あいての欄</b>に出ます</li>
    <li>わざは<b>おぼえるわざからランダム</b>。特別なわざ（レガシー技）は使いません</li>
    <li>したっぱはシールドを使わず、SPアタックの威力は0.6倍。リーダーとサカキは<b>こちらの最初の2発を必ずシールドで防ぎ</b>、威力は等倍です</li>
    <li>あいては同じ個体で2種類のSPアタックを使い分けません</li>
  </ul>

  <h4>硬直（⏸️）と交代のクールタイム</h4>
  <ul>
    <li><b>硬直</b>＝<b>あいてが動けない</b>時間。SPアタックのあと3.5秒、瀕死で交代した直後4秒、手動で交代した直後4.5秒</li>
    <li><b>交代のクールタイム</b>＝<b>自分が次の交代を出せない</b>時間で<b>45秒</b>。硬直とは別のものです</li>
    <li>手動で交代すると自分も0.5秒動けませんが、あいてが4.5秒止まるぶん得になります</li>
  </ul>

  <h4>あいてのわざ全通り</h4>
  <p>あいてのわざはランダムなので決め打ちできません。そこで<b>全通りを試して</b>、どのわざで来ても勝てるかを出しています。
  並び順は<b>キツい順</b>（上ほど危ない）。自分のわざはバトル中に変えられないので、
  <b>全通りに対していちばん強い構成</b>を自動で選び、そのまま相手のわざだけを差し替えています。
  画面の主結果と勝敗表は、<b>いちばんキツいわざで来た場合</b>＝安全側で出しています（水色枠の行）。
  行をタップすると、そのわざで来たときの詳細に切り替わります。</p>

  <h4>おすすめランキング（1対1）</h4>
  <p>あいてを決めると、<b>ノーマルアタックだけで殴ったときに火力が出る順</b>に並べます。
  ロケット団戦は早く倒すほど有利なので、SPアタックを撃たずに押し切れる相手を先に見つけるのが近道です。</p>
  <ul>
    <li>大きい数字は<b>倒しきるまでの秒数</b>、右下の小さい数字は<b>1秒あたりのダメージ</b>です</li>
    <li><b>⚠️</b>が付いたものは、<b>あいてのノーマルアタック次第で先に倒されます</b>。どのわざで負けるかを右に書いています</li>
    <li><b>高火力＋安定</b>に切り替えると、<b>あいてのわざがどれでも先に倒されない</b>ものだけになります</li>
    <li>シールドは<b>2枚とも残っている前提</b>です（SPアタックを撃たないので、まるごとあいてのSPを防ぐのに使えます）</li>
    <li>候補は<b>全ポケモン（理想個体値・PL50）</b>と、<b>★登録リストに入れた自分の個体</b>（★印・自分の個体値とPLで計算）です</li>
    <li>行をタップすると、そのポケモンで<b>シミュレート</b>に切り替わります。シミュレートは<b>SPアタックも使う前提</b>で計算するので、ランキングの秒数とは少し変わります</li>
  </ul>

  <h4>たたかい方の2つ</h4>
  <ul>
    <li><b>1対1</b>… おすすめランキングと、1匹どうしの詳しいシミュレートを切り替えられます</li>
    <li><b>模擬戦</b>… じぶんの3匹とあいての手持ちを通しで戦います。上から順に出し、倒れたら次。シールドはバトル全体で共有し、生き残りはHP・ゲージ・能力変化を引き継ぎます</li>
    <li><b>おすすめ（高火力／高火力＋安定）</b>… どのポケモンを使えばいいか思いつかないときの提案です。タブを押してから<b>じぶんの枠の入力欄をタップ</b>すると、<b>同じ順番のあいて</b>（1匹目↔1匹目…）への<b>対策トップ5</b>が出ます。基準は1対1のランキングと同じ（高火力=ノーマルアタックの火力順・高火力＋安定=あいてのどのわざでも先に倒されないものだけ・⚠=わざ次第で先に倒される）。タップで枠に入り、評価に使ったノーマルアタックがわざ欄にセットされます</li>
  </ul>

  <h4>模擬戦の使い方</h4>
  <p>ポケモンとわざをそろえて<b>▶ バトルスタート！</b>を押すと、バトルが<b>実際と同じ速さ（1ターン=0.5秒）</b>で上から流れ、<b>決断の場面で止まって選択肢が出ます</b>。選ぶとまた流れ出します。画面のいちばん下には、いまの<b>HP・SPゲージ・シールド・能力変化・残り手持ち</b>がつねに見えています。</p>
  <ul>
    <li><b>SPゲージの円</b>は<b>1周=1発ぶん</b>。2周目・3周目は色が変わって重なり、<b>数字はいま撃てる発数</b>です（例: グロウパンチ35なら最大2発＋86%）</li>
    <li>シールドは<b>2枚を全部使う前提</b>です（ロケット団戦では出し惜しみする意味がほぼ無いため、枚数の選択はありません）</li>
  </ul>
  <ul>
    <li><b>⚡ SPアタック</b>… 撃つわざをタップ／<b>＋1〜＋3</b>（ノーマルアタックをそのぶん打ってからもう一度選ぶ）／<b>撃たない</b>（この相手には撃たず、ゲージを次の相手に持ち越す）／<b>おまかせ</b>（AIの判断で進める）</li>
    <li><b>🛡 〜が来る！</b>… シールドで<b>使う</b>か、<b>受ける</b>か（受けた場合のダメージつき）</li>
    <li><b>${SWAPMK} 交代する？</b>… あいての交代直後（硬直中に殴ったあと）に聞かれます</li>
    <li><b>${SWAPMK} 開幕交代</b>… 1匹目の枠のタブをONにすると、バトルスタート直後に交代先を選びます。あいての打ちかけの1発は交代先に入り、あいては4.5秒硬直します（交代クールタイム45秒もここから始まります）</li>
    <li><b>💀 次に出すのは？</b>… 倒されたときの交代先</li>
    <li>決めた場面はタイムラインに<b>チップ</b>で残ります。タップすると<b>その場面まで巻き戻してやり直せます</b>（それより後ろの選択は消えます）</li>
    <li>下のフレームの <b>⏸／×1／⏩</b> で一時停止・倍速（×1×2×4）・次の決断まで飛ばす、ができます。<b>⏹</b>（または上の<b>▶ バトルスタート！</b>）で選んだ手を消して、もう一度はじめからバトルできます。決着後の <b>↻</b> は同じ選択のまま再生し直します</li>
  </ul>
  <h4>わざの決め方</h4>
  <ul>
    <li><b>じぶん</b>… 枠ごとに<b>ノーマルアタック／SPアタック1／SPアタック2</b>を選びます。わざはバトル中に変えられないので、ここで決めたわざで最後まで戦います</li>
    <li>既定では<b>ノーマルアタック・SPアタックともダメージ効率がいちばん高いわざ</b>が選ばれています。ノーマルアタックだけ<b>おまかせ</b>（相手に合わせて自動）も選べます。SP2本目を開放していないなら「なし」にしてください</li>
    <li><b>あいて</b>… ロケット団は<b>おぼえるわざの中からランダムに</b>打ってきます。既定の<b>自動（いちばんキツい）</b>は、全通りのうち<b>こちらにいちばんキツいわざ</b>を引いた前提で計算します（1対1と同じ基準）。わざを決め打ちしたいときは選ぶか、<b>⚙ 詳細</b>の<b>🎲</b>でランダムな引きを再現できます（押すたびに変わります）</li>
    <li><b>⚙ 詳細</b>（おすすめの右）… 使う頻度の低い設定置き場です。<b>確率で能力が上下するわざ</b>の扱い、<b>じぶんの個体値・PL</b>（既定はPL50・個体値100%。「理想個体値」で戻せます）、<b>あいてのわざの🎲ランダム</b>がここにあります</li>
    <li>わざを決め打ちしたときは、結果に<b>🎲 わざ運が最悪でも</b>が添えられ、わざ運がどう転んでも大丈夫かを確かめられます</li>
  </ul>

  <ul>
    <li><b>結果だけ見る</b>（オートバトル行の右）… バトルを流さず、全部おまかせで戦った結果を<b>一気に</b>出します。並んだチップをタップすれば選び直せます。もう一度押すと流れるバトル表示に戻ります</li>
    <li><b>🔎 オートバトル（最速／安定）</b>… <b>押して選んでおき、▶ バトルスタート！で開始</b>すると、決断の組み合わせをAIが自動でさがして再生します（もう一度押すと解除）。<b>最速</b>=勝てる中で決着がいちばん早い手順、<b>安定</b>=勝てる中で手持ちとHPがいちばん残る手順（どちらも「勝てること→倒した数」が最優先）。再生後も続けて手直しできます</li>
    <li>引っ込めたポケモンはHP・ゲージを保ったまま控えに戻り、出し直すと続きから戦います</li>
    <li><b>🎲 わざ運が最悪でも</b>… あいてのわざを決め打ちしたときだけ出ます。対面ごとに<b>こちらがいちばんキツいわざ</b>を引いた場合の結果です（わざ欄が全部「自動」なら主結果がそのまま最悪ケースです）</li>
  </ul>

  <h4>計算の前提</h4>
  <ul>
    <li>ロケット団戦は<b>CP制限なし</b>。じぶんは個体値を理想値・PLを上限まで上げた前提で計算します（★登録リストから呼び出せば自分の個体値・わざで計算します）</li>
    <li>「ねっとう(30%で相手の攻撃⬇)」のような運まかせの効果の扱いは、画面上部で切り替えられます（既定は<b>不発</b>＝運に頼らない見方）</li>
    <li>1ターン＝0.5秒です</li>
  </ul>`;
(() => {
  const tab = document.getElementById('helptab'), body = document.getElementById('helpbody');
  tab.onclick = () => {
    const open = body.style.display === 'none';
    if (open && !body.innerHTML) body.innerHTML = HELP_HTML;
    body.style.display = open ? 'block' : 'none';
    tab.setAttribute('aria-expanded', open);
    tab.textContent = open ? '？ 使い方・マークの見かた（閉じる）' : '？ 使い方・マークの見かた';
  };
})();

// ---- ロケット団戦の設定 ----
// 外部の対面シミュレータに書かれている動き:
//  ・どちらかがSPアタックを撃つと、あいては4ターン(2秒)硬直する
//  ・交代や新しいポケモンが出たとき、あいては6ターン(3秒)硬直する
//  ・したっぱはSPアタックの威力が0.5〜0.7倍(最短で撃つ場合0.6倍として計算)、幹部は1倍
//  ・同じ個体が2種類のSPアタックを使い分けることはない
// ステータスは専用CPM(RCPM)方式(pvp-engine.jsのbuildStats参照)。外部シミュレータの
// 表示実数値20例(3種別)と完全一致することを2026-08-10に確認した。
// シャドウ補正(攻×1.2・防÷1.2)はこの計算には含まれず、通常のポケモンと同じく戦闘計算でかかる
// (この扱いで「シャドウミュウツーPL40攻13のねんりきで4発(3.8発)」という実測と一致する)
// 硬直(2026年3月時点の確定情報。0.5秒=1ターン):
//   SPアタック発動直後 3.5秒=7ターン / 瀕死による交代直後 4秒=8ターン / 手動交代直後 4.5秒=9ターン
//   手動交代のときは自分も0.5秒(1ターン)動けないので、実質は8ターン分の得になる
// team=3枠を使う画面(模擬戦)か / sh=自分のシールド(バトル全体で共有)
// koFoe=あいてが倒れて次が出た直後の硬直 / koMe=自分が倒れて次を出した直後の硬直(どちらも既定8ターン=4秒)
// who=だれと戦うか(シエラ/クリフ/アルロ/サカキ) / sel=その人の何匹目に誰を選んでいるか(候補の番号)
// play=たたかい方('1v1'=1対1 / 'build'=模擬戦(3匹の通し。手を置かなければ自動で戦う))
// team は「じぶん・あいての3枠を使う画面か」を表す(＝模擬戦)
// swapCd=交代のクールタイム(ターン)。一度自分から交代したら、この時間が過ぎるまで次の交代ができない。
// 「あいてが固まる硬直(4.5秒)」とは別物で、こちら側の制約。45秒=90ターン(ユーザー確定)。
// これが無いと「交代を連打してあいてを硬直させ続ける」抜け道が成立してしまう
// whoBy = 種別ごとに最後に選んだ人(リーダーでアルロ→サカキ→リーダー と戻ってもアルロのまま)
// leadSwap=開幕交代(1匹目を出してすぐ交代し、あいての硬直4.5秒を序盤に稼ぐテク)
const RK = { kind: 'grunt', stall: 7, enter: 'first', play: '1v1', team: false, sh: 2, koFoe: 8, koMe: 8, swapCd: 90, who: null, whoBy: {}, sel: {}, leadSwap: false };
// 共有リンクでSPアタックタイミングが指定されていたか(指定があればロケット団戦の既定「撃たない」で上書きしない)
let timingFromUrl = false;
const RK_PLAY = { 0: '1v1', 1: 'build' };
function setPlay(v) { RK.play = v; RK.team = v !== '1v1'; }
const RK_ENTER = {
  first: { foe: 0, me: 0, label: '先頭（開幕）' },
  ko:    { foe: 8, me: 0, label: '倒されて交代' },
  swap:  { foe: 9, me: 1, label: '手動で交代' },
};
// ステータスは専用CPM(RCPM)方式でエンジン(buildStats)が計算する。ここでは種別の係数だけ渡す。
// 2026-08-10確定: 外部シミュレータと20例(3種別)で表示値が完全一致
//   サカキ×1.15 … ペルシアン(CP7956・攻415.88・防228.35・HP160)と一致
//   リーダー×1.05 … チゴラス(CP6417・攻397.66・防190.55・HP136)と一致
const RK_BASE = [1, 1, 1];   // したっぱ: 係数1(RCPM素のまま)
const rkMult = r => RK_BASE.map(v => v * r);
const RK_SPEC = {
  grunt:  { name: 'したっぱ', mult: rkMult(1), sp: 0.6, shields: 0 },
  leader: { name: 'リーダー', mult: rkMult(1.05), sp: 1, shields: 2 },
  boss:   { name: 'サカキ',   mult: rkMult(1.15), sp: 1, shields: 2 },
};
const rkSpec = () => RK_SPEC[RK.kind];
const rkShields = () => rkSpec().shields;   // したっぱはシールドを使わない
// ロケット団の相手(NPC)の共通設定。SPアタックは撃てしだい・硬直あり・ステータスは倍率で決まる。
// opt.stallStart=登場したときの硬直ターン / opt.shields=残りシールド枚数(通しの途中から使う)
function rkCfg(c, opt) {
  opt = opt || {};
  const sp = rkSpec();
  c.npc = true; c.stallSp = RK.stall; c.timing = 'asap';
  c.stallStart = opt.stallStart != null ? opt.stallStart : RK_ENTER[RK.enter].foe;
  c.statMult = sp.mult;   // ステータスはPL40・個体値100%基準の倍率で決まる
  c.spMult = sp.sp;       // したっぱのSPアタックは威力0.6倍
  c.shadow = true;        // ロケット団のポケモンはシャドウ(補正は倍率とは別にかかる)
  delete c.shotPlan; delete c.shotRest;
  if (opt.shields != null) {
    // 連戦の途中: 残っている枚数をそのまま使う(古い順＝先に撃たれたSPから防ぐので指定は不要)
    c.shields = opt.shields;
    delete c.shieldPlan; delete c.shieldRest;
  } else if (sp.shields) { c.shields = 2; c.shieldPlan = [1, 2]; c.shieldRest = false; }
  else { c.shields = 0; delete c.shieldPlan; delete c.shieldRest; }
  return c;
}
const RK_NOTE = {
  grunt: 'したっぱ（ムサシ・コジロウを含む）は<b>シールドを使いません</b>。SPアタックは手加減してくる（威力<b>0.6倍</b>）ものとして計算します。',
  leader: 'リーダー（シエラ・クリフ・アルロ）は<b>こちらの最初の2発のSPアタックを必ずシールドで防ぎます</b>。SPアタックの威力は等倍です。',
  boss: 'サカキは<b>こちらの最初の2発のSPアタックを必ずシールドで防ぎます</b>。SPアタックの威力は等倍です。',
};

// ---- リーダー・サカキの手持ち(内蔵データ) ----
// データは assets/rocket_roster.js。したっぱは相手が多すぎるので内蔵しない(自分で選ぶ)
const RR = window.ROCKET_ROSTER || { updated: '', list: {} };
const rkWhoList = () => (RR.list && RR.list[RK.kind]) || [];
const rkWho = () => rkWhoList().find(w => w.id === RK.who) || null;
// 選んでいる並び(各枠の候補番号)。未選択の枠は先頭の候補にする
const rkSel = w => (RK.sel[w.id] = (RK.sel[w.id] || w.slots.map(() => 0)));
const rkLineup = w => w.slots.map((cands, s) => cands[rkSel(w)[s]] || cands[0]).filter(k => D.pokemon[k]);

// 手持ちの1匹を「あいて」として使う。1対1は右パネル、模擬戦は指定の枠に入れる
// (どちらも表示の作り直しと再計算までここで済ませる)
function rkPutOne(slot, key) {
  if (!D.pokemon[key]) return;
  if (!RK.team) { pick(1, key); return; }   // 1対1: pickがシャドウ固定の表示と再計算までやる
  RKT[slot] = { key, fast: null, c1: null };
  saveRkt(); syncRocket(); run();
}
// その人の手持ちをまるごと呼び出す(連戦なら3枠、1対1なら1匹目)
function rkPutAll() {
  const w = rkWho();
  if (!w) return;
  const line = rkLineup(w);
  if (!RK.team) { if (line[0]) pick(1, line[0]); else { syncRocket(); run(); } return; }
  [0, 1, 2].forEach(i => { RKT[i] = line[i] ? { key: line[i], fast: null, c1: null } : null; });
  saveRkt(); syncRocket(); run();
}
// 手持ちパネルの描画(したっぱのときは丸ごと隠す)
function renderRoster() {
  const box = document.getElementById('rkroster');
  const list = rkWhoList();
  if (!list.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  if (!rkWho()) RK.who = list[0].id;   // 既定はリストの先頭(呼び出しはタップしたときだけ)
  const w = rkWho(), sel = rkSel(w);
  document.getElementById('rkwho').innerHTML = list.map(x =>
    `<button data-w="${x.id}" aria-pressed="${x.id === RK.who}" title="${x.name}の手持ちを${RK.team ? 'あいての3枠' : 'あいての欄'}に呼び出す">${x.name}</button>`).join('');
  const chip = (key, s, j) => {
    const p = D.pokemon[key];
    if (!p) return `<button class="rkchip" disabled>${key}</button>`;
    // 1対1は「いまあいてに入っている1匹」、連戦は「その枠に選んだ1匹」を光らせる
    const on = RK.team ? j === sel[s] : key === S[1].key;
    // ロケット団のあいては全部シャドウなので、チップにはマークを付けない
    // (タイプアイコンと名前のあいだに入って読みにくくなる。あいての入力欄のマークで足りる)
    return `<button class="rkchip${on ? ' on' : ''}" data-s="${s}" data-j="${j}"
      title="シャドウ${p.n}を${RK.team ? `${s + 1}匹目に入れる` : 'あいてにする'}">${p.n}${typeIcons(p, 14)}</button>`;
  };
  // 「固定/ランダム」は文字でなく📌🎲で示す(説明は最下部の「使い方」へ)
  document.getElementById('rklineup').innerHTML = w.slots.map((cands, s) =>
    `<div class="rkslot"><span class="rkslbl">${s + 1}匹目
      <i title="${cands.length < 2 ? '必ずこれが出てきます' : 'この中からランダムで出てきます'}">${cands.length < 2 ? '📌' : '🎲'}</i></span>
      <div class="rkcands">${cands.map((k, j) => chip(k, s, j)).join('')}</div></div>`).join('');
  // 「◯◯時点」の日付は出さない(常に最新に保つ前提。データ側の updated は更新時の目印として残す)
  document.querySelectorAll('#rkwho button').forEach(b => b.onclick = () => {
    RK.who = RK.whoBy[RK.kind] = b.dataset.w;
    rkPutAll();
  });
  document.querySelectorAll('#rklineup .rkchip').forEach(b => b.onclick = () => {
    if (b.disabled) return;
    const s = +b.dataset.s, j = +b.dataset.j;
    rkSel(w)[s] = j;
    rkPutOne(s, w.slots[s][j]);
  });
}

// ---- モード切替(1対1シミュ / 環境一覧) ----
let mode = PAGE_ROCKET ? 'rocket' : 'duel', multiToken = 0;   // ロケット団対策ページはモード固定
// 一覧系3モードの「⚙ 詳細」(ブラフ・能力変化わざ)の開閉
const MDET = { open: false };
function syncMdet() {
  const tab = document.getElementById('mdettab'), body = document.getElementById('mdetbody');
  tab.setAttribute('aria-expanded', MDET.open);
  body.style.display = MDET.open ? '' : 'none';
}
function applyMode() {
  // 環境一覧は「じぶん」だけ、カウンター検索は「あいて」だけ、パーティ診断は専用の3枠を使う
  const rk = mode === 'rocket';
  const rkTeam = rk && RK.team;   // 模擬戦は専用の3枠を使う(1対1の左右パネルは隠す)
  // 1対1のランキング表示のときは「じぶん」を選ぶ必要がない(あいてだけ決めればよい)
  const rkRankView = rk && RK.play === '1v1' && RKR.view !== 'sim';
  const duelBox = document.querySelector('.duel');
  duelBox.style.display = mode === 'party' || rkTeam ? 'none' : '';
  duelBox.classList.toggle('solo', mode === 'multi' || mode === 'counter');   // 片側だけのときは1列で広く使う
  // ロケット団戦はCP制限が無いのでリーグは選ばせない。相手の設定は専用パネルにまとめる
  document.getElementById('leagues').style.display = rk ? 'none' : '';
  document.getElementById('cupwin').style.display = 'none';
  document.getElementById('rocket').style.display = rk ? 'block' : 'none';
  if (rk) syncRocket(); else restoreFoeInputs();
  syncCounterPanel(mode === 'counter');
  sideEl[0].style.display = mode === 'counter' || rkRankView ? 'none' : '';
  sideEl[1].style.display = mode === 'duel' || mode === 'counter' || rk ? '' : 'none';
  duelBox.classList.toggle('solo', mode === 'multi' || mode === 'counter' || rkRankView);
  document.getElementById('multi').style.display = mode === 'multi' ? 'block' : 'none';
  document.getElementById('counter').style.display = mode === 'counter' ? 'block' : 'none';
  document.getElementById('party').style.display = mode === 'party' ? 'block' : 'none';
  document.getElementById('rkteam').style.display = rkTeam ? 'block' : 'none';
  document.getElementById('rkrank').style.display = rkRankView ? 'block' : 'none';
  // 能力変化わざの設定は、どの画面でも「ポケモンの設定の下・結果の上」に置く。
  // 模擬戦と一覧系3モードは「⚙ 詳細」パネルの中にしまう(常時出すと幅と文字を取りすぎる)
  const goptEl = document.getElementById('gopt');
  const bfEl = document.getElementById('gbluff');
  const detTab = document.getElementById('mdettab');
  const detBody = document.getElementById('mdetbody');
  const detWrap = document.getElementById('mdet');
  const listMode = ['multi', 'counter', 'party'].includes(mode);
  // ブラフの設定は環境リストを使う3モードだけ
  bfEl.style.display = listMode ? '' : 'none';
  const detHome = () => {   // 使わないときはタブも中身も入れ物へ戻しておく
    if (detTab.parentElement !== detWrap) detWrap.insertBefore(detTab, detWrap.firstChild);
    if (detBody.parentElement !== detWrap) detWrap.appendChild(detBody);
  };
  if (listMode) {
    if (bfEl.parentElement !== detBody) detBody.appendChild(bfEl);   // ブラフ→能力変化わざの順
    if (goptEl.previousElementSibling !== bfEl) detBody.appendChild(goptEl);
    if (mode === 'party') {
      // パーティ診断はタブを「わざ｜オート」の右へ、中身は見出しのすぐ下(3枠の上)へ置く
      const ph = document.querySelector('#party .phead'), ps = document.querySelector('#party .pslots');
      if (detTab.parentElement !== ph) ph.appendChild(detTab);
      if (detBody.nextElementSibling !== ps) ps.parentElement.insertBefore(detBody, ps);
      detWrap.style.display = 'none';
    } else {
      const anchor = document.getElementById(mode);
      detHome();
      detWrap.style.display = '';
      if (detWrap.nextElementSibling !== anchor) anchor.parentElement.insertBefore(detWrap, anchor);
    }
  } else {
    detHome();
    detWrap.style.display = 'none';
    if (rkTeam) {
      const pr = document.querySelector('#rkdetail .rkdprob');
      if (pr && goptEl.parentElement !== pr) pr.appendChild(goptEl);
    } else {
      const anchor = document.getElementById('result');
      if (goptEl.nextElementSibling !== anchor) anchor.parentElement.insertBefore(goptEl, anchor);
    }
  }
  syncMdet();
  renderRkDetail();
  renderMyPk();   // ★登録リストの中身はモードで変わる(ロケット団戦のあいてはメガ・ゲンシ不可)
  if ((mode !== 'duel' && !rk) || rkTeam || rkRankView) {
    document.getElementById('result').style.display = 'none';
    document.getElementById('tl').style.display = 'none';
    // 模擬戦は「置いた手」ごとURLで共有できるので、コピーボタンは出したままにする
    document.getElementById('share').style.display = RK.play === 'build' ? 'flex' : 'none';
  }
}

// ロケット団戦パネルの表示を状態に合わせる(あいて側の入力欄も整理する)
function syncRocket() {
  const sp = rkSpec();
  document.querySelectorAll('#rkkind button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === RK.kind));
  // 敵硬直は「途中の対面を切り出す」1対1専用の設定。模擬戦は開幕からの通しなので隠す
  if (RK.team) RK.enter = 'first';
  document.getElementById('rkenterrow').style.display = RK.team ? 'none' : '';
  document.querySelectorAll('#rkenter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === RK.enter));
  document.querySelectorAll('#rkmode button').forEach(b => b.setAttribute('aria-pressed', RK_PLAY[b.dataset.v] === RK.play));
  syncFoeSlots();
  renderRoster();   // リーダー・サカキの手持ち(したっぱのときは隠れる)
  // 1対1のときだけ「見かた」の切り替えを出す
  const vr = document.getElementById('rkviewrow');
  vr.style.display = RK.play === '1v1' ? '' : 'none';
  vr.querySelectorAll('#rkviewbtns button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === RKR.view));
  document.getElementById('rkfiltrow').style.display = (RK.play === '1v1' && RKR.view !== 'sim') ? '' : 'none';
  document.querySelectorAll('#rkfilt button').forEach(b => b.setAttribute('aria-pressed', !!RKR[b.dataset.f]));
  // あいての条件(シャドウ・ステータス倍率・シールド枚数・硬直)は画面に出さない。
  // 見て何かを変えられる情報ではないので、説明はすべて最下部の「使い方」へ。
  // 実際の数値(CP・攻・防・HP)はあいてのパネルに出るので、必要ならそちらで足りる。
  // ロケット団のポケモンはステータスの決まり方が違うので、個体値・PLの欄は使わない
  S[1].c2 = null;   // 同じ個体が2種類のSPアタックを使い分けることはない
  // ロケット団はメガ・ゲンシを使ってこない。他モードから持ち越していたら外す
  if (isMega(S[1].key)) { S[1].key = null; S[1].fast = S[1].c1 = null; resetPin(1); sideEl[1].querySelector('input').value = ''; }
  if (S[1].key) {   // 特別なわざ(レガシー技)は打ってこないので、選ばれていたら自動選択に戻す
    const pool = rkPool(S[1].key);
    if (S[1].fast && !pool.fasts.includes(S[1].fast)) S[1].fast = null;
    if (S[1].c1 && !pool.chargeds.includes(S[1].c1)) S[1].c1 = null;
  }
  const el = sideEl[1];
  // ロケット団はシャドウしか使ってこないので、シャドウは常にON(押しても切り替わらない)
  // ロケット団戦は「SPを撃たずに速く倒す」のが基本なので、タイミングの既定は「撃たない」。
  // 共有リンクでタイミングが指定されているときは尊重する
  if (RK.prevTiming == null && !timingFromUrl) {
    RK.prevTiming = S[0].timing;
    S[0].timing = 'never';
    resetSpPlan(0);
  }
  if (RK.prevShadow == null) RK.prevShadow = S[1].shadow;   // 他モードへ戻したときのために覚えておく
  S[1].shadow = true;
  const tab = el.querySelector('.shadowtab');
  tab.setAttribute('aria-pressed', true);
  tab.setAttribute('aria-disabled', true);
  tab.title = 'ロケット団のポケモンは必ずシャドウです（切り替えできません）';
  if (S[1].key) el.querySelector('input').value = 'シャドウ' + D.pokemon[S[1].key].n;
  // シールド(種別で決まる)・タイミング(常に撃てしだい)・連戦(登場の設定で扱う)は選ばせない
  // ★登録リストは「自分の個体値で計算する」ための機能。あいてはNPCで倍率が決まっているので出さない
  ['.ivmode', '.custIv', '.smaxwrap', '.selC2', '.bluffwrap', '.shields', '.custShield',
   '.timing', '.custSp', '.carry', '.custCarry', '.mypkbar', '.mypklist'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = 'none';
  });
  ['.ivmode', '.selC2', '.shields', '.timing', '.carry'].forEach(sel => hideLabelFor(el, sel));
  syncTimingTabs(true);
}
// SPアタックタイミングのタブは画面で出し分ける(2026-08-10ユーザー指示):
//   ロケット団戦 … 「同時」を出さない（硬直があって相手に合わせるのが現実的でない）代わりに「撃たない」
//   GBL         … 従来どおり「同時」まで。「撃たない」は出さない
function syncTimingTabs(rk) {
  sideEl.forEach((el, i) => {
    el.querySelectorAll('.timing button').forEach(b => {
      const hide = rk ? b.dataset.v === 'sync' : b.dataset.v === 'never';
      b.style.display = hide ? 'none' : '';
    });
    // 隠したタブが選ばれたままにならないよう「最適」へ戻す
    if ((rk && S[i].timing === 'sync') || (!rk && S[i].timing === 'never')) {
      S[i].timing = 'optimal';
      resetSpPlan(i);
    }
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[i].timing));
  });
}
// 入力欄のすぐ上の見出し(ラベル)も一緒に隠す/戻す
function hideLabelFor(el, sel, show) {
  const n = el.querySelector(sel);
  const lb = n && n.previousElementSibling;
  if (lb && lb.classList.contains('f')) lb.style.display = show ? '' : 'none';
}
// カウンター検索は「このポケモンがざっくり何に弱いか」を見る画面なので、
// 細かい手順の指定(シールドのﾏﾆｭｱﾙ・SPアタックタイミング・連戦)は出さない(2026-08-11ユーザー指示)。
// 表示を消すだけだと前の設定が裏で効いて結果がズレるので、値も既定へ寄せる(抜けるときに元へ戻す)
const CN = { prev: null };
function syncCounterPanel(on) {
  const el = sideEl[1];
  if (!el) return;
  const planBtn = el.querySelector('.shields button[data-v="plan"]');
  ['.timing', '.carry'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = on ? 'none' : '';
    hideLabelFor(el, sel, !on);
  });
  ['.custShield', '.custCarry', '.custSp'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n && on) n.style.display = 'none';
  });
  if (planBtn) planBtn.style.display = on ? 'none' : '';
  if (on) {
    if (!CN.prev) CN.prev = { timing: S[1].timing, carry: S[1].carry, shieldMode: S[1].shieldMode };
    S[1].timing = 'optimal'; S[1].carry = false;
    if (S[1].shieldMode === 'plan') { S[1].shieldMode = null; S[1].shields = 2; }
    resetSpPlan(1);
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'optimal'));
    el.querySelectorAll('.carry button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'off'));
    el.querySelectorAll('.shields button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(S[1].shields)));
  } else if (CN.prev) {
    S[1].timing = CN.prev.timing; S[1].carry = CN.prev.carry; S[1].shieldMode = CN.prev.shieldMode;
    CN.prev = null;
    resetSpPlan(1);
    el.querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[1].timing));
    el.querySelectorAll('.carry button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === (S[1].carry ? 'on' : 'off')));
  }
}
// ロケット団戦から他のモードへ戻したときに、隠した欄を元に戻す
function restoreFoeInputs() {
  const el = sideEl[1];
  ['.ivmode', '.selC2', '.shields', '.timing', '.carry'].forEach(sel => {
    const n = el.querySelector(sel);
    if (n) n.style.display = '';
    hideLabelFor(el, sel, true);
  });
  el.querySelector('.mypkbar').style.display = '';   // ★登録リストのタブを戻す
  syncTimingTabs(false);
  el.querySelector('.smaxwrap').style.display = (S[1].key && isMega(S[1].key)) ? 'block' : 'none';
  el.querySelector('.bluffwrap').style.display =
    S[1].c2 && !['multi', 'counter', 'party'].includes(mode) ? 'block' : 'none';
  hideLabelFor(el, '.ivmode', true); hideLabelFor(el, '.selC2', true);
  // シャドウ固定を解除し、ロケット団戦に入る前の状態へ戻す
  const tab = el.querySelector('.shadowtab');
  if (RK.prevTiming != null) { S[0].timing = RK.prevTiming; RK.prevTiming = null; resetSpPlan(0); }
  if (RK.prevShadow != null) { S[1].shadow = RK.prevShadow; RK.prevShadow = null; }
  tab.setAttribute('aria-pressed', !!S[1].shadow);
  tab.removeAttribute('aria-disabled');
  tab.title = 'シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする';
  if (S[1].key) el.querySelector('input').value = (S[1].shadow ? 'シャドウ' : '') + D.pokemon[S[1].key].n;
}
// したっぱのあいては内蔵データが無く自分で選ぶので、リーダー・サカキの手持ちで
// 上書きされて消えないように別に覚えておき、したっぱへ戻したときに復元する
const RKG_KEY = 'gbl_rocket_grunt';
const loadRkGrunt = () => { try { const v = JSON.parse(localStorage.getItem(RKG_KEY)); return Array.isArray(v) ? v : null; } catch (e) { return null; } };
const saveRkGrunt = () => { try { localStorage.setItem(RKG_KEY, JSON.stringify(RKT)); } catch (e) {} };
document.querySelectorAll('#rkkind button').forEach(b => b.onclick = () => {
  const v = b.dataset.v;
  if (RK.kind === 'grunt' && v !== 'grunt') saveRkGrunt();   // したっぱの枠を控えておく
  if (RK.who) RK.whoBy[RK.kind] = RK.who;   // 種別ごとに「最後に選んだ人」を覚えておく
  RK.kind = v;
  RK.who = RK.whoBy[v] || null;
  syncRocket();   // ここで renderRoster が走り、だれと戦うかが未選択なら先頭の人になる
  // リーダー・サカキは手持ちが分かっているので、選んだ時点であいての枠に入れる
  if (v !== 'grunt') { if (rkWhoList().length) rkPutAll(); else run(); return; }
  const g = loadRkGrunt();   // したっぱに戻す: 前に自分で選んでいた枠に戻す
  if (g) { [0, 1, 2].forEach(i => RKT[i] = g[i] || null); saveRkt(); syncRocket(); }
  run();
});
document.querySelectorAll('#rkenter button').forEach(b => b.onclick = () => {
  RK.enter = b.dataset.v;
  syncRocket();
  run();
});
// 1対1の見かた(火力ランキング / 高火力＋安定 / シミュレート)
document.querySelectorAll('#rkviewbtns button').forEach(b => b.onclick = () => {
  RKR.view = b.dataset.v;
  syncRocket(); applyMode(); run();
});
// ランキングの絞り込み(シャドウ・メガはそれぞれ独立ON/OFF)
document.querySelectorAll('#rkfilt button').forEach(b => b.onclick = () => {
  RKR[b.dataset.f] = !RKR[b.dataset.f];
  syncRocket(); run();
});
// 1対1 ⇄ 模擬戦
document.querySelectorAll('#rkmode button').forEach(b => b.onclick = () => {
  setPlay(RK_PLAY[b.dataset.v]);
  RB.ans = {}; RBUI.open = null; RBV.cur = 0; RBV.playing = true; RBV.started = false;   // たたかい方を変えたら模擬戦は最初から
  applyMode();
  run();
});
document.querySelectorAll('#modes button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-pressed', x === b));
  mode = b.dataset.m;
  applyMode();
  run();
});

// ---- 確率で能力が上下するわざの扱い(全モード共通・切り替えたら計算し直す) ----
// 説明は最下部の「使い方」へ。ここは選んでいる状態が一言でわかるだけにする
const PROB_NOTE = {
  none: '運まかせの効果は<b>起きない前提</b>',
  avg:  '確率のぶんを<b>平均</b>して反映',
  always: '運まかせの効果が<b>毎回発動する前提</b>',
};
function syncProbNote() {
  document.getElementById('goptnote').innerHTML = PROB_NOTE[SIMOPT.buffMode];
}
// 「ねっとう(30%で相手の攻撃⬇)」のように確率で能力が上下するわざかどうか
const isProbMove = id => { const m = D.moves[id]; return !!(m && m.bf && m.bc < 1); };
// この切り替えは、そういうわざが実際に使われているときだけ出す(使っていないと選ぶ意味がない)
function setProbTab(on) {
  document.getElementById('gopt').style.display = on ? '' : 'none';
}
// 計算に使う設定から、確率わざが混じっているかを見る
const cfgProbMoves = c => [c.fast, c.throw, ...(c.charged || [])].filter(Boolean);
const anyProbMove = cfgs => cfgs.filter(Boolean).some(c => cfgProbMoves(c).some(isProbMove));
// ---- 環境リストから作るポケモンのブラフ(環境一覧のあいて・カウンター検索の候補・パーティ診断のあいて) ----
// エンジンは cfg.bluff 未指定だとブラフするので、必ずこの値を渡すこと(渡し忘れると1対1と食い違う)
let metaBluff = false;
function syncBluffNote() {
  document.getElementById('gbluffnote').innerHTML = metaBluff
    ? '<b>お互いに</b>軽いSPで<b>駆け引きする前提</b>'
    : '<b>お互いにブラフしない前提</b>';
  document.querySelectorAll('#bluffmeta button').forEach(x =>
    x.setAttribute('aria-pressed', (x.dataset.v === '1') === metaBluff));
}
syncBluffNote();
document.querySelectorAll('#bluffmeta button').forEach(b => b.onclick = () => {
  metaBluff = b.dataset.v === '1';
  syncBluffNote(); updateUrl(); run();
});
syncProbNote();
document.querySelectorAll('#prob button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#prob button').forEach(x => x.setAttribute('aria-pressed', x === b));
  SIMOPT.buffMode = b.dataset.v;
  syncProbNote();
  run();
});

// ---- 環境一覧(1対多): 自分1匹×環境上位50匹をシールド0-0/1-1/2-2で一括対戦 ----
function runMulti() {
  const box = document.getElementById('multi');
  const list = cup ? cup.list : ((window.META_LISTS || {})[String(cap)] || []);
  if (!S[0].key) {
    box.innerHTML = '<div class="mtnote">左の<b>じぶん</b>を選ぶと、環境上位' + (list.length || 50) + '匹と一括対戦します</div>';
    return;
  }
  const token = ++multiToken;   // 設定変更で再実行されたら古い計算は中断
  const MV = VIEWS.multi;
  MV.results = [];
  MV.pick = (k, j) => { if (j != null) setBothShields(j); applyMeta(list[k]); };
  const meBase = S[0].ivMode === 'manual' && S[0].mIvs
    ? { key: S[0].key, ivs: S[0].mIvs.slice(), level: S[0].mLevel, shadow: S[0].shadow, cap, ...carryOf(0) }
    : (r => ({ key: S[0].key, ivs: r.ivs, level: r.level, shadow: S[0].shadow, cap, ...carryOf(0) }))(rank1(S[0].key, cap, 0, S[0].maxLv));
  const myTiming = S[0].timing === 'plan' ? 'optimal' : S[0].timing;
  // SPアタック2を選んでいれば、2本を相手に合わせて使い分ける前提で計算する(わざ開放した実戦に合わせる)
  const myPols = policies(S[0].key, polOpts(0));
  const myCfg = (pol, sh) => listSideCfg(0, meBase, pol, sh, myTiming);
  // 左パネルの表示(CP・個体値・PL・わざ)もこのリーグ/カップの内容に更新する
  const pool0 = movePool(S[0].key);
  fillMoves(0, { ...meBase, fast: S[0].fast || S[0].pin.fast || pool0.fasts[0], throw: S[0].c1 || S[0].pin.c1 || pool0.chargeds[0] });
  const myName = (S[0].shadow ? 'シャドウ' : '') + D.pokemon[S[0].key].n;
  box.innerHTML = `<h3>${myName} × 環境上位${list.length}匹${cup ? `（${cup.label}）` : ''}<small class="cnsub">マスをタップ→1対1シミュ</small></h3>
    ${ctlHtml('multi')}
    <table class="mttbl"><tbody><tr><th style="text-align:left">相手</th><th>🛡0-0</th><th>🛡1-1</th><th>🛡2-2</th></tr>
    ${list.map((m, k) => `<tr data-k="${k}"><td class="opname">${k + 1}. ${m.n}</td><td>…</td><td>…</td><td>…</td></tr>`).join('')}
    </tbody></table><div class="mtprog">計算中 0/${list.length}</div>`;
  const rowsEl = [...box.querySelectorAll('tr[data-k]')];
  rowsEl.forEach(tr => tr.onclick = () => applyMeta(list[+tr.dataset.k]));
  updateUrl();
  const prog = box.querySelector('.mtprog');
  const wins = [0, 0, 0], losses = [0, 0, 0], draws = [0, 0, 0];
  // 採用率加重: 環境1位の相手ほど重み大(1位=N点〜最下位=1点)
  const wScore = [0, 0, 0];
  let wSum = 0;
  let idx = 0;
  const step = () => {
    if (token !== multiToken) return;
    const t0 = performance.now();
    while (idx < list.length && performance.now() - t0 < 40) {
      const m = list[idx];
      const r1 = rank1(m.k, cap);
      const opCfg = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
        bluff: metaBluff, fast: m.f || movePool(m.k).fasts[0], charged: [m.c1, m.c2].filter(Boolean) };
      const cells = [0, 1, 2].map(sh => {
        let best = null;
        for (const pol of myPols) {   // 自分のわざはこの対面・このシールド数での最善を採用
          const res = PvpEngine.simulate(D, myCfg(pol, sh), { ...opCfg, shields: sh }, SIMOPT);
          const sc = scoreOf(res, 0);
          if (!best || sc > best.sc) best = { sc, res };
        }
        const r = best.res, w = r.winner;
        return { w, sc: best.sc, pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100) };
      });
      const tds = rowsEl[idx].querySelectorAll('td');
      const wgt = list.length - idx;   // 採用率順の重み
      wSum += wgt;
      cells.forEach((c, j) => {
        if (c.w === 0) { wins[j]++; wScore[j] += wgt; }
        else if (c.w === 'draw') { draws[j]++; wScore[j] += wgt * 0.5; }
        else losses[j]++;
        tds[j + 1].className = c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l';
        tds[j + 1].innerHTML = cellHtml(c);
      });
      // 絞り込み・並び替え用に対面の結果を保存(scは0〜1000の対面スコア=与ダメ+残HP)
      MV.results.push({ idx, m, name: `${idx + 1}. ${m.n}`, cells,
        sc: (cells[0].sc + cells[1].sc + cells[2].sc) / 3,
        nWin: cells.filter(c => c.w === 0).length,
        nLose: cells.filter(c => c.w === 1).length });
      idx++;
    }
    if (idx < list.length) {
      prog.textContent = `計算中 ${idx}/${list.length}`;
      setTimeout(step, 0);
    } else {
      const wl = j => `${wins[j]}勝${losses[j]}敗${draws[j] ? draws[j] + '分' : ''}`;
      const score = envScore((wScore[0] + wScore[1] + wScore[2]) / (wSum * 3));
      prog.innerHTML = `🛡0-0 ${wl(0)} / 🛡1-1 ${wl(1)} / 🛡2-2 ${wl(2)}<br>` +
        `<span class="mtscore" title="環境上位${list.length}匹×シールド0/1/2の勝敗を採用率で加重した点数。勝てない相手が減るほど加速的に上がります（全部に勝っても100にはなりません）">環境スコア ${score.toFixed(1)}<small> /100</small></span>` +
        `<span class="mtscorenote">※スコアはあくまで参考程度に</span>` +
        '';
      bindCtl(box, 'multi');   // 計算が終わったら絞り込み・並び替えを有効化
      applyView(box, 'multi');
    }
  };
  step();
}

// ---- 一括対戦の表: 絞り込み・並び替え(環境一覧とカウンター検索で共用) ----
const VIEWS = {
  multi: {
    results: [], filter: 'all', sort: 'meta', head: '相手',
    filters: [
      { v: 'all',  t: 'すべて',   d: '全ての相手を表示' },
      { v: 'lose', t: '負けあり', d: 'シールド3通りのうち1つでも負け・引き分けがある相手だけ表示' },
      { v: 'bad',  t: '全敗',     d: '3通りとも負けた相手だけ表示（パーティの穴になりやすい相手）' },
    ],
    sorts: [
      { v: 'meta',  t: '環境順',   d: '環境での使用率が高い順（初期表示）' },
      { v: 'bad',   t: '苦手順',   d: '不利な対面が上。大差で負けた相手から並ぶ' },
      { v: 'close', t: '惜しい順', d: 'あと少しで勝てた負け対面が上。個体値やわざの見直しで逆転できる可能性がある相手' },
    ],
  },
  counter: {
    results: [], filter: 'all', sort: 'good', head: '勝てる候補',
    filters: [
      { v: 'all',  t: 'すべて', d: '環境上位の全候補を表示' },
      { v: 'win',  t: '勝ちあり', d: 'シールド3通りのうち1つでも勝てる候補だけ表示' },
      { v: 'best', t: '全勝',   d: '3通りとも勝てる候補だけ表示（安定して有利）' },
    ],
    sorts: [
      { v: 'good', t: '強い順', d: '相手を圧倒できる候補が上（初期表示）' },
      { v: 'meta', t: '環境順', d: '環境での使用率が高い順' },
      { v: 'close', t: '惜しい順', d: 'あと少しで勝てる候補が上。個体値やわざを詰めれば届く可能性がある' },
    ],
  },
  party: {
    results: [], filter: 'all', sort: 'meta', head: '相手', tail: '勝てる数',
    filters: [
      { v: 'all',  t: 'すべて', d: '環境上位の全ての相手を表示' },
      { v: 'hole', t: '穴のみ', d: '3匹とも勝てない相手だけ表示（パーティの穴）' },
      { v: 'thin', t: '1匹以下', d: '勝てるのが1匹だけ（1匹頼み）、または0匹（穴）の相手を表示' },
    ],
    sorts: [
      { v: 'meta',  t: '環境順', d: '環境での使用率が高い順（初期表示）' },
      { v: 'risk',  t: '危険順', d: '勝てる数が少ない相手が上' },
      { v: 'close', t: '惜しい順', d: 'あと少しで勝てた対面が上' },
    ],
    tailHtml: r => `<td class="pcnt c${r.nWin}">${r.nWin}<small>/${r.cells.length}</small></td>`,
  },
};
// 環境スコア: 採用率で加重した勝率 p(0〜1) を 0〜99.9 の点数に直す。
// 「環境からランダムに2回対面したとき、少なくとも1回は勝てる確率」＝ 1-(1-p)^2 の形。
// 勝てない相手が減るほど加速的に伸びるので、上位の実力差が点数に出やすい。
// 99.9倍で頭打ちにしてあるので、全対面に勝っても100点にはならない。
const envScore = p => 99.9 * (1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 2));
const cellHtml = c => (c.w === 'draw' ? '分' : c.w === 0 ? '勝ち' : '負け') +
  `<small>${c.w === 'draw' ? '　' : '残' + c.pct + '%'}</small>`;
// カウンター検索だけの「探す範囲」。環境スコアの基準を動かさないよう、
// 環境一覧・パーティ診断は上位50固定のままにして、逆引きで候補を広げたいときだけ100位まで見る
let cnTop = 50;
const CN_RANGES = [
  { v: '50',  t: '上位50',  d: '環境上位50匹から探す（初期表示）' },
  { v: '100', t: '上位100', d: '51〜100位まで広げて探す。使用率は低いが刺さるポケモン（伝説など）を拾える' },
  { v: 'all', t: '全ポケモン', d: '環境の順位に関係なく全ポケモン（シャドウ込み）から探す。わざはそのあいてにいちばん効く組み合わせを自動で選びます' },
];
function ctlHtml(vn) {
  const V = VIEWS[vn];
  const grp = (cls, items, cur) => `<div class="opts ${cls}">` + items.map(o =>
    `<button data-v="${o.v}" aria-pressed="${o.v === cur}" title="${o.d}" disabled>${o.t}</button>`).join('') + '</div>';
  return `<div class="mtctl" data-v="${vn}">
    <div class="mtctlrow"><span class="lbl">表示</span>${grp('mtfilter', V.filters, V.filter)}</div>
    <div class="mtctlrow"><span class="lbl">並び</span>${grp('mtsort', V.sorts, V.sort)}</div>
    ${vn === 'counter' ? `<div class="mtctlrow"><span class="lbl">範囲</span>${grp('mtrange', CN_RANGES, String(cnTop))}</div>` : ''}
  </div>`;
}
function bindCtl(box, vn) {
  const V = VIEWS[vn];
  box.querySelectorAll('.mtctl button').forEach(b => { b.disabled = false; });
  const bind = (cls, key) => box.querySelectorAll('.' + cls + ' button').forEach(b => b.onclick = () => {
    box.querySelectorAll('.' + cls + ' button').forEach(x => x.setAttribute('aria-pressed', x === b));
    V[key] = b.dataset.v;
    applyView(box, vn);
  });
  bind('mtfilter', 'filter');
  bind('mtsort', 'sort');
  // 範囲を変えると候補そのものが変わるので、表を作り直すのではなく計算からやり直す
  if (vn === 'counter') box.querySelectorAll('.mtrange button').forEach(b => b.onclick = () => {
    if (b.dataset.v === String(cnTop)) return;
    cnTop = b.dataset.v === 'all' ? 'all' : +b.dataset.v;
    runCounter();
  });
}
// 保存済みの結果から、いまの絞り込み・並び替えで表を作り直す
function applyView(box, vn) {
  const V = VIEWS[vn];
  const tb = box.querySelector('.mttbl tbody');
  if (!tb || !V.results.length) return;
  let rows = V.results.slice();
  if (V.filter === 'lose') rows = rows.filter(r => r.nWin < 3);
  else if (V.filter === 'bad') rows = rows.filter(r => r.nLose === 3);
  else if (V.filter === 'win') rows = rows.filter(r => r.nWin > 0);
  else if (V.filter === 'best') rows = rows.filter(r => r.nWin === 3);
  else if (V.filter === 'hole') rows = rows.filter(r => r.nWin === 0);
  else if (V.filter === 'thin') rows = rows.filter(r => r.nWin <= 1);
  // 図から選んだ絞り込み(safe=2匹以上が勝てる / nX=勝てる数がちょうどX /
  // onlyX=X番目のポケモンだけが勝てる相手)
  else if (V.filter === 'safe') rows = rows.filter(r => r.nWin >= Math.min(2, r.cells.length));
  else if (/^n\d$/.test(V.filter)) rows = rows.filter(r => r.nWin === +V.filter.slice(1));
  else if (/^only\d$/.test(V.filter)) {
    const j = +V.filter.slice(4);
    rows = rows.filter(r => r.nWin === 1 && r.cells[j] && r.cells[j].w === 0);
  }
  if (V.sort === 'bad') rows.sort((a, b) => a.sc - b.sc);
  else if (V.sort === 'good') rows.sort((a, b) => b.sc - a.sc);
  else if (V.sort === 'risk') rows.sort((a, b) => a.nWin - b.nWin || a.sc - b.sc);   // 勝てる数が少ない順
  else if (V.sort === 'close') {
    // 惜しい順: 負けを含む対面をスコアの高い順(勝ちに近い順)に並べ、全勝は最後
    const lost = rows.filter(r => r.nWin < 3).sort((a, b) => b.sc - a.sc);
    rows = lost.concat(rows.filter(r => r.nWin === 3).sort((a, b) => b.sc - a.sc));
  }
  // 「全ポケモン」は1500匹を超えるので、並び順の上位だけ描く(全部DOMに置くと重い)。
  // 何件を出していて全部で何件あるかは下の件数表示に必ず出す
  const MAXROW = 200;
  const total = rows.length, cut = total > MAXROW;
  if (cut) rows = rows.slice(0, MAXROW);
  const cols = V.cols || ['🛡0-0', '🛡1-1', '🛡2-2'];
  const head = `<tr><th style="text-align:left">${V.head}</th>` + cols.map(c => `<th>${c}</th>`).join('') +
    (V.tail ? `<th>${V.tail}</th>` : '') + '</tr>';
  tb.innerHTML = head + (rows.length ? rows.map(r =>
    `<tr data-k="${r.idx}"><td class="opname">${r.name}</td>` +
    r.cells.map((c, j) => `<td data-j="${j}" class="${c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l'}">${cellHtml(c)}</td>`).join('') +
    (V.tailHtml ? V.tailHtml(r) : '') + '</tr>').join('')
    : `<tr><td class="mtempty" colspan="${cols.length + 1}">該当するポケモンはいません（この絞り込みでは0件）</td></tr>`);
  // セルをタップしたときは、その列(シールド枚数/パーティのメンバー)も一緒に渡す
  tb.querySelectorAll('tr[data-k] td').forEach(td => td.onclick = () =>
    V.pick(+td.parentNode.dataset.k, td.dataset.j === undefined ? null : +td.dataset.j));
  // いまの絞り込みを、表示タブと図(グリッドの凡例・3匹の働き)の両方に反映する
  box.querySelectorAll('.mtfilter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === V.filter));
  box.querySelectorAll('[data-flt]').forEach(el => el.setAttribute('aria-pressed', el.dataset.flt === V.filter));
  const cnt = box.querySelector('.mtcnt');
  if (cnt) cnt.remove();
  if (V.filter !== 'all' || cut)
    box.querySelector('.mtctl').insertAdjacentHTML('beforeend', '<div class="mtcnt">' +
      (cut ? `${total}件のうち<b>上位${MAXROW}件</b>を表示中（全${V.results.length}匹中）。絞り込みや並びで見たいところを出してください`
           : `${rows.length}件を表示中（全${V.results.length}匹中）`) + '</div>');
}

// 両者のシールド枚数をまとめて変更(一覧のマスをタップしたときに同じ条件へ揃える)
function setBothShields(v) {
  [0, 1].forEach(i => {
    S[i].shieldMode = null; S[i].shields = v;
    sideEl[i].querySelectorAll('.shields button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.v === v));
    sideEl[i].querySelector('.custShield').style.display = 'none';
  });
}

// 一覧の行タップ→そのポケモンを指定した側にセットして1対1シミュへ(i=0:じぶん / 1:あいて)
function applyMeta(m, i) {
  i = i === 0 ? 0 : 1;   // 省略時は「あいて」側
  S[i].key = m.k; S[i].shadow = !!m.s;
  S[i].maxLv = 51; syncSmax(i);
  sideEl[i].querySelector('.shadowtab').setAttribute('aria-pressed', S[i].shadow);
  // 環境リストのわざ構成(SP2本)とブラフの前提をそのまま引き継ぐ→一覧の結果と1対1シミュの結果が一致する。
  // ブラフは一覧では両者に同じ前提を使っているので、左右そろえて渡す
  S[i].fast = m.f || null; S[i].c1 = m.c1 || null; S[i].c2 = m.c2 || null;
  [0, 1].forEach(k => {
    S[k].bluff = metaBluff;
    sideEl[k].querySelectorAll('.bluff button').forEach(x =>
      x.setAttribute('aria-pressed', (x.dataset.v === '1') === metaBluff));
  });
  resetPin(i);   // 前のポケモンで確定したわざを持ち越さない
  resetSpPlan(i);
  S[i].ivMode = 'auto'; S[i].mIvs = null; S[i].mLevel = null;
  sideEl[i].querySelector('input').value = m.n;
  sideEl[i].querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'auto'));
  sideEl[i].querySelector('.custIv').style.display = 'none';
  document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === 'duel'));
  mode = 'duel'; applyMode();
  run();
  document.querySelector('.duel').scrollIntoView({ behavior: 'smooth' });
}

// 「全ポケモン」の候補を、環境リストと同じ形({k,n,s,f,c1})で作る。
// わざは総当たりすると重すぎる(1500匹×構成40通り)ので、
// そのあいてに対する実ダメージから「1ターンあたりが最大のノーマル」「ゲージ効率が最大のSP」を計算式で選ぶ。
// 選んだわざはそのまま行に持たせるので、マスをタップして開く1対1シミュとも食い違わない
function cnAllList(foeBase) {
  const foeSt = { ...PvpEngine.buildStats(D, foeBase), buffs: [0, 0] };
  const megaOk = !!(cup && cup.slug.startsWith('mega'));   // メガはメガカップ以外では使えない
  const out = [];
  for (const key of KEYS) {
    if (isMega(key) && !megaOk) continue;
    const p = D.pokemon[key];
    const r = rank1(key, cap);
    const { fasts, chargeds } = movePool(key);
    if (!fasts.length) continue;
    for (const sh of (p.shadow ? [false, true] : [false])) {
      const me = { ...PvpEngine.buildStats(D, { key, ivs: r.ivs, level: r.level, shadow: sh, cap }), buffs: [0, 0] };
      let f = null, fv = -1, c = null, cv = -1;
      for (const id of fasts) {
        const mv = D.moves[id], v = PvpEngine.damage(D, mv, me, foeSt) / (mv.tn || 1);
        if (v > fv) { fv = v; f = id; }
      }
      for (const id of chargeds) {
        const mv = D.moves[id], v = PvpEngine.damage(D, mv, me, foeSt) / mv.e;
        if (v > cv) { cv = v; c = id; }
      }
      out.push({ k: key, n: (sh ? 'シャドウ' : '') + p.n, s: sh ? 1 : 0, f, c1: c || undefined });
    }
  }
  return out;
}

// ---- 対策さがし(逆引き): 選んだ「あいて」に勝てるポケモンを探す ----
function runCounter() {
  const box = document.getElementById('counter');
  // 基準の上位50に、「上位100」を選んでいるときだけ51〜100位(META_EXT / cup.ext)を足す。
  // 環境一覧・パーティ診断・環境スコアは上位50のままなので、そちらの数値は影響を受けない
  const cnBase = cup ? cup.list : ((window.META_LISTS || {})[String(cap)] || []);
  const cnExt = cup ? (cup.ext || []) : ((window.META_EXT || {})[String(cap)] || []);
  if (!S[1].key) {
    box.innerHTML = '<div class="mtnote">右の<b>あいて</b>を選ぶと、勝てる候補を探します</div>';
    return;
  }
  const token = ++multiToken;
  const CV = VIEWS.counter;
  CV.results = [];
  // 倒したい相手(あいて)の設定。わざは対面ごとに相手側が最善を選ぶ前提で評価する
  const foeBase = S[1].ivMode === 'manual' && S[1].mIvs
    ? { key: S[1].key, ivs: S[1].mIvs.slice(), level: S[1].mLevel, shadow: S[1].shadow, cap, ...carryOf(1) }
    : (r => ({ key: S[1].key, ivs: r.ivs, level: r.level, shadow: S[1].shadow, cap, ...carryOf(1) }))(rank1(S[1].key, cap, 0, S[1].maxLv));
  // 「全ポケモン」は環境リストの代わりに、全ポケモン(シャドウ込み)から同じ形の候補を作る
  const list = cnTop === 'all' ? cnAllList(foeBase) : cnTop === 100 ? cnBase.concat(cnExt) : cnBase;
  CV.pick = (k, j) => {
    // マスをタップしたら、そのマスで使った「あいてのいちばんキツいわざ」も引き継ぐ。
    // これが無いと1対1は「わざを選ぶと結果が出ます」で止まり、表の勝敗を確かめられない
    if (j != null) {
      setBothShields(j);
      const row = CV.results.find(r => r.idx === k);
      const mv = row && row.cells[j] && row.cells[j].mv;
      if (mv) {
        S[1].fast = mv.fast || null; S[1].c1 = mv.c1 || null; S[1].c2 = mv.c2 || null;
        resetPin(1); resetSpPlan(1);
      }
    }
    applyMeta(list[k], 0);
  };
  const foeTiming = S[1].timing === 'plan' ? 'optimal' : S[1].timing;
  // SPアタック2を選んでいれば、あいても2本を使い分ける前提で評価する
  const foePols = policies(S[1].key, polOpts(1));
  const foeCfg = (pol, sh) => listSideCfg(1, foeBase, pol, sh, foeTiming);
  const pool1 = movePool(S[1].key);
  fillMoves(1, { ...foeBase, fast: S[1].fast || S[1].pin.fast || pool1.fasts[0], throw: S[1].c1 || S[1].pin.c1 || pool1.chargeds[0] });
  const foeName = (S[1].shadow ? 'シャドウ' : '') + D.pokemon[S[1].key].n;
  // 候補が多い「全ポケモン」では、計算しながら1行ずつ描くと重いので表は最後にまとめて作る
  const all = cnTop === 'all';
  const sub = all ? `全ポケモン${list.length}匹（シャドウ込み）` : `環境上位${list.length}匹${cup ? `（${cup.label}）` : ''}`;
  box.innerHTML = `<h3>${foeName} に勝てるのは？<small class="cnsub">${sub}・マスをタップ→1対1シミュ</small></h3>
    ${ctlHtml('counter')}
    <table class="mttbl"><tbody><tr><th style="text-align:left">勝てる候補</th><th>🛡0-0</th><th>🛡1-1</th><th>🛡2-2</th></tr>
    ${all ? '' : list.map((m, k) => `<tr data-k="${k}"><td class="opname">${k + 1}. ${m.n}</td><td>…</td><td>…</td><td>…</td></tr>`).join('')}
    </tbody></table><div class="mtprog">計算中 0/${list.length}</div>`;
  const rowsEl = [...box.querySelectorAll('tr[data-k]')];
  rowsEl.forEach(tr => tr.onclick = () => applyMeta(list[+tr.dataset.k], 0));
  updateUrl();
  const prog = box.querySelector('.mtprog');
  const beats = [0, 0, 0];
  let idx = 0;
  const step = () => {
    if (token !== multiToken) return;
    const t0 = performance.now();
    while (idx < list.length && performance.now() - t0 < 40) {
      const m = list[idx];
      const r1 = rank1(m.k, cap);
      const cdCfg = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
        bluff: metaBluff, fast: m.f || movePool(m.k).fasts[0], charged: [m.c1, m.c2].filter(Boolean) };
      const cells = [0, 1, 2].map(sh => {
        let worst = null;   // あいてが最も得をするわざ構成を選ぶ＝候補にとって最も厳しい結果
        for (const pol of foePols) {
          const res = PvpEngine.simulate(D, { ...cdCfg, shields: sh }, foeCfg(pol, sh), SIMOPT);
          const sc = scoreOf(res, 1);
          if (!worst || sc > worst.sc) worst = { sc, res, pol };
        }
        const r = worst.res, w = r.winner, p = worst.pol;
        return { w, sc: scoreOf(r, 0), pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100),
          // タップしたときに1対1へ渡す「あいての構成」
          mv: { fast: p.fast, c1: p.throw || (p.charged && p.charged[0]), c2: (p.charged && p.charged[1]) || null } };
      });
      const tds = rowsEl[idx] ? rowsEl[idx].querySelectorAll('td') : null;
      cells.forEach((c, j) => {
        if (c.w === 0) beats[j]++;
        if (!tds) return;
        tds[j + 1].className = c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l';
        tds[j + 1].innerHTML = cellHtml(c);
      });
      // 全ポケモンのときは並び順の番号に意味が無いので付けず、代わりに使ったわざを添える
      CV.results.push({ idx, m, cells,
        name: all
          ? `${m.n}<small class="cnmv">${D.moves[m.f] ? D.moves[m.f].n : ''}${m.c1 && D.moves[m.c1] ? ' / ' + D.moves[m.c1].n : ''}</small>`
          : `${idx + 1}. ${m.n}`,
        sc: (cells[0].sc + cells[1].sc + cells[2].sc) / 3,
        nWin: cells.filter(c => c.w === 0).length,
        nLose: cells.filter(c => c.w === 1).length });
      idx++;
    }
    if (idx < list.length) {
      prog.textContent = `計算中 ${idx}/${list.length}`;
      setTimeout(step, 0);
    } else {
      prog.innerHTML = `勝てる候補 🛡0-0 <b>${beats[0]}匹</b> / 🛡1-1 <b>${beats[1]}匹</b> / 🛡2-2 <b>${beats[2]}匹</b>`;
      bindCtl(box, 'counter');
      applyView(box, 'counter');
    }
  };
  step();
}

// ---- パーティ診断の図(環境を1匹1マスで並べたグリッド・3匹の働き) ----
const ptWinColor = p => p >= 0.5 ? 'var(--win)' : p >= 0.25 ? 'var(--gold)' : 'var(--lose)';
// 色は3段階だけにする(2026-08-13変更)。旧版は 楽勝/有利/綱渡り/穴 の4段階だったが、
// 「楽勝」と「有利」は緑どうしで見分けが付かないうえ、どちらも次の手が変わらない。
// 手を打つかどうかで分かれるのは「勝てる／1匹しか勝てない／勝てない」の3つ
const ptTier = (k, n) => k === 0 ? 'hole' : k < Math.min(2, n) ? 'n1' : 'safe';
const ptTierColor = t => t === 'hole' ? 'var(--lose)' : t === 'n1' ? 'var(--gold)' : 'var(--win)';
const PT_TIERS = ['safe', 'n1', 'hole'];
// 1匹だけのパーティでは「2匹勝ち」が成り立たないので、そのときだけ「勝てる」に戻す
const ptTierLabel = (t, n) => t === 'hole' ? '穴' : t === 'n1' ? '1匹頼み'
  : n > 1 ? '2匹勝ち' : '勝てる';
const ptTierDesc = (t, n) => t === 'hole' ? (n > 1 ? `${n}匹とも勝てない` : '勝てない')
  : t === 'n1' ? '1匹しか勝てない'
  : n <= 1 ? '勝てる' : n === 2 ? '2匹とも勝てる' : '2匹以上が勝てる';
// 環境の1匹を1マスで表す。
// 旧版は50マスを10列で折り返して並べていたが、「左上ほどよく当たる」という
// 読み方の説明が無いと図の意味がまったく通じなかった(タダシさん指摘・2026-08-13)。
// そこで **順位のグループごとに1本の帯** にした。左から右へ読むだけなので折り返しの説明が要らず、
// よく当たるグループほどマスを大きくしてあるので、重みも形で分かる
function ptGridHtml(res, n) {
  const N = res.length;
  const cell = (r, g) => `<i class="ptgc ${g}" style="background:${ptTierColor(ptTier(r.nWin, n))}"` +
    ` title="${r.idx + 1}位 ${r.m.n}／${ptTierLabel(ptTier(r.nWin, n), n)}` +
    `（${ptTierDesc(ptTier(r.nWin, n), n)}）"></i>`;
  // マスの大きさは g1 > g2 > g3。よく当たるグループほど大きいので、重みが形でも分かる
  const rows = [[0, 10, 'g1'], [10, 25, 'g2'], [25, N, 'g3']]
    .map(([a, b, g]) => [Math.min(a, N), Math.min(b, N), g])
    .filter(([a, b]) => b > a)
    .map(([a, b, g]) => `<div class="ptgrow">` +
      `<span class="ptglb" title="採用率が${a + 1}〜${b}番目のポケモン">${a + 1}-${b}位</span>` +
      `<span class="ptgline">${res.slice(a, b).map(r => cell(r, g)).join('')}</span></div>`).join('');
  const legend = PT_TIERS.map(t => {
    const cnt = res.filter(r => ptTier(r.nWin, n) === t).length;
    if (!cnt && t !== 'hole') return '';   // 穴だけは0でも出す(「穴なし」が分かるように)
    const lbl = ptTierLabel(t, n), desc = ptTierDesc(t, n);
    return `<button data-flt="${t}" aria-pressed="false"` +
      ` title="${desc}相手が${cnt}匹（タップで表を絞り込み）">` +
      `<i style="background:${ptTierColor(t)}"></i><span class="ptglbl">${lbl}</span>` +
      // 1匹だけのパーティは「勝てる／勝てる」と同じ言葉が並ぶので、そのときは添え書きを出さない
      `<b>${cnt}</b>${desc === lbl ? '' : `<small>${desc}</small>`}</button>`;
  }).join('');
  // 並び順は「左から採用率の高い順」。これを書かないと、マスが何の順に並んでいるのか分からない
  // (タダシさん指摘・2026-08-13。「よく当たる順」だけでは左右の並びの話だと伝わらなかった)
  // 見出しは「相性」ではなく「穴チェック」(2026-08-13タダシさん選択)。
  // この図の目的は"穴がないかの点検"なので、ページのタイトル・凡例の「穴」と語彙をそろえる
  return `<div class="ptcard"><div class="ptsec"><span class="ptdic">🎯</span>穴チェック</div>` +
    `<div class="ptgsub">環境<b>${N}匹</b>を<b>左から採用率の高い順</b>に（1マス＝1匹）</div>` +
    `<div class="ptchart"><div class="ptgwrap">${rows}</div>` +
    `<div class="ptglegend">${legend}</div></div></div>`;
}
// ---- 役割の判定(🛡が残る序盤 / 🛡が切れた終盤 の2つの場面) ----
// シールドはSPアタックしか防げないので、この2つの場面で得意なポケモンがはっきり分かれる。
// 環境100匹での実測: 高威力のSPを持つほど終盤型(相関-0.68)、安いSPを撃てるほど序盤型(-0.49)、
// ノーマルアタックが強いほど序盤型(+0.46。シールドがあっても素通りするため)
//
// 指標は **勝ち数そのもの**(2026-08-13にタダシさん指示で変更)。
// 以前は「環境50匹の中でのパーセンタイル(平均収支の順位)」だったが、
// **説明しないと分からない＝理解する努力が要る時点でダメ**という判断。
// 勝ち数なら「50匹中◯勝」とそのまま読めて、真ん中の線がそのまま「半分」になる
const PTR = { sig: '', ops: null };
const ptrSig = () => `${cap}|${cup ? cup.slug : ''}|${metaBluff}|${SIMOPT.buffMode}`;
// その場面での相手側の設定(環境リストの標準構成。表のマスと同じ前提でそろえる)
const ptRoleOps = (list, sh) => list.map(m => {
  const r1 = rank1(m.k, cap);
  return { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
    bluff: metaBluff, shields: sh, fast: m.f || movePool(m.k).fasts[0],
    charged: [m.c1, m.c2].filter(Boolean) };
});
// 🛡2-2(序盤)と🛡0-0(終盤)の相手セット。リーグごとに1回だけ作って使い回す
function ptRoleSets(list) {
  const sig = ptrSig();
  if (PTR.sig !== sig || !PTR.ops) { PTR.sig = sig; PTR.ops = [ptRoleOps(list, 2), ptRoleOps(list, 0)]; }
  return PTR.ops;
}
// その場面での勝ち数(50匹中)。3匹ぶんでも300戦＝数ミリ秒なので、区切らずその場で計算できる
const ptRoleWins = (me, ops, sh) =>
  ops.reduce((a, op) => a + (PvpEngine.simulate(D, { ...me, shields: sh }, op, SIMOPT).winner === 0 ? 1 : 0), 0);
// 役割の名前。色は状態の3色(赤・黄・緑)とぶつからないよう、水色と紫を使う
const PT_ROLES = {
  // 万能は水色と紫の中間の青。緑にすると相性の図の「2匹勝ち」と紛れる
  all:   { t: '万能',   c: '150,180,255' },
  early: { t: '序盤型', c: '67,224,255' },
  late:  { t: '終盤型', c: '176,108,255' },
  weak:  { t: '苦戦',   c: '139,150,194' },
};
// 半分(50匹中25勝)を超えているかで決める。**メーターの真ん中の線がそのまま基準**なので、
// バッジと横棒が必ず一致し、「なぜこの役割なのか」を figure の中で確かめられる
const ptRoleOf = (w2, w0, n) => {
  const half = n / 2;
  return w2 >= half ? (w0 >= half ? 'all' : 'early') : (w0 >= half ? 'late' : 'weak');
};
const ptRoleChip = r => `<span class="ptwrole r-${r}" style="--rc:${PT_ROLES[r].c}">${PT_ROLES[r].t}</span>`;
const ptDistOk = () => !!PTR.ops && PTR.sig === ptrSig();
// 入れ替え候補1匹の役割(相手セットができていないときは null)
function ptCandRole(key, shadow, pol, n) {
  if (!ptDistOk()) return null;
  const me = { ...ptBase({ key, ivMode: 'auto', shadow, maxLv: 51 }), ...pol,
    timing: 'optimal', bluff: metaBluff };
  const w2 = ptRoleWins(me, PTR.ops[0], 2), w0 = ptRoleWins(me, PTR.ops[1], 0);
  return { w2, w0, r: ptRoleOf(w2, w0, n) };
}
// 図で分かることを一言にする(数字を並べるより状況を言い切るほうが頭に入る)
function ptRoleNote(pos, names, n) {
  const half = n / 2;
  const lead = pos.map((p, j) => j).filter(j => pos[j].w2 >= half);
  const close = pos.map((p, j) => j).filter(j => pos[j].w0 >= half);
  const nm = j => `<b>${names[j]}</b>`;
  if (pos.length === 1) return lead.length && close.length ? `どちらの場面も半分以上に勝てます。`
    : lead.length ? `🛡が残るうちに強いタイプです。`
    : close.length ? `🛡が切れてから強いタイプです。` : `どちらの場面も半分に届きません。`;
  if (!lead.length && !close.length) return `どちらの場面も半分に届くポケモンがいません。`;
  if (!lead.length) return `🛡が残るうちに戦えるポケモンがいません。`;
  if (!close.length) return `🛡が切れてから戦えるポケモンがいません。`;
  if (lead.length === 1 && close.length >= 2) return `序盤は${nm(lead[0])}頼み。終盤に${close.length}匹かたよっています。`;
  if (close.length === 1 && lead.length >= 2) return `終盤は${nm(close[0])}頼み。序盤に${lead.length}匹かたよっています。`;
  return `序盤・終盤とも担当がいます。`;
}
// 環境のどのポケモンに苦しんでいるかを、タイプではなく名前で出す。
// 「じめんが苦手」と分かっても次の手は決まらないが、「この4匹に勝てない」なら
// そのまま入れ替え候補につながる（穴が無いときは、勝てるのが1匹だけ＝1匹頼みの対面を出す）
function ptDiagHtml(res, names, n) {
  const N = res.length;
  const holes = res.filter(r => r.nWin === 0);
  const thin = res.filter(r => r.nWin === 1);
  const pct = v => Math.round(v / N * 100);
  // よく当たる相手かどうかで優先度が変わる。平均順位で見ると
  // 「1位に勝てないのに下位が多いから軽い」と逆の判定になるので、上位10位に何匹いるかで見る
  const topHoles = holes.filter(r => r.idx < 10).length;
  let lead = '', detail = '', next = '', flt = '', list = [], ttl = '', tier = '';
  if (holes.length) {
    list = holes; flt = 'hole'; ttl = '勝てない相手'; tier = 'hole';
    const top = holes.slice(0, 3).map(r => `${r.m.n}(${r.idx + 1}位)`).join('・');
    lead = `環境の<b>${holes.length}匹</b>（${pct(holes.length)}%）には、<b>${n}匹とも勝てません</b>。`;
    detail = `とくに <b>${top}</b>${holes.length > 3 ? ' など' : ''}。` +
      (topHoles ? `よく当たる<b>上位10位に${topHoles}匹</b>いるので、優先して埋めたいところです。`
                : '上位の常連は避けられているので、深刻度は高くありません。');
  } else if (thin.length) {
    list = thin; flt = 'n1'; ttl = '1匹頼みの相手'; tier = 'n1';
    // その1匹頼みをだれが支えているか＝失うと崩れる1匹
    const rely = names.map((nm, j) => ({ nm, cnt: thin.filter(r => r.cells[j].w === 0).length }))
      .sort((a, b) => b.cnt - a.cnt)[0];
    lead = `<b>穴はありません</b>。ただし環境の<b>${thin.length}匹</b>（${pct(thin.length)}%）は` +
      `「勝てるのが1匹だけ」の<b>1匹頼み</b>です。`;
    detail = rely && rely.cnt ? `そのうち<b>${rely.cnt}匹</b>は <b>${rely.nm}</b> に頼りきりなので、` +
      `この1匹を先に失うと苦しくなります。` : '';
  } else {
    lead = `どの相手にも<b>2匹以上</b>が勝てます。かなり安定した並びです。`;
  }
  // 次の一手。抜いても穴が増えない子(＝他の子で代われる)があれば、そこが替え時
  const dup = names.map((nm, j) => ({ nm,
    only: res.filter(r => r.nWin === 1 && r.cells[j].w === 0).length })).filter(d => !d.only);
  if (n > 1 && dup.length) next = `→ <b>${dup[0].nm}</b> は他の${n - 1}匹で代われます。` +
    `下の<b>入れ替え候補</b>で、ここを替えると幅が広がりそうです。`;
  else if (holes.length) next = `→ 下の<b>入れ替え候補</b>で、この穴を埋められるポケモンを探せます。`;
  else next = `→ 下の<b>入れ替え候補</b>で、どの枠を替えるといちばん良くなるか比べられます。`;
  const MAX = 10;
  // 外枠と見出しの色は「穴」を基準にした深刻度で決める(2026-08-13変更)。
  // 旧版は「穴も1匹頼みも無い」を緑にしていたが、環境上位30匹から選んだ20通りのパーティで
  // 1匹頼みは10〜24匹・0匹は1つも無く、**緑が事実上出ない**基準だった(タダシさん指摘)。
  // 判定は診断文の深刻度ルールとそろえる: 赤=よく当たる上位10位に穴 / 黄=穴はあるが下位だけ / 緑=穴なし
  const cls = !holes.length ? ' ok' : topHoles ? ' bad' : ' warn';
  // ⚠リストの枠だけは「そこに並んでいるものの色」で固定する(穴=赤 / 1匹頼み=黄)。
  // 相性の図の凡例と同じ色にして、どの区分の話か迷わないようにする
  return `<div class="ptdiag${cls}">` +
    `<div class="ptsec"><span class="ptdic">📋</span>診断</div>` +
    `<p class="ptdtext">${lead}${detail}</p>` +
    (list.length ? `<button class="ptwhead t-${tier}" data-flt="${flt}" aria-pressed="false"` +
      ` title="タップで表をこの相手だけに絞り込みます">⚠ ${ttl} <b>${list.length}匹</b>` +
      `<small>環境での順位つき・タップで絞り込み</small></button>` +
      `<div class="ptwchips t-${tier}">` +
      list.slice(0, MAX).map(r => `<span class="ptwchip"><em>${r.idx + 1}</em>${r.m.n}</span>`).join('') +
      (list.length > MAX ? `<span class="ptwmore">ほか${list.length - MAX}匹</span>` : '') + '</div>' : '') +
    `<p class="ptdnext">${next}</p></div>`;
}
// 3匹それぞれの働きを「1行1匹」で出す(2026-08-13にタダシさん指示で散布図から作り直し)。
// 旧版は左に4象限の散布図・右に勝ち数のバーを置いていたが、
// ①点が番号だけなので誰か分からず左右を往復させられる ②軸の説明が図の外にある
// ③3匹しかないのに2次元を辿らせる、という3点で「ぱっと見」に届いていなかった。
// 役割を**言葉のバッジ**で出せば軸の説明が要らず、視線も上から下の一方向で済む。
// pos = 場面ごとの勝ち数([{w2,w0,r}])
function ptWorkHtml(res, names, pos) {
  if (!names.length) return '';
  const N = res.length;
  const rows = names.map((nm, j) => {
    // その相手に勝てるのがこの1匹だけ ＝ このポケモンを抜くと、そこがそのまま穴になる
    const only = res.filter(r => r.nWin === 1 && r.cells[j].w === 0).length;
    const p = pos && pos[j];
    // 横棒は勝ち数そのもの(50匹中◯勝)。**真ん中の線がちょうど半分**になるので、
    // 「線より右＝半分以上に勝てる」とだけ読めばよく、役割バッジの根拠もその場で確かめられる。
    // 数字は「25」ではなく「25/50」と書く。序盤と終盤は**同じ50匹と別々に戦った結果**なので
    // 2本の合計は50にならない。数字だけだと「内訳なのに50を超える?」と誤読される(タダシさん指摘・2026-08-13)
    const bar = (lbl, w, cls) => `<span class="ptwb ${cls}"><em>${lbl}</em>` +
      `<i><b style="width:${Math.max(3, Math.round(w / N * 100))}%"></b></i><u>${w}<small>/${N}</small></u></span>`;
    return `<button class="ptwk${p ? ' r-' + p.r : ''}" data-flt="only${j}" aria-pressed="false"` +
      (p ? ` style="--rc:${PT_ROLES[p.r].c}"` : '') +
      ` title="${nm}` +
      (p ? `／シールドが残っていれば${N}匹中${p.w2}勝・切れていれば${p.w0}勝` : '') +
      `。抜くと穴が${only}匹ふえます（この${only}匹に勝てるのはこのポケモンだけ）。タップで表を絞り込み">` +
      `<span class="ptwnm"><span class="pcolnum">${j + 1}</span>${nm}</span>` +
      (p ? ptRoleChip(p.r) : `<span class="ptwrole wait">…</span>`) +
      `<span class="ptwbars">${p ? bar('序盤🛡⭕', p.w2, 'e') + bar('終盤🛡❌', p.w0, 'l') : ''}</span>` +
      // 「代役なし6」は何の数か分からなかった(タダシさん指摘・2026-08-13)ので、
      // **抜いたらどうなるか**をそのまま書く。0匹なら入れ替えても穴は増えない
      (only ? `<span class="ptwsub">穴<b>+${only}</b></span>`
            : `<span class="ptwsub dup">増えない</span>`) +
      `</button>`;
  }).join('');
  // 足りない役割があれば、そのまま入れ替え候補の検索につなげる(分析だけで終わらせない)
  let find = '';
  if (pos && names.length > 1) {
    const half = N / 2;
    const early = pos.filter(p => p.w2 >= half).length, late = pos.filter(p => p.w0 >= half).length;
    const want = early <= 1 && early <= late ? 'early' : late <= 1 && late < early ? 'late' : '';
    if (want) find = `<button class="ptwfind" data-want="${want}"` +
      ` title="この型のポケモンを優先して並べた入れ替え候補を出します">🔧 ${PT_ROLES[want].t}を探す</button>`;
  }
  // 列の見出し。**シールドあり/なしという軸が伝わって初めて役割の話が通じる**ので、
  // 小さい注記ではなく、横棒の真上に列見出しとして出す(タダシさん指摘・2026-08-13)
  // 「勝ち数の内訳」は誤り(2026-08-13タダシさん指摘で変更)。"内訳"だと2本の合計が50になると
  // 読めるが、実際は**同じ50匹と場面ごとに別々に戦った結果**。「場面ごとの勝ち数」と書く
  const head = `<div class="ptwk cap"><span></span><span></span>` +
    `<span class="ptwcap">場面ごとの勝ち数<small>それぞれ環境${N}匹と対戦</small></span><span></span></div>` +
    `<div class="ptwk head"><span class="ptwnm">ポケモン</span><span class="ptwrole hd">役割</span>` +
    `<span class="ptwbars"><span class="ptwb e"><em>序盤<b>🛡⭕</b></em></span>` +
    `<span class="ptwb l"><em>終盤<b>🛡❌</b></em></span></span>` +
    `<span class="ptwsub">抜くと</span></div>`;
  return `<div class="ptcard"><div class="ptsec"><span class="ptdic">⚔️</span>3匹の働き</div>` +
    `<div class="ptgsub"><b class="e">シールドが残っている序盤</b>と<b class="l">切れた終盤</b>で` +
    `得意なポケモンが分かれます<small>真ん中の線＝半分（${N / 2}匹）</small></div>` +
    (pos && names.length > 1 ? `<p class="ptwnote">${ptRoleNote(pos, names, N)}${find}</p>` : '') +
    (pos ? head : '') + rows + '</div>';
}

// ---- パーティ3匹の穴チェック ----
// PT[i] = ★登録リストと同じ形({key, ivMode, mIvs, mLevel, fast, c1, c2, shadow, maxLv})
const PT = [null, null, null];
let ptShield = 2;   // 既定は2枚(実戦で最も多い前提)
const PT_KEY = 'gbl_party';
try { const v = JSON.parse(localStorage.getItem(PT_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) PT[i] = m; }); } catch (e) {}
const savePt = () => { try { localStorage.setItem(PT_KEY, JSON.stringify(PT)); } catch (e) {} };
const ptName = m => m ? (m.shadow ? 'シャドウ' : '') + D.pokemon[m.key].n : '';

// 3枠の入力欄を作る(検索・★登録リストからの呼び出し・シャドウ切替・クリア)
// パーティ診断とロケット団戦の連戦で同じ3枠(PT)を共有するので、置き場所(box)を受け取る
// withMoves=true の枠(模擬戦)にだけ、じぶんのわざを選ぶ欄を出す
// ポケモン名の検索候補。「メガ」のように該当が多い語でも埋もれないよう、
// 前方一致(名前の先頭が一致)を先に並べ、件数の上限も広めに取る(一覧はスクロールできる)。
// 上限100は「メガ」の該当数(2026-08時点で56)が今後増えても当分あふれない余裕を見た値
const SEARCH_MAX = 100;
function searchPk(q, ok) {
  const hit = [], sub = [];
  for (const k of KEYS) {
    if (ok && !ok(k)) continue;
    const n = D.pokemon[k].n;
    const i = n.indexOf(q);
    if (i === 0) hit.push(k);
    else if (i > 0) sub.push(k);
    if (hit.length + sub.length >= SEARCH_MAX) break;
  }
  return hit.concat(sub).slice(0, SEARCH_MAX);
}
// mvStore = わざ欄の置き場所。'rbm'=ロケット団の模擬戦(RBM) / 'pt'=パーティ診断(PTに直接持つ) / 無し=わざ欄なし
function buildPartySlots(box, mvStore) {
  if (!box) return;
  const withMoves = !!mvStore, isRk = mvStore === 'rbm';
  box.innerHTML = [0, 1, 2].map(i => `<div class="pslot mine${withMoves ? ' hasmv' : ''}" data-i="${i}" data-mv="${mvStore || ''}">
    <div class="phd"><span class="pnum">${i + 1}匹目</span>${isRk && i === 0
      ? `<button class="plead" aria-pressed="${RK.leadSwap}" title="バトル開始と同時に2匹目か3匹目へ交代します(あいては4.5秒硬直・打ちかけの1発は交代先に入ります)">${SWAPMK}開幕交代</button>` : ''}
      <button class="pshadow" aria-label="シャドウ" title="シャドウ（攻撃1.2倍・防御5/6）としてシミュレートする"><i class="shadowmark"></i></button>
      <button class="pstar" title="★登録リストから選ぶ（自分の個体値・わざで診断できます）">★</button>
      <button class="pclr" title="この枠を空にする">×</button></div>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="popwin pstarwin" style="display:none"></div>
    <div class="pmeta"></div>
    ${withMoves ? '<div class="pmv"></div>' : ''}
  </div>`).join('');
  box.querySelectorAll('.pslot').forEach(el => {
    const i = +el.dataset.i;
    const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) {
        const v = toKata(inp.value);
        if (v !== inp.value) inp.value = v;
      }
      const q = toKata(inp.value.trim());
      if (!q) { list.style.display = 'none'; return; }
      const hits = searchPk(q);
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        list.style.display = 'none';
        PT[i] = { key: d.dataset.k, ivMode: 'auto', shadow: false, maxLv: 51 };
        savePt(); syncPartySlot(i); run();
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
    // 模擬戦: おすすめタブ(高火力/高火力＋安定)が押されていたら、入力欄タップで対策トップ5を出す
    if (isRk) ['focus', 'click'].forEach(ev => inp.addEventListener(ev, () => {
      if (list.style.display !== 'block') rkShowSugg(i, el);
    }));
    el.querySelector('.pshadow').onclick = () => {
      if (!PT[i]) return;
      PT[i].shadow = !PT[i].shadow;
      savePt(); syncPartySlot(i); run();
    };
    el.querySelector('.pclr').onclick = () => { PT[i] = null; savePt(); syncPartySlot(i); run(); };
    const pl = el.querySelector('.plead');
    if (pl) pl.onclick = () => {
      RK.leadSwap = !RK.leadSwap;
      pl.setAttribute('aria-pressed', RK.leadSwap);
      run();   // バトルの署名が変わるので、スタート待ちから仕切り直しになる
    };
    el.querySelector('.pstar').onclick = () => {
      const win = el.querySelector('.pstarwin');
      const open = win.style.display === 'none';
      const saved = loadMyPk();
      win.innerHTML = saved.length
        ? '<div class="popttl">★登録リストから選ぶ</div>' + saved.map((m, k) => {
            const p = D.pokemon[m.key];
            if (!p) return '';
            const iv = m.ivMode === 'manual' && m.mIvs ? `<i>${m.mIvs.join('/')} PL${m.mLevel}</i>` : '<i>理想個体値</i>';
            return `<div class="mypkrow" data-k="${k}"><span>${m.shadow ? 'シャドウ' : ''}${p.n}${iv}</span></div>`;
          }).join('')
        : '<div class="mypkempty">まだ登録がありません。1対1シミュでポケモンを選び「★登録」を押すとここに追加されます</div>';
      win.querySelectorAll('.mypkrow').forEach(row => row.onclick = () => {
        PT[i] = { ...loadMyPk()[+row.dataset.k] };
        win.style.display = 'none';
        savePt(); syncPartySlot(i); run();
      });
      win.style.display = open ? 'block' : 'none';
      el.querySelector('.pstar').setAttribute('aria-pressed', open);
    };
    syncPartySlot(i);
  });
}
// 枠の表示(名前・タイプ・個体値・わざ)を現在の設定に合わせる(同じ枠が複数の画面にあるので全部そろえる)
function syncPartySlot(i) {
  document.querySelectorAll(`.pslot.mine[data-i="${i}"]`).forEach(el => {
    const m = PT[i];
    el.querySelector('.pshadow').setAttribute('aria-pressed', !!(m && m.shadow));
    el.querySelector('input').value = m ? ptName(m) : '';
    const meta = el.querySelector('.pmeta');
    const mvbox = el.querySelector('.pmv');
    if (mvbox) mvbox.innerHTML = '';
    if (!m) { meta.innerHTML = '<span class="pempty">未選択</span>'; return; }
    const p = D.pokemon[m.key];
    const isPt = el.dataset.mv === 'pt';
    const iv = m.ivMode === 'manual' && m.mIvs ? `個体値${m.mIvs.join('/')} PL${m.mLevel}` : '理想個体値';
    const mv = m.fast ? `${D.moves[m.fast].n}${m.c1 ? ' / ' + D.moves[m.c1].n : ''}${m.c2 ? ' / ' + D.moves[m.c2].n : ''}` : 'わざは対面ごとに自動';
    // わざを自分で選べる枠(模擬戦)では、わざは下の欄に出るので文字では書かない。
    // 個体値・PLの文字も出さない(⚙詳細にある。ﾏﾆｭｱﾙ入力中だけ小さく出して分かるようにする)
    meta.innerHTML = mvbox
      ? `${typeIcons(p, 15)}${m.ivMode === 'manual' && m.mIvs ? `<span class="pt2">${iv}</span>` : ''}`
      : `${typeIcons(p, 15)}<span class="pt2">${iv}</span><span class="pt2">${mv}</span>`;
    if (!mvbox) return;
    const cur = isPt ? ptMvOf(i) : rbmOf(i);
    const auto = isPt && ptAuto;   // パーティ診断のオート中はこちらで選ぶので触らせない
    const { fasts, chargeds } = movePool(m.key);
    const opts = (list, sel) => list.map(id =>
      `<option value="${id}"${id === sel ? ' selected' : ''}>${D.moves[id].n}</option>`).join('');
    mvbox.innerHTML = `
      <select class="mvF"${auto ? ' disabled' : ''} title="ノーマルアタック${isPt ? '' : '（おまかせにすると効率のよい構成を自動で選びます）'}">
        ${isPt ? '' : `<option value="auto"${cur.fast === 'auto' ? ' selected' : ''}>おまかせ</option>`}${opts(fasts, cur.fast)}</select>
      ${chargeds.length ? `<select class="mvC1"${auto ? ' disabled' : ''} title="SPアタック1">${opts(chargeds, cur.c1)}</select>
      <select class="mvC2"${auto ? ' disabled' : ''} title="SPアタック2（2本目を開放していないなら「ー」）">
        <option value=""${!cur.c2 ? ' selected' : ''}>ー</option>${opts(chargeds, cur.c2)}</select>`
        : '<span class="pt2">SPアタックなし</span>'}`;
    mvbox.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const c = isPt ? { fast: PT[i].fast, c1: PT[i].c1, c2: PT[i].c2 } : rbmOf(i);
      if (sel.classList.contains('mvF')) c.fast = sel.value;
      else if (sel.classList.contains('mvC1')) c.c1 = sel.value;
      else c.c2 = sel.value;
      if (c.c2 && c.c2 === c.c1) c.c2 = '';   // 同じわざを2本持っても意味がない
      if (isPt) {
        // 選び直したぶんだけ差し替え、空いている欄は今表示している構成で埋める(全部そろって初めて計算できる)
        const now = ptMvOf(i);
        PT[i].fast = c.fast || now.fast; PT[i].c1 = c.c1 || now.c1; PT[i].c2 = c.c2 || '';
        savePt();
      } else saveRbm();
      syncPartySlot(i); run();
    });
  });
}
// ---- パーティ診断のわざ ----
// オート = 環境上位にいちばん多く勝てる構成を1つ選んで固定する（対面ごとに選び直さない）。
// 手動 = 枠のわざ欄で選んだ構成でそのまま計算する。どちらも「画面に出ているわざで戦う」ので結果と食い違わない
// 既定は**マニュアル**(2026-08-13タダシさん指示)。はじめて触る人は自分のわざを入れたいのに、
// オートだと欄が操作できず「入力できない」と見えてしまうため。切り替えた設定は端末に残る
let ptAuto = false;
try { ptAuto = localStorage.getItem('gbl_party_auto') === '1'; } catch (e) {}
const savePtAuto = () => { try { localStorage.setItem('gbl_party_auto', ptAuto ? '1' : '0'); } catch (e) {} };
const PTA = [null, null, null];   // オートで選ばれた構成(計算のたびに更新して枠にも出す)
// その枠でいま使うわざ(オート中はオートの選出、手動なら選んだわざ。未指定は効率のよい既定で埋める)
function ptMvOf(i) {
  const m = PT[i];
  if (!m) return null;
  if (ptAuto && PTA[i] && PTA[i].key === m.key) return PTA[i];
  const d = rbmDefault(m.key);
  return { key: m.key, fast: m.fast || d.fast, c1: m.c1 || d.c1, c2: m.c2 || '' };
}
// policies() の1構成 → 画面のわざ欄の形に直す
const polToMv = (key, pol) => ({ key, fast: pol.fast,
  c1: pol.throw || (pol.charged && pol.charged[0]) || '', c2: (pol.charged && pol.charged[1]) || '' });
// オートで試すわざ構成。SP1本の全通り(policies)に加えて、
// わざ開放でSP2本にした構成も候補に入れる(効率のよいSP上位3本の組み合わせだけ。全部やると重い)
function ptAutoPols(key) {
  const out = policies(key, {});
  const { fasts, chargeds } = movePool(key);
  const dpe = m => D.moves[m].p / D.moves[m].e;
  const top = chargeds.slice().sort((a, b) => dpe(b) - dpe(a)).slice(0, 3);
  for (const f of fasts.slice(0, 5))
    for (let a = 0; a < top.length; a++)
      for (let b = a + 1; b < top.length; b++) out.push({ fast: f, charged: [top[a], top[b]] });
  return out;
}
// 「わざ｜マニュアル／オート」ボタン。両方を出して、オンの側だけ白く点灯させる
// (片方しか出さないと、いまどちらなのか・押すとどうなるのかが読み取れないため)
function syncPtAuto() {
  const b = document.querySelector('#party .ptauto');
  if (b) b.setAttribute('aria-pressed', ptAuto);
}
// パーティのメンバー1匹分の計算用設定(理想個体値/登録した個体値)
// capX=CP上限(ロケット団戦は制限が無いので0を渡す)
function ptBase(m, capX) {
  const cp = capX != null ? capX : cap;
  if (m.ivMode === 'manual' && m.mIvs)
    return { key: m.key, ivs: m.mIvs.slice(), level: m.mLevel, shadow: !!m.shadow, cap: cp };
  const r = rank1(m.key, cp, 0, m.maxLv || 51);
  return { key: m.key, ivs: r.ivs, level: r.level, shadow: !!m.shadow, cap: cp };
}
// シールドの枚数ごとの「穴」(3匹とも勝てない相手)の数。
// わざの構成は選択中の枚数で決まったもの(usedPols)を使い回す＝いま表に出ている3匹の話のまま、
// 枚数だけ変えたらどうなるかを見る。選択中の枚数は表と食い違わないよう PV.results から数える
function ptShieldHoles(list, bases, usedPols, curHoles) {
  const out = { [ptShield]: curHoles };
  [0, 1, 2].filter(sh => sh !== ptShield).forEach(sh => {
    let holes = 0;
    list.forEach(m => {
      const r1 = rank1(m.k, cap);
      const op = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
        bluff: metaBluff, shields: sh, fast: m.f || movePool(m.k).fasts[0],
        charged: [m.c1, m.c2].filter(Boolean) };
      const win = bases.some((b, j) => PvpEngine.simulate(D,
        { ...b, ...usedPols[j], timing: 'optimal', shields: sh, bluff: metaBluff }, op, SIMOPT).winner === 0);
      if (!win) holes++;
    });
    out[sh] = holes;
  });
  return out;
}
// シールドのボタンに、その枚数での穴の数をバッジで出す(nullで消す)
function syncPtShieldBadges(h) {
  document.querySelectorAll('#party .ptsh button').forEach(b => {
    const v = +b.dataset.v, n = h ? h[v] : null;
    let e = b.querySelector('.shhole');
    if (n == null) { if (e) e.remove(); b.removeAttribute('title'); return; }
    if (!e) { e = document.createElement('b'); b.appendChild(e); }
    e.className = 'shhole' + (n ? '' : ' zero');
    e.textContent = n ? '穴' + n : '穴なし';
    b.title = `おたがい${v}枚のとき、3匹とも勝てない相手が${n}匹`;
  });
}
function runParty() {
  const box = document.getElementById('party');
  const body = box.querySelector('.pbody');
  const list = cup ? cup.list : ((window.META_LISTS || {})[String(cap)] || []);
  const idxs = [0, 1, 2].filter(i => PT[i]);
  if (!idxs.length) {
    body.style.minHeight = '';
    body.innerHTML = '<div class="mtnote">上の枠にポケモンを入れると診断します（1〜3匹）</div>';
    return;
  }
  const token = ++multiToken;
  const PV = VIEWS.party;
  // 図から選んだ絞り込みは、パーティが変わると意味が変わるので持ち越さない
  if ((/^n\d$/.test(PV.filter) && (idxs.length < 2 || +PV.filter.slice(1) > idxs.length))
    || (/^only\d$/.test(PV.filter) && +PV.filter.slice(4) >= idxs.length)) PV.filter = 'all';
  PV.results = [];
  PV.cols = idxs.map(i => `<span class="pcolnum">${i + 1}</span>${ptName(PT[i])}`);
  PV.pick = (k, j) => {   // セルをタップ→そのメンバーと相手を同じシールド枚数で1対1シミュへ
    // 表で使ったわざ(オートの選出 or 手動で選んだわざ)をそのまま渡す＝一覧と1対1の結果が食い違わない
    if (j != null && PT[idxs[j]]) { applyMyPk(0, { ...PT[idxs[j]], ...ptMvOf(idxs[j]) }, true); setBothShields(ptShield); }
    applyMeta(list[k], 1);
  };
  const bases = idxs.map(i => ptBase(PT[i]));
  // オート: 全構成を試して「環境にいちばん多く勝てる1構成」をあとで選ぶ / 手動: 選んだ構成だけ
  const pols = idxs.map(i => {
    if (!ptAuto) { const v = ptMvOf(i); return policies(PT[i].key, { fast: v.fast, c1: v.c1 || undefined, c2: v.c2 || undefined }); }
    return ptAutoPols(PT[i].key);
  });
  const win = pols.map(ps => ps.map(() => 0));    // 構成ごとの勝った数
  const tot = pols.map(ps => ps.map(() => 0));    // 構成ごとの合計スコア(同数のときの決め手)
  const grid = [];                                 // grid[相手][メンバー][構成] = マスの中身
  const names = idxs.map(i => ptName(PT[i]));
  // 診断のまとめ(図)は表の上に置く。計算中は進み具合をここに出す。
  // 中身を「計算中…」の1行に入れ替えるとページが一瞬短くなり、ブラウザがスクロール位置を
  // 保てず一番上まで飛ぶ(シールドのボタンを押すたびに視点がガクッと動く・2026-08-13タダシさん報告)。
  // 計算のあいだは前の高さのまま固定しておき、結果が出そろったら固定を外す
  body.style.minHeight = body.offsetHeight ? body.offsetHeight + 'px' : '';
  body.innerHTML = `<div class="mtprog">計算中 0/${list.length}</div>
    <div class="ptswap" id="ptswap"></div>
    ${ctlHtml('party')}
    <table class="mttbl ptbl"><tbody></tbody></table>`;
  const prog = body.querySelector('.mtprog');
  syncPtShieldBadges(null);   // 計算し直すあいだ、前回のバッジは消しておく
  updateUrl();
  let idx = 0;
  const step = () => {
    if (token !== multiToken) return;
    const t0 = performance.now();
    while (idx < list.length && performance.now() - t0 < 40) {
      const m = list[idx];
      const r1 = rank1(m.k, cap);
      // bluff は必ず渡す(エンジンは未指定だとブラフする)。ここを揃えないと、
      // マスの勝敗とタップして開く1対1シミュの結果が食い違う
      const opCfg = { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap, bluff: metaBluff,
        shields: ptShield, fast: m.f || movePool(m.k).fasts[0], charged: [m.c1, m.c2].filter(Boolean) };
      // 構成ごとの結果をすべて控える。どの構成を使うかは全員ぶん出そろってから決める
      grid[idx] = idxs.map((pi, j) => pols[j].map((pol, pk) => {
        // じぶん側もあいてと同じブラフの前提で計算する(マスをタップした1対1にも同じ値を渡す)
        const me = { ...bases[j], ...pol, timing: 'optimal', shields: ptShield, bluff: metaBluff };
        const r = PvpEngine.simulate(D, me, opCfg, SIMOPT);
        const sc = scoreOf(r, 0), w = r.winner;
        if (w === 0) win[j][pk]++;
        tot[j][pk] += sc;
        return { w, sc, pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100) };
      }));
      idx++;
    }
    if (idx < list.length) {
      prog.textContent = `計算中 ${idx}/${list.length}`;
      setTimeout(step, 0);
    } else {
      // 各メンバーの構成を1つに決める(勝った数が最多→同数なら合計スコアが上)。手動なら候補は1つだけ
      const use = idxs.map((pi, j) => {
        let bk = 0;
        pols[j].forEach((pol, pk) => {
          if (win[j][pk] > win[j][bk] || (win[j][pk] === win[j][bk] && tot[j][pk] > tot[j][bk])) bk = pk;
        });
        PTA[pi] = polToMv(PT[pi].key, pols[j][bk]);   // 枠のわざ欄にも同じ構成を出す
        return bk;
      });
      idxs.forEach(pi => syncPartySlot(pi));
      PV.results = grid.map((row, k) => {
        const cells = row.map((byPol, j) => byPol[use[j]]);
        return { idx: k, m: list[k], name: `${k + 1}. ${list[k].n}`, cells,
          sc: cells.reduce((a, c) => a + c.sc, 0) / cells.length,
          nWin: cells.filter(c => c.w === 0).length,
          nLose: cells.filter(c => c.w === 1).length };
      });
      // 平均勝率は「相手1匹に何匹が勝てるか」を割合にして出す(1.50/3匹 = 50％)
      const avg = Math.round(PV.results.reduce((a, r) => a + r.nWin, 0)
        / (PV.results.length * idxs.length) * 100);
      // 実戦想定の勝率: 上位の相手ほど当たりやすいので、環境スコアと同じ採用率の重み(順位の逆順)を掛ける。
      // 引き分けを0.5とするのも環境一覧と同じ扱い
      let wSum = 0, wWin = 0;
      PV.results.forEach((r, k) => {
        const wgt = PV.results.length - k;
        wSum += wgt;
        wWin += wgt * (r.nWin + r.cells.filter(c => c.w === 'draw').length * 0.5);
      });
      const wavg = Math.round(wWin / (wSum * idxs.length) * 100);
      // シールドの枚数ごとの穴の数。わざの構成は選択中の枚数で決めたものを使い回す
      // (枚数ごとに構成を選び直すと、いま表に出ている構成の話ではなくなるため)
      syncPtShieldBadges(ptShieldHoles(list, bases, idxs.map((pi, j) => pols[j][use[j]]),
        PV.results.filter(r => r.nWin === 0).length));
      // 「3匹の働き」の勝ち数(🛡2-2と🛡0-0)。3匹ぶんで300戦＝数ミリ秒なので、その場で計算できる
      // (以前は環境50匹の分布を作っていて0.2〜0.45秒かかり、あとから差し込む必要があった)
      const rops = ptRoleSets(list);
      PTS.pos = bases.map((b, j) => {
        const me = { ...b, ...pols[j][use[j]], timing: 'optimal', bluff: metaBluff };
        const w2 = ptRoleWins(me, rops[0], 2), w0 = ptRoleWins(me, rops[1], 0);
        return { w2, w0, r: ptRoleOf(w2, w0, PV.results.length) };
      });
      // 穴の数はグリッドの凡例に出るので、文字では繰り返さない(平均勝率と前提だけ添える)
      prog.innerHTML = `<div class="ptchart">${ptGridHtml(PV.results, idxs.length)}</div>` +
        ptDiagHtml(PV.results, names, idxs.length) +
        `<div class="ptrole2">${ptWorkHtml(PV.results, names, PTS.pos)}</div>` +
        `<div class="holesub">平均勝率：<b>${avg}％</b>` +
        `<span class="wavg" title="上位の相手ほど当たりやすいので、順位の重みを掛けた勝率です。よく当たる相手に強いパーティほど高くなります（環境スコアと同じ重みの付け方）">実戦想定 <b>${wavg}％</b></span>` +
        `（環境上位${list.length}匹・🛡${ptShield}-${ptShield}）</div>` +
        // わざの前提を先に断っておく(実戦の鉄板構成とちがう結果に見えることがあるため)
        `<div class="holenote">${ptAuto
          ? '※わざは<b>オート選出</b>（枠に表示）／あいては環境の標準構成'
          : '※わざは枠で<b>指定した構成</b>／あいては環境の標準構成'}</div>`;
      // 図をタップしたら表を絞り込む(同じところをもう一度押すと解除)
      const bindFlt = el => el.onclick = () => {
        PV.filter = PV.filter === el.dataset.flt ? 'all' : el.dataset.flt;
        applyView(body, 'party');
      };
      // 「🔧 ◯◯型を探す」= 足りない役割を優先して入れ替え候補を並べ直す
      const bindFind = el => el.onclick = e => {
        e.stopPropagation();                      // 行のタップ(絞り込み)と兼ねない
        PTS.want = el.dataset.want;
        runPtSwap();
        const sw = document.getElementById('ptswap');
        if (sw) sw.scrollIntoView({ block: 'nearest' });
      };
      prog.querySelectorAll('[data-flt]').forEach(bindFlt);
      prog.querySelectorAll('[data-want]').forEach(bindFind);
      // 入れ替え候補は、いまの診断結果を土台にして探す(パーティや条件が変わったら作り直す)
      PTS.base = { list, idxs, bases, results: PV.results,
        usedPols: idxs.map((pi, j) => pols[j][use[j]]) };
      // リーグやカップが変わったら、入れ替えの記録は別の話になるので消す
      const psig = `${cap}|${cup ? cup.slug : ''}`;
      if (PTS.sig !== psig) { PTS.sig = psig; PTS.log = []; PTS.start = null; PTS.undo = null; }
      PTS.rows = null; PTS.busy = false;
      renderPtSwap();
      bindCtl(body, 'party');
      applyView(body, 'party');
      body.style.minHeight = '';   // 結果が出そろったので高さの固定を外す
      // 入れ替えた直後は、続けて次の候補を出す(提案が出なくなるまで繰り返すのが実用の使い方)
      if (PTS.chain) { PTS.chain = false; runPtSwap(); }
    }
  };
  step();
}

// ---- 入れ替え候補: 穴を埋められるポケモンを探して「①を△△に替えると穴が8→1」を出す ----
// 手順は3つ。①埋めたい相手(穴。無ければ1匹頼みの対面)を決める
// ②計算式で見込みのある候補まで絞る(環境上位なら全部・全ポケモンは約1600匹あるので絞る)
// ③絞った候補を環境の全員と戦わせて、入れ替えたあとの穴の数と勝率を出す
// 提案は「そこに出ているわざ構成で戦ったら」の数字なので、入れ替えるときはその構成ごと枠に入れる
// (オートのままだと構成を選び直して数字が変わるため、わざはマニュアルへ切り替える)
// log/start = 入れ替えの記録（はじめの状態からどう良くなったか）。chain = 入れ替えた直後に続けて次の候補を出す
// want = 優先したい役割('early'=序盤型 / 'late'=終盤型)。pos = 3匹の役割(「3匹の働き」で計算したもの)
const PTS = { range: 100, rows: null, base: null, busy: false, undo: null, msg: '', scan: null,
  log: [], start: null, chain: false, sig: '', want: '', pos: null };
// いまのパーティの穴の数と平均勝率(診断結果から数えるだけ。候補を計算していなくても出せる)
function ptNowStat() {
  const B = PTS.base, n = B.idxs.length;
  return { holes: B.results.filter(r => r.nWin === 0).length,
    avg: B.results.reduce((a, r) => a + r.nWin, 0) / (B.results.length * n) };
}
const PTS_RANGES = [
  { v: '100', t: '環境上位', d: '環境上位100匹から探す（初期表示）。人が確認した実戦の定番構成で計算します' },
  { v: 'all', t: '全ポケモン', d: '環境の順位に関係なく全ポケモン（シャドウ込み・約1600匹）から探す。環境上位は必ず候補に入れたうえで、残りは穴に強そうな順に絞ってくらべます' },
];
// 1回に進める時間。画面に出ているあいだは40msずつ区切って操作をふさがないようにするが、
// 他のタブを見ているあいだはブラウザがタイマーを1分に1回まで絞るので、区切りを大きくして進める
// (見えていないので固まっても困らない。これが無いと裏に回した瞬間に計算がほぼ止まる)
const ptSwapSlice = () => (document.hidden ? 1500 : 40);
// シミュにかける候補の数。環境上位(約100匹)は全部くらべる。
// 全ポケモン(約1600匹)は全部やると数十秒かかるので、計算式で見込みのある順に絞る
const ptRoughN = () => (PTS.range === 'all' ? 120 : 999);

// 候補の一覧。すでにパーティにいるポケモンは除く
function ptSwapPool() {
  const used = new Set(PTS.base.idxs.map(i => PT[i].key + (PT[i].shadow ? '|s' : '')));
  if (PTS.range !== 'all') {
    const src = cup ? (cup.list || []).concat(cup.ext || [])
      : ((window.META_LISTS || {})[String(cap)] || []).concat((window.META_EXT || {})[String(cap)] || []);
    return src.filter(m => !used.has(m.k + (m.s ? '|s' : '')));
  }
  // 全ポケモンは構成の総当たりが重すぎるので、わざはダメージ効率で選ぶ
  // (ノーマルは1ターンあたり・SPは効率のよい2本。実戦のわざ開放に合わせてSPは2本持たせる)
  // ただし環境上位に載っているポケモンは、人が確認した確定値の構成をそのまま使う
  const meta = new Map();
  (cup ? (cup.list || []).concat(cup.ext || [])
    : ((window.META_LISTS || {})[String(cap)] || []).concat((window.META_EXT || {})[String(cap)] || []))
    .forEach(m => meta.set(m.k + (m.s ? '|s' : ''), m));
  const megaOk = !!(cup && cup.slug.startsWith('mega'));
  const out = [];
  for (const key of KEYS) {
    if (isMega(key) && !megaOk) continue;
    const p = D.pokemon[key];
    const { fasts, chargeds } = movePool(key);
    if (!fasts.length) continue;
    const dpt = m => D.moves[m].p * (p.ty.includes(D.moves[m].t) ? 1.2 : 1) / (D.moves[m].tn || 1);
    const dpe = m => D.moves[m].p / D.moves[m].e;
    const f = fasts.slice().sort((a, b) => dpt(b) - dpt(a))[0];
    const cs = chargeds.slice().sort((a, b) => dpe(b) - dpe(a)).slice(0, 2);
    for (const sh of (p.shadow ? [false, true] : [false])) {
      const mk = key + (sh ? '|s' : '');
      if (used.has(mk)) continue;
      // meta=1 の印を付けた候補は、計算式の絞り込みに関係なく必ずくらべる
      // (「全ポケモン」の提案が「環境上位」より悪くなるのはおかしいため)
      const mm = meta.get(mk);
      out.push(mm ? { ...mm, meta: 1 }
        : { k: key, n: (sh ? 'シャドウ' : '') + p.n, s: sh ? 1 : 0, f,
            c1: cs[0] || undefined, c2: cs[1] || undefined });
    }
  }
  return out;
}
// 1ターンあたりの総ダメージ(ノーマルを打ちながらSPをためて撃つ想定)。
// シミュを回さずに強さを見積もるための式で、候補を絞る前段にだけ使う
function ptCycleDpt(fastId, chargedId, me, foe) {
  const mf = D.moves[fastId];
  if (!mf) return 0;
  const df = PvpEngine.damage(D, mf, me, foe);
  const mc = chargedId ? D.moves[chargedId] : null;
  const add = mc && mc.e ? PvpEngine.damage(D, mc, me, foe) * ((mf.e || 0) / mc.e) : 0;
  return (df + add) / (mf.tn || 1);
}
const ptBestDpt = (fasts, chargeds, me, foe) => {
  let v = 0;
  for (const f of fasts) {
    if (!chargeds.length) { v = Math.max(v, ptCycleDpt(f, null, me, foe)); continue; }
    for (const c of chargeds) v = Math.max(v, ptCycleDpt(f, c, me, foe));
  }
  return v;
};
// いちばん痛いSPアタックのダメージ。シールドで防げるぶんを耐久に足すのに使う
const ptBestSp = (chargeds, me, foe) => {
  let v = 0;
  for (const c of chargeds) v = Math.max(v, PvpEngine.damage(D, D.moves[c], me, foe));
  return v;
};
// 粗選別用のざっくりした個体(理想個体値で、CP上限に収まる最大レベル)。
// 正規の rank1 は1匹あたり4096通りを調べるので、全ポケモン(約1600匹)に掛けると数秒かかる。
// 候補を並べるだけならこの近似で足りる(本計算に回す数十匹は正規の rank1 で計算し直す)
const PTRB = new Map();
function ptRoughBase(key, shadow) {
  const ck = key + '|' + cap;
  let v = PTRB.get(ck);
  if (!v) {
    const p = D.pokemon[key];
    if (!cap) v = { ivs: [15, 15, 15], level: 50 };
    else {
      const LV = levelsUpTo(51);
      let lo = 0, hi = LV.length - 1, li = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (cpOf(p, 15, 15, 15, D.cpm[String(LV[mid])]) <= cap) { li = mid; lo = mid + 1; } else hi = mid - 1;
      }
      v = { ivs: [15, 15, 15], level: LV[li] };
    }
    PTRB.set(ck, v);
  }
  return { key, ivs: v.ivs, level: v.level, shadow, cap };
}
// 見込みのある候補を計算式で選ぶ。全候補をシミュすると1匹あたり50戦で重すぎるため、
// ここで数十匹まで絞ってから本計算に回す。
// 見るのは「埋めたい相手(穴)への強さ」だけではなく「環境全体への強さ」も。
// 穴だけで選ぶと、そこにしか刺さらない尖ったポケモンばかりが上がってきてパーティが弱くなる
function ptSwapRough(pool, targets, wide, keep) {
  const mk = list => list.map(m => {
    const r1 = rank1(m.k, cap);
    const st = { ...PvpEngine.buildStats(D, { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, cap }),
      buffs: [0, 0] };
    const mp = movePool(m.k);
    const cs = [m.c1, m.c2].filter(Boolean);
    return { st, fasts: m.f ? [m.f] : mp.fasts, chargeds: cs.length ? cs : mp.chargeds };
  });
  const tg = mk(targets), wd = mk(wide);
  const scored = pool.map(c => {
    const me = { ...PvpEngine.buildStats(D, ptRoughBase(c.k, !!c.s)), buffs: [0, 0] };
    const mp = movePool(c.k);
    const cs = [c.c1, c.c2].filter(Boolean);
    const fasts = c.f ? [c.f] : mp.fasts, chargeds = cs.length ? cs : mp.chargeds;
    const sum = (arr, w) => {
      let s = 0;
      for (const t of arr) {
        const mine = ptBestDpt(fasts, chargeds, me, t.st);
        const theirs = ptBestDpt(t.fasts, t.chargeds, t.st, me);
        if (!mine || !theirs) continue;
        // シールドで防げるぶんを耐久に足す。ここを見ないと、
        // 防御が低いかわりに火力で押す強豪(シールドがあれば十分戦える)を落としてしまう
        const myHp = me.hp + ptShield * ptBestSp(t.chargeds, t.st, me);
        const foeHp = t.st.hp + ptShield * ptBestSp(chargeds, me, t.st);
        const myTtk = foeHp / mine;   // 相手を倒すまでのターン数
        // 制限時間(480ターン)内に倒しきれない相手は勝ちようがない。
        // こういう候補はシミュも最後まで回って重いので、ここで落としておく
        if (myTtk > 400) { s -= w; continue; }
        // 倒すまでのターン数と、自分が倒されるまでのターン数の比(1匹に偏らないよう上限を付ける)
        s += w * Math.min(2.5, (myHp / theirs) / myTtk);
      }
      return s;
    };
    // 穴を埋められるかを重く見つつ、環境全体への強さも見る(1匹あたりの平均でそろえる)
    const sc = (tg.length ? sum(tg, 2) / tg.length : 0) + (wd.length ? sum(wd, 1) / wd.length : 0);
    return { c, sc };
  });
  // 環境上位(meta=1)は必ず残し、残りは見込みのある順に keep 匹だけ足す
  const must = scored.filter(x => x.c.meta);
  return must.concat(scored.filter(x => !x.c.meta).sort((a, b) => b.sc - a.sc).slice(0, keep));
}
// 候補1匹を環境の全員と戦わせて、勝てたかどうかの配列を返す。
// 埋めたい相手(hot)を先に戦って、1匹も勝てなければ残りは省く(穴を埋められない候補に50戦かけない)
function ptSwapWins(cb, pol, foes, hot) {
  const me = { ...cb, ...pol, timing: 'optimal', shields: ptShield, bluff: metaBluff };
  const sim = k => PvpEngine.simulate(D, me, foes[k], SIMOPT).winner === 0;
  const wins = new Array(foes.length);
  let any = false;
  for (const k of hot) { wins[k] = sim(k); if (wins[k]) any = true; }
  if (!any) return null;
  for (let k = 0; k < foes.length; k++) if (wins[k] === undefined) wins[k] = sim(k);
  return wins;
}
// 候補を j 番目のメンバーと入れ替えたときの穴の数・勝ち数の合計
function ptSwapScore(wins, rest, j, n) {
  let holes = 0, tot = 0;
  for (let k = 0; k < wins.length; k++) {
    const nw = rest[k][j] + (wins[k] ? 1 : 0);
    tot += nw;
    if (!nw) holes++;
  }
  return { holes, avg: tot / (wins.length * n) };
}
function runPtSwap() {
  const B = PTS.base;
  if (!B || PTS.busy) return;
  PTS.busy = true; PTS.rows = null; PTS.msg = ''; PTS.scan = null;
  renderPtSwap();
  const n = B.idxs.length;
  const foes = B.list.map(m => {
    const r1 = rank1(m.k, cap);
    return { key: m.k, ivs: r1.ivs, level: r1.level, shadow: !!m.s, timing: 'optimal', cap,
      bluff: metaBluff, shields: ptShield, fast: m.f || movePool(m.k).fasts[0],
      charged: [m.c1, m.c2].filter(Boolean) };
  });
  // rest[相手][メンバー] = そのメンバーを抜いた残りが勝てる数(いまの診断結果から作る)
  const rest = B.results.map(r => r.cells.map((c, j) => r.nWin - (c.w === 0 ? 1 : 0)));
  const now = ptNowStat();
  const pool = ptSwapPool();
  const token = ++multiToken;
  const found = [];
  let short = [], hot = [], idx = 0;
  // ①埋めたい相手(穴。無ければ1匹頼みの対面)を決めて、そこに強い候補だけを計算式で選ぶ
  const step0 = () => {
    if (token !== multiToken) { PTS.busy = false; return; }
    let tg = B.results.filter(r => r.nWin === 0);
    if (!tg.length) tg = B.results.filter(r => r.nWin <= 1);
    if (!tg.length) tg = B.results.slice(0, 10);
    hot = tg.map(r => r.idx);
    // 環境全体への強さは、採用率の高い上位20匹で見る(全員だと計算式でも重い)
    short = ptSwapRough(pool, tg.map(r => r.m), B.list.slice(0, 20), ptRoughN());
    PTS.scan = { pool: pool.length, short: short.length, target: tg.length };
    setTimeout(step1, 0);
  };
  // ②絞った候補を環境の全員と戦わせて、入れ替えたときの穴の数と勝率を出す
  const step1 = () => {
    if (token !== multiToken) { PTS.busy = false; return; }
    const t0 = performance.now();
    while (idx < short.length && performance.now() - t0 < ptSwapSlice()) {
      const { c } = short[idx++];
      // 本計算はここから。個体値は正規の rank1(CP上限内でいちばん強い個体)で計算し直す
      const cb = ptBase({ key: c.k, ivMode: 'auto', shadow: !!c.s, maxLv: 51 });
      const pol = { fast: c.f || movePool(c.k).fasts[0], charged: [c.c1, c.c2].filter(Boolean) };
      const wins = ptSwapWins(cb, pol, foes, hot);
      if (!wins) continue;   // 埋めたい相手に1匹も勝てない＝入れ替える意味がない
      // 枠ごとに「そのポケモンと入れ替えたらどうなるか」を全部控える(あとで枠ごとにまとめて出す)
      const gains = [];
      for (let j = 0; j < n; j++) {
        const s = ptSwapScore(wins, rest, j, n);
        // いまより悪くなる入れ替えは出さない(穴が増える・勝率が下がる)
        if (s.holes < now.holes || (s.holes === now.holes && s.avg > now.avg)) gains.push({ ...s, j });
      }
      if (gains.length) found.push({ c, pol, gains });
    }
    if (idx < short.length) {
      ptSwapProg(`くらべています ${idx}/${short.length}`);
      setTimeout(step1, 0);
    } else {
      // 並びは「穴がどれだけ減るか」と「勝率がどれだけ上がるか」の合計。
      // 穴だけで並べると、穴を1匹減らすかわりに勝率を大きく落とす候補が上に来てしまう
      // (穴1匹 ≒ 勝率3ポイントとして扱う)
      const base = r => (now.holes - r.holes) * 3 + (r.avg - now.avg) * 100;
      // 役割(序盤型/終盤型)を出す。1匹あたり100戦かかるので、見込みの高い上位だけにする。
      // 「◯◯型を探す」を押しているときは、合う候補に穴1匹ぶん(3点)の下駄をはかせる。
      // 並べ替えではなく下駄にするのは、型が合うだけで中身の悪い候補を上に出さないため
      const ROLE_MAX = 60;
      const roles = new Map();
      const rkey = c => c.k + (c.s ? '|s' : '');
      if (ptDistOk())
        found.map(r => ({ r, g: Math.max(...r.gains.map(base)) })).sort((a, b) => b.g - a.g)
          .slice(0, ROLE_MAX).forEach(({ r }) => {
            const v = ptCandRole(r.c.k, !!r.c.s, r.pol, B.list.length);
            if (v) roles.set(rkey(r.c), v);
          });
      const half = B.list.length / 2;
      const fits = ro => !!ro && (PTS.want === 'early' ? ro.w2 >= half : ro.w0 >= half);
      const gain = r => base(r) + (PTS.want && fits(r.role) ? 3 : 0);
      // 「①マリルリを替えるなら A / B / C」と枠ごとにまとめる。
      // 総合順に混ぜて並べると、どのポケモンを替える話なのか読み取りづらい
      const bySlot = new Map();
      found.forEach(r => r.gains.forEach(g => {
        const a = bySlot.get(g.j) || [];
        a.push({ key: r.c.k, name: r.c.n, shadow: !!r.c.s, holes: g.holes, avg: g.avg,
          mv: polToMv(r.c.k, r.pol), role: roles.get(rkey(r.c)) || null });
        bySlot.set(g.j, a);
      }));
      PTS.rows = [...bySlot.entries()]
        .map(([j, arr]) => ({ j: +j, cands: arr.sort((a, b) => gain(b) - gain(a)).slice(0, 3) }))
        .sort((a, b) => gain(b.cands[0]) - gain(a.cands[0]));
      PTS.now = now;
      PTS.busy = false; PTS.msg = '';
      renderPtSwap();
    }
  };
  ptSwapProg('候補を絞っています…');
  setTimeout(step0, 0);
}
// 計算中の進み具合。枠ごと描き直すと下の表まで並べ直しになって重いので、文字だけ差し替える
function ptSwapProg(msg) {
  PTS.msg = msg;
  const e = document.querySelector('#ptswap .ptswmsg');
  if (e) e.textContent = msg; else renderPtSwap();
}
// 入れ替えの記録。はじめの状態から何匹替えて、穴と勝率がどう変わったかをまとめて出す
// (提案が出なくなるまで繰り返す使い方をするので、どこから来たのかが見えるようにする)
function ptSwapLogHtml() {
  if (!PTS.log.length || !PTS.start) return '';
  const s = ptNowStat();
  const arrow = (a, b, less) => `<b>${a}</b><em>→</em>` +
    `<b class="${(less ? b < a : b > a) ? 'good' : ''}">${b}</b>`;
  return `<div class="ptswlog"><div class="ptttl">入れ替えの記録<small>／${PTS.log.length}匹</small></div>` +
    PTS.log.map(l => `<div class="ptswlogrow"><span class="pcolnum">${l.i + 1}</span>` +
      `<s>${l.from}</s><i class="swapmark"></i><b>${l.to}</b></div>`).join('') +
    `<div class="ptswlogsum"><small>穴</small>${arrow(PTS.start.holes, s.holes, true)}` +
    `<span class="sep">／</span><small>勝率</small>` +
    `${arrow(Math.round(PTS.start.avg * 100), Math.round(s.avg * 100), false)}<small>％</small></div></div>`;
}
// 入れ替え候補の表示(ボタン→計算中→結果)。パーティが変わるたびに作り直す
function renderPtSwap() {
  const box = document.getElementById('ptswap');
  if (!box || !PTS.base) return;
  const B = PTS.base;
  const names = B.idxs.map(i => ptName(PT[i]));
  const range = `<div class="opts ptswrange">` + PTS_RANGES.map(o =>
    `<button data-v="${o.v}" aria-pressed="${o.v === String(PTS.range)}" title="${o.d}">${o.t}</button>`).join('') + '</div>';
  // 「元に戻す」は、入れ替えたポケモンがまだ枠にいるときだけ出す
  // (そのあと自分で枠を変えたなら、戻す先はもう意味がない)
  const u = PTS.undo;
  const canUndo = u && PT[u.i] && PT[u.i].key === u.key && !!PT[u.i].shadow === !!u.shadow;
  const head = `<div class="ptswbar"><button class="ptswbtn" ${PTS.busy ? 'disabled' : ''}` +
    ` title="いまの穴を埋められるポケモンを探して、どのメンバーと入れ替えると何匹減るかを出します">🔧 入れ替え候補</button>${range}` +
    // どの型を優先して並べているかを出す(タップで解除)。押した覚えのない並び順にならないように
    (PTS.want ? `<button class="ptswwant" style="--rc:${PT_ROLES[PTS.want].c}"` +
      ` title="この型を優先して並べています（タップで解除）">${PT_ROLES[PTS.want].t}を優先 ✕</button>` : '') +
    (canUndo ? `<button class="ptswundo" title="入れ替える前のポケモンに戻します">↩ 元に戻す</button>` : '') + '</div>';
  let body = '';
  if (PTS.busy) body = `<div class="ptswmsg">${PTS.msg || '計算中…'}</div>`;
  else if (PTS.rows && !PTS.rows.length) {
    // 探したけれど、いまより良くなる入れ替えが無かった＝ここが仕上がり
    const s = ptNowStat();
    body = `<div class="ptswdone"><b>${s.holes ? '✅ これ以上よくなる入れ替えはありません' : '✅ 穴なしで仕上がりました'}</b>` +
      `<small>いま 穴${s.holes}・勝率${Math.round(s.avg * 100)}％` +
      `（${PTS.range === 'all' ? '全ポケモン' : '環境上位'}から探した結果）</small></div>`;
  }
  else if (PTS.rows && PTS.rows.length) {
    const now = PTS.now;
    body = '<div class="ptswlist">' + PTS.rows.map((g, gi) => {
      const rows = g.cands.map((r, i) => {
        const mv = [r.mv.fast, r.mv.c1, r.mv.c2].filter(Boolean)
          .map(m => D.moves[m] ? D.moves[m].n : '').filter(Boolean).join(' / ');
        return `<button class="ptswrow" data-g="${gi}" data-i="${i}"` +
          ` title="${names[g.j]}を${r.name}に替えたときの診断結果です（タップで枠に入れます）">` +
          `<span class="ptswnm"><b>${r.name}</b><small>${mv}</small></span>` +
          (r.role ? ptRoleChip(r.role.r) : '') +
          `<span class="ptswd"><small>穴</small>${now.holes}<em>→</em>` +
          `<b class="${r.holes < now.holes ? 'good' : ''}">${r.holes}</b></span>` +
          `<span class="ptswd"><small>勝率</small>${Math.round(now.avg * 100)}<em>→</em>` +
          `<b class="${r.avg > now.avg ? 'good' : ''}">${Math.round(r.avg * 100)}</b><small>％</small></span>` +
          `</button>`;
      }).join('');
      return `<div class="ptswgrp"><div class="ptswgh"><span class="pcolnum">${B.idxs[g.j] + 1}</span>` +
        `<b>${names[g.j]}</b>を替えるなら</div>${rows}</div>`;
    }).join('') +
      `<div class="ptswnote">タップすると、下に出ているわざのまま枠に入ります（わざは<b>マニュアル</b>に切り替わります）` +
      (PTS.scan ? '<br>' + (PTS.scan.short >= PTS.scan.pool
        ? `${PTS.scan.pool}匹すべてとくらべました`
        : `${PTS.scan.pool}匹から、環境上位＋穴に強そうな<b>${PTS.scan.short}匹</b>をくらべました`)
        : '') + '</div></div>';
  }
  box.innerHTML = head + body + ptSwapLogHtml();
  const btn = box.querySelector('.ptswbtn');
  if (btn) btn.onclick = () => runPtSwap();
  box.querySelectorAll('.ptswrange button').forEach(b => b.onclick = () => {
    if (b.dataset.v === String(PTS.range) || PTS.busy) return;
    PTS.range = b.dataset.v === 'all' ? 'all' : +b.dataset.v;
    runPtSwap();
  });
  const wt = box.querySelector('.ptswwant');
  if (wt) wt.onclick = () => { PTS.want = ''; runPtSwap(); };
  const un = box.querySelector('.ptswundo');
  if (un) un.onclick = () => {
    const u = PTS.undo;
    PTS.undo = null;
    PT[u.i] = u.was;
    PTS.log.pop();                               // 記録も1つ戻す
    if (!PTS.log.length) PTS.start = null;
    if (u.auto && !ptAuto) { ptAuto = true; savePtAuto(); syncPtAuto(); }
    savePt();
    [0, 1, 2].forEach(i => syncPartySlot(i));
    run();
  };
  box.querySelectorAll('.ptswrow').forEach(el => el.onclick = () => {
    const g = PTS.rows[+el.dataset.g], r = g.cands[+el.dataset.i], pi = B.idxs[g.j];
    PTS.undo = { i: pi, was: PT[pi] ? { ...PT[pi] } : null, auto: ptAuto, key: r.key, shadow: r.shadow };
    // はじめの状態を控えて、入れ替えを記録に積む。続けて次の候補も出す
    if (!PTS.log.length) PTS.start = ptNowStat();
    PTS.log.push({ i: pi, from: names[g.j], to: r.name });
    PTS.chain = true;
    // 提案は「このわざ構成で戦ったら」の数字なので、オートのままだと構成を選び直して数字が変わる。
    // 残る2匹はいま出ている構成をそのまま欄に書き込んでからマニュアルへ切り替える
    // (こうすると、入れ替えた結果が提案どおりの数字になる＝表示と計算が食い違わない)
    if (ptAuto) {
      // 書き込むのは「診断で実際に使った構成」(usedPols)。ここで ptMvOf を通すと、
      // 前に手で選んで PT に残っていたわざのほうが優先され、オートで出ていた構成とすり替わる
      // (実際にチャーレムがサイコカッター型→カウンター型に変わり、提案の数字と食い違った)
      B.idxs.forEach((slot, j) => {
        if (!PT[slot] || !B.usedPols[j]) return;
        const mv = polToMv(PT[slot].key, B.usedPols[j]);
        PT[slot].fast = mv.fast; PT[slot].c1 = mv.c1; PT[slot].c2 = mv.c2 || '';
      });
      ptAuto = false; savePtAuto(); syncPtAuto();
    }
    PT[pi] = { key: r.key, ivMode: 'auto', shadow: r.shadow, maxLv: 51,
      fast: r.mv.fast, c1: r.mv.c1, c2: r.mv.c2 || '' };
    savePt();
    [0, 1, 2].forEach(i => syncPartySlot(i));
    run();
  });
}

// ---- ロケット団戦: あいての3枠(模擬戦で使う) ----
// RKT[i] = あいての手持ち1匹({key, fast, c1})。ステータスは種別の倍率で決まるので個体値は持たない
const RKT = [null, null, null];
const RKT_KEY = 'gbl_rocket_team';
try { const v = JSON.parse(localStorage.getItem(RKT_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) RKT[i] = m; }); } catch (e) {}
const saveRkt = () => { try { localStorage.setItem(RKT_KEY, JSON.stringify(RKT)); } catch (e) {} };
const rktName = m => m ? 'シャドウ' + D.pokemon[m.key].n : '';
// あいて1匹分の計算用設定(わざが未選択なら、おぼえるわざの先頭を使う)
// 特別なわざ(レガシー技)は打ってこないので候補から外す
function rktCfg(m, opt) {
  const { fasts, chargeds } = rkPool(m.key);
  const fast = m.fast && fasts.includes(m.fast) ? m.fast : fasts[0];
  const sp = m.c1 && chargeds.includes(m.c1) ? m.c1 : chargeds[0];
  // SPアタックを覚えないポケモン(進化前など)はノーマルアタックだけで戦う
  return rkCfg({ key: m.key, ivs: [15, 15, 15], level: 40, cap: 0, fast,
    charged: sp ? [sp] : [], throw: sp }, opt);
}

// あいての3枠(ポケモン検索＋わざ選択)
function buildFoeSlots() {
  const box = document.querySelector('#rkteam .foeslots');
  if (!box) return;
  box.innerHTML = [0, 1, 2].map(i => `<div class="pslot fslot" data-i="${i}">
    <div class="phd"><span class="pnum">${i + 1}匹目</span>
      <span class="fshadow" title="ロケット団のポケモンは必ずシャドウです"><i class="shadowmark"></i></span>
      <button class="pclr" title="この枠を空にする">×</button></div>
    <div class="sugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    <div class="fbody" style="display:none">
      <select class="selFast" title="あいてのノーマルアタック"></select>
      <select class="selC1" title="あいてのSPアタック"></select>
      <div class="fstat"></div>
    </div>
  </div>`).join('');
  box.querySelectorAll('.fslot').forEach(el => {
    const i = +el.dataset.i;
    const inp = el.querySelector('input'), list = el.querySelector('.sugg-list');
    inp.addEventListener('compositionend', () => {
      const v = toKata(inp.value);
      if (v !== inp.value) inp.value = v;
      inp.dispatchEvent(new Event('input'));
    });
    inp.addEventListener('input', e => {
      if (!e.isComposing) {
        const v = toKata(inp.value);
        if (v !== inp.value) inp.value = v;
      }
      const q = toKata(inp.value.trim());
      if (!q) { list.style.display = 'none'; return; }
      // ロケット団はメガ・ゲンシを使ってこないので、あいての候補には出さない
      const hits = searchPk(q, k => !isMega(k));
      if (!hits.length) { list.style.display = 'none'; return; }
      list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
      list.style.display = 'block';
      list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
        list.style.display = 'none';
        RKT[i] = { key: d.dataset.k, fast: null, c1: null };
        saveRkt(); syncFoeSlots(); run();
      });
    });
    document.addEventListener('click', e => { if (!el.contains(e.target)) list.style.display = 'none'; });
    el.querySelector('.pclr').onclick = () => { RKT[i] = null; saveRkt(); syncFoeSlots(); run(); };
    el.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      if (!RKT[i]) return;
      // 空値=「自動(いちばんキツい)」。全通り試していちばんキツいわざで計算する
      RKT[i][sel.classList.contains('selFast') ? 'fast' : 'c1'] = sel.value || null;
      saveRkt(); syncFoeSlots(); run();
    });
  });
  syncFoeSlots();
}
// あいての枠の表示(わざの選択肢・実数値)を今の設定に合わせる
function syncFoeSlots() {
  document.querySelectorAll('#rkteam .fslot').forEach(el => {
    const m = RKT[+el.dataset.i];
    const fb = el.querySelector('.fbody');
    el.querySelector('input').value = m ? rktName(m) : '';   // 必ずシャドウなので名前もそう出す
    if (!m) { fb.style.display = 'none'; return; }
    fb.style.display = 'block';
    const cfg = rktCfg(m);
    const { fasts, chargeds } = rkPool(m.key);   // 特別なわざ(レガシー技)は打ってこない
    // 既定は「自動(いちばんキツい)」＝全通りのうちこちらにいちばんキツいわざで計算する。
    // 1対1(最悪ケース基準)と結果の基準がそろい、わざを決め打ちしたいときだけ選べばよい
    const auto = '<option value="">自動（いちばんキツい）</option>';
    const opts = (list, sel) => list.map(x => `<option value="${x}"${x === sel ? ' selected' : ''}>${D.moves[x].n}</option>`).join('');
    el.querySelector('.selFast').innerHTML = auto + opts(fasts, m.fast);
    el.querySelector('.selC1').innerHTML = chargeds.length ? auto + opts(chargeds, m.c1) : '';
    const st = PvpEngine.buildStats(D, cfg);
    // 実数値はシャドウ補正をかける前の値(ゲームの表示に合わせる)
    el.querySelector('.fstat').innerHTML =
      `${typeIcons(D.pokemon[m.key], 15)} CP${st.cp}／攻${st.baseAtk.toFixed(1)}・防${st.baseDef.toFixed(1)}・HP${st.hp}`;
  });
}

// ---- ロケット団戦 1対1: おすすめランキング ----
// ロケット団戦の目的は「いかに早く倒すか」なので、あいてを決めたらまず
// 「ノーマルアタックだけで殴ったときにいちばん火力が出るポケモンとわざ」を並べる。
// 火力＝そのあいてに対するノーマルアタックのDPS(ダメージ÷秒)。
// あいてのわざはランダムなので、倒され判定(⚠)は「いちばんキツいわざで来た場合」で見る。
const RKR = { view: 'power', shadow: true, mega: false, top: 30, cache: null };

// ---- 「自分のポケモン」の追加(CPと個体値からPLを逆算して★登録リストに入れる) ----
// 保存先は★登録リストと同じ(gbl_mypoke)なので、追加したものは左右パネルからも呼び出せる
const RKM = { key: null, shadow: false };
// そのCPになりうるPLを探す(個体値が決まればふつう1つに定まる)
function levelsFromCP(key, cp, ivs) {
  const p = D.pokemon[key], hits = [];
  for (let l = 1; l <= 51; l += 0.5) {
    const m = D.cpm[String(l)];
    if (m && cpOf(p, ivs[0], ivs[1], ivs[2], m) === cp) hits.push(l);
  }
  return hits;
}
const rkmIvs = () => [0, 1, 2].map(k => {
  const v = +document.getElementById(['rkmA', 'rkmD', 'rkmH'][k]).value;
  return isNaN(v) ? 15 : Math.max(0, Math.min(15, v));
});
function renderRkMy() {
  const box = document.getElementById('rkmybody');
  const saved = loadMyPk();
  const p = RKM.key && D.pokemon[RKM.key];
  box.innerHTML = `
    <div class="sugg rkmysugg"><input type="search" placeholder="ポケモン名" autocomplete="off"><div class="sugg-list"></div></div>
    ${p ? `<div class="rkmysel">
      <button class="rkmyshadow" aria-pressed="${RKM.shadow}" title="シャドウとして計算する"><i class="shadowmark"></i></button>
      <b>${RKM.shadow ? 'シャドウ' : ''}${p.n}</b>${typeIcons(p, 15)}</div>
    <div class="rkmyrow">
      <label for="rkmCP">CP</label><input type="number" id="rkmCP" min="10" inputmode="numeric" placeholder="例 2387">
      <label for="rkmA">攻</label><input type="number" id="rkmA" min="0" max="15" value="15" inputmode="numeric">
      <label for="rkmD">防</label><input type="number" id="rkmD" min="0" max="15" value="15" inputmode="numeric">
      <label for="rkmH">HP</label><input type="number" id="rkmH" min="0" max="15" value="15" inputmode="numeric">
    </div>
    <div class="rkmylv" id="rkmlv"></div>
    <button class="rkmyadd" id="rkmadd" disabled>ランキングに追加</button>` : ''}
    ${saved.length ? `<div class="rkmylist">${saved.map((m, k) => {
      const q = D.pokemon[m.key];
      if (!q) return '';
      const iv = m.ivMode === 'manual' && m.mIvs ? `${m.mIvs.join('/')} PL${m.mLevel}` : '理想個体値';
      return `<div class="rkmyrowsaved"><span>★${m.shadow ? 'シャドウ' : ''}${q.n}<i>${iv}</i></span>
        <b class="rkmydel" data-del="${k}" title="消す">×</b></div>`;
    }).join('')}</div>` : ''}`;
  // ポケモンの検索
  const inp = box.querySelector('.rkmysugg input'), list = box.querySelector('.rkmysugg .sugg-list');
  inp.addEventListener('compositionend', () => { inp.value = toKata(inp.value); inp.dispatchEvent(new Event('input')); });
  inp.addEventListener('input', e => {
    if (!e.isComposing) inp.value = toKata(inp.value);
    const q = toKata(inp.value.trim());
    if (!q) { list.style.display = 'none'; return; }
    const hits = searchPk(q);
    if (!hits.length) { list.style.display = 'none'; return; }
    list.innerHTML = hits.map(k => `<div data-k="${k}"><span>${D.pokemon[k].n}</span>${typeIcons(D.pokemon[k], 16)}</div>`).join('');
    list.style.display = 'block';
    list.querySelectorAll('div[data-k]').forEach(d => d.onclick = () => {
      RKM.key = d.dataset.k; RKM.shadow = false; renderRkMy();
    });
  });
  if (!p) return;
  box.querySelector('.rkmyshadow').onclick = () => { RKM.shadow = !RKM.shadow; renderRkMy(); };
  // CP・個体値を入れるたびにPLを逆算して出す(合わなければ追加させない)
  const lv = box.querySelector('#rkmlv'), add = box.querySelector('#rkmadd');
  const recalc = () => {
    const cp = +document.getElementById('rkmCP').value;
    if (!cp) { lv.textContent = ''; add.disabled = true; return; }
    const hits = levelsFromCP(RKM.key, cp, rkmIvs());
    if (!hits.length) {
      lv.innerHTML = '<span class="ng">CPと個体値の組み合わせが合いません</span>';
      add.disabled = true; return;
    }
    lv.innerHTML = `PL <b>${hits[hits.length - 1]}</b>` +
      (hits.length > 1 ? `<span class="rkrdim">（候補 ${hits.join(' / ')}・いちばん高いPLで計算します）</span>` : '');
    add.disabled = false;
  };
  ['rkmCP', 'rkmA', 'rkmD', 'rkmH'].forEach(id => document.getElementById(id).oninput = recalc);
  add.onclick = () => {
    const cp = +document.getElementById('rkmCP').value;
    const ivs = rkmIvs(), hits = levelsFromCP(RKM.key, cp, ivs);
    if (!hits.length) return;
    saveMyPkList([...loadMyPk(), { key: RKM.key, shadow: RKM.shadow, ivMode: 'manual', mIvs: ivs, mLevel: hits[hits.length - 1] }]);
    RKM.key = null; RKM.shadow = false;
    renderRkMy(); renderMyPk(); run();
  };
  box.querySelectorAll('.rkmydel').forEach(b => b.onclick = () => {
    const l = loadMyPk(); l.splice(+b.dataset.del, 1); saveMyPkList(l);
    renderRkMy(); renderMyPk(); run();
  });
}
document.getElementById('rkmytab').onclick = () => {
  const body = document.getElementById('rkmybody'), open = body.style.display === 'none';
  if (open) renderRkMy();
  body.style.display = open ? 'block' : 'none';
  document.getElementById('rkmytab').setAttribute('aria-expanded', open);
};

// ランキングの候補を作る。全ポケモン(理想個体値・PL上限)＋★登録リスト(自分の個体)
function rkCandidates() {
  const out = [];
  for (const key of KEYS) {
    const mega = isMega(key);
    if (mega && !RKR.mega) continue;
    out.push({ key, shadow: false, ivs: [15, 15, 15], level: 50 });
    // シャドウは攻撃1.2倍で火力が出るぶん、ロケット団戦の主力になりやすい
    if (RKR.shadow && D.pokemon[key].shadow && !mega) out.push({ key, shadow: true, ivs: [15, 15, 15], level: 50 });
  }
  // ★登録リスト(自分の強化段階・個体値)も混ぜる。行には★を付けて見分けられるようにする
  loadMyPk().forEach(m => {
    if (!D.pokemon[m.key]) return;
    const b = ptBase(m, 0);
    out.push({ key: m.key, shadow: !!m.shadow, ivs: b.ivs, level: b.level, mine: true, fixFast: m.fast || null });
  });
  return out;
}
// あいて1匹に対するランキングを作る(1対1画面用。わざは全通りで最悪ケースを見る)
function rkRanking() { return rkRankFor({ key: S[1].key }, false); }
// foe = {key, fast, c1}。respectPicked=true なら指定済みのわざだけに絞る(模擬戦の枠を尊重)
function rkRankFor(foe, respectPicked) {
  const foeBase = rkCfg({ key: foe.key, ivs: [15, 15, 15], level: 40, cap: 0,
    fast: rkPool(foe.key).fasts[0], charged: [], throw: null });
  const foeSt = PvpEngine.buildStats(D, foeBase);
  const combos = rkSuggCombos(respectPicked ? foe : { key: foe.key });
  const rows = [];
  for (const c of rkCandidates()) {
    const me = { key: c.key, ivs: c.ivs, level: c.level, shadow: c.shadow, cap: 0 };
    const st = PvpEngine.buildStats(D, me);
    const fasts = c.fixFast && D.moves[c.fixFast] ? [c.fixFast] : movePool(c.key).fasts;
    let best = null;
    for (const id of fasts) {
      const mv = D.moves[id];
      const dmg = PvpEngine.damage(D, mv, { ...st, buffs: [0, 0] }, { ...foeSt, buffs: [0, 0] });
      const dps = dmg / (mv.tn * 0.5);
      if (!best || dps > best.dps) best = { id, mv, dmg, dps };
    }
    if (!best) continue;
    rows.push({ ...c, me, st, fast: best.id, dmg: best.dmg, dps: best.dps });
  }
  rows.sort((a, b) => b.dps - a.dps || a.key.localeCompare(b.key));
  // 上位だけ実際にシミュレートして「先に倒されないか」を見る(全部やると重いので絞る)。
  // ただし★登録リストの自分の個体は、順位が下でも必ず調べる(必ず一覧に出すため)
  const CHECK = 160;
  rows.filter((r, i) => i < CHECK || r.mine).forEach(r => {
    // SPアタックは撃たない(ノーマルアタックだけで殴る前提)。
    // こちらがSPを撃たないぶん、シールド2枚はまるごとあいてのSPを防ぐのに使える
    const L = { ...r.me, fast: r.fast, charged: [], shields: 2, timing: 'shots', shotPlan: [], shotRest: null };
    // 勝ち負けを分けるのは主に「あいてのノーマルアタックがどれか」なので、そこでまとめる
    const byFast = new Map();
    for (const c of combos) {
      const res = PvpEngine.simulate(D, L,
        { ...foeBase, fast: c.fast, charged: c.throw ? [c.throw] : [], throw: c.throw }, SIMOPT);
      const cur = byFast.get(c.fast);
      if (!cur || rkWorstScore(res) < rkWorstScore(cur)) byFast.set(c.fast, res);
    }
    const list = [...byFast.entries()].map(([f, res]) => ({ f, res, win: res.winner === 0 }));
    r.nFast = list.length;
    r.nWin = list.filter(x => x.win).length;
    r.win = r.nWin === list.length;
    r.loseTo = list.filter(x => !x.win).map(x => D.moves[x.f].n);
    // 秒数は「勝てる中でいちばん遅いケース」＝安全側で出す
    const wins = list.filter(x => x.win);
    const show = (wins.length ? wins : list).reduce((a, b) => rkWorstScore(a.res) < rkWorstScore(b.res) ? a : b);
    r.turns = show.res.turns;
    r.myPct = Math.round(show.res.final[0].hp / show.res.final[0].hpMax * 100);
    r.foePct = Math.round(show.res.final[1].hp / show.res.final[1].hpMax * 100);
    r.anyWin = wins.length > 0;
    r.checked = true;
  });
  return rows;
}

// ---- 模擬戦: おすすめ提案(「どのポケモンを使えばいいか」が思いつかない人向け) ----
// じぶんの枠の上の「高火力 / 高火力＋安定」タブを押した状態で枠の入力欄をタップすると、
// 同じ順番のあいて(1匹目↔1匹目…)への対策トップ5を出す。基準は1対1のランキングと同じ
const RKS = { mode: null, cache: new Map() };
// あいての枠のわざ指定を尊重した全通り(未指定=自動はおぼえるわざ全部)
function rkSuggCombos(f) {
  const pool = rkPool(f.key);
  const fl = f.fast && pool.fasts.includes(f.fast) ? [f.fast] : pool.fasts;
  const sl = f.c1 && pool.chargeds.includes(f.c1) ? [f.c1]
    : (pool.chargeds.length ? pool.chargeds : [null]);
  const out = [];
  for (const fa of fl) for (const sp of sl) out.push({ fast: fa, throw: sp });
  return out;
}
// あいて1匹へのランキング(キャッシュ付き。★登録や絞り込みが変わったら作り直す)
function rkSlotRank(foe) {
  const sig = JSON.stringify([foe.key, foe.fast, foe.c1, RK.kind, RKR.shadow, RKR.mega, loadMyPk()]);
  if (!RKS.cache.has(sig)) {
    if (RKS.cache.size > 8) RKS.cache.clear();
    RKS.cache.set(sig, rkRankFor(foe, true));
  }
  return RKS.cache.get(sig);
}
// 枠 i の入力欄の下に、あいて i への対策トップ5を出す
function rkShowSugg(i, el) {
  if (RKS.mode === null) return false;
  const list = el.querySelector('.sugg-list');
  const foe = RKT[i];
  if (!foe) {
    list.innerHTML = `<div class="rksgnote">あいての${i + 1}匹目を入れると、対策トップ5が出ます</div>`;
    list.style.display = 'block';
    return true;
  }
  const rows = rkSlotRank(foe);
  const safe = RKS.mode === 'safe';
  const cand = (safe ? rows.filter(r => r.checked && r.win) : rows).slice(0, 5);
  const hd = `<div class="rksgnote">${rktName(foe)} への対策トップ5${safe ? '（先に倒されない）' : ''}</div>`;
  if (!cand.length) {
    list.innerHTML = hd + '<div class="rksgnote">先に倒されない候補が見つかりません（「高火力」を見てください）</div>';
    list.style.display = 'block';
    return true;
  }
  list.innerHTML = hd + cand.map((r, k) => {
    const p = D.pokemon[r.key];
    const warn = r.checked && !r.win;
    return `<div class="rksgrow" data-k="${k}" title="${warn ? 'あいてのわざ次第で先に倒されます' : ''}">
      <b class="rksgno">${k + 1}</b>
      <span class="rksgnm">${r.mine ? '<span class="rkrmine">★</span>' : ''}${r.shadow ? '<i class="shadowmark"></i>' : ''}${p.n}</span>${typeIcons(p, 15)}
      <span class="rksgmv">${mvChip(D.moves[r.fast].n, 12)}</span>
      <span class="rksgdps">${warn ? '⚠' : ''}<small>DPS</small>${r.dps.toFixed(1)}</span>
    </div>`;
  }).join('');
  list.style.display = 'block';
  list.querySelectorAll('.rksgrow').forEach(row => row.onclick = () => {
    const r = cand[+row.dataset.k];
    list.style.display = 'none';
    // ★の個体は登録リストの内容(個体値・PL)ごと、それ以外は理想個体値で枠に入れる
    const saved = r.mine ? loadMyPk().find(m => m.key === r.key && !!m.shadow === r.shadow) : null;
    PT[i] = saved ? { ...saved } : { key: r.key, ivMode: 'auto', shadow: r.shadow, maxLv: 51 };
    // 評価に使ったノーマルアタックをそのまま模擬戦のわざにする(表示と結果を食い違わせない)
    RBM[i] = { ...rbmDefault(r.key), fast: r.fast };
    saveRbm(); savePt(); syncPartySlot(i); run();
  });
  return true;
}

// ---- 模擬戦: 「⚙ 詳細」パネル ----
// 使う頻度の低い設定(確率わざ・じぶんの個体値とPL・あいてのわざランダム)をここへ集めて、
// トップの画面をすっきりさせる。確率わざの設定(#gopt)は模擬戦のあいだこのパネルへ移動する
const RKD = { open: false };
function renderRkDetail() {
  const box = document.getElementById('rkdetail');
  const tab = document.getElementById('rkdetailtab');
  if (!box || !tab) return;
  tab.setAttribute('aria-expanded', RKD.open);
  box.style.display = RKD.open ? 'block' : 'none';
  if (!RKD.open) return;
  const body = box.querySelector('.rkdbody');
  // じぶんの個体値・PL(既定は理想個体値=PL50・100%。枠にポケモンが居るときだけ出す)
  const ivRow = i => {
    const m = PT[i];
    const man = m.ivMode === 'manual' && m.mIvs;
    const iv = man ? m.mIvs : [15, 15, 15];
    const lv = man ? m.mLevel : 50;
    return `<div class="rkdrow rkdiv" data-i="${i}"><span class="lbl">${i + 1}匹目</span>
      <button class="rkdideal" aria-pressed="${!man}" title="PL50・個体値100%に戻す">理想個体値</button>
      <label>攻<input type="number" class="dA" min="0" max="15" value="${iv[0]}" inputmode="numeric"></label>
      <label>防<input type="number" class="dD" min="0" max="15" value="${iv[1]}" inputmode="numeric"></label>
      <label>HP<input type="number" class="dH" min="0" max="15" value="${iv[2]}" inputmode="numeric"></label>
      <label>PL<input type="number" class="dL" min="1" max="51" step="0.5" value="${lv}" inputmode="decimal"></label>
    </div>`;
  };
  const myRows = [0, 1, 2].filter(i => PT[i]).map(ivRow).join('');
  const anyFoe = [0, 1, 2].some(i => RKT[i]);
  body.innerHTML =
    (myRows ? `<div class="rkdttl">じぶんの個体値・PL</div>${myRows}` : '') +
    (anyFoe ? `<div class="rkdttl">あいてのわざを🎲でランダムに引き直す</div>
      <div class="rkdrow">${[0, 1, 2].map(i =>
        `<button class="rkdrand" data-i="${i}" ${RKT[i] ? '' : 'disabled'}>🎲 ${i + 1}匹目</button>`).join('')}</div>` : '');
  // 個体値・PLの入力: 変えたらﾏﾆｭｱﾙ扱い。「理想個体値」で既定に戻す
  body.querySelectorAll('.rkdiv').forEach(row => {
    const i = +row.dataset.i;
    const commit = () => {
      const n = (sel, lo, hi, st) => {
        const el2 = row.querySelector(sel);
        let v = +el2.value || 0;
        if (st) v = Math.round(v * 2) / 2; else v = Math.round(v);
        v = Math.min(hi, Math.max(lo, v));
        el2.value = v;
        return v;
      };
      PT[i].ivMode = 'manual';
      PT[i].mIvs = [n('.dA', 0, 15), n('.dD', 0, 15), n('.dH', 0, 15)];
      PT[i].mLevel = n('.dL', 1, 51, true);
      savePt(); syncPartySlot(i); renderRkDetail(); run();
    };
    row.querySelectorAll('input').forEach(inp => inp.onchange = commit);
    row.querySelector('.rkdideal').onclick = () => {
      PT[i].ivMode = 'auto'; PT[i].mIvs = null; PT[i].mLevel = null;
      savePt(); syncPartySlot(i); renderRkDetail(); run();
    };
  });
  // あいてのわざランダム(おぼえるわざから引き直す。ロケット団はランダムに打ってくる)
  body.querySelectorAll('.rkdrand').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (!RKT[i]) return;
    const { fasts, chargeds } = rkPool(RKT[i].key);
    const pickRnd = list => list.length ? list[Math.floor(Math.random() * list.length)] : null;
    RKT[i].fast = pickRnd(fasts);
    RKT[i].c1 = pickRnd(chargeds);
    saveRkt(); syncFoeSlots(); run();
  });
}

function runRkRank() {
  const box = document.getElementById('rkrank');
  const body = box.querySelector('.rkrbody');
  // 何のランキングかが一目で分かるように見出しを出す
  document.getElementById('rkranktitle').innerHTML = 'ノーマルアタック火力ランキング' +
    (RKR.view === 'safe' ? '<small>先に倒されないものだけ</small>' : '');
  updateUrl();
  if (!S[1].key) { body.innerHTML = '<div class="mtnote">あいてのポケモンを選ぶとランキングが出ます</div>'; return; }
  body.innerHTML = '<div class="mtprog">計算中…</div>';
  setTimeout(() => {
    const all = RKR.cache = rkRanking();
    // 全体での順位を持たせてから絞る(自分の個体が圏外でも、本当の順位のまま出せるように)
    const ranked = (RKR.view === 'safe' ? all.filter(r => r.checked && r.win) : all)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    const list = ranked.slice(0, RKR.top)
      .concat(ranked.slice(RKR.top).filter(r => r.mine));   // ★自分の個体は圏外でも必ず出す
    if (!list.length) {
      body.innerHTML = '<div class="mtnote">' + (RKR.view === 'safe'
        ? '<b>先に倒されずに勝てる</b>候補がありません（SPアタックを使うなら「シミュレート」か模擬戦へ）'
        : '候補がありません') + '</div>';
      return;
    }
    body.innerHTML = list.map((r, i) => rkRankCard(r, i)).join('');
    body.querySelectorAll('.rkrcard').forEach(el => el.onclick = () => {
      const r = list[+el.dataset.i];
      applyMyPk(0, { key: r.key, fast: r.fast, shadow: r.shadow,
        ivMode: r.mine ? 'manual' : 'auto', mIvs: r.mine ? r.ivs : null, mLevel: r.mine ? r.level : null }, true);
      RKR.view = 'sim'; syncRocket(); applyMode(); run();
    });
  }, 20);
}
function rkRankCard(r, i) {
  const n = r.rank || i + 1;   // 全体での順位(圏外の自分の個体もこの順位で出す)
  const p = D.pokemon[r.key];
  const mv = D.moves[r.fast];
  const nm = (r.shadow ? 'シャドウ' : '') + p.n;
  const warn = r.checked && !r.win;
  // ⚠は「あいてのどのわざで負けるか」の左に付ける。
  // わざ名の前に付けると、こちらのわざが悪いように読めてしまう(ローブシンのはっけい等)
  const num = !r.checked ? '<span class="rkrdim">—</span>'
    : r.anyWin ? `<b${warn ? ' class="warn"' : ''}>${(r.turns / 2).toFixed(1)}</b>秒`
    : '<span class="rkrdim">—</span>';   // 全部負けるなら秒数に意味がない
  const sub = !r.checked ? ''
    : r.win ? `残HP${r.myPct}%`
    : r.anyWin ? `<span class="ng">⚠️${r.loseTo.join('・')}だと負け</span>`
    : `<span class="ng">⚠️どのわざでも負け</span>`;
  return `<div class="rkrcard${warn ? ' warn' : ''}" data-i="${i}">
    <div class="rkrank ${n === 1 ? 'r1' : n === 2 ? 'r2' : n === 3 ? 'r3' : ''}">${n}</div>
    <div class="rkrmain">
      <div class="rkrname">${r.mine ? '<span class="rkrmine" title="★登録リストの個体">★</span>' : ''}
        ${r.shadow ? '<i class="shadowmark"></i>' : ''}${p.n}${typeIcons(p, 15)}</div>
      <div class="rkrmv">${mvChip(mv.n)}
        <span class="rkrdim">${r.mine ? `個体値${r.ivs.join('/')} PL${r.level}` : ''}</span></div>
    </div>
    <div class="rkrnum">${num}<small>${sub}</small><i class="rkrdps">${r.dps.toFixed(1)}/秒</i></div>
  </div>`;
}

// ---- ロケット団戦: 模擬戦 ----
// ans  = 決断への答え（キーは rbKey。決めていない場面は「おまかせ」でAIが判断する）
// step = 見かた。true=バトル（1ターン=0.5秒で再生し、決断で止まる）／false=結果だけ（一気に出す）
const RB = { ans: {}, step: true, found: null, goal: null };
const rbAnsCount = () => Object.keys(RB.ans).length;
// 共有URL用: 決断の答えを短い文字列にする(キーの : は . に置き換える)
const RB_CODE = { fire: 'f', wait: 'w', hold: 'h', use: 'u', no: 'n', stay: 'y', order: 'o', to: 't', toq: 'q', auto: 'a' };
const rbAnsToStr = () => Object.keys(RB.ans).map(k => {
  const a = RB.ans[k], c = RB_CODE[a.a] || 'a';
  const v = a.a === 'fire' ? a.mv : a.a === 'wait' ? a.n : (a.a === 'to' || a.a === 'toq') ? a.to : null;
  return `${k.replace(/:/g, '.')}~${c}${v != null ? '~' + v : ''}`;
}).join(',');
function rbAnsFromStr(str) {
  str.split(',').forEach(s => {
    const [k, c, v] = s.split('~');
    if (!k || !c) return;
    const a = c === 'f' ? (D.moves[v] ? { a: 'fire', mv: v } : null)
      : c === 'w' ? { a: 'wait', n: Math.max(1, Math.min(9, +v || 1)) }
      : c === 'h' ? { a: 'hold' } : c === 'u' ? { a: 'use' } : c === 'n' ? { a: 'no' }
      : c === 'y' ? { a: 'stay' } : c === 'o' ? { a: 'order' }
      : c === 't' ? (isNaN(+v) ? null : { a: 'to', to: +v })
      : c === 'q' ? (isNaN(+v) ? null : { a: 'toq', to: +v }) : null;
    if (a) RB.ans[k.replace(/\./g, ':')] = a;
  });
}

// ---- 模擬戦: じぶんが使うわざ(枠ごとに自分で選ぶ) ----
// パーティ診断は「わざを対面ごとに最適化」する仕様なので、PT には書かず別に持つ。
// SPアタックは必ず具体的なわざを指定する（おまかせにしない＝画面に出ているわざで必ず戦う）。
// ノーマルアタックだけ「おまかせ」を選べる（policies が効率のよい構成を選ぶ）
const RBM = [null, null, null];
const RBM_KEY = 'gbl_rocket_mymoves';
try { const v = JSON.parse(localStorage.getItem(RBM_KEY)); if (Array.isArray(v)) v.forEach((m, i) => { if (i < 3) RBM[i] = m; }); } catch (e) {}
const saveRbm = () => { try { localStorage.setItem(RBM_KEY, JSON.stringify(RBM)); } catch (e) {} };
// 既定のわざ: ノーマルは「1ターンあたりのダメージ(タイプ一致1.2倍込み)が最高のわざ」、
// SPは「ダメージ効率(威力÷ゲージ)がいちばん高いわざ」
function rbmDefault(key) {
  const { fasts, chargeds } = movePool(key);
  const ty = D.pokemon[key].ty;
  const dpt = m => D.moves[m].p * (ty.includes(D.moves[m].t) ? 1.2 : 1) / (D.moves[m].tn || 1);
  const dpe = m => D.moves[m].p / D.moves[m].e;
  return { v: 2, key,
    fast: fasts.slice().sort((a, b) => dpt(b) - dpt(a))[0] || 'auto',
    c1: chargeds.slice().sort((a, b) => dpe(b) - dpe(a))[0] || '', c2: '' };
}
// その枠のわざ指定(ポケモンを入れ替えたら作り直す。v無しは旧形式なので既定を選び直す)
function rbmOf(i) {
  if (!PT[i]) return null;
  if (!RBM[i] || RBM[i].key !== PT[i].key || !RBM[i].v) { RBM[i] = rbmDefault(PT[i].key); saveRbm(); }
  return RBM[i];
}
const rbMyMoves = () => [0, 1, 2].filter(i => PT[i]).map(i => rbmOf(i));

// じぶんの各枠のわざ構成を決める(1対1の rkOptimize と同じ最悪ケース基準)。バトル中は変えられない
// 置いた手には左右されない(バトル前に決めるもの)ので、同じ条件なら計算し直さずに使い回す。
// これが無いと、ターンをタップするたびに45ms×3通りの選び直しが走って画面が重くなる
// (シールド枚数ごとに選び直すので、0/1/2の3通りを覚えておけるようにMapで持つ)
const RBP = new Map();
const rbPkKey = (mine, foes, sh) => JSON.stringify([mine, foes, sh, RK.kind, RK.stall, SIMOPT.buffMode, rbMyMoves()]);
const rbPicksHas = (mine, foes, sh) => RBP.has(rbPkKey(mine, foes, sh));
function rbPicksCached(mine, foes, myShields) {
  const key = rbPkKey(mine, foes, myShields);
  if (!RBP.has(key)) {
    if (RBP.size > 6) RBP.clear();   // 設定を変えながら使うと溜まるので、たまに捨てる
    RBP.set(key, rbPicks(mine, foes, myShields, rbMyMoves()));
  }
  return RBP.get(key);
}
// moves = 画面で選んだわざ(mine と同じ並び)。ノーマルが 'auto' のときだけ構成を選ばせる
function rbPicks(mine, foes, myShields, moves) {
  moves = moves || [];
  return mine.map((m, k) => {
    const base = ptBase(m, 0);
    const mv = moves[k] || {};
    const pols = policies(m.key, {
      fast: (mv.fast && mv.fast !== 'auto') ? mv.fast : (m.fast || undefined),
      c1: mv.c1 || m.c1 || undefined,
      c2: mv.c2 || m.c2 || undefined });
    let best = null;
    for (const pol of pols) {
      const L = { ...base, ...pol, timing: 'optimal', shields: myShields, bluff: true };
      let sc = 0;
      for (const f of foes) {
        const R = rktCfg(f, { stallStart: 0, shields: rkShields() });
        const { fasts, chargeds } = rkPool(f.key);
        const spList = chargeds.length ? chargeds : [null];
        let worst = null;
        for (const fm of fasts) for (const sp of spList) {
          const s = rkWorstScore(PvpEngine.simulate(D, L, { ...R, fast: fm, charged: sp ? [sp] : [], throw: sp }, SIMOPT));
          if (worst === null || s < worst) worst = s;
        }
        sc += worst;
      }
      if (!best || sc > best.sc) best = { sc, pol };
    }
    return { m, base, pol: best.pol, name: ptName(m) };
  });
}
// ---- 模擬戦「1手ずつ」: 決断が要る場面だけ止まって選ぶ ----
// 実際のバトルと同じ流れを再現する。ノーマルアタックの応酬はまとめて進み、
// 次の4つのどれかに来たら止まって選択肢を出す(選ぶたびに先へ伸びていく):
//   sp   … 自分のSPアタックが撃てるようになった → 撃つ(どちらを) / 撃たない / あとN発殴ってから
//   sh   … あいてのSPアタックが飛んできた → シールドを使う / 使わない
//   swap … あいての次のポケモンが出てきた(倒した直後など) → すぐ交代 / 硬直ぶん殴ってから交代 / このまま
//   next … 自分が倒された → 次にどれを出すか
// 答えは RB.ans[キー] に持つ。キーは「対面の番号:種別:連番:待った発数」なので、
// 前の決断を変えなければ後ろの決断のキーも変わらない(選び直しに強い)。
// 決めていない場面は「おまかせ」(AIの判断)で進む。これは従来の自動と完全に同じ動きになる
// ＝ 一気に結果を出してから、気になる場面だけタップして選び直せる。
const rbKey = (li, kind, seq, w) => `${li}:${kind}:${seq}:${w || 0}`;
const RB_AUTO = { sp: { a: 'auto' }, sh: { a: 'use' }, swap: { a: 'stay' }, next: { a: 'order' }, lead: { a: 'to', to: 1 } };

// 1対面ぶんのシミュ結果から、決断が要る場面を時系列に並べる。
// dec はいまの対面で決まっている内容(撃つと決めた発・使うと決めたシールド)。
function rbPoints(turns, ctx, dec) {
  const pts = [];
  // --- あいてのSPアタック(シールドを使うかどうか) ---
  let shSeq = 0, shUsed = 0;
  // --- 自分のSPアタック(撃つかどうか) ---
  // asked = その発についてもう聞いた（撃つ or 撃たないが決まるまで、毎ターン聞き直さない）
  let spIdx = 0, armed = false, normals = 0, asked = false;
  const cost = ctx.cost;
  for (const t of turns) {
    // あいてのSPアタックが飛んできた(1ターンに複数入ることは無いが念のため配列で見る)
    for (const e of t.ev[1]) {
      if (e.full === undefined) continue;
      // mv/dmg は選択ウィンドウの表示用(何が来て、受けたら何ダメージか)
      if (ctx.myShLeft - shUsed > 0) pts.push({ kind: 'sh', seq: shSeq, tn: t.tn, spSeen: shSeq + 1, mv: e.move, dmg: e.full });
      if (dec.shieldAt.includes(shSeq + 1)) shUsed++;
      shSeq++;
    }
    // 自分がSPアタックを撃った → 次の発の判断へ
    if (t.ev[0].some(e => e.full !== undefined)) { spIdx++; armed = false; asked = false; normals = 0; continue; }
    if (armed && t.ev[0].some(e => e.full === undefined)) normals++;   // 待っているあいだのノーマル
    // 決着したターンではSPの質問を出さない(2026-08-10バグ修正)。
    // SPアタックは次の行動ターンに発動するので、すでに倒しきった(倒された)ターンで
    // 「撃つ?」と聞いても撃ちようがない。あいてのHPが0なのにSPを聞かれて見えていた原因
    const over = t.state[0].hp <= 0 || t.state[1].hp <= 0;
    // 交代すると決めたあとはSPの質問を出さない(殴って下がる途中に撃つ判断は混乱のもと)
    if (!armed && !asked && !over && !dec.hold && dec.swapTo == null && cost && t.state[0].en >= cost) { armed = true; normals = 0; }
    if (armed && !over) {
      // 「あとN発殴ってから」を選んでいれば、そのぶん後ろにずれたところが判断の場面
      // (撃つと決めた発は、そのとき決めた待ち発数の位置に判断の場面が残る＝キーが変わらない)
      const dw = spIdx < dec.shots.length ? dec.shots[spIdx].wait : dec.wait;
      const w = typeof dw === 'number' ? dw : 0;
      // en = この時点のゲージ。選択ウィンドウで「ゲージが足りないわざはあと何発で発動か」を出すのに使う
      if (normals >= w) { pts.push({ kind: 'sp', seq: spIdx, w, tn: t.tn, en: t.state[0].en }); armed = false; asked = true; }
    }
  }
  // --- あいての次のポケモンが出てきた(倒した直後など・硬直中): こちらも交代するか ---
  // 質問は「次のあいてが出てきたターン」に出す。すぐ交代するか、硬直のあいだ
  // ノーマルアタックを打ちきってから交代するか(rbChoices)を選べる。
  // クールタイムが明けない・出せる控えが無いときは出さない
  if (ctx.foeEntry > 0 && ctx.base + ctx.foeEntry >= ctx.swOkAt && ctx.swTo.length) {
    pts.push({ kind: 'swap', seq: 0, tn: 1 });
  }
  // 質問は必ず時系列の順に出す(同じターンに並んだら交代→SP・シールドの順。
  // 「交代する？」が最初の判断で、残る場合にだけSPを撃つかが意味を持つため)。
  // 時系列を崩して交代を先頭に出すと、答えたあとに時間が巻き戻る逆順が起きる(実装時に踏んだ)
  pts.sort((a, b) => a.tn - b.tn || (a.kind === 'swap' ? -1 : b.kind === 'swap' ? 1 : 0));
  return pts;
}

// 決断ひとつぶんの選択肢(画面に出すボタン)を作る
function rbChoices(p, ctx) {
  if (p.kind === 'lead') return ctx.swTo.map(k => ({ a: 'to', to: k, label: `${SWAPMK} ${ctx.picks[k].name}`, cls: 'fire',
    tip: '開幕にこのポケモンへ交代します(あいての打ちかけの1発は交代先に入ります)' }));
  if (p.kind === 'sp') {
    // 質問は「いちばん軽いSPが撃てるようになったターン」に出るので、重いほうのわざは
    // ゲージが足りず、ノーマルを追加で打ってからの発動になる。それをボタンに出さないと
    // 「選んだらすぐ撃てる」と錯覚しやすい(例: グロウパンチ35で質問→はっけい＋1でコメットパンチ)
    const fm = ctx.fast && D.moves[ctx.fast];
    const list = ctx.spList.map(id => {
      const need = fm && fm.eg > 0 && p.en != null
        ? Math.max(0, Math.ceil((D.moves[id].e - p.en) / fm.eg)) : 0;
      return { a: 'fire', mv: id, cls: 'fire',
        label: `${mvChip(D.moves[id].n, 14)}<i class="cost">${D.moves[id].e}</i>${
          need ? `<i class="need">${fm.n}＋${need}</i>` : ''}`,
        tip: need ? `ゲージが足りないので、${fm.n}をあと${need}発打ってから発動します`
                  : `ゲージ${D.moves[id].e} のSPアタックをここで撃ちます` };
    });
    return list.concat([
      { a: 'wait', n: 1, label: '＋1', cls: 'wait', tip: 'ノーマルアタックをあと1発打ってから、もう一度ここで選びます' },
      { a: 'wait', n: 2, label: '＋2', cls: 'wait', tip: 'ノーマルアタックをあと2発打ってから、もう一度ここで選びます' },
      { a: 'wait', n: 3, label: '＋3', cls: 'wait', tip: 'ノーマルアタックをあと3発打ってから、もう一度ここで選びます' },
      { a: 'hold', label: '撃たない', cls: 'hold', tip: 'この相手には撃たず、ゲージを次の相手に持ち越します' },
    ]);
  }
  if (p.kind === 'sh') return [
    { a: 'use', label: '🛡 使う', cls: 'fire', tip: 'シールドで防ぎます(ダメージ1)' },
    { a: 'no', label: `受ける${p.dmg ? `<b class="dmg">-${p.dmg}</b>` : ''}`, cls: 'hold', tip: 'シールドを使わずにダメージを受けます' },
  ];
  if (p.kind === 'swap') {
    // すぐ交代するか、あいての硬直のあいだノーマルアタックを打ちきってから交代するか。
    // ＋N = 硬直(foeEntryターン)のあいだに打ちきれる発数
    const fm = ctx.fast && D.moves[ctx.fast];
    const n = fm ? Math.floor(ctx.foeEntry / (fm.tn || 1)) : 0;
    const opts = [];
    for (const k of ctx.swTo) {
      opts.push({ a: 'toq', to: k, cls: 'fire',
        label: `${SWAPMK} ${ctx.picks[k].name} <i class="need">すぐ</i>`,
        tip: 'いますぐ交代します(あいてはここから4.5秒動けません／自分も0.5秒動けません)' });
      if (n > 0) opts.push({ a: 'to', to: k, cls: 'fire',
        label: `${SWAPMK} ${ctx.picks[k].name} <i class="need">${fm.n}＋${n}</i>`,
        tip: `あいてが動けないあいだに${fm.n}をあと${n}発打ってから交代します(硬直ぶんを殴ってから下がる)` });
    }
    return opts.concat([{ a: 'stay', label: 'このまま', cls: 'hold', tip: '交代せずにこのまま戦います' }]);
  }
  return ctx.swTo.map(k => ({ a: 'to', to: k, label: ctx.picks[k].name, cls: 'fire',
    tip: '次にこのポケモンを出します' }));
}

// 決めた答えを、その対面の決定(dec)に反映する
function rbApply(dec, p, ans) {
  if (p.kind === 'sp') {
    // おまかせ＝エンジンの最適タイミング判断にゆだねる(従来の自動とまったく同じ動き)
    if (ans.a === 'auto') { dec.shots[p.seq] = { wait: 'opt', mv: null }; dec.wait = 0; }
    else if (ans.a === 'fire') { dec.shots[p.seq] = { wait: dec.wait, mv: ans.mv }; dec.wait = 0; }
    else if (ans.a === 'wait') dec.wait += ans.n;
    else dec.hold = true;
  } else if (p.kind === 'sh') {
    if (ans.a !== 'no') dec.shieldAt.push(p.spSeen);   // おまかせは「残っていれば使う」
  }
  // swap / next は対面をまたぐので、呼び出し側(rbPlay)で使う
}

// 決断リスト(ans)のとおりにバトルを進める。まだ決めていない場面に来たら
// そこで止めて pending に入れて返す(画面はそこまでを出して選択肢を見せる)。
// stepwise=true なら「1手ずつ」＝決めていない場面に来たら止まる。
// false（おまかせ）なら決めていない場面はAIの判断で進み、最後まで結果を出す。
// worst=true はあいてのわざを対面ごとに「こちらがいちばんキツいもの」にする(わざ運の最悪ケース)
function rbPlay(picks, foes, myShields, ans, stepwise, worst) {
  ans = ans || {};
  const legs = [];
  const st = picks.map(() => ({ alive: true, resume: null }));
  const nextAlive = from => {
    for (let i = 0; i < st.length; i++) if (st[(from + i) % st.length].alive) return (from + i) % st.length;
    return -1;
  };
  let mi = 0, fi = 0, base = 0, pending = null;
  let myShLeft = myShields, foeShLeft = rkShields();
  let foeResume = null;
  // あいてのわざはバトル中に変わらない。「自動(いちばんキツい)」も最初の対面で採用したわざに
  // 固定し、こちらの交代・被弾後の出し直しで同じあいてと再戦しても選び直さない
  const foeMvLock = {};
  let myEntry = RK_ENTER[RK.enter].me, foeEntry = RK_ENTER[RK.enter].foe;
  let swOkAt = 0;
  // ---- 開幕交代(1匹目を出してすぐ交代し、あいての硬直4.5秒を序盤に稼ぐ) ----
  // あいての打ちかけのノーマルアタック1発は交代先に入り、あいてはそのぶんのゲージを得る。
  // そのあと あいて9ターン硬直・自分1ターン硬直・交代クールタイム開始(通常の手動交代と同じ)
  let lead = null;
  if (RK.leadSwap && picks.length > 1 && foes.length) {
    const key = rbKey(0, 'lead', 0, 0);
    const lctx = { li: 0, base: 0, picks, swTo: picks.map((p, k) => k).filter(k => k > 0) };
    const opts = rbChoices({ kind: 'lead' }, lctx);
    const a = ans[key] || (stepwise ? null : RB_AUTO.lead);
    if (!a) {
      pending = { kind: 'lead', seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts };
    } else {
      const to = picks[a.to] ? a.to : 1;
      // 飛んでくる1発のダメージは、交代先 vs あいて で小さくシミュして読み取る
      // (タイプ相性・シャドウ・倍率込みの正確な値になる)。
      // わざ欄が「自動(いちばんキツい)」なら、いちばん痛いノーマルアタックが来るとして読む
      const R0 = rktCfg(foes[0], { shields: foeShLeft, stallStart: 0 });
      const lfList = foes[0].fast ? [R0.fast] : rkPool(foes[0].key).fasts;
      let hit = null;
      for (const f of lfList) {
        const probe = PvpEngine.simulate(D, { ...picks[to].base, ...picks[to].pol,
          charged: [], timing: 'shots', shotPlan: [], shotRest: null, shields: myShields },
          { ...R0, fast: f }, { ...SIMOPT, stopAt: 8 });
        for (const row of probe.rows) {
          const e = row.ev && row.ev[1];
          if (e && e.full === undefined && e.dmg != null) {
            if (!hit || e.dmg > hit.dmg) hit = { dmg: e.dmg, mv: e.move, eg: D.moves[f] ? D.moves[f].eg : 0 };
            break;
          }
        }
      }
      if (!hit) hit = { dmg: 1, mv: D.moves[R0.fast] ? D.moves[R0.fast].n : '',
        eg: D.moves[R0.fast] ? D.moves[R0.fast].eg : 0 };
      const maxB = PvpEngine.buildStats(D, picks[to].base).hp;
      const maxF = PvpEngine.buildStats(D, R0).hp;
      mi = to;
      st[to].resume = { hp: Math.max(0, maxB - hit.dmg), en: 0, buffs: [0, 0], stall: 0 };
      foeResume = { hp: maxF, en: Math.min(100, hit.eg), buffs: [0, 0], stall: 0 };
      myEntry = RK_ENTER.swap.me;
      foeEntry = RK_ENTER.swap.foe;
      swOkAt = RK.swapCd;
      lead = { hit: { mv: hit.mv, dmg: hit.dmg },
        pt: { kind: 'lead', seq: 0, w: 0, key, tn: 0, gt: 0, ctx: lctx, opts, ans: a, auto: !ans[key] } };
    }
  }
  while (fi < foes.length && mi >= 0 && legs.length < 12 && !pending) {
    const li = legs.length;
    const pol = picks[mi].pol;
    const spList = rbSpList(pol);
    const cost = spList.length ? Math.min(...spList.map(id => D.moves[id].e)) : 0;
    const swTo = picks.map((p, k) => k).filter(k => k !== mi && st[k].alive);
    const ctx = { li, base, cost, spList, picks, myShLeft, foeEntry, swOkAt, swTo, fast: pol.fast };
    const dec = { shots: [], wait: 0, hold: false, shieldAt: [], swapTo: null, swapAt: 0 };
    // 決めた場面はキーで覚える(「撃たない」を選ぶとその場面自体が消えるなど、
    // 決めるたびに場面の並びが変わるので、番号ではなくキーで対応づける)
    const handled = new Set(), log = [];   // log = 決めた場面の履歴(画面に出して選び直せるようにする)
    let res = null, foeMv = null;   // foeMv = 採用したあいてのわざ(自動のときHUDの表示に使う)
    // あいての採用わざ(自動=いちばんキツい)は、この対面をはじめて迎えた時点で
    // 「全部おまかせ」基準(1対1と同じエンジンの自動プレイ)の全通り評価で決めて、バトル中固定する。
    // 決断を反映した再計算で選び直すと、SP・シールド・交代に答えるたびに
    // あいてのわざが変わって見えてしまう(2026-08-10バグ修正)
    if (!foeMvLock[fi]) {
      const pool0 = rkPool(foes[fi].key);
      const Rb = rktCfg(foes[fi], { shields: foeShLeft, stallStart: foeEntry });
      if (foeResume) Rb.resume = { ...foeResume, stall: Math.max(foeResume.stall || 0, foeEntry) };
      const Lb = { ...picks[mi].base, ...pol, charged: spList.slice(), shields: myShLeft,
        bluff: true, timing: 'optimal' };
      if (st[mi].resume) Lb.resume = { ...st[mi].resume, stall: Math.max(st[mi].resume.stall || 0, myEntry) };
      else if (myEntry) Lb.stallStart = myEntry;
      const fl = (worst || !foes[fi].fast) ? pool0.fasts : [Rb.fast];
      const sl = (worst || !foes[fi].c1) ? (pool0.chargeds.length ? pool0.chargeds : [null]) : [Rb.throw || null];
      let bs = null, bmv = null;
      for (const f of fl) for (const sp of sl) {
        const r = PvpEngine.simulate(D, Lb, { ...Rb, fast: f, charged: sp ? [sp] : [], throw: sp }, SIMOPT);
        const s = rkWorstScore(r);
        if (bmv === null || s < bs) { bs = s; bmv = { fast: f, sp: sp || null }; }
      }
      if (bmv) foeMvLock[fi] = bmv;
    }
    // 決断を1つずつ解決する(1つ決めるたびに1ターン目から回し直す)
    for (let guard = 0; guard < 60; guard++) {
      // charged は必ず入れる(SPが1本の構成だと、わざ未指定のときエンジンが選べないため)
      const L = { ...picks[mi].base, ...pol, charged: spList.slice(), shields: myShLeft, bluff: true,
        timing: 'shots', shotPlan: dec.shots.map(s => ({ mode: s.wait, move: s.mv })), shotRest: null,
        shieldPlan: dec.shieldAt.slice(), shieldRest: false };
      if (st[mi].resume) L.resume = { ...st[mi].resume, stall: Math.max(st[mi].resume.stall || 0, myEntry) };
      else if (myEntry) L.stallStart = myEntry;
      const R = rktCfg(foes[fi], { shields: foeShLeft, stallStart: foeEntry });
      if (foeResume) R.resume = { ...foeResume, stall: Math.max(foeResume.stall || 0, foeEntry) };
      const sopt = { ...SIMOPT, stopAt: dec.swapAt };
      // あいてのわざ欄が「自動(いちばんキツい)」の項目は全通り試して、こちらに
      // いちばんキツいものを採用する(1対1の最悪ケース基準と結果がそろう)。
      // worst=true(わざ運の最悪) は、わざを指定していても全通りにする
      const pool = rkPool(foes[fi].key);
      const lock = foeMvLock[fi];   // 2対面目以降は最初に採用したわざで固定(途中で変わらない)
      const fList = lock ? [lock.fast] : (worst || !foes[fi].fast) ? pool.fasts : [R.fast];
      const spL = lock ? [lock.sp]
        : (worst || !foes[fi].c1) ? (pool.chargeds.length ? pool.chargeds : [null]) : [R.throw || null];
      res = null; let sc = null;
      for (const f of fList) for (const sp of spL) {
        const r = PvpEngine.simulate(D, L, { ...R, fast: f, charged: sp ? [sp] : [], throw: sp }, sopt);
        const s = rkWorstScore(r);
        if (!res || s < sc) { res = r; sc = s; foeMv = { fast: f, sp: sp || null }; }
      }
      const pts = rbPoints(rbTurns(res), ctx, dec);
      const p = pts.find(x => !handled.has(rbKey(li, x.kind, x.seq, x.w)));
      if (!p) break;                              // この対面で決めることはもう無い
      p.key = rbKey(li, p.kind, p.seq, p.w);
      p.gt = base + p.tn;
      const a = ans[p.key] || (stepwise ? null : RB_AUTO[p.kind]);
      if (!a) { pending = { ...p, ctx, opts: rbChoices(p, ctx) }; break; }
      handled.add(p.key);
      log.push({ ...p, ans: a, auto: !ans[p.key] });
      if (p.kind === 'swap') {
        if (a.a === 'stay') continue;             // 交代しないなら、そのまま先へ
        dec.swapTo = a.to;
        // すぐ交代=そのターンのうちに ／ それ以外=硬直のあいだ殴りきってから(旧共有リンクの t~ も同じ)
        dec.swapAt = a.a === 'toq' ? 1 : Math.max(1, ctx.foeEntry);
        continue;
      }
      rbApply(dec, p, a);
    }
    res.final[0].name = picks[mi].name;
    res.final[1].name = rktName(foes[fi]);
    const meDown = res.final[0].hp <= 0, foeDown = res.final[1].hp <= 0;
    const swapped = !!(res.stopped && dec.swapTo != null && !meDown && !foeDown);
    // この対面の「決断の場面」を最終状態で作り直す(画面に出してタップで選び直せるようにする)
    const points = log.map(p => ({ ...p, gt: base + p.tn, ctx, opts: rbChoices(p, ctx) }));
    legs.push({ res, base, myIdx: mi, foeIdx: fi, meName: picks[mi].name, foeName: rktName(foes[fi]),
      swOk: swOkAt,   // この対面中に交代が解禁される通しターン(HUDの交代タイマー用)
      meDown, foeDown, swapped, swapTo: swapped ? dec.swapTo : null, pol, li, points, foeMv,
      leadHit: li === 0 && lead ? lead.hit : null, leadPt: li === 0 && lead ? lead.pt : null,
      // hud = この対面が始まった時点の両者の状態(下の常駐フレームの表示に使う)
      hud: { hp0: st[mi].resume ? Math.max(0, st[mi].resume.hp) : res.final[0].hpMax,
             en0: st[mi].resume ? st[mi].resume.en : 0,
             b0: ((st[mi].resume && st[mi].resume.buffs) || [0, 0]).slice(),
             hp1: foeResume ? Math.max(0, foeResume.hp) : res.final[1].hpMax,
             en1: foeResume ? foeResume.en : 0,
             b1: ((foeResume && foeResume.buffs) || [0, 0]).slice() },
      pending: pending && pending.key.slice(0, pending.key.indexOf(':')) === String(li) ? pending : null });
    if (pending) break;
    base += res.turns;
    myShLeft = res.final[0].shields;
    foeShLeft = res.final[1].shields;
    st[mi].alive = !meDown;
    st[mi].resume = meDown ? null : res.final[0].resume;
    foeResume = foeDown ? null : res.final[1].resume;
    if (!meDown && !foeDown && !swapped) break;   // 上限ターンまで決着せず
    if (foeDown) fi++;
    if (swapped) {
      mi = dec.swapTo;
      swOkAt = base + RK.swapCd;
      foeEntry = Math.max(RK_ENTER.swap.foe, foeDown ? RK.koFoe : 0);
      myEntry = RK_ENTER.swap.me;
    } else {
      if (meDown) {
        // 倒された → 次に出すポケモンを選ぶ(残り1匹なら選ぶまでもない)
        const rest = picks.map((p, k) => k).filter(k => st[k].alive);
        if (rest.length > 1) {
          const key = rbKey(li, 'next', 0, 0), nctx = { ...ctx, swTo: rest };
          const a = ans[key] || (stepwise ? null : RB_AUTO.next);
          const pt = { kind: 'next', seq: 0, w: 0, key, tn: res.turns, gt: base, ctx: nctx,
            opts: rbChoices({ kind: 'next' }, nctx), ans: a, auto: !ans[key] };
          if (!a) { pending = pt; legs[legs.length - 1].pending = pt; break; }
          legs[legs.length - 1].nextPoint = pt;
          mi = a.a === 'to' ? a.to : nextAlive(mi);
        } else mi = rest.length ? rest[0] : -1;
      }
      foeEntry = Math.max(meDown ? RK.koMe : 0, foeDown ? RK.koFoe : 0);
      myEntry = 0;
    }
  }
  const meLeft = st.filter(s => s.alive).length;
  const foeLeft = foes.length - fi;
  const outcome = pending ? 'playing'
    : foeLeft === 0 ? (meLeft > 0 ? 'win' : 'draw') : (meLeft === 0 ? 'lose' : 'timeout');
  // 生き残っているぶんの残HP(割合の合計)。手順のよしあしを比べるのに使う
  const hpLeft = st.reduce((sum, s, i) => {
    if (!s.alive) return sum;
    const max = PvpEngine.buildStats(D, picks[i].base).hp;
    return sum + (s.resume ? Math.max(0, s.resume.hp) / max : 1);
  }, 0);
  return { legs, picks, st, outcome, meLeft, foeLeft, pending, turns: base, hpLeft,
    myShLeft, foeShLeft, nMe: picks.length, nFoe: foes.length };
}

// ---- 手順の自動探索 ----
// 対面ごとに「どのポケモンを出すか」「SPをどう撃つか（作戦）」「すぐ交代するか」を
// 総当たりし、ビームサーチ(見込みのある手順だけ残して次の対面へ)で通しの手順を組み立てる。
// goal='fast' … 早く倒しきる手順 ／ goal='safe' … 手持ちを多く残して確実に勝つ手順
const RB_GOAL = {
  fast: { label: '最速', tip: '倒しきるまでの時間がいちばん短い手順をさがします（ロケット団戦はここがいちばん大事）' },
  safe: { label: '安定', tip: '手持ちとHPをできるだけ多く残して勝つ手順をさがします（負けにくさ重視）' },
};
function rbScore(bt, goal) {
  const win = bt.outcome === 'win' ? 1 : 0;
  const killed = bt.nFoe - bt.foeLeft;
  // まず「倒した数」、次に目的に応じて 速さ / 残り、の順で比べる
  const core = win * 1e7 + killed * 1e5;
  return goal === 'fast'
    ? core - bt.turns * 10 + bt.hpLeft * 20 + bt.meLeft * 30
    : core + bt.meLeft * 2000 + bt.hpLeft * 800 - bt.turns;
}
// 「最速 / 安定」の手順をさがす。決断そのものを組み合わせて探すので、
// 見つかった手順は**そのまま画面の選択(ans)になる**＝探索の結果と表示が食い違わない。
// 各段で「まだ決めていない最初の場面」を選択肢ぶんだけ枝分かれさせ、見込みのある手だけ残す
function rbFind(picks, foes, myShields, goal) {
  const evalAns = ans => {
    const bt = rbPlay(picks, foes, myShields, ans, false);   // 残りはおまかせで最後まで通す
    return { ans, bt, sc: rbScore(bt, goal) };
  };
  let best = evalAns({});          // 何も決めない(全部おまかせ)を出発点にする
  let beam = [best];
  for (let depth = 0; depth < 24; depth++) {
    const cand = [];
    for (const b of beam) {
      const step = rbPlay(picks, foes, myShields, b.ans, true);
      if (!step.pending) continue;   // この手順はもう決めることが無い
      for (const o of step.pending.opts) cand.push(evalAns({ ...b.ans, [step.pending.key]: { ...o } }));
    }
    if (!cand.length) break;
    cand.sort((x, y) => y.sc - x.sc);
    beam = cand.slice(0, 5);
    if (beam[0].sc > best.sc) best = beam[0];
  }
  return best;
}

// 1ターン=0.5秒。通しターンから経過秒を出す
const rbSec = t => (t / 2).toFixed(1);
// 対面の中身を「1ターン=1行」にまとめ直す(番号行＋そのあとの'-'行を1ターンとして扱う)
function rbTurns(res) {
  const out = [];
  res.rows.forEach(row => {
    if (row.tn !== '-') out.push({ tn: row.tn, rows: [row] });
    else if (out.length) out[out.length - 1].rows.push(row);
  });
  return out.map(t => {
    const ev = [[], []];
    let stalled = false;
    t.rows.forEach(r => {
      for (let i = 0; i < 2; i++) if (r.ev[i]) ev[i].push(r.ev[i]);
      if (r.stalled && r.stalled[1]) stalled = true;
    });
    const last = t.rows[t.rows.length - 1];
    // SPアタック・シールド・能力変化・決着のあるターンは「見どころ」として必ず表示する
    const key = ev.some(list => list.some(e => e.full !== undefined || e.buff || e.shielded || e.disguised)) ||
      last.state[0].hp === 0 || last.state[1].hp === 0;
    return { tn: t.tn, ev, state: last.state, stalled, key };
  });
}
// じぶんが撃てるSPアタックの一覧(1本でも2本でも同じ形にする)
const rbSpList = pol => (pol.charged && pol.charged.length ? pol.charged : (pol.throw ? [pol.throw] : []));

// ==== 模擬戦の画面: ゲームと同じ流れで「観て・選ぶ」 ====
// タイムラインは実際のバトルと同じ 1ターン=0.5秒 で上から下へ流れ、
// 決断の場面に来ると止まって、下の常駐フレーム(HUD)の上に選択ウィンドウが出る。
// HUD = 両者の HP・ゲージ・シールド・能力変化・残り手持ち(モンスターボール)を常に表示
// started=false のあいだは再生せず「バトルスタート！」ボタンを出す
// (ポケモンやわざの入力中に勝手にシミュが動き始めないように)
const RBV = { cur: 0, playing: true, speed: 1, timer: null, started: false, sig: undefined };
const RBUI = { pts: {}, order: [], open: null };
const RB_ICON = { sp: '⚡', sh: '🛡', swap: SWAPMK, next: '💀', lead: SWAPMK };
// 選び直したら、その決断より後ろの答えは消す(前提が変わるので、そこから先はおまかせに戻る)
function rbTrim(key) {
  const i = RBUI.order.indexOf(key);
  if (i < 0) return;
  RBUI.order.slice(i + 1).forEach(k => delete RB.ans[k]);
}
function rbAskTitle(p) {
  if (p.kind === 'lead') return SWAPMK + ' 開幕交代';
  if (p.kind === 'sp') return '⚡ SPアタック';
  if (p.kind === 'sh') return `🛡 ${p.mv || 'SPアタック'}が来る！`;
  if (p.kind === 'swap') return SWAPMK + ' 交代する？';
  return '💀 次に出すのは？';
}
function rbAnsLabel(p, a) {
  if (!a) return '？';
  if (p.kind === 'sp') {
    if (a.a === 'auto') return 'おまかせ';
    if (a.a === 'fire') return `▶ ${D.moves[a.mv] ? D.moves[a.mv].n : a.mv}`;
    if (a.a === 'wait') return `＋${a.n}`;
    return '撃たない';
  }
  // チップは種別アイコン(RB_ICON)と並べて出すので、ここでは🛡や⇄を重ねない
  if (p.kind === 'sh') return a.a === 'no' ? '受ける' : '使う';
  if (p.kind === 'swap' || p.kind === 'lead') {
    if (a.a === 'stay') return 'このまま';
    const nm = p.ctx.picks[a.to] ? p.ctx.picks[a.to].name : '';
    if (p.kind === 'lead') return `${nm}に交代`;
    if (a.a === 'toq') return `${nm}にすぐ交代`;
    const fm = p.ctx.fast && D.moves[p.ctx.fast];
    const n = fm ? Math.floor((p.ctx.foeEntry || 0) / (fm.tn || 1)) : 0;
    return `${fm && n ? `${fm.n}＋${n}のあと` : ''}${nm}に交代`;
  }
  return a.a === 'order' ? '順番どおり' : (p.ctx.picks[a.to] ? p.ctx.picks[a.to].name : '');
}
const rbSameAns = (a, o) => !!a && a.a === o.a && a.mv === o.mv && a.n === o.n && a.to === o.to;
// 能力変化のタグ(⬆⬇)。1段階ちょうど以外は段階数を添える
function buffTag(bf) {
  let out = '';
  for (let k = 0; k < 2; k++) {
    const d = Math.round((bf.to[k] - bf.from[k]) * 10) / 10;
    if (!d) continue;
    out += `<i class="bf ${d > 0 ? 'up' : 'dn'}">${bf.target === 'opponent' ? '相手' : ''}${'攻防'[k]}${d > 0 ? '⬆' : '⬇'}${Math.abs(d) === 1 ? '' : Math.abs(d)}</i>`;
  }
  return out;
}

function runRkBuild() {
  const body = document.querySelector('#rkteam .rkbody');
  const mine = [0, 1, 2].filter(i => PT[i]).map(i => PT[i]);
  const foes = [0, 1, 2].filter(i => RKT[i]).map(i => RKT[i]);
  updateUrl();
  renderRkDetail();   // 詳細パネル(開いていれば、枠の増減に追従する)
  clearInterval(RBV.timer); RBV.timer = null;
  if (!mine.length || !foes.length) {
    body.innerHTML = `<div class="mtnote">${!mine.length ? '<b>じぶん</b>' : ''}${!mine.length && !foes.length ? 'と' : ''}` +
      `${!foes.length ? '<b>あいて</b>' : ''}のポケモンを枠に入れてください（1匹ずつでもOK）</div>`;
    return;
  }
  // 入力(ポケモン・わざ・あいて等)が変わったら、前のバトルの選択と再生位置は仕切り直す
  const sig = JSON.stringify([mine, foes, rbMyMoves(), RK.kind, RK.enter, RK.stall, SIMOPT.buffMode, RK.leadSwap]);
  if (RBV.sig !== sig) {
    if (RBV.sig !== undefined) { RB.ans = {}; RBUI.open = null; RB.found = null; }
    RBV.sig = sig; RBV.started = false; RBV.cur = 0; RBV.playing = true;
  }
  const token = ++multiToken;
  const go = () => {
    if (token !== multiToken) return;
    const picks = rbPicksCached(mine, foes, RK.sh);
    const bt = rbPlay(picks, foes, RK.sh, RB.ans, RB.step);
    // 決着まで出ているときだけ、まとめ(わざ運の最悪)を添える。
    // あいてのわざが全部「自動(いちばんキツい)」なら主結果がそのまま最悪ケースなので出さない
    const anyFixed = foes.some(f => f.fast || f.c1);
    const extra = bt.pending || !anyFixed ? {} : { worst: rbPlay(picks, foes, RK.sh, RB.ans, false, true) };
    rbRender(body, bt, picks, foes, extra);
  };
  if (rbPicksHas(mine, foes, RK.sh)) go();
  else { body.innerHTML = '<div class="mtprog">計算中…</div>'; setTimeout(go, 0); }
}

function rbRender(body, bt, picks, foes, extra) {
  // わざ欄が「自動(いちばんキツい)」のあいては、候補の全わざを確率わざの判定に含める
  setProbTab(anyProbMove(picks.map(p => p.pol).concat(foes.map(f => {
    const pool = rkPool(f.key);
    return { charged: (f.fast ? [f.fast] : pool.fasts).concat(f.c1 ? [f.c1] : pool.chargeds) };
  }))));
  extra = extra || {};
  RBUI.pts = {}; RBUI.order = [];
  const regPt = p => { if (p) { RBUI.pts[p.key] = p; RBUI.order.push(p.key); } };
  bt.legs.forEach(leg => { regPt(leg.leadPt); (leg.points || []).forEach(regPt); regPt(leg.nextPoint); regPt(leg.pending); });

  // ---- タイムラインの項目(全ターン)と、ターンごとの状況(HUD用)を作る ----
  // items は時系列どおりに積む(gt=通しターン。表示はそこまで「再生」が進んだら出す)
  const items = [], frames = [];
  let alive0 = picks.length, alive1 = foes.length;
  let sh0 = RK.sh, sh1 = rkShields();
  const shMax0 = RK.sh, shMax1 = rkShields();
  const evCell = list => list.map(e => {
    const b = e.buff ? buffTag(e.buff) : '';
    if (e.full !== undefined) return `<span class="ev sp">${mvChip(e.move, 13)}${
      e.shielded ? '<i class="blk">🛡ブロック</i>' : `<b class="dmg">-${e.dmg}</b>`}${b}</span>`;
    return `<span class="ev">${mvChip(e.move, 12)}<b class="dmg">-${e.dmg}</b>${b}</span>`;
  }).join('');
  const chipItem = (p, gt) => ({ gt, html: `<div class="fc"><button class="fchip${p.auto ? ' auto' : ''}"
    data-k="${p.key}" title="タップすると、この場面からやり直せます">${RB_ICON[p.kind]}<b>${rbAnsLabel(p, p.ans)}</b></button></div>` });
  bt.legs.forEach(leg => {
    const res = leg.res, base = leg.base;
    // あいてのSPは実際に採用されたわざ(自動なら「いちばんキツい」と選ばれたもの)で出す
    const fsp = leg.foeMv ? leg.foeMv.sp : rktCfg(foes[leg.foeIdx]).throw;
    const meta = {
      name0: leg.meName, name1: leg.foeName,
      cp0: res.final[0].cp, cp1: res.final[1].cp,
      max0: res.final[0].hpMax, max1: res.final[1].hpMax,
      sp0: rbSpList(leg.pol).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      sp1: fsp ? [{ n: D.moves[fsp].n, e: D.moves[fsp].e }] : [],
      swOk: leg.swOk || 0,   // 交代が解禁される通しターン(残り秒は表示時に gt から計算)
    };
    let b0 = leg.hud.b0.slice(), b1 = leg.hud.b1.slice();
    if (leg.leadPt) items.push(chipItem(leg.leadPt, base));
    items.push({ gt: base, html: `<div class="flg"><span class="me">${leg.meName}</span><em>VS</em><span class="foe">${leg.foeName}</span></div>` });
    if (leg.leadHit) items.push({ gt: base, html: `<div class="ft"><div class="c me"></div><i class="tn">${base}</i>
      <div class="c foe">${evCell([{ move: leg.leadHit.mv, dmg: leg.leadHit.dmg }])}</div></div>` });
    frames[base] = { meta, hp0: leg.hud.hp0, en0: leg.hud.en0, hp1: leg.hud.hp1, en1: leg.hud.en1,
      b0: b0.slice(), b1: b1.slice(), sh0, sh1, alive0, alive1 };
    const ptAt = {};
    (leg.points || []).forEach(p => (ptAt[p.tn] = ptAt[p.tn] || []).push(p));
    // 決断待ちより先は「まだ起きていない」ので描かない。ただし同じターンの中でも
    // 「もう決まった出来事」は見せる＝出来事の単位で隠す。
    //   sp待ち: 質問はゲージが条件を満たした(=ノーマルが当たった)ターンに出るが、
    //           撃つ場合も発動は次の行動ターン。質問ターンの出来事はすべて確定なので全部見せる
    //           (隠すと「＋2で待った2発目」が見えず、打ったかどうか確認できない。実装時に踏んだ)
    //   sh待ち: 質問対象のあいてのSPから先を隠す(それより前のノーマルの応酬は決まっている)
    //   swap待ち: そのターンまで殴ってから聞く仕様なので、ターンはすべて見せる
    const pend = leg.pending && leg.pending.kind !== 'next' ? leg.pending : null;
    rbTurns(res).forEach(t => {
      if (pend && t.tn > pend.tn) return;
      const gt = base + t.tn;
      const partial = pend && pend.kind === 'sh' && t.tn === pend.tn;
      let ev0 = t.ev[0], ev1 = t.ev[1];
      if (partial) {
        const k = ev1.findIndex(e => e.full !== undefined);
        if (k >= 0) ev1 = ev1.slice(0, k);
      }
      // シールド・能力変化の追跡は「見せる出来事」だけに対して行う(仮の結果を混ぜない)
      for (let i = 0; i < 2; i++) for (const e of (i ? ev1 : ev0)) {
        if (e.shielded) { if (i === 0) sh1--; else sh0--; }
        if (e.buff) { const tgt = e.buff.target === 'opponent' ? 1 - i : i;
          if (tgt === 0) b0 = e.buff.to.slice(); else b1 = e.buff.to.slice(); }
      }
      if (!partial) {
        frames[gt] = { meta, hp0: t.state[0].hp, en0: t.state[0].en, hp1: t.state[1].hp, en1: t.state[1].en,
          b0: b0.slice(), b1: b1.slice(), sh0, sh1, alive0, alive1 };
      } else {
        // 決断待ちのターンのHUDは、前のターンのHP・ゲージのまま(結果はまだ決まっていない)
        const pf = frames[gt - 1] || frames[base];
        frames[gt] = { meta, hp0: pf.hp0, en0: pf.en0, hp1: pf.hp1, en1: pf.en1,
          b0: b0.slice(), b1: b1.slice(), sh0, sh1, alive0, alive1 };
      }
      const e0 = evCell(ev0);
      const e1 = evCell(ev1) + (t.stalled && !ev1.length ? '<i class="stall">⏸</i>' : '');
      items.push(!e0 && !e1
        ? { gt, html: `<div class="ft q"><i class="tn">${gt}</i></div>` }
        : { gt, html: `<div class="ft"><div class="c me">${e0}</div><i class="tn">${gt}</i><div class="c foe">${e1}</div></div>` });
      (ptAt[t.tn] || []).forEach(p => items.push(chipItem(p, gt)));
    });
    const endGt = base + res.turns;
    // 決断待ちのあいだは倒れたかどうかもまだ決まっていない(仮の結果)ので出さない
    if (!pend) {
      if (leg.foeDown) { alive1--; items.push({ gt: endGt,
        html: `<div class="fko win">💥 ${leg.foeName} をたおした！<i>⏱${rbSec(endGt)}</i></div>` }); }
      if (leg.meDown) { alive0--; items.push({ gt: endGt,
        html: `<div class="fko lose">💀 ${leg.meName} はたおれた</div>` }); }
      if (leg.meDown || leg.foeDown) {
        const f = frames[endGt] || frames[endGt - 1];
        if (f) frames[endGt] = { ...f, alive0, alive1 };
      }
    }
    if (leg.nextPoint) items.push(chipItem(leg.nextPoint, endGt));
  });
  // 開幕交代の質問中はまだ対面が無いので、1匹目とあいて1匹目の初期状態を出しておく
  if (!bt.legs.length && bt.pending && foes.length) {
    const F = rktCfg(foes[0]);
    const sA = PvpEngine.buildStats(D, picks[0].base), sF = PvpEngine.buildStats(D, F);
    items.push({ gt: 0, html: `<div class="flg"><span class="me">${picks[0].name}</span><em>VS</em><span class="foe">${rktName(foes[0])}</span></div>` });
    frames[0] = { meta: { name0: picks[0].name, name1: rktName(foes[0]), cp0: sA.cp, cp1: sF.cp, max0: sA.hp, max1: sF.hp,
      sp0: rbSpList(picks[0].pol).map(id => ({ n: D.moves[id].n, e: D.moves[id].e })),
      sp1: F.throw ? [{ n: D.moves[F.throw].n, e: D.moves[F.throw].e }] : [] },
      hp0: sA.hp, en0: 0, hp1: sF.hp, en1: 0, b0: [0, 0], b1: [0, 0], sh0, sh1, alive0, alive1 };
  }
  const stop = bt.pending ? bt.pending.gt : bt.turns;
  for (let g = 1; g <= stop; g++) if (!frames[g]) frames[g] = frames[g - 1];
  // 決着のまとめ(再生が最後まで来たら出る)
  if (!bt.pending) {
    const o = RK_OUTCOME[bt.outcome];
    const wo = extra.worst && RK_OUTCOME[extra.worst.outcome];
    items.push({ gt: stop, html: `<div class="rbfin">
      <div class="rkverdict ${o.cls}">${o.mark} ${o.txt}
        <small>じぶん ${bt.meLeft}/${bt.nMe} ／ あいて ${bt.foeLeft}/${bt.nFoe} ・ ⏱<b>${rbSec(bt.turns)}</b>秒 ・ 🛡${bt.myShLeft}／${bt.foeShLeft}</small></div>
      ${!wo ? '' : `<div class="rkworst ${wo.cls === 'win' ? 'ok' : 'ng'}"
        title="あいてが対面ごとに、こちらにいちばんキツいわざを打ってきた場合">
        🎲 わざ運が最悪でも <b>${wo.txt}</b>
        <small>じぶん${extra.worst.meLeft}/${extra.worst.nMe} ／ あいて${extra.worst.foeLeft}/${extra.worst.nFoe} ・ ⏱${rbSec(extra.worst.turns)}秒</small></div>`}
    </div>` });
  }

  // ---- 画面を組む ----
  body.innerHTML = `<div class="rbctlbar">
      <div class="rbctl">
        <div class="rbrow1 rbfind"><span class="lbl">🔎 オートバトル</span>
          ${Object.keys(RB_GOAL).map(g => `<button class="rbgo" data-g="${g}" aria-pressed="${RB.goal === g}" title="${RB_GOAL[g].tip}（押して選んでから ▶ バトルスタート！で開始）">${RB_GOAL[g].label}</button>`).join('')}
          ${RB.step ? `<button class="rbclear" style="display:${RBV.started || rbAnsCount() ? '' : 'none'}" title="選んだ手を消して、もう一度はじめからバトルします">▶ バトルスタート！</button>`
            : (rbAnsCount() ? '<button class="rbclear" title="選んだ手をすべて消して、全部おまかせに戻します">選び直す</button>' : '')}
        </div>
        ${RB.found ? `<div class="rbfound">${RB.found}</div>` : ''}
      </div>
      <button class="rbonly" aria-pressed="${!RB.step}" title="バトルを流さず、結果を一気に出します。もう一度押すとバトル表示に戻ります">結果だけ見る</button>
    </div>
    <div class="rbfeed">${items.map(x => `<div class="fi future" data-gt="${x.gt}">${x.html}</div>`).join('')}</div>
    <div class="rbdock">
      <div class="rbwinbox"></div>
      <div class="rbhud">
        <div class="hs me"><div class="hn"><span class="nm"></span><b class="cp"></b><b class="hpn"></b></div>
          <div class="hb"><i></i></div>
          <div class="hx"><span class="balls"></span><span class="shds"></span><span class="gqs"></span><span class="bfs"></span></div>
          <div class="hswap" title="次に交代できるまでの残り時間（一度交代すると45秒間は次の交代ができません）"></div>
        </div>
        <div class="hm"><b class="clk">0.0</b><i class="trn">0T</i>
          <div class="hctl">${RB.step ? `<button class="hplay" title="一時停止／再生">⏸</button><button class="hspd" title="再生の速さ">×${RBV.speed}</button><button class="hskip" title="次の決断まで飛ばす">⏩</button><button class="hstop" title="もう一度バトルスタート！（選んだ手は消えます）">⏹</button>` : ''}</div>
        </div>
        <div class="hs foe"><div class="hn"><b class="hpn"></b><b class="cp"></b><span class="nm"></span></div>
          <div class="hb"><i></i></div>
          <div class="hx"><span class="bfs"></span><span class="gqs"></span><span class="shds"></span><span class="balls"></span></div>
        </div>
      </div>
    </div>`;

  // ---- 再生(1ターン=0.5秒で流す)と HUD の更新 ----
  const feedEl = body.querySelector('.rbfeed');
  const els = [...feedEl.children];
  const dock = body.querySelector('.rbdock');
  const winbox = dock.querySelector('.rbwinbox');
  const hud = dock.querySelector('.rbhud');
  const sideRefs = side => {
    const el = hud.querySelector('.hs.' + side);
    return { nm: el.querySelector('.nm'), cp: el.querySelector('.cp'), bar: el.querySelector('.hb i'),
      hpn: el.querySelector('.hpn'),
      balls: el.querySelector('.balls'), shds: el.querySelector('.shds'),
      gqs: el.querySelector('.gqs'), bfs: el.querySelector('.bfs') };
  };
  const R0 = sideRefs('me'), R1 = sideRefs('foe');
  const clk = hud.querySelector('.clk'), trn = hud.querySelector('.trn');
  const swapEl = hud.querySelector('.hs.me .hswap');   // 交代タイマー(じぶん側だけ)
  let ptr = 0, lastEl = null, curLegKey = '';
  function updateHud(gt) {
    const f = frames[Math.max(0, Math.min(gt, stop))];
    if (!f) return;
    const legKey = f.meta.name0 + '|' + f.meta.name1;
    if (legKey !== curLegKey) {   // 対面が変わったときだけ名前・CP・ゲージの器を作り直す
      curLegKey = legKey;
      [[R0, f.meta.name0, f.meta.cp0, f.meta.sp0], [R1, f.meta.name1, f.meta.cp1, f.meta.sp1]].forEach(([Rf, nm, cp, sps]) => {
        // 下のフレームは幅が狭いので「シャドウ○○」は「S○○」に縮める(ロケット団はほぼ全部シャドウ)
        Rf.nm.textContent = nm.replace(/^シャドウ/, 'S');
        Rf.nm.title = nm;
        Rf.cp.textContent = 'CP' + cp;
        Rf.gqs.innerHTML = sps.map(m => `<span class="gq" data-e="${m.e}" title="${m.n}（ゲージ${m.e}）"><i>${typeIconHTML(D.typeJa[MOVE_TYPE[m.n]] || '', 13)}</i><b></b></span>`).join('');
      });
    }
    const set = (Rf, hp, max, en, sh, shMax, alive, total, b) => {
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      // HPが1でも残っているうちはバーを空に見せない(残りわずかでも「まだ倒せていない」と分かるように)
      Rf.bar.style.width = (hp > 0 ? Math.max(pct, 4) : 0) + '%';
      const cls = pct > 50 ? 'g' : pct > 20 ? 'y' : 'r';
      Rf.bar.className = cls;
      // バーだけでは残りわずかが読み取れないので、実数値も出す(色はバーと同じ基準)
      Rf.hpn.textContent = hp + '/' + max;
      Rf.hpn.className = 'hpn ' + cls;
      Rf.balls.innerHTML = Array.from({ length: total }, (_, i) => `<i class="pb${i < alive ? '' : ' off'}"></i>`).join('');
      Rf.shds.innerHTML = Array.from({ length: shMax }, (_, i) => `<i class="shd${i < sh ? '' : ' off'}">🛡</i>`).join('');
      Rf.bfs.innerHTML = [0, 1].map(k => !b[k] ? '' :
        `<i class="bf ${b[k] > 0 ? 'up' : 'dn'}">${'攻防'[k]}${b[k] > 0 ? '⬆' : '⬇'}${Math.abs(b[k]) === 1 ? '' : Math.abs(b[k])}</i>`).join('');
      // SPゲージ: 1周=1発ぶん。2周目・3周目は色を変えて重ね、数字は「いま撃てる発数」
      // (グロウパンチ35なら最大2.86周。何発ぶん溜まっているかが一目で分かるように)
      Rf.gqs.querySelectorAll('.gq').forEach(g => {
        const e = +g.dataset.e;
        const laps = Math.floor(en / e);                       // 撃てる発数
        const prog = (en - laps * e) / e * 100;                // いまの周の溜まり具合
        const cur = cols[Math.min(laps, cols.length - 1)];
        const below = laps > 0 ? cols[Math.min(laps - 1, cols.length - 1)] : 'rgba(255,255,255,.09)';
        g.style.background = `conic-gradient(${cur} ${prog}%, ${below} 0)`;
        g.style.setProperty('--gqc', laps > 0 ? below : cur);
        g.classList.toggle('on', laps >= 1);
        g.querySelector('b').textContent = laps >= 1 ? laps : '';
      });
    };
    const GQC_ME = ['#43e0ff', '#ffd54a', '#ff6b81'], GQC_FOE = ['#ffd54a', '#ff6b81', '#b06cff'];
    let cols = GQC_ME;
    set(R0, f.hp0, f.meta.max0, f.en0, f.sh0, shMax0, f.alive0, picks.length, f.b0);
    cols = GQC_FOE;
    set(R1, f.hp1, f.meta.max1, f.en1, f.sh1, shMax1, f.alive1, foes.length, f.b1);
    clk.textContent = rbSec(gt);
    trn.textContent = gt + 'T';
    // 交代のクールタイム(45秒)の残り。0になったら消える＝出ていなければいつでも交代できる
    const swLeft = Math.max(0, (f.meta.swOk || 0) - gt);
    swapEl.innerHTML = swLeft > 0 ? `${SWAPMK}<b>${Math.ceil(swLeft / 2)}</b><small>秒</small>` : '';
  }
  const revealTo = g => {
    while (ptr < els.length && +els[ptr].dataset.gt <= g) {
      els[ptr].classList.remove('future'); els[ptr].classList.add('in');
      lastEl = els[ptr]; ptr++;
    }
  };
  const autoScroll = () => {
    if (!lastEl) return;
    const target = lastEl.getBoundingClientRect().bottom + scrollY - (innerHeight - dock.offsetHeight - 10);
    // 手で上へスクロールして読み返しているときは連れ戻さない
    if (target > scrollY && target - scrollY < innerHeight * 1.5)
      scrollTo({ top: target, behavior: RBV.speed === 1 ? 'smooth' : 'auto' });
  };
  const stopTimer = () => { clearInterval(RBV.timer); RBV.timer = null; };
  const ended = () => RBV.cur >= stop && !bt.pending;
  const setPlayBtn = () => {
    const b = hud.querySelector('.hplay');
    if (b) b.textContent = ended() ? '↻' : RBV.timer ? '⏸' : '▶';
  };
  function showWin(p, editing) {
    RBV.playing = !editing && RBV.playing;
    stopTimer(); setPlayBtn();
    const btns = p.opts.map((o, i) => `<button class="${o.cls || ''}${rbSameAns(p.ans, o) ? ' on' : ''}"
        data-k="${p.key}" data-i="${i}" title="${o.tip || ''}">${o.label}</button>`).join('')
      + (p.kind === 'sp' ? `<button class="hold" data-k="${p.key}" data-i="auto" title="AIの判断にまかせます">おまかせ</button>` : '')
      + (editing && p.ans && !p.auto ? `<button class="hold" data-k="${p.key}" data-i="reset" title="この場面をおまかせに戻します">↺</button>` : '');
    winbox.innerHTML = `<div class="rbwin">
      <div class="rwt">${rbAskTitle(p)}<span>${p.gt}T ⏱${rbSec(p.gt)}</span>${editing ? '<button class="wx" title="閉じる">✕</button>' : ''}</div>
      <div class="rwb">${btns}</div></div>`;
    winbox.querySelectorAll('.rwb button').forEach(b => b.onclick = () => {
      rbTrim(p.key);
      if (b.dataset.i === 'reset') delete RB.ans[p.key];
      else if (b.dataset.i === 'auto') RB.ans[p.key] = { ...RB_AUTO[p.kind] };
      else RB.ans[p.key] = { ...p.opts[+b.dataset.i] };
      RBUI.open = null; RBV.playing = true;
      run();
    });
    const wx = winbox.querySelector('.wx');
    if (wx) wx.onclick = () => { RBUI.open = null; RBV.playing = true; run(); };
    // ウィンドウが出たぶん画面下が高くなるので、最新のターンが隠れないように追従する
    autoScroll();
  }
  function atStop() {
    stopTimer();
    if (bt.pending) showWin(bt.pending, false);
    else RBV.playing = false;
    setPlayBtn();
  }
  function tick() {
    if (!document.body.contains(feedEl)) { stopTimer(); return; }
    RBV.cur++;
    revealTo(RBV.cur);
    updateHud(RBV.cur);
    autoScroll();
    if (RBV.cur >= stop) atStop();
  }
  const startTimer = () => { stopTimer(); RBV.timer = setInterval(tick, 500 / RBV.speed); setPlayBtn(); };

  // ---- 操作の配線 ----
  // 「結果だけ見る」: バトルを流さず一気に表示。もう一度押すとバトル表示へ戻る
  const only = body.querySelector('.rbonly');
  if (only) only.onclick = () => {
    RB.step = !RB.step;
    RBV.cur = RB.step ? 0 : 1e9; RBV.playing = true; RBUI.open = null;
    run();
  };
  const restart = () => {
    RB.ans = {}; RBUI.open = null; RB.found = null;
    RBV.cur = 0; RBV.playing = true;
    if (RB.step) RBV.started = true;   // そのまま新しいバトルが最初から始まる
    if (RB.step && RB.goal) { applyGoal(); return; }   // オートバトルを選んでいれば探索してから再生
    run();
  };
  const clr = body.querySelector('.rbclear');
  if (clr) clr.onclick = restart;
  // 手順の自動探索: 見つかった手順をそのまま決断の答えに入れて、バトルで再生する
  // 最速/安定は「押して選んでおく」だけ。▶ バトルスタート！を押したときに探索して再生する
  body.querySelectorAll('.rbgo').forEach(b => b.onclick = () => {
    const g = b.dataset.g;
    RB.goal = RB.goal === g ? null : g;
    body.querySelectorAll('.rbgo').forEach(x => x.setAttribute('aria-pressed', x.dataset.g === RB.goal));
  });
  const mine2 = () => [0, 1, 2].filter(i => PT[i]).map(i => PT[i]);
  // 選んでおいたオートバトル(最速/安定)の手順をさがして、そのまま再生する
  const applyGoal = () => {
    const r = rbFind(rbPicksCached(mine2(), foes, RK.sh), foes, RK.sh, RB.goal);
    if (!r) { RB.found = '手順が見つかりませんでした。'; run(); return; }
    RB.ans = r.ans; RBUI.open = null;
    const o2 = RK_OUTCOME[r.bt.outcome];
    RB.found = `🔎 ${RB_GOAL[RB.goal].label} → <b class="${o2.cls === 'win' ? 'ok' : 'ng'}">${o2.txt}</b>` +
      `　⏱<b>${rbSec(r.bt.turns)}</b>秒　じぶん ${r.bt.meLeft}/${r.bt.nMe}`;
    RBV.cur = 0; RBV.playing = true; RBV.started = true;
    run();
  };
  // 決めた場面のチップ → その場面からやり直す
  feedEl.querySelectorAll('.fchip').forEach(b => b.onclick = () => {
    const p = RBUI.pts[b.dataset.k];
    if (!p) return;
    RBUI.open = p.key; RBV.cur = p.gt;
    run();
  });
  // HUDの再生コントロール
  const hplay = hud.querySelector('.hplay'), hspd = hud.querySelector('.hspd'), hskip = hud.querySelector('.hskip');
  const startBattle = () => {
    RBV.started = true; RBV.playing = true;
    if (RB.goal) { applyGoal(); return; }   // オートバトルを選んでいれば探索してから再生
    winbox.innerHTML = '';
    if (clr) clr.style.display = '';   // 走り出したら上にも「▶ バトルスタート！」(やり直し)を出す
    if (RBV.cur >= stop) atStop();     // 開幕交代など、最初の決断が0ターン目ならすぐ聞く
    else startTimer();
  };
  if (hplay) hplay.onclick = () => {
    if (!RBV.started) { startBattle(); return; }
    if (ended()) { RBV.cur = 0; RBV.playing = true; run(); return; }   // ↻ 最初から再生
    if (RBV.cur >= stop) return;   // 決断待ちのあいだは選択がすべて
    if (RBV.timer) { RBV.playing = false; stopTimer(); } else { RBV.playing = true; startTimer(); }
    setPlayBtn();
  };
  if (hspd) hspd.onclick = () => {
    RBV.speed = RBV.speed === 1 ? 2 : RBV.speed === 2 ? 4 : 1;
    hspd.textContent = '×' + RBV.speed;
    if (RBV.timer) startTimer();
  };
  if (hskip) hskip.onclick = () => {
    RBV.started = true;
    RBV.cur = stop; revealTo(stop); updateHud(stop); autoScroll();
    if (RBV.timer || bt.pending) atStop(); else { RBV.playing = false; setPlayBtn(); }
  };
  const hstop = hud.querySelector('.hstop');
  if (hstop) hstop.onclick = restart;

  // ---- 初期表示(再生の途中状態を引き継ぐ) ----
  RBV.cur = Math.max(0, Math.min(RBV.cur, stop));
  if (!RB.step) RBV.cur = stop;   // 結果だけ: 最後まで一気に出す
  if (RB.step && !RBV.started) {
    // まだスタートしていない: VSカードと両者の状態だけ見せて、スタートボタンを待つ
    RBV.cur = 0;
    revealTo(0);
    updateHud(0);
    winbox.innerHTML = '<button class="rbstart">▶ バトルスタート！</button>';
    winbox.querySelector('.rbstart').onclick = startBattle;
    setPlayBtn();
    return;
  }
  revealTo(RBV.cur);
  updateHud(RBV.cur);
  if (RBUI.open && RBUI.pts[RBUI.open]) showWin(RBUI.pts[RBUI.open], true);
  else if (RBV.cur >= stop) atStop();
  else if (RB.step && RBV.playing) startTimer();
  setPlayBtn();
}

const mvName2 = id => D.moves[id] ? D.moves[id].n : id;

const RK_OUTCOME = {
  win:  { cls: 'win',  txt: '勝利', mark: '🏆' },
  lose: { cls: 'lose', txt: '敗北', mark: '💥' },
  draw: { cls: 'lose', txt: '相打ち', mark: '🤝' },
  timeout: { cls: 'lose', txt: '決着つかず', mark: '⏱' },
};
// ---- ★登録リスト(端末内保存・両側の欄から呼び出せる) ----
const MYPK_KEY = 'gbl_mypoke';
const loadMyPk = () => { try { return JSON.parse(localStorage.getItem(MYPK_KEY)) || []; } catch (e) { return []; } };
const saveMyPkList = list => { try { localStorage.setItem(MYPK_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {} };
function renderMyPk() {
  const list = loadMyPk();
  sideEl.forEach((el, i) => {
    const box = el.querySelector('.mypklist');
    if (!list.length) {
      box.innerHTML = '<div class="mypkempty">まだ登録がありません。ポケモンを選んで「★登録」を押すとここに追加されます</div>';
      return;
    }
    box.innerHTML = list.map((m, k) => {
      const p = D.pokemon[m.key];
      if (!p || !rkFoeOk(i, m.key)) return '';   // あいて側はメガ・ゲンシを出さない
      const iv = m.ivMode === 'manual' && m.mIvs ? `<i>${m.mIvs.join('/')} PL${m.mLevel}</i>` : '<i>理想個体値</i>';
      return `<div class="mypkrow" data-k="${k}"><span>${m.shadow ? 'シャドウ' : ''}${p.n}${iv}</span><b class="del" data-del="${k}">×</b></div>`;
    }).join('');
    box.querySelectorAll('.mypkrow').forEach(row => row.onclick = e => {
      if (e.target.dataset.del !== undefined) {   // ×で削除
        const l = loadMyPk(); l.splice(+e.target.dataset.del, 1); saveMyPkList(l); renderMyPk();
        return;
      }
      applyMyPk(i, loadMyPk()[+row.dataset.k]);
      box.style.display = 'none';   // 選んだら一覧を閉じる
      el.querySelector('.mypktab').setAttribute('aria-pressed', 'false');
    });
  });
}
function applyMyPk(i, m, skipRun) {
  if (!m || !D.pokemon[m.key]) return;
  S[i].key = m.key;
  S[i].fast = m.fast || null; S[i].c1 = m.c1 || null; S[i].c2 = m.c2 || null;
  resetPin(i);   // 前のポケモンで確定したわざを持ち越さない
  resetSpPlan(i);   // 発ごとのSP設定は「おまかせ」に戻す(前のポケモンの指定を残さない)
  S[i].ivMode = m.ivMode || 'auto'; S[i].mIvs = m.mIvs || null; S[i].mLevel = m.mLevel || null;
  S[i].shadow = !!m.shadow;
  S[i].maxLv = m.maxLv || 51;
  syncSmax(i);
  const el = sideEl[i];
  el.querySelector('.shadowtab').setAttribute('aria-pressed', S[i].shadow);
  el.querySelector('input').value = (S[i].shadow ? 'シャドウ' : '') + D.pokemon[m.key].n;
  el.querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === S[i].ivMode));
  el.querySelector('.custIv').style.display = S[i].ivMode === 'manual' ? 'block' : 'none';
  if (S[i].mIvs) {
    el.querySelector('.ivA').value = S[i].mIvs[0]; el.querySelector('.ivD').value = S[i].mIvs[1];
    el.querySelector('.ivH').value = S[i].mIvs[2]; el.querySelector('.ivL').value = S[i].mLevel;
  }
  if (mode === 'rocket' && i === 1) syncRocket();   // あいて側はシャドウ固定などの表示に戻す
  if (!skipRun) run();   // 続けて別の設定も変える場合は呼び出し側でまとめて実行する
}

// スーパーマックスレベルのタブ表示(メガのみ)と選択状態を同期
function syncSmax(i) {
  const el = sideEl[i];
  el.querySelector('.smaxwrap').style.display = (S[i].key && isMega(S[i].key)) ? 'block' : 'none';
  el.querySelectorAll('.smax button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.lv === S[i].maxLv));
}

// 発ごとのSP設定を初期状態(全部おまかせ)へ戻す。ポケモンを切り替えたときに古い指定を残さない
function resetSpPlan(i) {
  const m = spModeOf(i);
  S[i].spMode = [m, m, m, m, m]; S[i].spModeRest = m;
  S[i].spMv = ['auto', 'auto', 'auto', 'auto', 'auto']; S[i].spMvRest = 'auto';
}

function pick(i, key) {
  S[i].key = key;
  S[i].fast = S[i].c1 = S[i].c2 = null;   // 自動選択に戻す
  resetPin(i);   // 前のポケモンで確定したわざを持ち越さない
  resetSpPlan(i);
  S[i].shadow = false;
  sideEl[i].querySelector('.shadowtab').setAttribute('aria-pressed', false);
  S[i].maxLv = 51; syncSmax(i);
  S[i].ivMode = 'auto'; S[i].mIvs = null; S[i].mLevel = null;   // 個体値も理想に戻す
  sideEl[i].querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'auto'));
  sideEl[i].querySelector('.custIv').style.display = 'none';
  if (mode === 'rocket' && i === 1) syncRocket();   // ロケット団のポケモンはシャドウ固定
  run();
}

// ---- 実行 ----
const parseNums = v => (v || '').split(/[^0-9]+/).filter(Boolean).map(Number);
// 連戦の引き継ぎ設定(開始HP%・開始ゲージ)を計算用の設定に足す
const carryOf = i => S[i].carry ? { startHpPct: S[i].cHp, startEn: S[i].cEn } : {};
// 発ごとのSP設定(何発目をどのタイミング・どのわざで撃つか)を計算用の設定に変換する
// move=null は「自動」＝その時点で威力効率が高いほうをエンジンが選ぶ
function shotsCfg(i, m1, m2) {
  const pick = v => v === '2' ? m2 : v === '1' ? m1 : null;
  return { timing: 'shots',
    shotPlan: S[i].spMode.map((mode, k) => ({ mode, move: pick(S[i].spMv[k]) })),
    shotRest: { mode: S[i].spModeRest, move: pick(S[i].spMvRest) } };
}
// 一覧系で使う「自分側の1構成」を作る(SP2指定・発ごとの設定を1対1シミュと同じ扱いにする)
function listSideCfg(i, base, pol, sh, timing) {
  // 一覧系のブラフは共通の「ブラフ」枠で両者まとめて決める(片側だけ違うと見かたが分かりにくい)
  const c = { ...base, ...pol, timing, shields: sh, bluff: metaBluff };
  if (S[i].timing === 'plan' || S[i].c2) {
    const m1 = S[i].c1 || (pol.charged ? pol.charged[0] : pol.throw), m2 = S[i].c2 || m1;
    c.charged = [m1, S[i].c2].filter(Boolean);
    delete c.throw;
    Object.assign(c, shotsCfg(i, m1, m2));
  }
  return c;
}
// 1対1シミュの結果・タイムライン・共有ボタンを引っ込める。
// hint=true のときは「わざを選ぶと結果が出る」ことだけ短く伝える
function hideDuelResult(hint) {
  const rEl = document.getElementById('result');
  rEl.innerHTML = hint ? '<div class="mtnote">わざを選ぶと結果が出ます</div>' : '';
  rEl.style.display = hint ? 'block' : 'none';
  document.getElementById('tl').style.display = 'none';
  document.getElementById('share').style.display = 'none';
}
function run() {
  // 一覧系は多数のポケモンを回すので、確率わざの切り替えは常に出す。
  // 対面を1つに決めて計算する画面だけ、そのわざを使っているときに絞る(下で上書きする)
  setProbTab(true);
  if (mode === 'multi') { runMulti(); return; }
  if (mode === 'counter') { runCounter(); return; }
  if (mode === 'party') { runParty(); return; }
  // ロケット団戦の1対1は、まず「誰で殴ればいいか」のランキングを出す
  if (mode === 'rocket' && RK.play === '1v1' && RKR.view !== 'sim') { setProbTab(false); runRkRank(); return; }
  if (mode === 'rocket' && RK.team) { runRkBuild(); return; }   // 模擬戦(3匹の通し)
  const rk = mode === 'rocket';       // ロケット団戦: 相手はNPC、CP制限なし
  if (!S[0].key || !S[1].key) { hideDuelResult(); return; }
  const capX = rk ? 0 : cap;
  // 手動交代の直後は自分も1ターン(0.5秒)動けない
  const myStall = rk ? RK_ENTER[RK.enter].me : 0;
  const base = S.map((s, i) => {
    const c = carryOf(i);
    if (s.ivMode === 'manual' && s.mIvs) return { key: s.key, ivs: s.mIvs.slice(), level: s.mLevel, shadow: s.shadow, cap: capX, ...c };
    const r1 = rank1(s.key, capX, 0, s.maxLv);
    return { key: s.key, ivs: r1.ivs, level: r1.level, shadow: s.shadow, cap: capX, ...c };
  });
  if (myStall) base[0].stallStart = myStall;
  // マニュアル個体値のCPと実数値を表示し、リーグ上限超えは警告する(計算は続行)。
  // 実数値はブレイクポイントの数字と同じ基準(シャドウ補正込み)なので、設定の調整に使える
  S.forEach((s, i) => {
    const note = sideEl[i].querySelector('.ivnote');
    if (s.ivMode === 'manual' && s.mIvs) {
      const st = PvpEngine.buildStats(D, base[i]);
      const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
      note.innerHTML = `この設定のCP: <b>${st.cp}</b>` + (capX && st.cp > capX ? ' <span class="over">⚠リーグ上限超え</span>' : '') +
        `<div class="ivstats">攻 <b>${f1(st.atk)}</b>・防 <b>${f1(st.def)}</b>・HP <b>${st.hp}</b></div>`;
    } else note.textContent = '';
    // CP上限のないリーグ(マスター・ロケット団戦)では入手別の1位個体は意味がないので隠す
    const noCap = !capX;
    const el2 = sideEl[i];
    [el2.querySelector('.ivpresetttl'), el2.querySelector('.ivpresets')].forEach(n => {
      if (n) n.style.display = noCap ? 'none' : '';
    });
  });
  // 1対1シミュは「自分で選んだ構成の結果を見る」画面なので、
  // わざを選ぶまでは結果を出さない(わざ欄だけ先に用意して選べるようにする)
  fillMoves(0, { ...base[0], fast: S[0].fast, throw: S[0].c1 });
  fillMoves(1, rk
    ? rkCfg({ ...base[1], fast: S[1].fast || rkPool(S[1].key).fasts[0], charged: [], throw: S[1].c1 })
    : { ...base[1], fast: S[1].fast, throw: S[1].c1 });
  // SPアタックは「撃たない」ときは選ばなくても結果を出せる。
  // ロケット団戦のあいては「わざ全通りの最悪ケース」仕様なので選ばせない(じぶんだけ見る)
  const needMv = i => !S[i].fast ||
    (S[i].timing !== 'never' && !S[i].c1 && movePool(S[i].key).chargeds.length);
  // 能力変化わざの設定は、そういうわざを実際に選んでいるときだけ出す
  const selCfg = i => ({ fast: S[i].fast, throw: S[i].c1, charged: [S[i].c1, S[i].c2].filter(Boolean) });
  setProbTab(anyProbMove([selCfg(0), selCfg(1)]));
  if (needMv(0) || (!rk && needMv(1))) { hideDuelResult(true); return; }
  // わざの自動最適化(ﾏﾆｭｱﾙタイミング側は「最適」扱いでわざだけ決める)
  // わざの最適化も実際のシールド枚数で行う(一覧のマスをタップしたときに結果が一致する)
  // ロケット団戦では相手のシールドは種別で決まる(したっぱ0枚・リーダー/サカキ2枚)
  const curSh = i => rk && i === 1 ? rkShields() : (S[i].shieldMode === 'plan' ? 2 : S[i].shields);
  // わざの候補(policies)側でSP1/SP2の組を決めるので、ここではポケモン・シールド・タイミングだけ渡す
  const optCfg = (i, sh) => {
    const c = { ...base[i], shields: sh, bluff: S[i].bluff,
      timing: ['plan', 'never'].includes(S[i].timing) ? 'optimal' : S[i].timing,
      ...polOpts(i) };
    // 「撃たない」ときは、わざの選び方もSPを撃たない前提にそろえる(表示と結果を食い違わせない)
    if (S[i].timing === 'never') { c.timing = 'shots'; c.shotPlan = []; c.shotRest = null; }
    return rk && i === 1 ? rkCfg(c) : c;
  };
  // ロケット団戦はあいてのわざがランダムなので「最悪ケース基準」で選ぶ(rkOptimize)
  const opt2 = (a, b) => rk ? rkOptimize(optCfg(0, a), optCfg(1, b)) : optimize(optCfg(0, a), optCfg(1, b));
  const plan = opt2(curSh(0), curSh(1));
  // 自動選出のわざはここで確定して控える(pin)。以後は手動で変えるか、
  // ポケモン・リーグを替えるまで同じ構成を使い続ける(設定をいじるたびに勝手に変わらないように)。
  // ロケット団のあいては「わざ全通りの最悪ケース」を見る仕様なので固定しない
  const pinMoves = (i, pol) => {
    if (!S[i].fast && pol.fast) S[i].pin.fast = pol.fast;
    if (!S[i].c1) S[i].pin.c1 = pol.throw || (pol.charged && pol.charged[0]) || null;
  };
  pinMoves(0, plan.left);
  if (!rk) pinMoves(1, plan.right);
  // pol=採用するわざ構成 / sh=シールド枚数 / usePlan=マニュアル指定(何発目で使うか)を反映するか
  const fin = (i, pol, sh, usePlan) => {
    const c = { ...base[i], ...pol, bluff: S[i].bluff };
    if (S[i].fast) c.fast = S[i].fast;
    if (S[i].c1) c.throw = S[i].c1;
    if (usePlan && S[i].shieldMode === 'plan') {
      c.shields = 2;
      c.shieldPlan = S[i].shieldSlots.map((on, k) => on ? k + 1 : 0).filter(Boolean);
      c.shieldRest = S[i].shieldRest;
    } else c.shields = sh;
    // SP1は「選んだわざ > 候補として選ばれたわざ」の順で決まる(SP2指定時はpol.chargedの1本目が候補)
    const m1 = S[i].c1 || (pol.charged ? pol.charged[0] : c.throw), m2 = S[i].c2 || m1;
    c.charged = [m1, S[i].c2].filter(Boolean);
    c.throw = m1;   // 画面のSPアタック欄にも実際に使うわざを表示する
    // 発ごとの設定: 各発のタイミング(最適/最短/+N発)とわざ(自動/1/2)を指定
    if (S[i].timing === 'never') { c.timing = 'shots'; c.shotPlan = []; c.shotRest = null; }
    else if (S[i].timing === 'plan' || S[i].c2) Object.assign(c, shotsCfg(i, m1, m2));
    else c.timing = S[i].timing;
    return rk && i === 1 ? rkCfg(c) : c;
  };
  const L = fin(0, plan.left, curSh(0), true), R = fin(1, plan.right, curSh(1), true);
  const res = PvpEngine.simulate(D, L, R, SIMOPT);
  // シャドウ個体は結果・タイムラインの名前にも反映する
  // シャドウ個体は結果・タイムラインの名前にも反映する(ロケット団のポケモンは常にシャドウ)
  [L, R].forEach((c, i) => { if (c.shadow || c.statMult) res.final[i].name = 'シャドウ' + res.final[i].name; });
  // シールド枚数別の勝敗(3×3): 各マスでわざ構成も選び直す(マスをタップした結果と一致させるため)
  // ロケット団戦は相手のシールドが固定なので、自分のシールド枚数(0/1/2)だけを並べる
  const bList = rk ? [curSh(1)] : [0, 1, 2];
  const matrix = [];
  for (let a = 0; a <= 2; a++) {
    const row = [];
    for (const b of bList) {
      const p = a === curSh(0) && b === curSh(1) ? plan : opt2(a, b);
      const r = PvpEngine.simulate(D, fin(0, p.left, a, false), fin(1, p.right, b, false), SIMOPT);
      const w = r.winner;
      row.push({ w, pct: w === 'draw' ? 0 : Math.round(r.final[w].hp / r.final[w].hpMax * 100) });
    }
    matrix.push(row);
  }
  render(res, L, R, matrix);
}

// あいてが打ってくるわざの全通り。picked=true なら画面で指定されたわざだけに絞る
function rkFoeCombos(cfgR, picked) {
  let { fasts, chargeds } = rkPool(cfgR.key);
  if (picked && S[1].fast && fasts.includes(S[1].fast)) fasts = [S[1].fast];
  if (picked && S[1].c1 && chargeds.includes(S[1].c1)) chargeds = [S[1].c1];
  const spList = chargeds.length ? chargeds : [null];
  const out = [];
  for (const f of fasts) for (const sp of spList) out.push({ fast: f, throw: sp });
  return out;
}
// ロケット団戦のわざ最適化(最悪ケース基準)
// あいてのわざはランダムなので「お互いが最善を尽くす」前提は合わない。
// 自分のわざはバトル中に変えられないので、あいての全通りに対して
//   ①勝てる通りが多い ②その中で最悪ケースがマシ
// の順でいちばん強い構成を選び、表示は「その構成にとっていちばんキツいわざ」で出す。
// こうすると主結果・シールド枚数別の勝敗・わざ全通り表の数字が食い違わない。
function rkOptimize(cfgL, cfgR) {
  const PL = policies(cfgL.key, cfgL);
  const all = rkFoeCombos(cfgR, false);      // 自分のわざ選びは常に全通りで評価する
  const shown = rkFoeCombos(cfgR, true);     // 画面でわざを指定していれば、表示はその中の最悪ケース
  const foeCfg = c => ({ ...cfgR, fast: c.fast, charged: c.throw ? [c.throw] : [], throw: c.throw });
  let best = null;
  for (const pol of PL) {
    const L = { ...cfgL, ...pol, timing: cfgL.timing || 'optimal' };
    let wins = 0, worst = null;
    for (const c of all) {
      const r = PvpEngine.simulate(D, L, foeCfg(c), SIMOPT);
      if (r.winner === 0) wins++;
      const sc = rkWorstScore(r);   // 勝つ場合は「遅いほどキツい」も込みで最悪を見る
      if (worst === null || sc < worst) worst = sc;
    }
    if (!best || wins > best.wins || (wins === best.wins && worst > best.worst)) best = { wins, worst, pol, L };
  }
  // 選んだ構成にとって、いちばんキツいわざを主結果として出す(最悪ケース基準)
  let show = shown[0], showSc = null;
  for (const c of shown) {
    const sc = rkWorstScore(PvpEngine.simulate(D, best.L, foeCfg(c), SIMOPT));
    if (showSc === null || sc < showSc) { showSc = sc; show = c; }
  }
  return { left: best.pol, right: show, wins: best.wins, n: all.length };
}

// ---- あいてのわざ全通り(ロケット団戦) ----
// ロケット団のあいては、おぼえるわざの中からランダムに打ってくるので決め打ちできない。
// そこで全通り試して「どのわざで来ても勝てるか」を出す。
// 自分のわざはバトル中に変えられないので L は固定したまま、あいてのわざだけ差し替える。
function rkAllMoves(L, R) {
  const { fasts, chargeds } = rkPool(R.key);
  const spList = chargeds.length ? chargeds : [null];   // SPを覚えないポケモンはノーマルだけ
  const rows = [];
  for (const f of fasts) for (const sp of spList) {
    const r = PvpEngine.simulate(D, L, { ...R, fast: f, charged: sp ? [sp] : [], throw: sp }, SIMOPT);
    const me = r.final[0], foe = r.final[1];
    rows.push({ fast: f, sp, win: r.winner === 0, draw: r.winner === 'draw', turns: r.turns,
      pct: Math.round(me.hp / me.hpMax * 100), foePct: Math.round(foe.hp / foe.hpMax * 100),
      score: rkWorstScore(r),   // 自分から見た良さ。低いほどキツい
      cur: f === R.fast && sp === (R.throw || null) });
  }
  // キツい順に並べる。先頭がいちばん危ないわざ
  // (勝つ場合は決着が遅いほど・残りが少ないほど、負ける場合は相手を削れていないほどキツい)
  rows.sort((a, b) => a.score - b.score);
  return { rows, wins: rows.filter(r => r.win).length };
}
// あいてのわざ全通りの表(タップでそのわざに切り替えてタイムラインを確認できる)
function rkMovesHtml(all) {
  const sec = t => (t / 2).toFixed(1);
  const n = all.rows.length, w = all.wins;
  const worst = all.rows[0];
  const head = w === n ? `<b class="ok">◯ どのわざでも勝ち</b>　<small>${n}通り</small>`
    : w === 0 ? `<b class="ng">✕ どのわざでも負け</b>　<small>${n}通り</small>`
    : `<b class="ng">△ わざ次第</b>　<small>${n}通り中 ${w}通りで勝ち</small>
       <span class="rkdanger">危険: ${mvChip(D.moves[worst.fast].n)}${worst.sp ? mvChip(D.moves[worst.sp].n) : ''}</span>`;
  const rowHtml = r => `<tr class="${r.cur ? 'cur' : ''}" data-f="${r.fast}" data-c="${r.sp || ''}">
    <td>${mvChip(D.moves[r.fast].n)}${r.sp ? '<span class="rkmvsp">' + mvChip(D.moves[r.sp].n) + '</span>' : ''}</td>
    <td class="${r.win ? 'w' : 'l'}"><b>${r.draw ? '△' : r.win ? '◯' : '✕'}</b></td>
    <td>${sec(r.turns)}</td>
    <td>${r.win ? `${r.pct}%` : `<span class="foepct">${r.foePct}%</span>`}</td></tr>`;
  return `<div class="rkmoves">
    <div class="mvhead">🎲 あいてのわざ全通り<small>キツい順</small></div>
    <div class="rkmvsum">${head}</div>
    <table><tr><th style="text-align:left">わざ</th><th>勝敗</th><th>⏱</th><th>残り</th></tr>
      ${all.rows.map(rowHtml).join('')}</table>
  </div>`;
}

function fillMoves(i, cfg) {
  // ロケット団のあいては、おぼえるわざ(特別なわざを除く)しか打ってこないので候補を絞る
  const rkFoe = !!cfg.statMult;
  const el = sideEl[i], { fasts, chargeds } = poolOf(cfg);
  const p = D.pokemon[cfg.key];
  el.querySelector('.pkview').style.display = 'block';
  el.querySelector('.nm').textContent = (cfg.shadow ? 'シャドウ' : '') + p.n;
  el.querySelector('.ticons').innerHTML = typeIcons(p, 18);
  el.querySelector('.ticons').className = 'ticons tpair';
  const st = PvpEngine.buildStats(D, cfg);
  // SCP: 攻撃×防御×耐久を総合したPvP向け評価値(ロケット団のポケモンは基準が違うので出さない)
  el.querySelector('.scp').textContent = cfg.statMult ? '' : 'SCP ' + Math.floor(Math.pow(st.atk * st.def * st.hp, 2 / 3) / 10);
  // ロケット団のポケモンは個体値・PLでなく倍率でステータスが決まるので、実数値をそのまま出す
  // (シャドウ補正をかける前の値＝ゲームやシミュレータの表示に合わせる)
  el.querySelector('.ivline').textContent = cfg.statMult
    ? `CP${st.cp}／攻${st.baseAtk.toFixed(2)}・防${st.baseDef.toFixed(2)}・HP${st.hp}`
    : `CP${st.cp} / 個体値${cfg.ivs.join('/')} / PL${cfg.level}`;
  // タイプは同名で複数タイプがあるわざ(ウェザーボール等)だけ表記する
  const opt = (m, sel) => {
    const mv = D.moves[m];
    const suf = NAME_TYPES[mv.n].size > 1 ? `（${D.typeJa[mv.t]}）` : '';
    return `<option value="${m}"${m === sel ? ' selected' : ''}>${mv.n}${suf}</option>`;
  };
  // おぼえないわざも含めて選択可能にする(検証・お試し用)
  // 同名・同タイプの別ID(カメックス専用版など)とタイプ不定のめざめるパワーは除外
  const byName = (a, b) => D.moves[a].n.localeCompare(D.moves[b].n, 'ja');
  const sig = m => D.moves[m].n + '|' + D.moves[m].t;
  const others = (isFast, own) => {
    const ownSig = new Set(own.map(sig)), seen = new Set();
    return Object.keys(D.moves).filter(m => {
      const mv = D.moves[m];
      if (isFast ? !mv.eg : !mv.e) return false;
      if (own.includes(m) || m === 'HIDDEN_POWER_NORMAL') return false;
      const s = sig(m);
      if (ownSig.has(s) || seen.has(s)) return false;
      seen.add(s);
      return true;
    }).sort(byName);
  };
  const otherF = others(true, fasts);
  const otherC = others(false, chargeds);
  // ロケット団のあいては打ってこないわざを選べても意味がないので「その他のわざ」を出さない
  const grouped = (own, others, sel) => rkFoe
    ? own.map(m => opt(m, sel)).join('')
    : `<optgroup label="おぼえるわざ">${own.map(m => opt(m, sel)).join('')}</optgroup>` +
      `<optgroup label="その他のわざ（本来おぼえない）">${others.map(m => opt(m, sel)).join('')}</optgroup>`;
  // わざ欄は「選ぶ前は欄の中に薄くわざの種類を出し、選んだらわざ名に変わる」方式。
  // 自分で選んでいないあいだ(＝自動でいちばん良い構成を使う)は見出しを兼ねたプレースホルダーにする
  const ph = (sel, key, label, own, others, cur) => {
    const un = !S[i][key];   // 未選択＝自動。どのわざにも selected を付けず、見出しを選んだ状態にする
    sel.innerHTML = `<option value=""${un ? ' selected' : ''}>${label}</option>` + grouped(own, others, un ? null : cur);
    sel.classList.toggle('ph', un);
  };
  ph(el.querySelector('.selFast'), 'fast', 'ノーマルアタック', fasts, otherF, cfg.fast);
  ph(el.querySelector('.selC1'), 'c1', 'SPアタック', chargeds, otherC, cfg.throw);
  ph(el.querySelector('.selC2'), 'c2', 'SPアタック2', chargeds, otherC, S[i].c2);
  // ブラフ設定はSPアタックを2本持たせたときだけ意味があるので、そのときだけ出す。
  // 一覧系(環境一覧・カウンター検索・パーティ診断)は共通の「ブラフ」枠で両者まとめて決めるので出さない
  el.querySelector('.bluffwrap').style.display =
    S[i].c2 && !['multi', 'counter', 'party'].includes(mode) ? 'block' : 'none';
  el.querySelectorAll('.bluff button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!S[i].bluff));
  // 発ごとのSP設定窓: ﾏﾆｭｱﾙ時またはSPアタック2選択時に表示(カウンター検索は手順を指定しないので出さない)
  const showSp = S[i].timing !== 'never' && (S[i].timing === 'plan' || !!S[i].c2) && mode !== 'counter';
  el.querySelector('.custSp').style.display = showSp ? 'block' : 'none';
  if (showSp) buildSpConfig(i, S[i].c1 || cfg.throw, S[i].c2);
}

// 「発ごとのSP設定」小窓(タイミングとわざを1行で選ぶ)
function buildSpConfig(i, m1, m2) {
  const el = sideEl[i];
  el.querySelector('.custSp .legend').innerHTML = m2
    ? `1 = ${mvChip(D.moves[m1].n)}　2 = ${mvChip(D.moves[m2].n)}<br><span class="autonote">自 = 自動（その時点で威力効率が高いほうを撃つ）</span>`
    : `SP: ${mvChip(D.moves[m1].n)}`;
  const optHtml = sel =>
    `<option value="opt"${sel === 'opt' ? ' selected' : ''}>最適</option>` +
    `<option value="min"${sel === 'min' ? ' selected' : ''}>最短</option>` +
    `<option value="sync"${sel === 'sync' ? ' selected' : ''}>同時</option>` +
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
      `<option value="${n}"${sel === n ? ' selected' : ''}>＋${n}発</option>`).join('');
  const labels = ['1発目', '2発目', '3発目', '4発目', '5発目', '6発目〜'];
  el.querySelector('.sprows').innerHTML = labels.map((lbl, k) => {
    const mode = k < 5 ? S[i].spMode[k] : S[i].spModeRest;
    const mv = k < 5 ? S[i].spMv[k] : S[i].spMvRest;
    return `<div class="sprow"><span class="lbl">${lbl}</span>
      <select class="tsel" data-k="${k}">${optHtml(mode)}</select>
      ${m2 ? `<button data-k="${k}" data-v="auto" aria-pressed="${mv === 'auto'}" title="威力効率が高いほうを自動で選ぶ">自</button>
      <button data-k="${k}" data-v="1" aria-pressed="${mv === '1'}">1</button>
      <button data-k="${k}" data-v="2" aria-pressed="${mv === '2'}">2</button>` : ''}
    </div>`;
  }).join('');
  el.querySelectorAll('.custSp .tsel').forEach(sel => sel.onchange = () => {
    const k = +sel.dataset.k;
    const v = ['opt', 'min', 'sync'].includes(sel.value) ? sel.value : +sel.value;
    if (k < 5) S[i].spMode[k] = v; else S[i].spModeRest = v;
    // 発ごとに触ったらタイミングは「ﾏﾆｭｱﾙ」表示にする
    if (S[i].timing !== 'plan') {
      S[i].timing = 'plan';
      el.querySelectorAll('.timing button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'plan'));
    }
    run();
  });
  el.querySelectorAll('.custSp .sprows button').forEach(b => b.onclick = () => {
    const k = +b.dataset.k;
    if (k < 5) S[i].spMv[k] = b.dataset.v; else S[i].spMvRest = b.dataset.v;
    run();
  });
}

function render(res, L, R, matrix) {
  // 確率で能力が上下するわざを使っている対面のときだけ、扱いの切り替えを出す
  setProbTab(anyProbMove([L, R]));
  fillMoves(0, L); fillMoves(1, R);
  const rEl = document.getElementById('result');
  rEl.style.display = 'block';
  const badge = i => res.winner === 'draw' ? '<span class="badge draw">DRAW</span>'
    : res.winner === i ? '<span class="badge win">WIN</span>' : '<span class="badge lose">LOSE</span>';
  const fighter = (i, cfg) => {
    const f = res.final[i];
    const pct = Math.round(f.hp / f.hpMax * 100);
    // ゲージ(0〜100)はメーターで、シールドは🛡️で残数を見せる(使った分は薄く表示)
    const enPct = Math.min(100, f.en);
    const shInit = cfg.shieldPlan ? 2 : cfg.shields;
    // シールドを持たない側(したっぱなど0枚設定)は、シールドの行そのものを出さない
    const shHtml = shInit === 0 ? ''
      : `<div class="subline shline">${Array.from({ length: shInit },
          (_, k) => `<span class="sh${k < f.shields ? '' : ' usedsh'}">🛡️</span>`).join('')}</div>`;
    // 連戦設定を使っているときは開始状態を明示する
    const carryTxt = cfg.startHpPct != null || cfg.startEn
      ? `<div class="carrytag">連戦 HP${cfg.startHpPct != null ? cfg.startHpPct : 100}%・ゲージ${cfg.startEn || 0}</div>` : '';
    return `<div class="fighter">
      <div class="top">${badge(i)}<span class="nm">${f.name}</span></div>
      ${carryTxt}
      <div class="hpbar"><i class="${pct <= 25 ? 'low' : ''}" style="width:${pct}%"></i></div>
      <div class="subline">HP ${f.hp}/${f.hpMax}（${pct}%）</div>
      <div class="enbar"><i style="width:${enPct}%"></i></div>
      <div class="subline">ゲージ <b>${f.en}</b></div>
      ${shHtml}
    </div>`;
  };
  // 技ごとの集計
  const mvRows = i => {
    const cfg = i === 0 ? L : R;
    const s = res.final[i];
    const uses = {};
    res.rows.forEach(row => {
      const e = row.ev[i];
      if (!e) return;
      uses[e.move] = uses[e.move] || { n: 0, dmg: e.dmg, sh: 0 };
      uses[e.move].n++;
      uses[e.move].dmg = Math.max(uses[e.move].dmg, e.full || e.dmg);
      if (e.shielded) uses[e.move].sh++;
    });
    return Object.entries(uses).map(([n, u]) =>
      `<div class="mvrow">${mvChip(n)}<span class="num">威力${u.dmg}・${u.n}回${u.sh ? `（<span class="shield">🛡×${u.sh}</span>）` : ''}</span></div>`).join('');
  };
  // シールド枚数別の勝敗表(マスをタップでその設定に切替)。
  // ロケット団戦は相手のシールドが種別で決まっているので、自分の枚数だけの1列にする
  const rkMode = mode === 'rocket';
  const curA = S[0].shieldMode ? -1 : S[0].shields, curB = rkMode ? 0 : (S[1].shieldMode ? -1 : S[1].shields);
  const mtxCell = (a, b) => {
    const c = matrix[a][b];
    const cls = c.w === 'draw' ? 'd' : c.w === 0 ? 'w' : 'l';
    const txt = c.w === 'draw' ? '分' : c.w === 0 ? '勝ち' : '負け';
    return `<td class="${cls}${a === curA && b === curB ? ' cur' : ''}" data-a="${a}" data-b="${b}">
      <b>${txt}</b><small>${c.w === 'draw' ? '両者0' : '残HP' + c.pct + '%'}</small></td>`;
  };
  const mtxHtml = rkMode ? `<div class="shmtx">
    <div class="mvhead">🛡 自分のシールド別<small>タップで切替</small></div>
    <table>
      <tr><th class="corner">自分のシールド</th><th>勝敗</th></tr>
      ${[0, 1, 2].map(a => `<tr><th>🛡${a}</th>${mtxCell(a, 0)}</tr>`).join('')}
    </table></div>` : `<div class="shmtx">
    <div class="mvhead">🛡 シールド枚数別<small>タップで切替・残HPは勝った側</small></div>
    <table>
      <tr><th class="corner">自分＼相手</th><th>🛡0</th><th>🛡1</th><th>🛡2</th></tr>
      ${[0, 1, 2].map(a => `<tr><th>🛡${a}</th>${[0, 1, 2].map(b => mtxCell(a, b)).join('')}</tr>`).join('')}
    </table></div>`;
  // 「同時」を使っているときは、撃ち合いになったらどちらが先に当たるか(CMP)を出す
  let cmpHtml = '';
  if (S[0].timing === 'sync' || S[1].timing === 'sync') {
    const at = [PvpEngine.buildStats(D, L).atk, PvpEngine.buildStats(D, R).atk];
    const fst = at[0] >= at[1] ? 0 : 1;   // 攻撃の実数値が高いほうが先に当たる
    const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
    cmpHtml = `<div class="cmpnote">同じターンに撃ち合ったときは <b>${res.final[fst].name}</b> のSPアタックが先に当たります
      （能力変化がない状態の攻撃実数値 ${fmt1(at[fst])} ${at[0] === at[1] ? '＝' : '＞'} ${fmt1(at[1 - fst])}。
      戦闘中に攻撃が上下すると入れ替わることがあります）</div>`;
  }
  // ロケット団戦は「いかに早く倒せるか」が大事なので、決着までの時間を必ず出す。
  // あいてのわざはランダムなので、全通り試した結果も添える
  let rkHtml = '';
  if (rkMode) {
    rkHtml = `<div class="rktime">⏱ <b>${(res.turns / 2).toFixed(1)}</b>秒</div>` + rkMovesHtml(rkAllMoves(L, R));
  }
  // 技一覧もHPバー等と同じ左右2列に揃える(中央のVSは列幅合わせ用の不可視スペーサー)
  rEl.innerHTML = `
    <div class="vs">${fighter(0, L)}<div class="vsmark">VS</div>${fighter(1, R)}</div>
    ${cmpHtml}
    ${rkHtml}
    ${mtxHtml}
    <div class="mvcols">
      <div class="mvside"><div class="mvhead">${res.final[0].name}の技</div>${mvRows(0)}</div>
      <div class="vsmark" style="visibility:hidden">VS</div>
      <div class="mvside"><div class="mvhead">${res.final[1].name}の技</div>${mvRows(1)}</div>
    </div>
    <details class="bp"><summary>ブレイクポイント<small>ダメージが変わる境目</small></summary>
      <div class="bpbody"></div></details>`;
  // ブレイクポイント: 開いた時だけ計算する(個体値例の探索が少し重いため)
  const bpBody = () => {
    const cfgs = [L, R];
    const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
    const side = i => {
      const me = cfgs[i], op = cfgs[1 - i];
      const stM = { ...PvpEngine.buildStats(D, me), buffs: [0, 0] };
      const stO = { ...PvpEngine.buildStats(D, op), buffs: [0, 0] };
      const mv = D.moves[me.fast], mvO = D.moves[op.fast];
      // 与ダメ: 攻撃実数値がいくつあれば1上がるか
      const effM = PvpEngine.effectiveness(D, mv.t, stO.types);
      const stabM = stM.types.includes(mv.t) ? 1.2 : 1;
      const K = 0.5 * mv.p * effM * stabM * 1.3 / stO.def;   // ダメ = floor(攻×K)+1
      const cur = PvpEngine.damage(D, mv, stM, stO);
      const atkReq = cur / K;
      const exA = findIvFor(me.key, { atk: atkReq }, cap, S[i].maxLv);
      // 1行ぶんの表示: わざ・ダメージの変化・必要な実数値・届くかどうか
      // 1行の作り: わざ ／ ダメージの変化 ／ 必要な実数値(いまの値→必要な値) ／ 届くか。
      // このリーグの個体値・PLでは届かないときは「5→5 変化なし」と出す(ユーザー指示)
      const item = (mark, mvName, from, to, statLbl, now, need, ex, note) => `<div class="bpitem">
        <div class="bpttl"><i class="bpk">${mark}</i>${mvChip(mvName, 13)}</div>
        <div class="bpdmg">${note ? `<b>${from}</b><small>${note}</small>`
          : `<b>${from}</b><i>→</i><b class="${ex ? 'hit' : 'same'}">${ex ? to : from}</b>`}</div>
        ${note ? '' : `<div class="bpreq">${statLbl} <i>いま</i><b>${fmt(now)}</b><i>→ 必要</i><b class="need">${fmt(need)}</b></div>
        <div class="bpst ${ex ? 'ok' : 'ng'}">${ex ? `変化あり<small>${ex.ivs.join('/')} PL${ex.level}</small>`
          : `変化なし<small>最大まで上げても届かない</small>`}</div>`}
      </div>`;
      const give = item('💥', mv.n, cur, cur + 1, '攻撃', stM.atk, atkReq, exA);
      // 被ダメ: 防御実数値がいくつあれば1減るか
      let take;
      const curT = PvpEngine.damage(D, mvO, stO, stM);
      if (curT <= 1) take = item('🛡', mvO.n, 1, 1, '防御', 0, 0, null, 'これ以上減らない');
      else {
        const effO = PvpEngine.effectiveness(D, mvO.t, stM.types);
        const stabO = stO.types.includes(mvO.t) ? 1.2 : 1;
        const KO = 0.5 * mvO.p * effO * stabO * 1.3 * stO.atk;   // ダメ = floor(KO÷防)+1
        const defReq = KO / (curT - 1);
        const exD = findIvFor(me.key, { def: defReq }, cap, S[i].maxLv);
        take = item('🛡', mvO.n, curT, curT - 1, '防御', stM.def, defReq, exD);
      }
      return `<div class="bpside"><div class="bphd">${stM.name}</div>${give}${take}</div>`;
    };
    return `<div class="bpcols">${side(0)}${side(1)}</div>
      <div class="bpnote">※開始時点（バフなし）・いま選んでいるノーマルアタックで計算。<i class="bpk">💥</i>与ダメ ／ <i class="bpk">🛡</i>被ダメ</div>`;
  };
  const bpEl = rEl.querySelector('.bp');
  bpEl.addEventListener('toggle', () => {
    bpOpen = bpEl.open;
    if (bpEl.open && !bpEl.querySelector('.bpbody').innerHTML) bpEl.querySelector('.bpbody').innerHTML = bpBody();
  });
  if (bpOpen) bpEl.open = true;
  // 3×3表のマスをタップ→両者のシールド枚数をその組み合わせに変更
  rEl.querySelectorAll('.shmtx td[data-a]').forEach(td => td.onclick = () => {
    [+td.dataset.a, +td.dataset.b].forEach((v, i) => {
      if (rkMode && i === 1) return;   // ロケット団戦は相手のシールドが種別で決まっている
      S[i].shieldMode = null; S[i].shields = v;
      sideEl[i].querySelectorAll('.shields button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.v === v));
      sideEl[i].querySelector('.custShield').style.display = 'none';
    });
    run();
  });
  // わざ全通りの行をタップ→あいてのわざをそれに切り替える(タイムラインでどう負けるか確認できる)
  rEl.querySelectorAll('.rkmoves tr[data-f]').forEach(tr => tr.onclick = () => {
    S[1].fast = tr.dataset.f;
    S[1].c1 = tr.dataset.c || null;
    run();
  });
  lastRes = res;
  renderTimeline();
  document.getElementById('share').style.display = 'flex';
  updateUrl();
}

// 現在の設定を共有URLへ反映(1対1・環境一覧の両モードで使用)
function updateUrl() {
  // ロケット団対策ページはCP制限なし・モード固定なので lg / md はURLに書かない
  const qp = PAGE_ROCKET ? {} : { lg: cap };
  if (S[0].key) qp.l = S[0].key;
  if (S[1].key) qp.r = S[1].key;
  qp.sl = S[0].shieldMode ? 2 : S[0].shields;
  qp.sr = S[1].shieldMode ? 2 : S[1].shields;
  qp.tl = S[0].timing === 'plan' ? 'optimal' : S[0].timing;
  qp.tr = S[1].timing === 'plan' ? 'optimal' : S[1].timing;
  // マニュアル個体値は「攻.防.HP.PL」形式でURLに含める
  S.forEach((s, i) => {
    if (s.ivMode === 'manual' && s.mIvs) qp[i ? 'ir' : 'il'] = s.mIvs.join('.') + '.' + s.mLevel;
    if (s.shadow) qp[i ? 'shr' : 'shl'] = 1;
    if (s.maxLv !== 51) qp[i ? 'mlr' : 'mll'] = s.maxLv;
    if (s.carry) qp[i ? 'cyr' : 'cyl'] = s.cHp + '.' + s.cEn;   // 連戦(開始HP%.開始ゲージ)
    if (s.bluff) qp[i ? 'bfr' : 'bfl'] = 1;   // ブラフする設定(既定はしない)
    // わざ構成(ノーマル~SP1~SP2)。手動選択は「!」付き、自動選出の確定値はそのまま書く。
    // これが無いと、共有リンクを開いた人の側で自動選出をやり直すことになり、
    // 送り主が確定させた構成と食い違うことがある
    if (s.key) {
      const f = s.fast ? '!' + s.fast : (s.pin.fast || '');
      const c = s.c1 ? '!' + s.c1 : (s.pin.c1 || '');
      if (f || c || s.c2) qp[i ? 'mvr' : 'mvl'] = [f, c, s.c2 || ''].join('~');
    }
  });
  if (cup) qp.cup = cup.slug;
  if (mode !== 'duel' && !PAGE_ROCKET) qp.md = mode;
  if (mode === 'counter' && cnTop !== 50) qp.cn = cnTop;   // 対策さがしで探す範囲(既定50・100/all)
  if (metaBluff && ['multi', 'counter', 'party'].includes(mode)) qp.bf = 1;   // 環境リスト側のブラフ(既定はしない)
  if (SIMOPT.buffMode !== 'none') qp.pb = SIMOPT.buffMode;   // 確率わざの扱い
  if (mode === 'rocket') {   // ロケット団戦の設定
    qp.rk = RK.kind; qp.rs = RK.stall; qp.re = RK.enter;
    const w = rkWho();   // リーダー・サカキの手持ち(だれと・何匹目に誰を選んでいるか)
    if (w) { qp.rw = w.id; qp.rl = rkSel(w).join(''); }
    if (RK.team) {   // 模擬戦(自分のパーティは端末内に保存しているのでURLには入れない)
      qp.rt = 1;
      if (RK.leadSwap) qp.rls = 1;   // 開幕交代
      if (!RB.step) qp.rbs = 0;   // 見かた(結果だけ)
      // 決断で選んだ内容(rb=)は普段のURLには書かない。書くとリロードで復元されて
      // 「答えた場面が聞かれずに素通りする」ため。共有はコピーボタンを押した時だけ付ける
      const t = [0, 1, 2].filter(i => RKT[i]).map(i => [RKT[i].key, RKT[i].fast || '', RKT[i].c1 || ''].join('~'));
      if (t.length) qp.rp = t.join(',');
    }
  }
  history.replaceState(null, '', '?' + new URLSearchParams(qp).toString());
}

// ---- タイムライン(ダイジェスト/全ターン切替) ----
let lastRes = null, tlMode = 'all', bpOpen = false;
// タイムラインの表を作る(1対1シミュで使う)
function timelineTable(res, tlMode) {
  // HPの残り割合で色分け: 緑(50%以上)・黄(20〜50%未満)・赤(20%未満)
  const hpCls = (i, hp) => {
    const pct = hp / res.final[i].hpMax;
    return hp === 0 || pct < 0.2 ? 'hpr' : pct < 0.5 ? 'hpy' : 'hpg';
  };
  // 能力変化はデータから向きを判定し、太い矢印(⬆⬇)で表示
  // 1段階ちょうど以外(2段階や「期待値」設定の端数)は矢印のうしろに段階数を添える
  const stg = d => {
    const a = Math.abs(d);
    return a === 1 ? '' : String(Math.round(a * 100) / 100);
  };
  const buffTxt = e => {
    if (!e.buff) return '';
    const dA = e.buff.to[0] - e.buff.from[0], dD = e.buff.to[1] - e.buff.from[1];
    const pre = e.buff.target === 'opponent' ? '相手' : '';
    let t = '';
    if (dA) t += pre + '攻' + (dA > 0 ? '⬆' : '⬇') + stg(dA);
    if (dD) t += (t ? ' ' : '') + pre + '防' + (dD > 0 ? '⬆' : '⬇') + stg(dD);
    return t ? ` <span class="${dA + dD >= 0 ? 'buffup' : 'buffdown'}">${t}</span>` : '';
  };
  // CCT等でゲージが足りているのに余分に打ったノーマルアタックへ(+n)を付与
  res.rows.forEach(row => { row._extra = [null, null]; });
  for (let i = 0; i < 2; i++) {
    let extra = 0;
    for (let idx = 0; idx < res.rows.length; idx++) {
      const e = res.rows[idx].ev[i];
      if (!e) continue;
      if (e.full !== undefined) { extra = 0; continue; }   // SPアタックでリセット
      const prevEn = idx > 0 ? res.rows[idx - 1].state[i].en : 0;
      let cost = null;
      for (let j = idx + 1; j < res.rows.length; j++) {
        const ev2 = res.rows[j].ev[i];
        if (ev2 && ev2.full !== undefined) { cost = MOVE_COST[ev2.move] || null; break; }
      }
      if (cost != null && prevEn >= cost) { extra++; res.rows[idx]._extra[i] = '+' + extra; }
      else extra = 0;
    }
  }
  // わざの発動は1発ずつ枠(フレーム)に入れて見分けやすくする
  const cellEv = (row, i) => {
    const e = row.ev[i], opp = row.ev[1 - i];
    let h = '';
    // ロケット団戦の硬直(この側は動けないターン)
    if (!e && row.stalled && row.stalled[i]) h = '<span class="evbox stallbox">硬直</span>';
    if (e) {
      let t = mvChip(e.move);
      if (e.shielded) t += ' -1';
      else if (e.full) t += ` <b>-${e.dmg}</b>`;
      else t += ` -${e.dmg}`;
      if (row._extra && row._extra[i]) t += ` <span class="extra">(${row._extra[i]})</span>`;
      t += buffTxt(e);
      h = `<span class="evbox">${t}</span>`;
    }
    // シールドは「使った側」に表示する
    if (opp && opp.shielded) h += (h ? ' ' : '') + '<span class="evbox shield">🛡シールド</span>';
    // ミミッキュのばけのかわ発動も「防いだ側」に表示する
    if (opp && opp.disguised) h += (h ? ' ' : '') + '<span class="evbox shield">👻ばけのかわ 防⬇</span>';
    return h;
  };
  // SPアタックを打った行のENはピンクで「ゲージを消費した」ことを示す
  const enCls = (row, i) => (row.ev[i] && row.ev[i].full !== undefined) ? ' class="ensp"' : '';
  // SPアタックが番号行に入る場合(番号行が空くケース)もハイライトする
  const spRow = row => row.tn === '-' ||
    (row.ev[0] && row.ev[0].full !== undefined) || (row.ev[1] && row.ev[1].full !== undefined);
  const rowHtml = (row, prev) => {
    // 全ターン表示では、前の行と同じ数字は省略して変化だけを見せる
    const num = (v, pv) => (prev && v === pv) ? '' : v;
    const p = prev ? prev.state : null;
    return `<tr${spRow(row) ? ' class="charged"' : ''}>
      <td class="ev">${cellEv(row, 0)}</td>
      <td class="${hpCls(0, row.state[0].hp)}${row.state[0].hp === 0 ? ' ko' : ''}">${num(row.state[0].hp, p && p[0].hp)}</td><td${enCls(row, 0)}>${num(row.state[0].en, p && p[0].en)}</td>
      <td class="tn">${row.tn}</td>
      <td${enCls(row, 1)}>${num(row.state[1].en, p && p[1].en)}</td><td class="${hpCls(1, row.state[1].hp)}${row.state[1].hp === 0 ? ' ko' : ''}">${num(row.state[1].hp, p && p[1].hp)}</td>
      <td class="ev r">${cellEv(row, 1)}</td>
    </tr>`;
  };
  // ダイジェスト: ゲージ技・シールド・バフ・決着の行だけを残し、間は1行にたたむ
  const isKey = (row, idx) => row.tn === '-' || idx === res.rows.length - 1 ||
    (row.ev[0] && (row.ev[0].full || row.ev[0].buff)) || (row.ev[1] && (row.ev[1].full || row.ev[1].buff));
  let body = '';
  if (tlMode === 'digest') {
    let hidden = [];
    const flush = () => {
      if (!hidden.length) return;
      const a = hidden[0].tn, b = hidden[hidden.length - 1].tn;
      // ロケット団戦: たたんだ中に相手の硬直が含まれていたらターン数を添える
      const st = hidden.filter(r => r.stalled && r.stalled[1]).length;
      body += `<tr class="gap"><td colspan="7">… ノーマルアタックの応酬 ${hidden.length}ターン（TN${a}${a === b ? '' : '〜' + b}）` +
        `${st ? `<span class="stallbox">うち あいての硬直 ${st}ターン</span>` : ''}…</td></tr>`;
      hidden = [];
    };
    res.rows.forEach((row, idx) => {
      if (isKey(row, idx)) { flush(); body += rowHtml(row); }
      else hidden.push(row);
    });
    flush();
  } else {
    // 全ターン: わざ1発を「所要ターン分の高さの枠」で表示(あわ=3ターンなら3行分の枠)
    const n = res.rows.length;
    const blocks = [[], []];
    for (let i = 0; i < 2; i++) {
      let start = 0, turnStart = 0;
      res.rows.forEach((row, idx) => {
        if (row.tn !== '-') turnStart = idx;   // この行が属するターンの先頭行
        if (!row.ev[i]) return;
        // SPアタックの枠は「発動したターンの先頭行〜そのターンの最終行(次の番号行の直前)」。
        // それより前の待ちは行ごとの空セルにして罫線を通常どおり区切る
        const isSp = row.ev[i].full !== undefined;
        const s = isSp ? Math.max(start, turnStart) : start;
        for (let k = start; k < s; k++) blocks[i].push({ start: k, end: k, ev: null, idle: true });
        let e = idx;
        if (isSp) while (e + 1 < n && res.rows[e + 1].tn === '-') e++;
        blocks[i].push({ start: s, end: e, evRow: idx, ev: row.ev[i] });
        start = e + 1;
      });
      if (start < n) blocks[i].push({ start, end: n - 1, ev: null });   // 打ちかけで終了した分
    }
    const shieldRows = [[], []];   // その側がシールドを使った行
    const disguiseRows = [[], []];   // その側のばけのかわが発動した行
    res.rows.forEach((row, idx) => {
      for (let i = 0; i < 2; i++) {
        if (row.ev[i] && row.ev[i].shielded) shieldRows[1 - i].push(idx);
        if (row.ev[i] && row.ev[i].disguised) disguiseRows[1 - i].push(idx);
      }
    });
    const blockTd = (i, idx) => {
      const b = blocks[i].find(x => x.start === idx);
      if (!b) return '';
      const shs = shieldRows[i].filter(r => r >= b.start && r <= b.end);
      const dgs = disguiseRows[i].filter(r => r >= b.start && r <= b.end);
      let moveHtml = '';
      if (b.ev) {
        moveHtml = mvChip(b.ev.move);
        if (b.ev.shielded) moveHtml += ' -1';
        else if (b.ev.full) moveHtml += ` <b>-${b.ev.dmg}</b>`;
        else moveHtml += ` -${b.ev.dmg}`;
        const ex = res.rows[b.evRow]._extra && res.rows[b.evRow]._extra[i];
        if (ex) moveHtml += ` <span class="extra">(${ex})</span>`;
        moveHtml += buffTxt(b.ev);
      }
      // ロケット団戦の硬直(この側が動けないターン)は、わざの入っていない枠に「硬直」と出す
      let stn = 0;
      for (let k = b.start; k <= b.end; k++) if (res.rows[k].stalled && res.rows[k].stalled[i]) stn++;
      const stallHtml = stn ? `<span class="stallbox">硬直${stn === b.end - b.start + 1 ? '' : stn}</span>` : '';
      if (!b.ev) moveHtml = stn === b.end - b.start + 1 ? stallHtml : (b.idle ? stallHtml : '…' + stallHtml);
      else if (stn) moveHtml = stallHtml + '<br>' + moveHtml;   // 硬直が明けてから出したわざ
      // 待ちの空セルは枠なし・通常の罫線で1行ずつ区切る(シールド類は防いだSPと同じ段に出る)
      if (b.idle) return `<td class="ev ${i ? 'r' : 'l'}">${shs.length ? '<span class="shield">🛡シールド</span>' : ''}${dgs.length ? '<span class="shield">👻ばけのかわ 防⬇</span>' : ''}${moveHtml}</td>`;
      // 時系列順に上から並べる: シールド類は防いだSPアタックの段、わざ名はダメージ発生の段
      const er = b.evRow != null ? b.evRow : b.end;
      const items = shs.map(r => ({ row: r, h: '<span class="shield">🛡シールド</span>' }));
      dgs.forEach(r => items.push({ row: r, h: '<span class="shield">👻ばけのかわ 防⬇</span>' }));
      items.push({ row: er + 0.5, h: moveHtml });
      items.sort((a, b2) => a.row - b2.row);
      const inner = items.map(x => x.h).join('');
      // わざ名は発動行の位置(枠の上端/下端)へ寄せる(シールド併記時は行順の積み上げで表現)
      let align = '';
      if (!shs.length && !dgs.length && b.end > b.start) {
        if (er === b.start) align = ' vtop';
        else if (er === b.end) align = ' vbottom';
      }
      const cls = 'mvblock ' + (i ? 'r' : 'l')
        + (b.ev && b.ev.full !== undefined ? ' spblock' : '')
        + (b.ev ? '' : ' pendingblock')
        + align;
      return `<td class="${cls}" rowspan="${b.end - b.start + 1}">${inner}</td>`;
    };
    body = res.rows.map((row, idx) => {
      const prev = res.rows[idx - 1];
      const num = (v, pv) => (prev && v === pv) ? '' : v;
      const p = prev ? prev.state : null;
      return `<tr${spRow(row) ? ' class="charged"' : ''}>
        ${blockTd(0, idx)}
        <td class="${hpCls(0, row.state[0].hp)}${row.state[0].hp === 0 ? ' ko' : ''}">${num(row.state[0].hp, p && p[0].hp)}</td><td${enCls(row, 0)}>${num(row.state[0].en, p && p[0].en)}</td>
        <td class="tn">${row.tn}</td>
        <td${enCls(row, 1)}>${num(row.state[1].en, p && p[1].en)}</td><td class="${hpCls(1, row.state[1].hp)}${row.state[1].hp === 0 ? ' ko' : ''}">${num(row.state[1].hp, p && p[1].hp)}</td>
        ${blockTd(1, idx)}
      </tr>`;
    }).join('');
  }
  return `<div style="overflow-x:auto"><table class="tltbl">
    <tr><th style="text-align:left">${res.final[0].name}</th><th>HP</th><th>EN</th><th>TN</th><th>EN</th><th>HP</th><th style="text-align:right">${res.final[1].name}</th></tr>
    ${body}
  </table></div>`;
}
function renderTimeline() {
  const res = lastRes;
  if (!res) return;
  const tl = document.getElementById('tl');
  tl.style.display = 'block';
  tl.innerHTML = `<div class="tlhead"><h3>タイムライン<small>0.5秒=1ターン</small></h3>
    <div class="tlmode">
      <button aria-pressed="${tlMode === 'all'}" data-m="all">全ターン</button>
      <button aria-pressed="${tlMode === 'digest'}" data-m="digest">山場のみ</button>
    </div></div>` + timelineTable(res, tlMode);
  tl.querySelectorAll('.tlmode button').forEach(b => b.onclick = () => { tlMode = b.dataset.m; renderTimeline(); });
}

// オフラインでも起動できるようにService Workerを登録する
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

document.getElementById('copyUrl').onclick = async () => {
  // 模擬戦は「選んだ手」も含めて共有する。リンクを開いた人にはその手順が再現される
  let url = location.href;
  if (mode === 'rocket' && RK.team) {
    const ansStr = rbAnsToStr();
    if (ansStr) { const u = new URL(location.href); u.searchParams.set('rb', ansStr); url = u.toString(); }
  }
  await navigator.clipboard.writeText(url);
  document.getElementById('copyUrl').textContent = 'コピーしました ✅';
  setTimeout(() => document.getElementById('copyUrl').textContent = '結果のURLをコピー', 1500);
};

// ---- URLパラメータからの復元 ----
(function init() {
  const q = new URLSearchParams(location.search);
  if (q.get('lg')) {
    cap = +q.get('lg');
    document.querySelectorAll('.lgbtn').forEach(b => b.setAttribute('aria-pressed', +b.dataset.cap === cap));
  }
  ['l', 'r'].forEach((k, i) => {
    const v = q.get(k);
    if (v && D.pokemon[v]) {
      S[i].key = v;
      sideEl[i].querySelector('input').value = D.pokemon[v].n;
      syncSmax(i);   // メガならスーパーマックスタブを表示
    }
  });
  ['sl', 'sr'].forEach((k, i) => { if (q.get(k) != null) {
    S[i].shields = +q.get(k);
    sideEl[i].querySelectorAll('.shields button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === S[i].shields));
  }});
  ['tl', 'tr'].forEach((k, i) => { if (['optimal', 'asap', 'sync', 'plan', 'never'].includes(q.get(k))) {
    timingFromUrl = true;
    S[i].timing = q.get(k);
    sideEl[i].querySelectorAll('.timing button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S[i].timing));
    resetSpPlan(i);   // 発ごとのSP設定も復元したタイミングに揃える(SPアタック2を選んだときの表示用)
  }});
  if (q.get('cn') === '100') cnTop = 100;   // 対策さがしで探す範囲
  else if (q.get('cn') === 'all') cnTop = 'all';
  if (q.get('bf') === '1') { metaBluff = true; syncBluffNote(); }   // 環境リスト側のブラフ
  if (q.get('cup')) selectCup(q.get('cup'));   // 特殊カップの復元
  ['shl', 'shr'].forEach((k, i) => {   // シャドウ指定の復元
    if (q.get(k) && S[i].key) {
      S[i].shadow = true;
      sideEl[i].querySelector('.shadowtab').setAttribute('aria-pressed', true);
      sideEl[i].querySelector('input').value = 'シャドウ' + D.pokemon[S[i].key].n;
    }
  });
  ['mll', 'mlr'].forEach((k, i) => {   // スーパーマックスレベルの復元
    const v = +q.get(k);
    if ((v === 52 || v === 53) && S[i].key) { S[i].maxLv = v; syncSmax(i); }
  });
  ['il', 'ir'].forEach((k, i) => {   // マニュアル個体値(攻.防.HP.PL)の復元
    const v = q.get(k); if (!v) return;
    const p = v.split('.').map(Number);
    if (p.length < 4 || p.some(n => isNaN(n))) return;
    S[i].ivMode = 'manual';
    S[i].mIvs = [p[0], p[1], p[2]];
    S[i].mLevel = p.length > 4 ? p[3] + p[4] / 10 : p[3];   // PL45.5は「45.5」の2要素に割れて届く
    const el = sideEl[i];
    el.querySelectorAll('.ivmode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'manual'));
    el.querySelector('.custIv').style.display = 'block';
    el.querySelector('.ivA').value = p[0]; el.querySelector('.ivD').value = p[1];
    el.querySelector('.ivH').value = p[2]; el.querySelector('.ivL').value = S[i].mLevel;
  });
  ['mvl', 'mvr'].forEach((k, i) => {   // わざ構成の復元(「!」付き=手動選択 / なし=自動選出の確定値)
    const v = q.get(k); if (!v || !S[i].key) return;
    const [f, c, c2] = v.split('~');
    const put = (val, fld) => {
      if (!val) return;
      const man = val[0] === '!';
      const id = man ? val.slice(1) : val;
      if (!D.moves[id]) return;
      if (man) S[i][fld] = id; else S[i].pin[fld] = id;
    };
    put(f, 'fast'); put(c, 'c1');
    if (c2 && D.moves[c2]) S[i].c2 = c2;
  });
  ['bfl', 'bfr'].forEach((k, i) => {   // ブラフ設定の復元(既定は「しない」。旧リンクの bfl=0 は既定と同じ)
    if (q.get(k) === '1') {
      S[i].bluff = true;
      sideEl[i].querySelectorAll('.bluff button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === '1'));
    }
  });
  ['cyl', 'cyr'].forEach((k, i) => {   // 連戦(開始HP%.開始ゲージ)の復元
    const v = q.get(k); if (!v) return;
    const p = v.split('.').map(Number);
    if (p.some(n => isNaN(n))) return;
    S[i].carry = true;
    S[i].cHp = Math.min(100, Math.max(1, p[0] || 100));
    S[i].cEn = Math.min(100, Math.max(0, p[1] || 0));
    const el = sideEl[i];
    el.querySelectorAll('.carry button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'on'));
    el.querySelector('.custCarry').style.display = 'block';
    el.querySelector('.cHp').value = S[i].cHp;
    el.querySelector('.cEn').value = S[i].cEn;
    el.querySelectorAll('.cpre button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.hp === S[i].cHp));
  });
  if (['avg', 'always'].includes(q.get('pb'))) {   // 確率で能力が上下するわざの扱いの復元
    SIMOPT.buffMode = q.get('pb');
    document.querySelectorAll('#prob button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === SIMOPT.buffMode));
    syncProbNote();
  }
  if (['grunt', 'leader', 'boss'].includes(q.get('rk'))) RK.kind = q.get('rk');   // ロケット団戦の設定の復元
  if (q.get('rs') != null && !isNaN(+q.get('rs'))) RK.stall = Math.max(0, Math.min(16, +q.get('rs')));
  if (RK_ENTER[q.get('re')]) RK.enter = q.get('re');
  // 模擬戦の復元(rt=2 は「3匹連戦」と別画面だったころの古いリンク。同じ画面に読み替える)
  if (q.get('rt') === '1' || q.get('rt') === '2') setPlay('build');
  if (q.get('rbs') === '0') RB.step = false;   // 見かた(結果だけ)の復元(rbs=1は旧リンク・既定と同じ)
  if (q.get('rls') === '1') RK.leadSwap = true;   // 開幕交代の復元
  if (q.get('rb')) rbAnsFromStr(q.get('rb'));   // 決断で選んだ内容の復元
  if (q.get('rw') && rkWhoList().some(w => w.id === q.get('rw'))) {   // 手持ち(だれと・選んだ並び)の復元
    RK.who = q.get('rw');
    const w = rkWho(), sel = (q.get('rl') || '').split('').map(Number);
    if (w) RK.sel[w.id] = w.slots.map((c, s) => (sel[s] >= 0 && sel[s] < c.length ? sel[s] : 0));
  }
  if (q.get('rp')) q.get('rp').split(',').slice(0, 3).forEach((s, i) => {
    const [key, fast, c1] = s.split('~');
    if (D.pokemon[key]) RKT[i] = { key, fast: fast || null, c1: c1 || null };
  });
  if (PAGE_ROCKET) {   // ロケット団対策ページはモード固定(md= は見ない)
    applyMode();
  } else if (['multi', 'counter', 'party'].includes(q.get('md'))) {   // モードの復元(md=rocket は別ページへ転送済み)
    mode = q.get('md');
    document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    applyMode();
  }
  buildPartySlots(document.querySelector('#party .pslots'), 'pt');
  buildPartySlots(document.querySelector('#rkteam .myslots'), 'rbm');   // 模擬戦でも同じ3枠(PT)を使う
  // パーティ診断の「わざ｜オート」。手動へ切り替えるときは、いま出ている構成を枠に書き込んでから編集させる
  const paBtn = document.querySelector('#party .ptauto');
  if (paBtn) paBtn.onclick = () => {
    // 空いている欄だけオートの選出で埋める(★登録リストの個体や、前に自分で選んだわざは上書きしない)
    if (ptAuto) [0, 1, 2].forEach(i => {
      if (!PT[i]) return;
      const v = ptMvOf(i);
      PT[i].fast = PT[i].fast || v.fast; PT[i].c1 = PT[i].c1 || v.c1; PT[i].c2 = PT[i].c2 || v.c2 || '';
    });
    ptAuto = !ptAuto;
    savePt(); savePtAuto(); syncPtAuto();
    [0, 1, 2].forEach(i => syncPartySlot(i));
    run();
  };
  syncPtAuto();
  buildFoeSlots();
  // 模擬戦のおすすめタブ(高火力/高火力＋安定)。同じタブをもう一度押すとオフ
  document.querySelectorAll('#rksuggbar button[data-m]').forEach(b => b.onclick = () => {
    RKS.mode = RKS.mode === b.dataset.m ? null : b.dataset.m;
    document.querySelectorAll('#rksuggbar button[data-m]').forEach(x =>
      x.setAttribute('aria-pressed', x.dataset.m === RKS.mode));
  });
  // 模擬戦の「⚙ 詳細」パネルの開閉
  const dTab = document.getElementById('rkdetailtab');
  if (dTab) dTab.onclick = () => { RKD.open = !RKD.open; renderRkDetail(); };
  // 一覧系3モードの「⚙ 詳細」パネルの開閉
  const mTab = document.getElementById('mdettab');
  if (mTab) mTab.onclick = () => { MDET.open = !MDET.open; syncMdet(); };
  document.querySelectorAll('#party .ptsh button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#party .ptsh button').forEach(x => x.setAttribute('aria-pressed', x === b));
    ptShield = +b.dataset.v;
    run();
  });
  renderMyPk();
  run();
})();
