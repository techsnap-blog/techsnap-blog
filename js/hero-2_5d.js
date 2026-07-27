/* ============================================================
   TechSnap Hero 2.5D — Mouse Parallax Engine
   ------------------------------------------------------------
   構成（1ファイル内で責務分離 / ビルド環境なしのため分割しない）
     HERO25D_CONFIG : 全定数（Magic Number禁止）
     LayerLoader    : DOM外での画像取得と decode()
     MouseTracker   : pointermove → target値の更新のみ（DOM操作なし）
     ParallaxEngine : Depth/Lerp計算
     GlitchTimer    : 決定論的（固定Seed）なグリッチ微動
     AnimationLoop  : 唯一の requestAnimationFrame
   ------------------------------------------------------------
   起動タイミング（2026-07-27 設計変更 / 最重要）:
     Heroタイトルの登場アニメーションが完全に終わるまで、このスクリプトは
     何もしない。画像リクエスト・decode()・DOM追加・rAF・pointermove購読の
     いずれも行わない。コールドキャッシュ時に透過WebPのデコードとレイヤー合成が
     GSAPのタイトル移動と同一フレームを奪い合い、文字が一瞬停止して見えていた
     ためである。
     合図は hero-title-intro.js が発行する
       CustomEvent 'techsnap:hero-intro-complete'（document）
     と documentElement の data-hero-intro="complete"。
     このファイルが後から読み込まれてイベントを取り逃した場合に備え、
     読み込み時点で属性が既に complete なら即座に初期化する。

   状態遷移（二重初期化・二重rAFの禁止）:
     idle ──intro完了──> loading ──全必須画像decode完了──> ready
                            │                                  │
                            │失敗/タイムアウト                  │クロスフェード完了
                            v                                  v
                        fallback（静止Heroのまま）           active（rAF稼働）
     idle 以外で初期化要求が来ても無視する。rAFは active 以降のみ、常に最大1本。
   ------------------------------------------------------------
   Transform所有権:
     GSAP        → .hero-image-wrap（親）の scale/opacity/filter
     このスクリプト → .hero25d-layer（子）の translate3d/scale/rotate
   互いに同じ要素へ触れないため競合しない。
   ------------------------------------------------------------
   フォールバック:
     静止Hero（images/hero-main.webp / .png）は初期HTMLから常に表示され、
     2.5Dが有効化されるまで隠されない。必須レイヤーが1枚でも読めなければ
     状態は fallback となり、静止Heroがそのまま残る。
     Heroが空になる経路は存在しない。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 定数 ---------------- */
  var HERO25D_CONFIG = {
    ASSET_DIR: 'images/hero/',
    LERP: 0.08,               // 追従補間係数（約0.6秒で収束）
    LERP_LAGGED: 0.045,       // glitch-detail 用の遅延追従
    VERTICAL_RATIO: 0.7,      // 垂直移動は水平の70%
    GLITCH_VERTICAL_RATIO: 0.3, // グリッチ複製層は縦ズレを抑え、スライス感を保つ
    GLITCH_RIGHT_RATIO: 0.12,   // グリッチ層は右方向へはほぼ動かさない（左は等倍）
    MAX_ROTATE_DEG: 0.5,      // Glow層のみに適用（上限0.8degの内側）
    ACTIVE_SCROLL_LIMIT: 1.5, // scrollY > vh*1.5 でループ停止（Heroがほぼ隠れる）
    DESKTOP_MIN: 1280,        // フル機能
    MOBILE_MAX: 768,          // 静止Hero（style.cssのモバイル境界に合わせる）
    TABLET_STRENGTH: 0.5,     // タブレットはパララックス50%
    LOAD_TIMEOUT_MS: 10000,   // 低速回線の打ち切り（これを超えたら静止Heroを維持）
    CROSSFADE_MS: 450,        // CSS .hero25d-stage の transition と一致させること
    GLITCH: {
      SEED: 20260710,         // 決定論的動作のための固定Seed
      MIN_INTERVAL_MS: 600,
      MAX_INTERVAL_MS: 1600,
      MIN_SHIFT_PX: 2,        // ずれ幅 2〜5px（肉眼で分かる量）
      MAX_SHIFT_PX: 5,
      MIN_OPACITY: 0.88,
      EASE: 0.08              // ずれ・明滅の補間係数（瞬間ジャンプさせずぬるぬる遷移）
    },
    /* 呼吸ドリフト: マウス静止時も常に微動し続ける（sin波・レイヤーごとに位相差） */
    BREATH: {
      FREQ_HZ: 0.22,          // 基本周期 約4.5秒
      PHASE_STEP: 1.7         // レイヤーごとの位相ずらし（バラバラに揺れる）
    }
  };

  /* レイヤー定義
       move    : マウス最大移動量(px)
       scale   : 常時スケール
       breath  : 呼吸ドリフト振幅(px) — マウス静止時も常に揺れ続ける量
       optional: true の層は読み込みに失敗しても全体を中止しない（装飾のみ）
     人物・グロー・グリッチは絵の構成要素のため必須。粒子(particles)は
     タブレット以下で元々非表示の装飾なので任意扱いとする。 */
  var HERO25D_LAYERS = [
    { name: 'back-glow',     move: 4,  scale: 1.02, rotate: true, breath: 3 },
    { name: 'person',        move: 8,  scale: 1.0,  breath: 1.2 },
    /* baseOpacity: 複製断片が下の原画と重なって二重に濃くなるのを防ぎ、
       周囲の墨色に馴染ませる（CSS側の初期値と一致させること） */
    { name: 'glitch-main',   move: 22, scale: 1.0,  glitch: true, baseOpacity: 0.6, breath: 3 },
    { name: 'glitch-detail', move: 30, scale: 1.0,  glitch: true, lagged: true, baseOpacity: 0.6, breath: 4 },
    /* wide: 画像カラム(overflow:hidden)ではなくHero全面に配置する層。
       vdrift: 上下方向のランダム風ドリフト振幅(px)。3枚が別速度で漂う */
    { name: 'particles-a',   move: 34, scale: 1.0,  breath: 5, wide: true, vdrift: 9, optional: true },
    { name: 'particles-b',   move: 30, scale: 1.0,  breath: 4, wide: true, vdrift: 12, optional: true },
    { name: 'particles-c',   move: 38, scale: 1.0,  breath: 6, wide: true, vdrift: 7, optional: true },
    { name: 'front-glow',    move: 40, scale: 1.05, rotate: true, breath: 4 }
  ];

  var wrap = document.querySelector('.hero-image-wrap');
  var hero = document.querySelector('.hero');
  if (!wrap || !hero) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* 動作検証用: ?hero25d=force で対応環境ガードを緩められる（本番挙動に影響なし） */
  var forceEnable = /[?&]hero25d=force/.test(window.location.search);

  /* 対応環境判定。ここで false なら画像は1枚も取得しない。
     判定は初期化時（＝タイトル演出後）に行うため、その時点の実寸で評価される。 */
  function isCapableEnvironment() {
    if (forceEnable) return true;
    if (reducedMotion.matches) return false;
    if (window.innerWidth <= HERO25D_CONFIG.MOBILE_MAX) return false;
    /* タッチ主体の端末（hover不可/粗ポインタ）では画面幅に関わらず初期化しない */
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return false;
    return true;
  }

  /* ---------------- 状態 ---------------- */
  var STATE = { IDLE: 'idle', LOADING: 'loading', READY: 'ready', ACTIVE: 'active', FALLBACK: 'fallback' };
  var state = STATE.IDLE;

  /* ---------------- LayerLoader ----------------
     画像は new Image() で生成し、DOMへは一切追加しない。
     load と decode() を安全に処理し、decodeが完了した要素だけを後段へ渡す。
     decode未対応・decode拒否・404・通信遅延をすべてここで吸収する。 */
  function loadLayer(def) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.className = 'hero25d-layer hero25d-layer--' + def.name +
        (def.wide ? ' hero25d-wide' : '');
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';

      var settled = false;
      function fail(e) { if (settled) return; settled = true; reject(e); }
      function ok() {
        if (settled) return;
        settled = true;
        resolve({ def: def, el: img });
      }

      img.addEventListener('error', function () { fail(new Error('load failed: ' + def.name)); }, { once: true });
      img.addEventListener('load', function () {
        /* decode()未対応ブラウザではload完了をもって描画準備完了とみなす。
           decodeが拒否された場合も同様（画像自体は取得できている）。 */
        if (typeof img.decode !== 'function') { ok(); return; }
        img.decode().then(ok, ok);
      }, { once: true });

      img.src = HERO25D_CONFIG.ASSET_DIR + def.name + '.webp';
    });
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  /* ---------------- ステージ構築 ----------------
     全必須レイヤーのdecode完了後に、DocumentFragmentで一括DOM追加する。
     decodeが済んでいない画像は決して画面へ入れない。 */
  function buildStage(onReady, onFail) {
    var loads = HERO25D_LAYERS.map(function (def) {
      return withTimeout(loadLayer(def), HERO25D_CONFIG.LOAD_TIMEOUT_MS);
    });

    var settleAll = Promise.allSettled
      ? Promise.allSettled(loads)
      : Promise.all(loads.map(function (p) {
          return p.then(
            function (v) { return { status: 'fulfilled', value: v }; },
            function (e) { return { status: 'rejected', reason: e }; }
          );
        }));

    settleAll.then(function (results) {
      var elements = [];
      var requiredMissing = false;

      results.forEach(function (r, i) {
        if (r.status === 'fulfilled') { elements.push(r.value); return; }
        if (!HERO25D_LAYERS[i].optional) requiredMissing = true;
      });

      /* 必須レイヤーが1枚でも欠けたら2.5Dを諦める。静止Heroが表示され続ける。 */
      if (requiredMissing) { onFail(); return; }

      var stage = document.createElement('div');
      stage.className = 'hero25d-stage';
      stage.setAttribute('aria-hidden', 'true');

      var wideFrag = document.createDocumentFragment();
      elements.forEach(function (item) {
        /* rAF開始の瞬間に scale が突然掛かって“弾む”のを防ぐため、
           静止時の基準transformを追加前に確定させておく。 */
        item.el.style.transform = 'translate3d(0,0,0)' +
          (item.def.scale !== 1 ? ' scale(' + item.def.scale + ')' : '');
        item.lagX = 0;
        item.lagY = 0;
        if (item.def.wide) { wideFrag.appendChild(item.el); }
        else { stage.appendChild(item.el); }
      });

      /* 一括追加（ここが初めてのDOM追加＝レイアウト/合成の発生点） */
      wrap.appendChild(stage);
      hero.appendChild(wideFrag);

      onReady(elements);
    });
  }

  /* ---------------- MouseTracker ----------------
     pointermoveではtarget値の更新のみ行う（DOM書換え禁止）。
     購読開始は2.5D有効化後。タイトル演出中は一切の処理を持たない。 */
  var targetX = 0, targetY = 0;      // -1..1（Hero中心が0）
  var currentX = 0, currentY = 0;

  function onPointerMove(e) {
    targetX = (e.clientX / window.innerWidth) * 2 - 1;
    targetY = (e.clientY / window.innerHeight) * 2 - 1;
    ensureRunning();  // 何らかの理由でループが停止していても操作で必ず復帰する
  }
  function onPointerLeave() {
    targetX = 0;                     // Hero外では中央へ戻る（Lerpで約0.6秒）
    targetY = 0;
  }

  /* ---------------- GlitchTimer ----------------
     固定Seedの決定論的PRNG（mulberry32）。乱数生成はイベント時のみ */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var glitchRand = mulberry32(HERO25D_CONFIG.GLITCH.SEED);
  var glitchNextAt = 0;
  var glitchTargetShiftX = 0;   // タイマーが更新するのは目標値のみ
  var glitchTargetOpacity = 1;
  var glitchShiftX = 0;         // 実際の値は毎フレームLerpで追従（カクつき防止）
  var glitchOpacity = 1;

  function updateGlitch(now) {
    var g = HERO25D_CONFIG.GLITCH;
    if (now >= glitchNextAt) {
      glitchNextAt = now + g.MIN_INTERVAL_MS +
        glitchRand() * (g.MAX_INTERVAL_MS - g.MIN_INTERVAL_MS);
      /* 交互にずらす／元へ戻す（点滅感を抑える） */
      if (glitchTargetShiftX === 0) {
        glitchTargetShiftX = (glitchRand() < 0.5 ? -1 : 1) *
          (g.MIN_SHIFT_PX + glitchRand() * (g.MAX_SHIFT_PX - g.MIN_SHIFT_PX));
        glitchTargetOpacity = g.MIN_OPACITY + glitchRand() * (1 - g.MIN_OPACITY);
      } else {
        glitchTargetShiftX = 0;
        glitchTargetOpacity = 1;
      }
    }
    glitchShiftX += (glitchTargetShiftX - glitchShiftX) * g.EASE;
    glitchOpacity += (glitchTargetOpacity - glitchOpacity) * g.EASE;
  }

  /* ---------------- AnimationLoop ---------------- */
  var strength = 1;                  // 画面幅に応じた減衰率
  var running = false;               // rAFループが1本だけ動いているか
  var rafId = 0;
  var layerEls = null;

  function computeStrength() {
    var w = window.innerWidth;
    if (w <= HERO25D_CONFIG.MOBILE_MAX) return 0;
    if (w < HERO25D_CONFIG.DESKTOP_MIN) return HERO25D_CONFIG.TABLET_STRENGTH;
    return 1;
  }

  function heroIsActive() {
    return state === STATE.ACTIVE &&
      !document.hidden &&
      window.scrollY < window.innerHeight * HERO25D_CONFIG.ACTIVE_SCROLL_LIMIT &&
      strength > 0;
  }

  function frame(now) {
    /* 画面外・非表示・非activeでは自らループを畳む（rAFは残さない） */
    if (!heroIsActive()) { running = false; rafId = 0; return; }
    rafId = window.requestAnimationFrame(frame);

    currentX += (targetX - currentX) * HERO25D_CONFIG.LERP;
    currentY += (targetY - currentY) * HERO25D_CONFIG.LERP;
    updateGlitch(now);

    /* 呼吸ドリフトの基準位相（レイヤーごとにPHASE_STEPずつずらす） */
    var breathT = now * 0.001 * HERO25D_CONFIG.BREATH.FREQ_HZ * Math.PI * 2;

    for (var i = 0; i < layerEls.length; i++) {
      var item = layerEls[i];
      var def = item.def;
      var lerpX = def.lagged ?
        (item.lagX += (currentX - item.lagX) * HERO25D_CONFIG.LERP_LAGGED, item.lagX) : currentX;
      var lerpY = def.lagged ?
        (item.lagY += (currentY - item.lagY) * HERO25D_CONFIG.LERP_LAGGED, item.lagY) : currentY;

      var vr = def.glitch ? HERO25D_CONFIG.GLITCH_VERTICAL_RATIO : HERO25D_CONFIG.VERTICAL_RATIO;
      var x = lerpX * def.move * strength;
      var y = lerpY * def.move * vr * strength;
      if (def.glitch) {
        if (x > 0) x *= HERO25D_CONFIG.GLITCH_RIGHT_RATIO; // 右へはほぼ動かさない
        x += glitchShiftX;
      }

      /* 呼吸ドリフト: 静止画に見えないよう常時ゆっくり揺らす
         （x/yで周期をわずかに変え、単調な円運動に見せない） */
      var phase = breathT + i * HERO25D_CONFIG.BREATH.PHASE_STEP;
      x += Math.sin(phase) * def.breath * strength;
      y += Math.cos(phase * 0.83) * def.breath * 0.6 * strength;

      /* 粒子の上下ランダム風ドリフト: 周期の異なる2つのsinの合成で
         繰り返しに見えない滑らかな漂いを作る（transformのみ・乱数不使用） */
      if (def.vdrift) {
        y += (Math.sin(phase * 0.61 + i * 2.3) * 0.6 +
              Math.sin(phase * 1.37 + i * 1.1) * 0.4) * def.vdrift * strength;
      }

      var t = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      if (def.scale !== 1) t += ' scale(' + def.scale + ')';
      if (def.rotate) t += ' rotate(' + (lerpX * HERO25D_CONFIG.MAX_ROTATE_DEG).toFixed(3) + 'deg)';
      item.el.style.transform = t;
      if (def.glitch) item.el.style.opacity = (def.baseOpacity * glitchOpacity).toFixed(3);
    }
  }

  /* rAFの唯一の起動口。running フラグと既存rafIdの二重チェックにより、
     scroll/resize/visibilitychange/pageshow/pointermove が同時に呼んでも
     ループは常に最大1本しか存在しない。 */
  function ensureRunning() {
    if (running || !layerEls) return;
    if (!heroIsActive()) return;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    running = true;
    rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
  }

  /* ---------------- 静止画 → 2.5D クロスフェード ----------------
     位置・サイズは静止画とレイヤーで一致させてある（hero-2_5d.css の
     align-self / height:108% / object-position 参照）。ここで動かすのは
     opacity だけで、位置・サイズ・色補正は一切触らない。
     クロスフェードが終わってから静止画を visibility:hidden にし、
     さらにその後で rAF を開始する（＝タイトルにもフェードにも競合させない）。 */
  function activate() {
    if (state !== STATE.READY) return;
    window.requestAnimationFrame(function () {
      wrap.classList.add('hero25d-on');   // stage 0→1 / 静止画 1→0（同尺）
      setTimeout(function () {
        wrap.classList.add('hero25d-swapped'); // 完了後に静止画を非表示
        state = STATE.ACTIVE;

        /* ここで初めてポインタ購読とrAFを開始する */
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
        strength = computeStrength();
        ensureRunning();
      }, HERO25D_CONFIG.CROSSFADE_MS);
    });
  }

  /* ---------------- イベント（activeになってから意味を持つ） ---------------- */
  window.addEventListener('scroll', ensureRunning, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopLoop(); return; }
    ensureRunning();
  });
  window.addEventListener('resize', function () {
    strength = computeStrength();   // Resize時のみ再計算
    ensureRunning();
  }, { passive: true });
  /* bfcache復帰: DOMは復元済みなので再初期化せず、ループだけ張り直す */
  window.addEventListener('pageshow', function () { stopLoop(); ensureRunning(); });
  window.addEventListener('pagehide', stopLoop);
  reducedMotion.addEventListener('change', function (e) {
    if (e.matches) stopLoop();
  });

  /* ---------------- 初期化（intro完了後にのみ呼ばれる） ---------------- */
  function init() {
    if (state !== STATE.IDLE) return;    // 二重初期化の禁止

    if (!isCapableEnvironment()) {
      state = STATE.FALLBACK;            // 画像リクエストを一切発生させない
      return;
    }

    state = STATE.LOADING;
    strength = computeStrength();

    buildStage(function (elements) {
      layerEls = elements;
      state = STATE.READY;
      activate();
    }, function () {
      state = STATE.FALLBACK;            // 静止Heroがそのまま残る
    });
  }

  /* introの完了は「イベント」と「属性」の二本立てで受ける。
     - このファイルが先に読まれた場合  … イベントで起動
     - 後から読まれ取り逃した場合      … 属性が既にcompleteなので即起動 */
  if (document.documentElement.getAttribute('data-hero-intro') === 'complete') {
    init();
  } else {
    document.addEventListener('techsnap:hero-intro-complete', init, { once: true });
  }
})();
