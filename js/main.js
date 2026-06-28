/* ============================================================
   TechSnap — main.js  v2.0
   Lenis smooth scroll + GSAP ScrollTrigger + UI interactions
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. Mobile menu
  ---------------------------------------------------------- */
  const toggle    = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  /* ----------------------------------------------------------
     2. Header: transparent → frosted on scroll
  ---------------------------------------------------------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------
     3. Category filter
  ---------------------------------------------------------- */
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      document.querySelectorAll('.article-card').forEach(card => {
        const show = cat === 'all' || card.dataset.cat === cat;
        card.style.display = show ? '' : 'none';
        /* Re-trigger visibility for filtered-in cards */
        if (show && !card.classList.contains('visible')) {
          requestAnimationFrame(() => card.classList.add('visible'));
        }
      });
    });
  });

  /* ----------------------------------------------------------
     4. Article card scroll fade-in (IntersectionObserver)
        — fallback when GSAP is unavailable
  ---------------------------------------------------------- */
  function initCardFadeIn() {
    const cards = document.querySelectorAll('.article-card');
    if (!cards.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          /* Stagger per row of 3 */
          const idx = Array.from(cards).indexOf(entry.target);
          const delay = (idx % 3) * 80;
          setTimeout(() => entry.target.classList.add('visible'), delay);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    cards.forEach(card => io.observe(card));
  }

  /* ----------------------------------------------------------
     5. GSAP + Lenis (loaded from CDN in index.html)
  ---------------------------------------------------------- */
  function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      /* GSAP not loaded — use IntersectionObserver fallback */
      initCardFadeIn();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /* ---- Lenis smooth scroll ---- */
    let lenis = null;
    if (typeof Lenis !== 'undefined') {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      lenis.on('scroll', ScrollTrigger.update);

      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    /* ---- Hero parallax / scale / blur ---- */
    const heroImageWrap = document.querySelector('.hero-image-wrap');
    const heroTextOverlay = document.querySelector('.hero-text-overlay');
    const heroScrollHint  = document.querySelector('.hero-scroll-hint');

    if (heroImageWrap) {
      gsap.to(heroImageWrap, {
        scale: 0.92,
        opacity: 0.85,
        filter: 'blur(4px)',
        ease: 'none',
        scrollTrigger: {
          trigger: '.content-section',
          start: 'top bottom',
          end: 'top 30%',
          scrub: true,
        }
      });
    }

    if (heroTextOverlay) {
      gsap.to(heroTextOverlay, {
        opacity: 0,
        y: -24,
        ease: 'none',
        scrollTrigger: {
          trigger: '.content-section',
          start: 'top 90%',
          end: 'top 50%',
          scrub: true,
        }
      });
    }

    if (heroScrollHint) {
      gsap.to(heroScrollHint, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.content-section',
          start: 'top 95%',
          end: 'top 80%',
          scrub: true,
        }
      });
    }

    /* ---- Content section: slide up from behind ---- */
    const contentSection = document.querySelector('.content-section');
    if (contentSection) {
      gsap.from(contentSection, {
        y: 60,
        ease: 'none',
        scrollTrigger: {
          trigger: contentSection,
          start: 'top bottom',
          end: 'top 60%',
          scrub: true,
        }
      });
    }

    /* ---- Article cards stagger fade-in ---- */
    const cards = gsap.utils.toArray('.article-card');
    cards.forEach((card, i) => {
      gsap.fromTo(card,
        { opacity: 0, y: 28 },
        {
          opacity: 1, y: 0,
          duration: 0.6,
          ease: 'power2.out',
          delay: (i % 3) * 0.07,
          scrollTrigger: {
            trigger: card,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true,
          },
          onStart: () => card.classList.add('visible'),
        }
      );
    });

    /* ---- Section titles fade-in ---- */
    gsap.utils.toArray('.section-title, .ranking .section-title').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, y: 16 },
        {
          opacity: 1, y: 0,
          duration: 0.7, ease: 'power2.out',
          scrollTrigger: {
            trigger: el, start: 'top 88%',
            toggleActions: 'play none none none',
            once: true,
          }
        }
      );
    });

    /* ---- Ranking items stagger ---- */
    gsap.utils.toArray('.rank-item').forEach((item, i) => {
      gsap.fromTo(item,
        { opacity: 0, x: -16 },
        {
          opacity: 1, x: 0,
          duration: 0.5, ease: 'power2.out',
          delay: i * 0.06,
          scrollTrigger: {
            trigger: item, start: 'top 90%',
            toggleActions: 'play none none none',
            once: true,
          }
        }
      );
    });
  }

  /* ----------------------------------------------------------
     6. Init after DOM + scripts ready
  ---------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGSAP);
  } else {
    /* CDN scripts may still be loading */
    window.addEventListener('load', initGSAP);
  }

})();
