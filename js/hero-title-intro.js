/* ============================================================
   TechSnap Hero Title Intro — 見出しの横方向スライドイン
   ------------------------------------------------------------
   1行目「いい暮らしは、」… 画面左から前面を通って定位置へ
   2行目「いい道具から。」… 画面右から人物の“背面”を通って定位置へ
   ------------------------------------------------------------
   背面通過の仕組み:
     .hero-poster の子として z-index:-1 の複製要素
     （.hero-title-behind / aria-hidden）を置き、兄弟である
     .hero-image-wrap（＝人物レイヤー）より背面へ回す。
     遮蔽は人物レイヤー(person.webp)のアルファがそのまま担う。
     透明度やblurで“背面っぽく見せる”疑似表現ではない。

   Transform所有権:
     GSAP(main.js) → .hero-image-wrap / .hero-bg / CSS変数
     hero-2_5d.js  → .hero25d-layer（人物レイヤー等の子）
     このファイル  → h1内の行span と .hero-title-behind のみ
     いずれも対象要素が重複しないため競合しない。

   フォールバック:
     - JS無効                  … head側のクラスが付かず h1 が完成状態
     - このJSが落ちる          … head側の2.5秒安全網でクラス解除
     - GSAP未読込              … 即時に完成状態を表示
     - prefers-reduced-motion  … 横移動を一切行わず即時表示
     - モバイル/タッチ端末     … 2.5D人物レイヤーが無効で遮蔽できないため
                                 背面通過はやめ、通常の右スライドへ切替
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = {
    BEHIND_MIN_WIDTH: 769,   // hero-2_5d.js の MOBILE_MAX(768) と対
    OFFSCREEN_MARGIN: 48,    // 画面外へ完全に逃がす余白(px)
    DUR_LINE1: 1.0,
    DUR_LINE2: 1.2,
    DELAY_LINE2: 0.14,       // 1行目から遅らせて開始
    DELAY_EYEBROW: 0.05,
    DUR_FADE: 0.8,
    EASE_MAIN: 'power3.out'  // バウンド系(bounce/elastic/大きなback)は使わない
  };

  /* 速度連動スラント（イタリック的な傾き）
     ------------------------------------------------------------
     移動は従来どおり「まっすぐ横スライド」のまま。行の回転や縦移動は
     行わず、skewX だけを“その瞬間の移動速度”に比例させて掛ける。

     カーブの選定（2026-07-24修正）:
     位置の ease は power3.out（= 1-(1-t)^4）で、速度は (1-t)^3 に比例する。
     skew を速度へ厳密比例させると skew(t) = MAX*(1-t)^3 となり、
     0.3秒時点で既に残り2〜3度まで落ちてしまう。文字が動いて見えている
     区間のほとんどが「立った状態」になり、傾きを体感できなかった。
     そこで GSAP の fromTo(MAX → 0) が value = MAX*(1-ease(t)) である
     ことを利用し、ease に power1.in（= t^2）を与えて
       skew(t) = MAX * (1 - t^2)
     とする。飛行中はほぼ倒れたまま、着地に向けて滑らかに立ち上がる。

     符号（慣性 / 2026-07-24修正）: 下辺を支点に加速すると、上辺は
     慣性で進行方向の“逆（後方）”へ遅れて残る。文字の上側を後方へ倒す。
       右へ進む1行目 … 上側は左(後方)へ → CSS skewX 正
       左へ進む2行目 … 上側は右(後方)へ → CSS skewX 負
     （CSS skewX(+θ) は上辺を左・下辺を右へずらす向き）
     transform-origin を下辺(50% 100%)に置き、“下を支点に上が振られる”
     見え方にする。
     ------------------------------------------------------------
     SETTLE_RATIO: skewが0へ戻り切るのを移動完了より少し早める。
       着地の瞬間には必ず skewX:0（＝完全に立った状態）になっており、
       背面→前面の差し替え時に傾きが残ることはない。 */
  /* max1=1行目 / max2=2行目。2行目は移動距離が長く（画面右外→定位置）、
     速度が速いぶん慣性の傾きも大きい方が自然なため max2 を強めにする。 */
  var SLANT = {
    desktop: { max1: 14, max2: 24 },   // イタリック相当。崩れて見える手前が上限
    mobile:  { max1: 8,  max2: 13 }
  };
  var SLANT_SETTLE_RATIO = 0.92;
  var SLANT_EASE = 'power1.in';
  var SLANT_ORIGIN = '50% 100%';  // 下辺を支点に上側が慣性で振られる

  var html   = document.documentElement;
  var poster = document.querySelector('.hero-poster');
  var line1  = document.querySelector('.hero-title-line--first');
  var line2  = document.querySelector('.hero-title-line--second-front');
  var behind = document.querySelector('.hero-title-behind');
  var behindLine = behind ? behind.querySelector('.hero-title-line--second-behind') : null;
  var eyebrow = document.querySelector('.hero-eyebrow');
  var sub     = document.querySelector('.hero-sub');
  var search  = document.querySelector('.hero-search');

  function release() { html.classList.remove('hero-intro-pending'); }

  /* 完成状態（アニメーションなし）へ確定させる */
  function settle() {
    if (behind) behind.style.display = 'none';
    [line1, line2, eyebrow, sub, search].forEach(function (el) {
      if (!el) return;
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
      el.style.willChange = '';
    });
    release();
  }

  if (!poster || !line1 || !line2) { release(); return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) { settle(); return; }

  /* 背面通過が成立する条件 = hero-2_5d.js が人物レイヤーを構築する条件。
     モバイル/タッチ端末では元画像(mix-blend-mode:multiply)しか無く、
     アルファによる遮蔽ができないため背面通過を行わない。 */
  function behindAvailable() {
    return !!behindLine &&
      window.innerWidth >= CONFIG.BEHIND_MIN_WIDTH &&
      !window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  /* 複製2行目を、前面2行目の実測位置へ1px単位で合わせる。
     どちらも同じフォント指定を共有し、白背景の同一グリフのため
     切り替え時に位置・太さ・色は変化しない。 */
  function syncBehind() {
    var r = line2.getBoundingClientRect();
    var pr = poster.getBoundingClientRect();
    behind.style.left = (r.left - pr.left) + 'px';
    behind.style.top  = (r.top  - pr.top)  + 'px';
  }

  function start() {
    var g = window.gsap;
    if (!g) { settle(); return; }

    var useBehind = behindAvailable();
    if (useBehind) {
      behind.style.display = 'block';
      behind.style.opacity = '1';
      syncBehind();
    } else if (behind) {
      behind.style.display = 'none';
    }

    /* 移動距離は実測から算出し、必ず画面外から流れ込ませる
       （.hero が overflow:hidden のため横スクロールは発生しない） */
    var vw = window.innerWidth;
    var r1 = line1.getBoundingClientRect();
    var r2 = line2.getBoundingClientRect();
    var fromX1 = -(r1.right + CONFIG.OFFSCREEN_MARGIN);          // 画面左外
    var fromX2 = (vw - r2.left) + CONFIG.OFFSCREEN_MARGIN;       // 画面右外

    var slant = (window.innerWidth < CONFIG.BEHIND_MIN_WIDTH) ? SLANT.mobile : SLANT.desktop;

    var moving = useBehind ? behindLine : line2;

    /* 完成位置での一瞬の露出を防ぐため、クラス解除前にインラインで伏せる */
    g.set([line1, line2], { opacity: 0 });
    if (useBehind) g.set(behindLine, { opacity: 0 });
    if (eyebrow) g.set(eyebrow, { opacity: 0 });
    if (sub) g.set(sub, { opacity: 0 });
    if (search) g.set(search, { opacity: 0 });
    release();

    /* アニメーション中のみリサイズで複製位置を追従させる */
    function onResize() { if (useBehind) syncBehind(); }
    window.addEventListener('resize', onResize, { passive: true });

    /* フォント確定を待たずに開始しているため、Webフォント差し替えで
       前面2行目の幅が変わったら背面複製の座標を取り直す（位置ズレ防止）。 */
    if (useBehind && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (!swapped) syncBehind(); });
    }

    /* 背面→前面の差し替え。同一フレーム内で
       「前面を出す」「複製を消す」を同時に行うため、
       二重表示・1フレーム消失・点滅は発生しない。
       複製は x=0（＝完成位置）に到達済みなので位置も飛ばない。 */
    var swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      line2.style.opacity = '1';
      if (behind) behind.style.display = 'none';
    }

    function cleanup() {
      swap();
      window.removeEventListener('resize', onResize);
      g.set([line1, line2, eyebrow, sub, search].filter(Boolean), { clearProps: 'all' });
      if (behindLine) g.set(behindLine, { clearProps: 'all' });
    }

    var tl = g.timeline({
      defaults: { ease: CONFIG.EASE_MAIN },
      onComplete: cleanup
    });

    if (eyebrow) {
      tl.fromTo(eyebrow, { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: CONFIG.DUR_FADE }, CONFIG.DELAY_EYEBROW);
    }

    /* --- 1行目: 画面左からまっすぐ右へスライド（縦移動・回転なし） --- */
    tl.fromTo(line1,
      { x: fromX1, opacity: 0, transformOrigin: SLANT_ORIGIN, willChange: 'transform,opacity' },
      { x: 0, opacity: 1, duration: CONFIG.DUR_LINE1 }, 0)
      /* 速度に連動した慣性の傾き。右へ進むので上側は後方(左)へ倒れる
         → CSS skewX 正。移動と同時に始め、着地より少し早く0へ戻す。 */
      .fromTo(line1,
        { skewX: slant.max1 },
        { skewX: 0, duration: CONFIG.DUR_LINE1 * SLANT_SETTLE_RATIO, ease: SLANT_EASE }, 0);

    /* --- 2行目: 画面右からまっすぐ左へスライド ---
       背面通過時は複製要素(moving)にx/opacity/skewXをまとめて適用する。
       人物画像やHeroコンテナ側は一切動かさない。 */
    var start2 = CONFIG.DELAY_LINE2;
    var end2 = start2 + CONFIG.DUR_LINE2;
    var from2 = { x: fromX2, opacity: 0,
                  transformOrigin: SLANT_ORIGIN, willChange: 'transform,opacity' };
    var to2   = { x: 0, opacity: 1, duration: CONFIG.DUR_LINE2, onComplete: swap };
    if (useBehind) {
      /* 奥行きの補助表現はごく僅かに留める（主役はz-indexによる遮蔽） */
      from2.filter = 'blur(3px)';
      from2.scale = 0.99;
      from2.willChange = 'transform,opacity,filter';
      to2.filter = 'blur(0px)';
      to2.scale = 1;
    }
    tl.fromTo(moving, from2, to2, start2)
      /* 左へ進むので上側は後方(右)へ倒れる → CSS skewX 負（1行目と逆）。
         こちらも着地より早く0へ戻るため、背面→前面の差し替え時に
         傾きが残ったまま切り替わることはない。 */
      .fromTo(moving,
        { skewX: -slant.max2 },
        { skewX: 0, duration: CONFIG.DUR_LINE2 * SLANT_SETTLE_RATIO, ease: SLANT_EASE }, start2);

    /* サブコピーと検索ボックスを、見出し着地の少し手前から
       下からフワッと一緒に表示する（同じ開始位置・同じ尺で揃える） */
    var softStart = Math.max(0, end2 - 0.35);
    if (sub) {
      tl.fromTo(sub, { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: CONFIG.DUR_FADE }, softStart);
    }
    if (search) {
      tl.fromTo(search, { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: CONFIG.DUR_FADE }, softStart + 0.08);
    }
  }

  /* 初回表示時に1回だけ実行する（スクロール・リサイズ・bfcache復帰では
     再生しない。同タブのリロードでは通常どおり再生される）。
     ------------------------------------------------------------
     以前は document.fonts.ready を待ってから start していたが、それだと
     見出しが最大600ms前後 opacity:0 のまま残り、ロード直後の hero が
     「中身の無い温白背景だけ」に見えて白く点滅する原因になっていた。
     そこで DOMContentLoaded で即 start し、フォント確定は待たない。
     フォント差し替えによる幅変化は、start 内で fonts.ready 後に
     背面複製の座標を再同期して吸収する（前面/背面とも最終位置は
     レイアウト由来の x:0 なので、確定後に中央へ収まる）。 */
  function boot() {
    try { start(); } catch (e) { settle(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
