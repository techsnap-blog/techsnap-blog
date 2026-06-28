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
    const pinWrap      = document.querySelector('.hero-pin-wrap');
    const heroImg      = document.querySelector('.hero-image-wrap');
    const heroText     = document.querySelector('.hero-text-overlay');
    const heroHint     = document.querySelector('.hero-scroll-hint');
    const contentSec   = document.querySelector('.content-section');

    if (pinWrap && heroImg) {
      /* Blueprint: image scale 1→0.98, opacity 1→0.9, blur 0→2px */
      gsap.to(heroImg, {
        scale: 0.98,
        opacity: 0.9,
        filter: 'blur(2px)',
        ease: 'none',
        scrollTrigger: {
          trigger: pinWrap,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.4,
        }
      });
    }

    if (pinWrap && heroText) {
      /* Blueprint: title opacity 100% → 30% */
      gsap.to(heroText, {
        opacity: 0.3,
        ease: 'none',
        scrollTrigger: {
          trigger: pinWrap,
          start: 'top top',
          end: '45% top',
          scrub: 1.0,
        }
      });
    }

    if (pinWrap && heroHint) {
      gsap.to(heroHint, {
        opacity: 0, ease: 'none',
        scrollTrigger: {
          trigger: pinWrap,
          start: 'top top',
          end: '15% top',
          scrub: 0.5,
        }
      });
    }

    /* -------------------------------------------------------
       Story Transition: Article Surfaceがせり上がる
       - content-sectionはCSS margin-top:-100vhでHero上に初期配置
       - GSAPがさらにtranslateY(60vh)→(0)でせり上がりを演出
       - Hero上に10〜15%残るよう、終了時もHeroが完全に隠れない
       ------------------------------------------------------- */
    if (pinWrap && contentSec) {
      gsap.fromTo(contentSec,
        { y: '65vh' },   /* 初期位置: 画面下65%に隠れている */
        {
          y: '0vh',       /* 終了位置: 自然な位置（margin-top:-100vhが基準） */
          ease: 'none',
          scrollTrigger: {
            trigger: pinWrap,
            start: 'top top',      /* ページ最上部からスクロール開始と同時 */
            end: 'bottom top',     /* pin-wrap底部＝200vh地点で完了 */
            scrub: 1.2,            /* スクロールに滑らかに追従 */
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
