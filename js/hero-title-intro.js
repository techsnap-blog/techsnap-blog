/* ============================================================
   TechSnap Hero Title Intro — 見出しの横方向スライドイン
   ------------------------------------------------------------
   1行目「いい暮らしは、」… 画面左から定位置へ
   2行目「いい道具から。」… 画面右から定位置へ
   どちらも静止Hero画像より“前面”を通る通常の横スライド。

   2026-07-27 設計変更:
     旧仕様は2行目を人物の背面へ通すため .hero-title-behind（z-index:-1の
     複製要素）を使い、着地時に前面へswapしていた。この背面通過をやめ、
     .hero-title 内の実要素2つを直接アニメーションさせる。
     複製の座標同期(getBoundingClientRect)・blur・背面用scale・swap処理は
     すべて不要になったため削除した。

   処理順の契約:
     終了時に
       document → CustomEvent 'techsnap:hero-intro-complete'
       documentElement → data-hero-intro="complete"
     を1回だけ発行する（発行口は head 側の
     window.__techsnapHeroIntroDone() に一本化されている）。
     2026-07-29に2.5D Heroを廃止したため、現在この合図を待つ処理はないが、
     Hero関連の初期化フックとして属性・イベントは維持する。

   Transform所有権:
     GSAP(main.js)  → .hero-image-wrap / .hero-bg / CSS変数
     hero-tilt.js   → .hero-image-tilt（カーソル連動の傾斜のみ）
     このファイル   → h1内の行span と eyebrow/sub/search のみ
     いずれも対象要素が重複しないため競合しない。

   フォールバック（いずれの経路でも完了イベントは必ず発行する）:
     - JS無効                  … head側のクラスが付かず h1 が完成状態
     - このJSが落ちる          … head側の安全網でクラス解除＋完了発行
     - GSAP未読込              … 即時に完成状態を表示して完了発行
     - 例外発生                … 完成状態へ戻して完了発行
     - prefers-reduced-motion  … 横移動を一切行わず即時表示＋完了発行
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = {
    MOBILE_MAX: 768,         // スラント量の切替（style.cssのモバイル境界と対）
    OFFSCREEN_MARGIN: 48,    // 画面外へ完全に逃がす余白(px)
    DUR_LINE1: 1.0,
    DUR_LINE2: 1.2,
    DELAY_LINE2: 0.14,       // 1行目から遅らせて開始
    DELAY_EYEBROW: 0.05,
    DUR_FADE: 0.8,
    FONT_WAIT_MS: 600,       // フォント確定待ちの上限（長時間の非表示を防ぐ）
    EASE_MAIN: 'power3.out'  // バウンド系(bounce/elastic/大きなback)は使わない
  };

  /* タイトルに必要なフォントだけを待つ（document.fonts.ready ではページ全体の
     Webフォント――Inter各ウェイト・Noto各ウェイト――の完了まで待ってしまい、
     Heroの登場が回線状況に引きずられる）。
     指定文字列は h1 の実テキストのみ。CSSの .hero-text-overlay h1 と
     一致するファミリ／ウェイトを書くこと（font-weight:700 / Noto Sans JP）。 */
  var FONT_SPECS = ['700 2.5rem "Noto Sans JP"'];
  var FONT_TEXT = 'いい暮らしは、道具から。';

  /* 速度連動スラント（イタリック的な傾き）
     ------------------------------------------------------------
     移動は「まっすぐ横スライド」のまま。行の回転や縦移動は行わず、
     skewX だけを“その瞬間の移動速度”に比例させて掛ける。

     カーブの選定（2026-07-24）:
     位置の ease は power3.out（= 1-(1-t)^4）で、速度は (1-t)^3 に比例する。
     skew を速度へ厳密比例させると 0.3秒時点で既に残り2〜3度まで落ちてしまい、
     文字が動いて見えている区間のほとんどが「立った状態」になる。
     GSAP の fromTo(MAX → 0) が value = MAX*(1-ease(t)) であることを利用し、
     ease に power1.in（= t^2）を与えて skew(t) = MAX*(1 - t^2) とする。
     飛行中はほぼ倒れたまま、着地に向けて滑らかに立ち上がる。

     符号（慣性）: 下辺を支点に加速すると、上辺は慣性で進行方向の“逆”へ残る。
       右へ進む1行目 … 上側は左(後方)へ → CSS skewX 正
       左へ進む2行目 … 上側は右(後方)へ → CSS skewX 負
     SETTLE_RATIO: skewが0へ戻り切るのを移動完了より少し早め、着地の瞬間には
     必ず完全に立った状態にする。 */
  var SLANT = {
    desktop: { max1: 14, max2: 24 },   // イタリック相当。崩れて見える手前が上限
    mobile:  { max1: 8,  max2: 13 }
  };
  var SLANT_SETTLE_RATIO = 0.92;
  var SLANT_EASE = 'power1.in';
  var SLANT_ORIGIN = '50% 100%';  // 下辺を支点に上側が慣性で振られる

  var html    = document.documentElement;
  var line1   = document.querySelector('.hero-title-line--first');
  var line2   = document.querySelector('.hero-title-line--second-front');
  var eyebrow = document.querySelector('.hero-eyebrow');
  var sub     = document.querySelector('.hero-sub');
  var search  = document.querySelector('.hero-search');

  /* 同一ロード中の二重実行防止（bootが複数回呼ばれても1回しか走らない） */
  var booted = false;

  /* introが「これから走る」ことを、このファイルが実行された時点で即座に記録する。
     head側の安全網タイマーは data-hero-intro が無いときだけ完了扱いにするため、
     ここを遅らせると低速回線で「スクリプト失敗」と誤判定され、2.5Dの読み込みが
     タイトル移動に重なる。DOMContentLoadedを待たずに立てること。 */
  html.setAttribute('data-hero-intro', 'running');

  function release() { html.classList.remove('hero-intro-pending'); }

  /* intro完了の通知。head側に定義された唯一の発火口へ委譲する。
     head側スクリプトが何らかの理由で失われていた場合の保険も持つ。 */
  function notifyComplete() {
    if (typeof window.__techsnapHeroIntroDone === 'function') {
      window.__techsnapHeroIntroDone();
      return;
    }
    if (html.getAttribute('data-hero-intro') === 'complete') return;
    html.setAttribute('data-hero-intro', 'complete');
    try {
      document.dispatchEvent(new CustomEvent('techsnap:hero-intro-complete'));
    } catch (e) {}
  }

  /* 完成状態（アニメーションなし）へ確定させ、完了を通知する。
     エラー経路はすべてここを通る＝Heroが非表示のまま残らない。 */
  function settle() {
    [line1, line2, eyebrow, sub, search].forEach(function (el) {
      if (!el) return;
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
      el.style.willChange = '';
    });
    release();
    notifyComplete();
  }

  if (!line1 || !line2) { release(); notifyComplete(); return; }

  function start() {
    var g = window.gsap;
    if (!g) { settle(); return; }

    /* 移動距離は実測から算出し、必ず画面外から流れ込ませる
       （.hero が overflow:hidden のため横スクロールは発生しない） */
    var vw = window.innerWidth;
    var r1 = line1.getBoundingClientRect();
    var r2 = line2.getBoundingClientRect();
    var fromX1 = -(r1.right + CONFIG.OFFSCREEN_MARGIN);          // 画面左外
    var fromX2 = (vw - r2.left) + CONFIG.OFFSCREEN_MARGIN;       // 画面右外

    var slant = (vw <= CONFIG.MOBILE_MAX) ? SLANT.mobile : SLANT.desktop;

    /* 完成位置での一瞬の露出を防ぐため、クラス解除前にインラインで伏せる */
    g.set([line1, line2], { opacity: 0 });
    if (eyebrow) g.set(eyebrow, { opacity: 0 });
    if (sub) g.set(sub, { opacity: 0 });
    if (search) g.set(search, { opacity: 0 });
    release();

    function cleanup() {
      g.set([line1, line2, eyebrow, sub, search].filter(Boolean), { clearProps: 'all' });
      /* タイムラインが完全に終わった“後”に初めて2.5Dの読み込みを許可する */
      notifyComplete();
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
      /* 右へ進むので上側は後方(左)へ倒れる → CSS skewX 正。
         移動と同時に始め、着地より少し早く0へ戻す。 */
      .fromTo(line1,
        { skewX: slant.max1 },
        { skewX: 0, duration: CONFIG.DUR_LINE1 * SLANT_SETTLE_RATIO, ease: SLANT_EASE }, 0);

    /* --- 2行目: 画面右からまっすぐ左へスライド（前面のまま） --- */
    var start2 = CONFIG.DELAY_LINE2;
    var end2 = start2 + CONFIG.DUR_LINE2;
    tl.fromTo(line2,
      { x: fromX2, opacity: 0, transformOrigin: SLANT_ORIGIN, willChange: 'transform,opacity' },
      { x: 0, opacity: 1, duration: CONFIG.DUR_LINE2 }, start2)
      /* 左へ進むので上側は後方(右)へ倒れる → CSS skewX 負（1行目と逆） */
      .fromTo(line2,
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
     フォント確定後に座標を取るが、待ちは上限付きで打ち切る。 */
  function boot() {
    if (booted) return;
    booted = true;

    /* reduced-motion は横移動を行わず即時完成 → そのまま完了通知。
       この場合2.5Dは対応環境判定で無効なので、静止Heroのままとなる。 */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle();
      return;
    }

    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { start(); } catch (e) { settle(); }
    }

    /* ページ全体のフォント完了(document.fonts.ready)は待たない。
       h1に必要なファミリ・ウェイト・文字だけを待ち、上限で打ち切る。 */
    if (document.fonts && typeof document.fonts.load === 'function') {
      var loads = FONT_SPECS.map(function (spec) {
        try { return document.fonts.load(spec, FONT_TEXT); }
        catch (e) { return Promise.resolve(); }
      });
      Promise.all(loads).then(run, run);
      setTimeout(run, CONFIG.FONT_WAIT_MS);
    } else {
      run();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
