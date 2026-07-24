/* ============================================================
   TechSnap — main.js  v3.0
   Pinned Hero + Scroll Overlay via GSAP ScrollTrigger + Lenis
   ============================================================ */
(function () {
  'use strict';

  /* ------ 記事内ヘッダーからの #hash 付き遷移対策 ------
     index.html#reviews 等のリンクで着地すると、ブラウザのネイティブ
     アンカージャンプがLenis初期化前に発生し、Lenisの内部スクロール位置
     （0起点）と実際のscrollYがズレる。この状態のままだとLenis経由の
     ScrollTrigger.update()が正しく発火し続けず、Hero拡大縮小が途中で
     固まって見える不具合になるため、ネイティブジャンプを一旦無効化し、
     Lenis初期化後に自前でスクロールし直す（下のinitScrollAnimations内）。 */
  if (location.hash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  /* ------ Mobile menu ------ */
  const toggle    = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  /* ------ カードのスコアを1本の極細ラインで可視化 ------
     「総合スコア 8.4 / 10」のテキストから数値を読み取り、
     スコア/10 の幅を持つ.card-score-barを挿入する。
     カードがvisibleクラスを得たタイミングでscaleXが0→1に育つ
     （CSS側）。 */
  document.querySelectorAll('.card-score').forEach(el => {
    const match = el.textContent.match(/([\d.]+)\s*\/\s*10/);
    if (!match) return;
    const pct = Math.max(0, Math.min(100, (parseFloat(match[1]) / 10) * 100));
    const bar = document.createElement('div');
    bar.className = 'card-score-bar';
    bar.style.width = pct + '%';
    el.insertAdjacentElement('afterend', bar);
  });

  /* ------ 「カテゴリ」リンク: ボタンが画面中央に来るよう滑らかにスクロール ------
     html{scroll-behavior:auto}（Lenisとの競合回避のため）なので、
     通常のアンカージャンプは一瞬で上端に飛んでしまう。ここだけは
     window.scrollTo({behavior:'smooth'})で明示的に滑らかに動かし、
     かつtopではなくセクションの中央が画面中央に来る位置を計算する。 */
  /* Lenis使用時はネイティブのsmooth scroll（window.scrollTo/scrollIntoView）が
     Lenisの内部スクロール制御と競合して途中で止まることがあるため、
     プログラムからのスクロールは必ずこのヘルパーを通す。
     （lenisはinitScrollAnimations内で初期化時に代入される） */
  let lenis = null;
  function smoothScrollTo(top) {
    const dest = Math.max(0, top);
    if (lenis) {
      lenis.scrollTo(dest, { duration: 1.1 });
    } else {
      window.scrollTo({ top: dest, behavior: 'smooth' });
    }
  }
  function smoothScrollToCenter(target) {
    const rect = target.getBoundingClientRect();
    const destination = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    smoothScrollTo(destination);
  }
  /* 記事一覧(#reviews)の先頭へスクロールする。CSSのscroll-margin-top
     （固定ヘッダー＋stickyカテゴリバー分の余白）を尊重して着地させる。 */
  function scrollToListTop() {
    const reviews = document.getElementById('reviews');
    if (!reviews) return;
    const margin = parseFloat(getComputedStyle(reviews).scrollMarginTop) || 0;
    smoothScrollTo(window.scrollY + reviews.getBoundingClientRect().top - margin);
  }
  /* 「カテゴリ」リンクはスクロールに加えて、押すたびに選択カテゴリを
     1つ右へ進める（すべて→…→その他→すべて とループ）。
     advanceCategory は後方のCategory filterセクションで定義（巻き上げで参照可）。 */
  document.querySelectorAll('a[href="#categories"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileNav) mobileNav.classList.remove('open');
      advanceCategory();
      const target = document.getElementById('categories');
      if (!target) return;
      /* ボタン列がすでに画面内に見えているときはスクロールしない。
         （「レビュー」→「カテゴリ」と連続で押すと、中央寄せスクロールで
         画面が上へ戻り表示が下にずれて見える問題の対策。見えていない
         位置から押したときだけ従来どおり中央へスクロールする。） */
      /* 絞り込みでページの高さが変わった直後はレイアウトとスクロール位置が
         安定していないため、1フレーム待ってから位置を測ってスクロールする。 */
      requestAnimationFrame(() => {
        /* .categoriesはposition:sticky(top:60px)。
           - 張り付き状態（rect.top<=61 ＝ 一覧の途中〜ランキング・フッター付近）
             で押された場合は、絞り込みでページの高さが大きく変わって表示が
             ずれるため、「レビュー」リンクと同じ一覧先頭へ滑らかに戻して
             絞り込み結果を見せる。
           - 自然位置で見えている場合（一覧先頭にいるとき）はスクロールしない。
           - 見えていない場合（ヒーロー上部など）は従来どおり中央へスクロール。 */
        const rect = target.getBoundingClientRect();
        if (rect.top <= 61) {
          scrollToListTop();
        } else {
          const inView = rect.top >= 55 && rect.bottom <= window.innerHeight;
          if (!inView) smoothScrollToCenter(target);
        }
      });
    });
  });

  /* 「レビュー」リンク: 記事一覧へ滑らかにスクロールしつつ、
     カード全体をstaggerフェードで出し直す（カテゴリ切替と同じ演出）。 */
  document.querySelectorAll('a[href="#reviews"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileNav) mobileNav.classList.remove('open');
      updateArticleVisibility({ forceReveal: true, animate: true, animateAll: true });
      scrollToListTop();
    });
  });

  /* 「おすすめ」リンク: ランキングへ滑らかにスクロールしつつ、
     項目をstaggerフェードでふわっと出し直す（「レビュー」リンクと同じ思想）。
     アンカー即ジャンプ＋GSAP once再生済みだと表示がパッと切り替わって
     見えるため、押すたびに再入場アニメーションを掛ける。 */
  document.querySelectorAll('a[href="#ranking"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileNav) mobileNav.classList.remove('open');
      const ranking = document.getElementById('ranking');
      if (!ranking) return;
      const items = ranking.querySelectorAll('.rank-item');
      items.forEach(item => {
        /* GSAP側の入場トゥイーン（once）が未再生・進行中でも競合しないよう
           トゥイーンと対応するScrollTriggerを止めてから引き継ぐ */
        if (window.gsap) gsap.killTweensOf(item);
        if (window.ScrollTrigger) {
          ScrollTrigger.getAll().forEach(s => { if (s.trigger === item) s.kill(); });
        }
        item.style.transition = 'none';
        item.style.opacity = '0';
        item.style.transform = 'translateY(14px)';
      });
      void ranking.offsetWidth;  /* reflowで初期状態を確定させる */
      items.forEach((item, i) => {
        const delay = (0.15 + i * 0.07) + 's';
        item.style.transition = 'opacity 0.5s ease ' + delay + ', transform 0.5s ease ' + delay;
        item.style.opacity = '1';
        item.style.transform = 'translateY(0px)';
        item.addEventListener('transitionend', function clearTransition() {
          item.style.transition = '';
          item.removeEventListener('transitionend', clearTransition);
        });
      });
      const margin = parseFloat(getComputedStyle(ranking).scrollMarginTop) || 0;
      smoothScrollTo(window.scrollY + ranking.getBoundingClientRect().top - margin);
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
  let searchQuery = '';

  function cardMatchesSearch(card) {
    if (!searchQuery) return true;
    if (!card.dataset.searchText) {
      card.dataset.searchText = card.textContent.toLowerCase();
    }
    return card.dataset.searchText.includes(searchQuery);
  }

  function updateArticleVisibility(opts) {
    const forceReveal = !!(opts && opts.forceReveal);
    /* animate: 表示カードを opacity+translateY のstaggerフェードで
       入場させる（Blueprint許可Motionの範囲内）。
       animateAll: カテゴリ切替・「レビュー」リンクなど一覧全体を出し直す
       場合true。falseなら今回の更新で新たに現れたカードだけフェードさせる
       （「もっと見る」・検索で既表示カードが再フェードして
       チラつくのを避けるため）。 */
    const animate = !!(opts && opts.animate);
    const animateAll = !!(opts && opts.animateAll);
    const prevVisible = animate
      ? new Set(allCards.filter(c => c.style.display !== 'none' && !c.classList.contains('more-hidden')))
      : null;
    let animIdx = 0;
    /* カテゴリと検索キーワードの両方を満たす記事だけを表示する。
       検索中は15件制限のみ無視して該当記事を全件表示する。 */
    /* data-catはスペース区切りで複数カテゴリ指定可（例: data-cat="撮影機材 PC・周辺パーツ"）。
       単一値の既存カードもそのまま動く（後方互換）。 */
    const matches = allCards.filter(card =>
      (currentCat === 'all' || (card.dataset.cat || '').split(' ').includes(currentCat)) && cardMatchesSearch(card)
    );
    const limitActive = !searchQuery;

    allCards.forEach(card => {
      const isMatch = matches.includes(card);
      card.style.display = isMatch ? '' : 'none';
    });

    matches.forEach((card, i) => {
      const hidden = limitActive && !articlesExpanded && i >= MAX_VISIBLE_ARTICLES;
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
        if (animate && (animateAll || !prevVisible.has(card))) {
          /* いったん透明＋14px下に置いてから、カード順に少しずつ遅らせて
             フェードイン。reflow（offsetWidth参照）で初期状態を確定させ、
             transition終了後はinlineのtransitionを消して他の演出と干渉
             しないようにする。 */
          card.style.transition = 'none';
          card.style.opacity = '0';
          card.style.transform = 'translateY(14px)';
          void card.offsetWidth;
          const delay = (animIdx * 0.06) + 's';
          animIdx += 1;
          card.style.transition = 'opacity 0.5s ease ' + delay + ', transform 0.5s ease ' + delay;
          card.style.opacity = '1';
          card.style.transform = 'translateY(0px)';
          card.addEventListener('transitionend', function clearTransition() {
            card.style.transition = '';
            card.removeEventListener('transitionend', clearTransition);
          });
        } else {
          card.style.transition = '';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0px)';
        }
      } else if (!card.classList.contains('visible')) {
        requestAnimationFrame(() => card.classList.add('visible'));
      }
    });

    if (showMoreBtn) {
      showMoreBtn.style.display = (limitActive && !articlesExpanded && matches.length > MAX_VISIBLE_ARTICLES) ? '' : 'none';
    }

    if (forceReveal && window.ScrollTrigger) {
      ScrollTrigger.refresh();
    }
  }
  updateArticleVisibility();

  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      articlesExpanded = true;
      updateArticleVisibility({ forceReveal: true, animate: true });
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
      /* 検索キーワードが残ったままだと「カテゴリ×検索」のAND条件で
         該当0件になり、ボタンが反応していないように見えるため、
         カテゴリ切替時は検索をクリアしてそのカテゴリ全体を表示する */
      searchQuery = '';
      const searchInputEl = document.getElementById('site-search');
      if (searchInputEl) searchInputEl.value = '';
      updateArticleVisibility({ forceReveal: true, animate: true, animateAll: true });
    });
  });

  /* ヘッダー「カテゴリ」用: 現在activeなボタンの右隣を選択する。
     一番右の次は先頭（すべて）に戻る。ボタンのclick()を呼ぶことで
     絞り込み・active切替・検索クリアの既存処理をそのまま再利用する。 */
  function advanceCategory() {
    const btns = Array.from(catBtns);
    if (!btns.length) return;
    const current = btns.findIndex(b => b.classList.contains('active'));
    btns[(current + 1) % btns.length].click();
  }

  /* ------ サイト内キーワード検索 ------ */
  const searchInput = document.getElementById('site-search');
  if (searchInput) {
    let searchDebounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchQuery = searchInput.value.trim().toLowerCase();
        articlesExpanded = false;
        updateArticleVisibility({ forceReveal: true, animate: true });
      }, 120);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      scrollToListTop();
    });
  }

  /* ------ 記事カード全体をクリック可能にする（画像タップでも遷移） ------ */
  allCards.forEach(card => {
    const link = card.querySelector('h3 a');
    if (!link) return;
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; /* タイトルリンク自身のクリックはそのまま任せる */
      window.location.href = link.href;
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

    /* === Lenis ===（インスタンスは外側スコープのlenisに保持） */
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
    const heroBgEl  = document.querySelector('.hero-bg');
    const heroSearchEl = document.querySelector('.hero-search');
    const heroHint  = document.querySelector('.hero-scroll-hint');
    const contentSec = document.querySelector('.content-section');

    /* ---------------------------------------------------
       Hero カメラ前進演出（スクロール0〜900pxで収束）
       背景 < 人物 の順で拡大量を変え、少しHeroへ入り込む。
       - gsap.matchMedia: ブレークポイント切替・reduced-motion変更時に
         旧トゥイーンをrevertし、inline transformの残留を防ぐ。
       - テキストはCSS変数(--heroTextY)のみ更新し、CSS側の
         translateX(8vw)配置とresize挙動を壊さない。
       - 検索ボックス(CTA位置)はテキストよりわずかに速く動かす。
       Transform所有権: GSAPは .hero-bg / .hero-image-wrap（親）と
       CSS変数のみを扱い、hero-2_5d.jsの子レイヤーとは競合しない。 */
    /* trigger: document.body は content-section の margin-top:100vh が
       bodyへ margin collapse して start が約100vhにずれるため使わない。
       fixed配置の .hero をトリガーにすると start は常にスクロール0になる。
       end はビューポート高（記事一覧がHeroを覆い切る位置）で、
       そこへ到達するまでに演出が滑らかに収束する。 */
    const heroScrollST = {
      trigger: '.hero',
      start: 'top top',
      end: () => '+=' + window.innerHeight,
      scrub: 2.0,            /* 非常に滑らかに */
    };
    const mmHero = gsap.matchMedia();
    mmHero.add({
      isDesktop: '(min-width: 769px)',
      isMobile:  '(max-width: 768px)',
      reduce:    '(prefers-reduced-motion: reduce)',
    }, (ctx) => {
      const { isDesktop, reduce } = ctx.conditions;
      /* モバイルの前進量は体感が弱いとのユーザー指摘(2026-07-22)によりデスクトップに近い強さへ引き上げ、reduced-motionはscale変化なし */
      const imgScale = reduce ? 1 : (isDesktop ? 1.10 : 1.15);
      const bgScale  = reduce ? 1 : (isDesktop ? 1.07 : 1.09);

      if (heroImg) {
        gsap.to(heroImg, {
          scale: imgScale,
          transformOrigin: '50% 100%',   /* 足元基準で拡大し人物の見切れを防ぐ */
          opacity: 0.92,
          filter: 'blur(2px)',
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST),
        });
      }
      if (heroBgEl && !reduce) {
        gsap.to(heroBgEl, {
          scale: bgScale,
          transformOrigin: '65% 30%',    /* 右上の光源方向へ寄っていく */
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST),
        });
      }
      if (heroText && isDesktop && !reduce) {
        gsap.to(heroText, {
          '--heroTextY': '-10px',        /* わずかに手前（上）へ */
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST),
        });
      }
      if (heroSearchEl && isDesktop && !reduce) {
        gsap.to(heroSearchEl, {
          y: -8,                         /* テキストと異なる速度感を出す差分 */
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST, { end: '+=700' }),
        });
      }
    });

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

    /* === 記事カードの出現 ===
       以前はカード全98枚に個別ScrollTriggerを生成しており、その生成だけで
       起動時に約270msメインスレッドを占有し、プチフリーズの主因になっていた。
       初期表示されるのは先頭の最大15枚だけで、残り83枚は .more-hidden
       (display:none) のためScrollTriggerを作っても発火せず無駄。さらに
       「もっと見る」やカテゴリ切替で表示されるカードは updateArticleVisibility が
       inlineフェードで別途出しているため、そちらにも不要。
       そこで ScrollTrigger は「今表示されているカードだけ」に限定して生成する。
       見た目・挙動は同じで、生成コスト(≒トリガー数)が98→約15に減る。 */
    const visibleCards = gsap.utils.toArray('.article-card')
      .filter(c => c.style.display !== 'none' && !c.classList.contains('more-hidden'));
    visibleCards.forEach((card, i) => {
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

    /* === セクション見出し / ランキング ===
       こちらは要素数が少なくコストは小さいのでGSAPのまま残す。 */
    gsap.utils.toArray('.section-title').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, y: 18 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        }
      );
    });

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

    /* 冒頭で無効化した#hash遷移のスクロールをここで復元する。
       すべてのScrollTrigger（Hero含む）をscrollY=0の状態で作り終えた
       「後」に実行することが重要。先に動かすと、fixedな.heroを
       トリガーにしたHero用ScrollTriggerのstartが「常に0」という前提
       （main.js内の別コメント参照）が崩れ、Hero拡大縮小がその場で
       固まったままになる。ScrollTrigger.refresh()をscrollY=0のうちに
       明示実行して内部キャッシュを確定させてから、Lenis経由で
       スクロールし直す（Lenisの内部位置とscrollYを同期させ、以後の
       ScrollTrigger.update自動発火を保証するため）。 */
    if (location.hash) {
      const hashTarget = document.querySelector(location.hash);
      if (hashTarget) {
        ScrollTrigger.refresh();
        if (lenis) {
          lenis.scrollTo(hashTarget, { immediate: true });
        } else {
          hashTarget.scrollIntoView();
        }
      }
    }
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
