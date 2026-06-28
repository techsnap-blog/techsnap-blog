/* ============================================================
   TechSnap — main.js  v3.0
   Pinned Hero + Scroll Overlay via GSAP ScrollTrigger + Lenis
   ============================================================ */
(function () {
  'use strict';

  /* ------ Mobile menu ------ */
  const toggle    = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  /* ------ Header frosted on scroll ------ */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------ Category filter ------ */
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      document.querySelectorAll('.article-card').forEach(card => {
        const show = cat === 'all' || card.dataset.cat === cat;
        card.style.display = show ? '' : 'none';
        if (show && !card.classList.contains('visible')) {
          requestAnimationFrame(() => card.classList.add('visible'));
        }
      });
    });
  });

  /* ------ IntersectionObserver fallback for cards ------ */
  function initCardFadeIn() {
    const cards = document.querySelectorAll('.article-card');
    if (!cards.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Array.from(cards).indexOf(entry.target);
          setTimeout(() => entry.target.classList.add('visible'), (idx % 3) * 90);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
    cards.forEach(c => io.observe(c));
  }

  /* ------ Main GSAP init ------ */
  function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      initCardFadeIn();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /* === Lenis === */
    let lenis = null;
    if (typeof Lenis !== 'undefined') {
      lenis = new Lenis({
        duration: 1.2,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(time => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    /* ===================================================
       HERO PIN — image fades/scales as content rises
       trigger: hero-pin-wrap (200vh)
       =================================================== */
    const heroEl    = document.querySelector('.hero');
    const heroImg   = document.querySelector('.hero-image-wrap');
    const heroText  = document.querySelector('.hero-text-overlay');
    const heroHint  = document.querySelector('.hero-scroll-hint');
    const contentSec = document.querySelector('.content-section');

    /* -------------------------------------------------------
       Hero Pin Control（Blueprint v2.0）
       
       仕組み:
         - heroはCSSでposition:relative（通常フロー）
         - GSAPのpin:trueがスクロール中だけposition:fixedに変える
         - pinSpacing:trueでpin期間分のスクロール空間を自動確保
         - pin終了後はheroが通常フローに戻りフッターまで残らない

       pin期間:
         - start: 'top top'  → heroがvpに入った瞬間からpin
         - end: '+=900'      → 900px（約90vh相当）スクロール後にpin解除
         - 合計 100vh(hero表示) + 900px ≒ 180〜200vh相当

       pinが解除されるタイミング:
         - content-sectionがほぼ全面を覆った状態
         = Article Surfaceが完全に主役になった時点
       ------------------------------------------------------- */
    if (heroEl) {
      ScrollTrigger.create({
        trigger: heroEl,
        start: 'top top',
        end: '+=900',          /* 約180〜200vh分をpinで固定 */
        pin: true,
        pinSpacing: true,      /* pin期間分のスクロール空間を確保 */
        anticipatePin: 1,      /* ちらつき防止 */
      });
    }

    /* Hero画像: pin期間中にごく静かに変化
       scale: 1→0.985 / opacity: 1→0.92 / blur: 0→2px */
    if (heroImg && heroEl) {
      gsap.to(heroImg, {
        scale: 0.985,
        opacity: 0.92,
        filter: 'blur(2px)',
        ease: 'none',
        scrollTrigger: {
          trigger: heroEl,
          start: 'top top',
          end: '+=900',
          scrub: 2.0,          /* 非常に滑らかに */
        }
      });
    }

    /* Hero タイトル: pin期間の前半でopacity 1→0.3 */
    if (heroText && heroEl) {
      gsap.to(heroText, {
        opacity: 0.3,
        ease: 'none',
        scrollTrigger: {
          trigger: heroEl,
          start: 'top top',
          end: '+=450',        /* pin期間の前半で完了 */
          scrub: 1.5,
        }
      });
    }

    /* Scrollヒント: スクロール開始直後に消える */
    if (heroHint) {
      gsap.to(heroHint, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: heroEl,
          start: 'top top',
          end: '+=200',
          scrub: 0.5,
        }
      });
    }

    /* -------------------------------------------------------
       Story Transition: Article SurfaceがHeroの上に浮かび上がる
       - content-section: position:sticky top:0 z-index:10
       - GSAPがtranslateY(10vh → 0)でせり上がりを演出
       - pin期間の中盤から開始し、pin終了までに完了する
       ------------------------------------------------------- */
    if (contentSec && heroEl) {
      gsap.fromTo(contentSec,
        { y: '10vh' },         /* 8〜12vh範囲内 — Blueprintに従い控えめな移動量 */
        {
          y: '0vh',
          ease: 'none',
          scrollTrigger: {
            trigger: heroEl,
            start: '+=200',    /* pin開始から200px後 — Heroの余韻を残しつつ早めに見え始める */
            end: '+=900',      /* pin終了と同時に完了 */
            scrub: 2.2,        /* Hero→空気→Surface の流れを滑らかに */
          }
        }
      );
    }

    /* === Article cards stagger === */
    const cards = gsap.utils.toArray('.article-card');
    cards.forEach((card, i) => {
      gsap.fromTo(card,
        { opacity: 0, y: 32 },
        {
          opacity: 1, y: 0,
          duration: 0.65, ease: 'power2.out',
          delay: (i % 3) * 0.08,
          scrollTrigger: {
            trigger: card,
            start: 'top 91%',
            toggleActions: 'play none none none',
            once: true,
          },
          onStart: () => card.classList.add('visible'),
        }
      );
    });

    /* === Section titles === */
    gsap.utils.toArray('.section-title').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, y: 18 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        }
      );
    });

    /* === Ranking items === */
    gsap.utils.toArray('.rank-item').forEach((item, i) => {
      gsap.fromTo(item,
        { opacity: 0, x: -18 },
        {
          opacity: 1, x: 0, duration: 0.5, ease: 'power2.out',
          delay: i * 0.07,
          scrollTrigger: { trigger: item, start: 'top 90%', once: true }
        }
      );
    });
  }

  /* ------ Init ------ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('load', initScrollAnimations);
    });
  } else {
    window.addEventListener('load', initScrollAnimations);
  }

})();
