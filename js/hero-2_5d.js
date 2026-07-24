/* ============================================================
   TechSnap Hero 2.5D — Mouse Parallax Engine
   ------------------------------------------------------------
   構成（1ファイル内で責務分離 / ビルド環境なしのため分割しない）
     HERO25D_CONFIG : 全定数（Magic Number禁止）
     MouseTracker   : pointermove → target値の更新のみ（DOM操作なし）
     ParallaxEngine : Depth/Lerp計算
     GlitchTimer    : 決定論的（固定Seed）なグリッチ微動
     AnimationLoop  : 唯一の requestAnimationFrame
   ------------------------------------------------------------
   Transform所有権:
     GSAP        → .hero-image-wrap（親）の scale/opacity/filter
     このスクリプト → .hero25d-layer（子）の translate3d/scale/rotate
   互いに同じ要素へ触れないため競合しない。
   ------------------------------------------------------------
   フォールバック:
     全レイヤー画像の読込に成功した時だけステージを有効化する。
     失敗時・モバイル・prefers-reduced-motion 時は既存の静止Hero
     （images/hero-main.png）がそのまま表示され続ける。
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
    GLITCH: {
      SEED: 20260710,         // 決定論的動作のための固定Seed
      MIN_INTERVAL_MS: 600,
      MAX_INTERVAL_MS: 1600,
      MIN_SHIFT_PX: 2,        // ずれ幅 2〜5px（肉眼で分かる量に増量 2026-07-10）
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

  /* レイヤー定義: move=マウス最大移動量(px), scale=常時スケール,
     breath=呼吸ドリフト振幅(px) — マウス静止時も常に揺れ続ける量 */
  var HERO25D_LAYERS = [
    { name: 'back-glow',     move: 4,  scale: 1.02, rotate: true, breath: 3 },
    { name: 'person',        move: 8,  scale: 1.0,  breath: 1.2 },
    /* baseOpacity: 複製断片が下の原画と重なって二重に濃くなるのを防ぎ、
       周囲の墨色に馴染ませる（CSS側の初期値と一致させること） */
    { name: 'glitch-main',   move: 22, scale: 1.0,  glitch: true, baseOpacity: 0.6, breath: 3 },
    { name: 'glitch-detail', move: 30, scale: 1.0,  glitch: true, lagged: true, baseOpacity: 0.6, breath: 4 },
    /* wide: 画像カラム(overflow:hidden)ではなくHero全面に配置する層。
       vdrift: 上下方向のランダム風ドリフト振幅(px)。3枚が別速度で漂い、
       粒がバラバラに動いて見える */
    { name: 'particles-a',   move: 34, scale: 1.0,  breath: 5, wide: true, vdrift: 9 },
    { name: 'particles-b',   move: 30, scale: 1.0,  breath: 4, wide: true, vdrift: 12 },
    { name: 'particles-c',   move: 38, scale: 1.0,  breath: 6, wide: true, vdrift: 7 },
    { name: 'front-glow',    move: 40, scale: 1.05, rotate: true, breath: 4 }
  ];

  /* ---------------- 起動ガード ---------------- */
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* 動作検証用: ?hero25d=force でreduced-motionガードを無視できる（本番挙動に影響なし） */
  var forceEnable = /[?&]hero25d=force/.test(window.location.search);
  var wrap = document.querySelector('.hero-image-wrap');
  var hero = document.querySelector('.hero');
  if (!wrap || !hero) return;
  if (reducedMotion.matches && !forceEnable) return;       // 静止Heroのまま
  if (window.innerWidth <= HERO25D_CONFIG.MOBILE_MAX) return; // モバイルは初期化しない
  /* タッチ主体の端末（hover不可/粗ポインタ）では画面幅に関わらず
     マウスパララックスを初期化しない（タブレット横持ち等の誤作動防止） */
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches && !forceEnable) return;

  /* ---------------- ステージ構築 ---------------- */
  function buildStage(onReady) {
    var stage = document.createElement('div');
    stage.className = 'hero25d-stage';
    stage.setAttribute('aria-hidden', 'true');

    var pending = HERO25D_LAYERS.length;
    var failed = false;
    var elements = [];
    var wideNodes = [];   // Hero全面配置の層（stage外・.hero直下へ入れる）

    HERO25D_LAYERS.forEach(function (def) {
      var img = document.createElement('img');
      img.className = 'hero25d-layer hero25d-layer--' + def.name +
        (def.wide ? ' hero25d-wide' : '');
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', function () { failed = true; done(); }, { once: true });
      img.src = HERO25D_CONFIG.ASSET_DIR + def.name + '.webp';
      elements.push({ def: def, el: img });
      if (def.wide) { wideNodes.push(img); } else { stage.appendChild(img); }
    });

    function done() {
      pending -= 1;
      if (pending > 0) return;
      if (failed) { stage.remove(); return; }  // 1枚でも失敗→静止Heroのまま
      wrap.appendChild(stage);
      wideNodes.forEach(function (n) { hero.appendChild(n); });
      wrap.classList.add('hero25d-on');
      onReady(elements);
    }
  }

  /* ---------------- MouseTracker ----------------
     pointermoveではtarget値の更新のみ行う（DOM書換え禁止） */
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
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });

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
  var running = false;
  var rafId = 0;
  var layerEls = null;

  /* 起動直後、heroは blur→シャープの「ピント送り」演出中。全画面にかかる
     blurは重く、その最中にパララックス（呼吸ドリフト含む）で子の transform を
     毎フレーム書き換えると、ぼかし対象が毎フレーム再描画されて起動時に
     カクつく。演出が終わるまで2.5Dの動作を止めておく（人物はぼけていて
     パララックスは元々見えないため体感上の損失はない）。
     BLUR_HOLD_MS は style.css の .hero blur transition(1.2s)より少し長め。 */
  var BLUR_HOLD_MS = 1400;
  var blurHoldDone = false;

  function computeStrength() {
    var w = window.innerWidth;
    if (w <= HERO25D_CONFIG.MOBILE_MAX) return 0;
    if (w < HERO25D_CONFIG.DESKTOP_MIN) return HERO25D_CONFIG.TABLET_STRENGTH;
    return 1;
  }

  function heroIsActive() {
    return blurHoldDone &&
      !document.hidden &&
      window.scrollY < window.innerHeight * HERO25D_CONFIG.ACTIVE_SCROLL_LIMIT &&
      strength > 0;
  }

  function frame(now) {
    if (!heroIsActive()) { running = false; return; } // 画面外/非表示で停止
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

  function ensureRunning() {
    if (running || !layerEls) return;
    if (!heroIsActive()) return;
    running = true;
    rafId = window.requestAnimationFrame(frame);
  }

  /* ---------------- イベント ---------------- */
  window.addEventListener('scroll', ensureRunning, { passive: true });
  document.addEventListener('visibilitychange', ensureRunning);
  window.addEventListener('resize', function () {
    strength = computeStrength();   // Resize時のみ再計算
    ensureRunning();
  }, { passive: true });
  reducedMotion.addEventListener('change', function (e) {
    if (e.matches && rafId) { window.cancelAnimationFrame(rafId); running = false; }
  });

  /* ---------------- 初期化 ---------------- */
  strength = computeStrength();

  /* ピント送り演出の終了後にパララックスを解禁する。
     reduced-motion時はblur演出自体が無いため待たずに解禁。 */
  var reduceForBlur = reducedMotion.matches && !forceEnable;
  window.setTimeout(function () {
    blurHoldDone = true;
    ensureRunning();
  }, reduceForBlur ? 0 : BLUR_HOLD_MS);

  buildStage(function (elements) {
    elements.forEach(function (item) {
      item.lagX = 0; item.lagY = 0;
    });
    layerEls = elements;
    ensureRunning();   // blurHoldDoneがtrueになるまでは内部で待機
  });
})();
