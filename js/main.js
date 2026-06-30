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

  /* ------ 「カテゴリ」リンク: ボタンが画面中央に来るよう滑らかにスクロール ------
     html{scroll-behavior:auto}（Lenisとの競合回避のため）なので、
     通常のアンカージャンプは一瞬で上端に飛んでしまう。ここだけは
     window.scrollTo({behavior:'smooth'})で明示的に滑らかに動かし、
     かつtopではなくセクションの中央が画面中央に来る位置を計算する。 */
  function smoothScrollToCenter(target) {
    const rect = target.getBoundingClientRect();
    const destination = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, destination), behavior: 'smooth' });
  }
  document.querySelectorAll('a[href="#categories"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileNav) mobileNav.classList.remove('open');
      const target = document.getElementById('categories');
      if (target) smoothScrollToCenter(target);
    });
  });

  /* ------ Header frosted on scroll ------ */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------ Heroタイトルを確実に隠す ------
     GSAPのscrubフェードだけでは「opacityが0になりきらず薄く残る」
     ケースがあったため、一定スクロール後はvisibility:hiddenで
     完全に非表示にする（CSS側のtransitionで滑らかさは維持）。 */
  const heroTextEl = document.querySelector('.hero-text-overlay');
  if (heroTextEl) {
    const onHeroScroll = () => heroTextEl.classList.toggle('is-hidden', window.scrollY > 260);
    window.addEventListener('scroll', onHeroScroll, { passive: true });
    onHeroScroll();
  }

  /* ------ 記事の表示件数制限（カテゴリごとに最大15件 + もっと見る） ------ */
  const MAX_VISIBLE_ARTICLES = 15;
  const allCards = Array.from(document.querySelectorAll('.article-card'));
  const showMoreBtn = document.getElementById('show-more-btn');
  let currentCat = 'all';
  let articlesExpanded = false;

  function updateArticleVisibility(opts) {
    const forceReveal = !!(opts && opts.forceReveal);
    const matches = allCards.filter(card => currentCat === 'all' || card.dataset.cat === currentCat);

    allCards.forEach(card => {
      const isMatch = matches.includes(card);
      card.style.display = isMatch ? '' : 'none';
    });

    matches.forEach((card, i) => {
      const hidden = !articlesExpanded && i >= MAX_VISIBLE_ARTICLES;
      card.classList.toggle('more-hidden', hidden);
      if (hidden) return;
      if (forceReveal) {
        /* ユーザー操作（カテゴリ切替・もっと見る）で表示されたカードは、
           GSAPのScrollTrigger（画面内に入ったらフェードイン）が
           display:noneだった間のズレで反応しないことがあるため、
           （既にvisibleクラスが付いていてもGSAPが後からopacity:0を
           inline上書きしている場合があるので）毎回強制的に表示する。
           GSAPのトゥイーンが同時に進行中だと毎フレームinline styleを
           上書きして競合するため、先に該当カードのトゥイーンを止める。 */
        if (window.gsap) gsap.killTweensOf(card);
        card.classList.add('visible');
        card.style.opacity = '1';
        card.style.transform = 'translateY(0px)';
      } else if (!card.classList.contains('visible')) {
        requestAnimationFrame(() => card.classList.add('visible'));
      }
    });

    if (showMoreBtn) {
      showMoreBtn.style.display = (!articlesExpanded && matches.length > MAX_VISIBLE_ARTICLES) ? '' : 'none';
    }

    if (forceReveal && window.ScrollTrigger) {
      ScrollTrigger.refresh();
    }
  }
  updateArticleVisibility();

  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      articlesExpanded = true;
      updateArticleVisibility({ forceReveal: true });
    });
  }

  /* ------ Category filter ------ */
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      articlesExpanded = false;  /* カテゴリ切替時は毎回15件制限から再スタート */
      updateArticleVisibility({ forceReveal: true });
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
       HERO BACKGROUND — image fades/scales as content rises
       .heroはCSSでposition:fixedの常時背景。GSAPのpin/pin-spacer
       方式は「pin解除後に一緒にスクロールし始める」不具合が
       再発したため廃止。スクロール量に応じた数値演出のみ行う。
       =================================================== */
    const heroImg   = document.querySelector('.hero-image-wrap');
    const heroText  = document.querySelector('.hero-text-overlay');
    const heroHint  = document.querySelector('.hero-scroll-hint');
    const contentSec = document.querySelector('.content-section');

    /* Hero画像: スクロール0〜900pxでごく静かに変化
       scale: 1→0.985 / opacity: 1→0.92 / blur: 0→2px */
    if (heroImg) {
      gsap.to(heroImg, {
        scale: 0.985,
        opacity: 0.92,
        filter: 'blur(2px)',
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: '+=900',
          scrub: 2.0,          /* 非常に滑らかに */
        }
      });
    }

    /* Hero タイトルのopacityフェードはCSS(.hero-text-overlay.is-hidden)＋
       スクロールリスナー側で確実に処理するため、GSAPでの重複制御は行わない。 */

    /* Scrollヒント: スクロール開始直後に消える */
    if (heroHint) {
      gsap.to(heroHint, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: '+=200',
          scrub: 0.5,
        }
      });
    }

    /* -------------------------------------------------------
       Story Transition: Article SurfaceがHeroの上に重なる
       - content-section: position:relative, margin-top:100vh
       - Heroはfixedで常時背景に残るため、Surfaceを通常フローの
         位置からずらすアニメーションは付けない。
         （Y方向にずらすとHero(100vh固定)とSurfaceの間に隙間が
          できてbody地の背景色が露出するため、JSでの位置移動は禁止。
          静かな没入感はopacityのみで表現する。）
       ------------------------------------------------------- */
    if (contentSec) {
      gsap.fromTo(contentSec,
        { opacity: 0.92 },
        {
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: document.body,
            start: '+=200',
            end: '+=900',
            scrub: 2.2,
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
