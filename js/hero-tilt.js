/* ============================================================
   TechSnap Hero Tilt — カーソル連動の控えめな3D傾斜
   ------------------------------------------------------------
   2026-07-29: 旧 hero-2_5d.js（レイヤー合成・グロー・グリッチ・
   パーティクル・呼吸ドリフト）を全廃し、Hero画像1枚だけを
   カーソル位置に応じて静かに傾ける最小実装へ置換した。

   責務:
     PointerTracker … window の pointermove で目標角度のみ更新
     TiltLoop       … requestAnimationFrame 1本で線形補間しtransform適用

   入力範囲（2026-08-03変更）:
     以前は .hero-image-wrap（画像カラム＝画面右側）だけを入力範囲にしていたため、
     カーソルが人物に近づいた瞬間に傾きが付き「カクッ」と見えた。
     現在は viewport 全体を入力範囲とし、画面左端→右端の移動が
     そのまま -1..1 に対応する。境界での不連続が原理的に発生しない。

   Transform所有権:
     GSAP(main.js) → .hero-image-wrap（親）
     このファイル   → .hero-image-tilt（子）のみ
   同一要素を二重制御しない。

   有効条件: (hover: hover) and (pointer: fine) かつ
             (prefers-reduced-motion: no-preference)
   条件を満たさない間はリスナーもrAFも一切持たない。
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = {
    /* 傾き上限（2026-07-29: ユーザー指示により 3/5deg → 5/8deg → 7/11deg と
       二段階強めた）。静かな印象を保つため、これ以上の増量は要相談。 */
    MAX_ROTATE_X_DEG: 7,     // 上下方向の傾き上限
    MAX_ROTATE_Y_DEG: 11,    // 左右方向の傾き上限
    LERP: 0.09,             // 補間係数（0.06〜0.12）
    SETTLE_DEG: 0.01        // これ未満の差でループを畳む
  };

  var hero  = document.querySelector('.hero');              // 可視判定に使う
  var tilt  = document.querySelector('.hero-image-tilt');   // 傾斜対象
  if (!tilt) return;

  var mqEnable = window.matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
  );

  var targetX = 0, targetY = 0;   // -1..1
  var currentX = 0, currentY = 0;
  var vw = 0, vh = 0;
  var rafId = 0;
  var bound = false;

  function measure() {
    vw = window.innerWidth || document.documentElement.clientWidth || 0;
    vh = window.innerHeight || document.documentElement.clientHeight || 0;
  }

  function clamp1(v) { return v < -1 ? -1 : (v > 1 ? 1 : v); }

  /* Heroが画面外へ出たら追従を止める（見えない要素を描き続けない） */
  function heroVisible() {
    if (!hero) return true;
    var r = hero.getBoundingClientRect();
    return r.bottom > 0 && r.top < vh;
  }

  function render() {
    /* 向きの根拠（CSS座標系）:
         rotateX(正) … 上辺が奥へ倒れる → カーソルが上(y=-1)のとき正にしたいので -y
         rotateY(正) … 右辺が奥へ倒れる → カーソルが右(x=+1)のとき正なので +x
       いずれも「カーソル側を向く」挙動になる（逃げない）。 */
    tilt.style.transform =
      'rotateX(' + (-currentY * CONFIG.MAX_ROTATE_X_DEG).toFixed(3) + 'deg) ' +
      'rotateY(' + (currentX * CONFIG.MAX_ROTATE_Y_DEG).toFixed(3) + 'deg)';
  }

  function frame() {
    currentX += (targetX - currentX) * CONFIG.LERP;
    currentY += (targetY - currentY) * CONFIG.LERP;

    var dx = Math.abs(targetX - currentX) * CONFIG.MAX_ROTATE_Y_DEG;
    var dy = Math.abs(targetY - currentY) * CONFIG.MAX_ROTATE_X_DEG;

    if (dx < CONFIG.SETTLE_DEG && dy < CONFIG.SETTLE_DEG) {
      currentX = targetX;
      currentY = targetY;
      render();
      rafId = 0;              // 収束したらループを畳む（常時描画しない）
      return;
    }
    render();
    rafId = window.requestAnimationFrame(frame);
  }

  function ensureRunning() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(frame);
  }

  function onPointerMove(e) {
    if (!vw || !vh) measure();
    if (!heroVisible()) return;
    targetX = clamp1((e.clientX / vw) * 2 - 1);
    targetY = clamp1((e.clientY / vh) * 2 - 1);
    ensureRunning();
  }

  /* ウィンドウ外へ出たときだけ正面へ戻す（同じ補間で 体感 約0.6秒） */
  function onPointerLeave(e) {
    if (e && e.relatedTarget) return;   // ページ内の要素間移動は無視
    targetX = 0;
    targetY = 0;
    ensureRunning();
  }

  function onResize() { measure(); }

  function bind() {
    if (bound) return;
    bound = true;
    measure();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerLeave, { passive: true });
    window.addEventListener('blur', onPointerLeave, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
  }

  function unbind() {
    if (!bound) return;
    bound = false;
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerout', onPointerLeave);
    window.removeEventListener('blur', onPointerLeave);
    window.removeEventListener('resize', onResize);
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    targetX = targetY = currentX = currentY = 0;
    tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }

  function sync() {
    if (mqEnable.matches) bind();
    else unbind();
  }

  if (typeof mqEnable.addEventListener === 'function') {
    mqEnable.addEventListener('change', sync);
  } else if (typeof mqEnable.addListener === 'function') {
    mqEnable.addListener(sync);      // 旧Safari
  }

  /* bfcache復帰・離脱でリスナーとrAFが重複しないようにする */
  window.addEventListener('pagehide', unbind);
  window.addEventListener('pageshow', sync);

  sync();
})();
