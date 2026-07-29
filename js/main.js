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

  /* 「比較記事」リンク: 新着比較記事セクションへ滑らかにスクロールする。
     html{scroll-behavior:auto}かつLenis使用のため、smoothScrollTo経由で動かす。 */
  const comparisonsSection = document.getElementById('comparisons');
  document.querySelectorAll('a[href="#comparisons"]').forEach(link => {
    link.addEventListener('click', (e) => {
      if (!comparisonsSection) return;   /* 比較記事0件でセクションが無い場合は既定動作 */
      e.preventDefault();
      if (mobileNav) mobileNav.classList.remove('open');
      scrollToComparisons();
    });
  });

  function scrollToComparisons() {
    if (!comparisonsSection) return;
    const margin = parseFloat(getComputedStyle(comparisonsSection).scrollMarginTop) || 0;
    smoothScrollTo(window.scrollY + comparisonsSection.getBoundingClientRect().top - margin);
  }

  /* ------ 新着比較記事: 5件目以降の折りたたみ ------
     リンクは全件が初期HTMLに存在する（SEO・JS無効時の閲覧性のため）。
     JavaScriptが動いたこの時点で初めて5件目以降を隠し、「もっと見る」を出す
     （Progressive Enhancement）。JS無効時は全件表示・ボタン非表示のまま。 */
  const COMPARISON_INITIAL_VISIBLE = 4;   /* scripts/comparison-articles.mjs の INITIAL_VISIBLE と一致させる */
  (function initComparisonToggle() {
    const list = document.getElementById('comparison-list');
    const btn = document.getElementById('comparison-more-btn');
    if (!list || !btn) return;

    const extras = Array.from(list.querySelectorAll('.cmp-card')).slice(COMPARISON_INITIAL_VISIBLE);
    if (!extras.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let expanded = false;
    let settleTimer = 0;

    /* 入場演出用のクラスとインライン遅延を片付ける（片付け後は素の表示状態に戻る） */
    const settle = (card) => {
      card.style.transitionDelay = '';
      card.classList.remove('is-entering', 'is-entering-active');
    };

    const collapse = () => {
      clearTimeout(settleTimer);
      extras.forEach(card => {
        settle(card);
        /* hidden属性で見た目・フォーカス順・支援技術上の状態をまとめて外す */
        card.hidden = true;
      });
    };

    const expand = () => {
      extras.forEach(card => {
        card.hidden = false;
        if (!reduceMotion) card.classList.add('is-entering');
      });
      if (reduceMotion) return;
      /* reflowで初期状態（opacity:0）を確定させてからactiveを付け、transitionを走らせる。
         requestAnimationFrameに任せると、非表示タブなどrAFが止まる状況で
         カードがopacity:0のまま残るため、同期的に確定させる。 */
      void list.offsetWidth;
      extras.forEach((card, i) => {
        card.style.transitionDelay = Math.min(i, 6) * 0.04 + 's';
        card.classList.add('is-entering-active');
      });
      /* 保険: バックグラウンドタブ等でtransitionが進まなくても、
         入場演出用クラスを必ず外して素の表示状態へ戻す（opacity:0で取り残さない）。 */
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => extras.forEach(settle), 900);
    };

    /* 入場が終わったらインラインの遅延と状態クラスを片付ける */
    list.addEventListener('transitionend', (e) => {
      const card = e.target.closest?.('.cmp-card');
      if (!card || !card.classList.contains('is-entering-active')) return;
      settle(card);
    });

    collapse();
    btn.hidden = false;

    btn.addEventListener('click', () => {
      expanded = !expanded;
      btn.setAttribute('aria-expanded', String(expanded));
      btn.textContent = expanded ? '閉じる' : 'もっと見る';
      if (expanded) {
        expand();
        return;
      }
      /* 折りたたみでフォーカスが非表示要素内に残らないようにボタンへ戻す */
      if (extras.some(card => card.contains(document.activeElement))) btn.focus();
      collapse();
      /* 閉じた結果ボタンが画面の外（上）へ出てしまった時だけ位置を戻す。
         見えている場合は不要な自動スクロールを行わない。 */
      if (btn.getBoundingClientRect().top < 60) scrollToComparisons();
    });
  })();

  /* ------ Header frosted on scroll ------ */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------ カテゴリバーは固定時だけ背景を出す ------
     .categoriesはデフォルトで背景透明（記事上部のHero溶け込み帯に
     ボタンだけが乗り、硬い横線が出ない）。sticky(top:60px)でヘッダー
     直下に貼り付いた時だけ.stuckを付与し、カードがバー背後を通過するのを
     隠す背景を出す。判定はrect.top<=61（＝貼り付き位置に到達したか）で、
     Lenis等のスクロール実装に依存しない。 */
  const categoriesEl = document.querySelector('.categories');
  if (categoriesEl) {
    const onCatScroll = () =>
      categoriesEl.classList.toggle('stuck', categoriesEl.getBoundingClientRect().top <= 61);
    window.addEventListener('scroll', onCatScroll, { passive: true });
    onCatScroll();
  }

  /* Heroタイトルのフェードは、GSAPのscrubトゥイーン（下部のHero演出内）で
     Hero画像と同じスクロール量・同じカーブで薄めていく。以前はしきい値での
     is-hiddenトグル（0.6sで急に消える）だったが、Hero画像のじわ〜っとした
     薄まり方と揃えるため廃止した（see: heroText opacity scrub）。 */

  /* ------ 記事の表示件数制限（カテゴリごとに最大15件 + もっと見る） ------ */
  const MAX_VISIBLE_ARTICLES = 15;
  const allCards = Array.from(document.querySelectorAll('.article-card'));
  const showMoreBtn = document.getElementById('show-more-btn');
  const noResultsEl = document.getElementById('no-results');
  let articlesExpanded = false;

  /* ================= 予算フィルタの価格帯設定 =================
     価格帯を増減・変更するときはこの配列だけを編集する（ボタンも
     この配列からDOM生成される）。
     - min は「より大きい」、max は「以下」で判定する（境界の二重所属を防ぐ）。
     - 記事側の価格は index.html の data-price（半角スペース区切り・円）。
       正は scripts/articles-meta.json の price（定価ベース）で、
       scripts/build-price-data.mjs が data-price へ機械転記する。
     - 比較記事など複数商品の記事は、いずれかの商品が価格帯に入れば該当扱い。 */
  const PRICE_RANGES = [
    { id: 'all',   label: 'すべて' },
    { id: 'u5k',   label: '～5,000円',        min: 0,     max: 5000 },
    { id: '5k10k', label: '5,000～10,000円',  min: 5000,  max: 10000 },
    { id: '1m3m',  label: '1～3万円',          min: 10000, max: 30000 },
    { id: '3m5m',  label: '3～5万円',          min: 30000, max: 50000 },
    { id: 'o5m',   label: '5万円以上',         min: 50000, max: Infinity },
  ];

  /* ================= フィルタ共通基盤 =================
     フィルタ軸ごとに { state初期値, test(card) } を1件登録する。
     ブランド・評価・新着順などを足すときは FILTERS に1件追加し、
     対応するUIから setFilter(key, value) を呼ぶだけでよい。 */
  const filterState = { cat: 'all', budget: 'all', q: '' };

  const FILTERS = {
    /* data-catはスペース区切りで複数カテゴリ指定可
       （例: data-cat="撮影機材 PC・周辺パーツ"）。単一値の既存カードもそのまま動く。 */
    cat: (card, value) =>
      value === 'all' || (card.dataset.cat || '').split(' ').includes(value),

    /* 価格未登録（data-price無し）の記事は「すべて」のときだけ表示する。
       推測の価格で価格帯に入れてしまわないための意図的な仕様。 */
    budget: (card, value) => {
      if (value === 'all') return true;
      const range = PRICE_RANGES.find(r => r.id === value);
      if (!range || range.min === undefined) return true;
      return cardPrices(card).some(p => p > range.min && p <= range.max);
    },

    q: (card, value) => {
      if (!value) return true;
      if (!card.dataset.searchText) card.dataset.searchText = card.textContent.toLowerCase();
      return card.dataset.searchText.includes(value);
    },
  };

  /* data-price のパース結果はカードごとに1度だけ計算して使い回す
     （フィルタ切替のたびに全カードを再パースしない）。 */
  const priceCache = new WeakMap();
  function cardPrices(card) {
    let v = priceCache.get(card);
    if (!v) {
      v = (card.dataset.price || '')
        .split(/\s+/)
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0);
      priceCache.set(card, v);
    }
    return v;
  }

  /* 全フィルタのAND条件を満たすカードだけを返す */
  function cardMatchesFilters(card) {
    return Object.keys(FILTERS).every(key => FILTERS[key](card, filterState[key]));
  }

  /* フィルタ値を1つ変更して再描画する。値が変わらない場合は何もしない
     （同じボタンの連打で不要な再描画・再アニメーションを起こさない）。 */
  function setFilter(key, value, opts) {
    if (filterState[key] === value && !(opts && opts.force)) return false;
    filterState[key] = value;
    articlesExpanded = false;  /* 条件が変わったら毎回15件制限から再スタート */
    updateArticleVisibility({ forceReveal: true, animate: true, animateAll: true });
    return true;
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
    /* 全フィルタ（カテゴリ・予算・検索）をAND条件で満たす記事だけを表示する。
       検索中は15件制限のみ無視して該当記事を全件表示する。 */
    const matches = allCards.filter(cardMatchesFilters);
    const limitActive = !filterState.q;

    /* 表示/非表示の判定に matches.includes(card) を使うとカード数×件数の
       線形探索になるためSetで引く（100件超でも切替が重くならない）。 */
    const matchSet = new Set(matches);
    allCards.forEach(card => {
      card.style.display = matchSet.has(card) ? '' : 'none';
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
    if (noResultsEl) noResultsEl.hidden = matches.length > 0;

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
  const catBtns = document.querySelectorAll('.cat-list:not(.budget-list) .cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      /* 検索キーワードが残ったままだと「カテゴリ×検索」のAND条件で
         該当0件になり、ボタンが反応していないように見えるため、
         カテゴリ切替時は検索をクリアしてそのカテゴリ全体を表示する。
         予算フィルタは仕様どおりカテゴリと併用（AND）するため維持する。 */
      filterState.q = '';
      const searchInputEl = document.getElementById('site-search');
      if (searchInputEl) searchInputEl.value = '';
      setFilter('cat', btn.dataset.cat, { force: true });
    });
  });

  /* ------ Budget filter ------
     ボタンは PRICE_RANGES から生成する。価格帯の変更が
     「配列1箇所の編集」で完結し、HTML側の書き換えが不要になる。 */
  const budgetList = document.getElementById('budget-list');
  if (budgetList) {
    const frag = document.createDocumentFragment();
    PRICE_RANGES.forEach(range => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-btn' + (range.id === filterState.budget ? ' active' : '');
      btn.dataset.budget = range.id;
      btn.textContent = range.label;
      frag.appendChild(btn);
    });
    budgetList.appendChild(frag);

    /* ボタン個別ではなく列に1つだけリスナーを置く（委譲） */
    budgetList.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-btn');
      if (!btn || !budgetList.contains(btn)) return;
      const changed = setFilter('budget', btn.dataset.budget);
      if (!changed) return;
      budgetList.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

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
        const q = searchInput.value.trim().toLowerCase();
        if (q === filterState.q) return;
        filterState.q = q;
        articlesExpanded = false;
        /* 検索は入力のたびに走るため、既に表示済みのカードは
           再フェードさせない（animateAll指定なし）。 */
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
       CSS変数のみを扱い、hero-tilt.jsが所有する .hero-image-tilt（子）とは競合しない。 */
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

      /* Progressive blur（2026-07-25 ユーザー指定）
         記事パネルを上端の透明度で全面統一した結果、パネル越しに人物の
         シルエットが下まで濃く残り、ランキング等の可読性を落としていた。
         そこで「スクロールが深くなるほどHeroのブラーを上げ、色味を拡散
         させる」演出にする。

         2段のkeyframes（0〜1画面でblur2px → そこから一気に深くする）で
         組むと、段の境目でblurの増加レートが跳ね、ユーザーの画面録画で
         「ブラーがいきなりかかる瞬間」として視認された（2026-07-25 指摘）。
         またfilterの関数リストが段ごとに違うと（blur+saturate →
         blur+saturate+brightness+contrast）、GSAPの補間が境目で不連続に
         なり同じ症状を招く。恒久対策として次の2点を守る:
           1. blurは段を作らず、0からの1本の連続カーブで増やす。
              序盤を寝かせて深部で伸びるease(power2.in)にすることで、
              「いつ始まったか分からないまま濃くなる」挙動にする。
           2. filterの関数リストは開始値と終了値で完全に一致させる
              （使わない関数もbrightness(1)/contrast(1)として明示する）。

         Transform所有権: scale＝この下のトゥイーン、filter/opacity＝
         blurトゥイーンと、プロパティ単位で所有者を1つに分けている。
         負荷を考慮し、深いブラーはデスクトップかつ非reduced-motionのみ。 */
      const deepBlur = isDesktop && !reduce;
      /* 深いブラーの射程。長く取るほど1pxあたりのスクロール量が増え、
         変化が知覚されにくくなる。 */
      const blurST = Object.assign({}, heroScrollST, {
        end: () => '+=' + window.innerHeight * 3.5,
      });

      if (heroImg) {
        gsap.set(heroImg, { transformOrigin: '50% 100%' }); /* 足元基準で拡大し人物の見切れを防ぐ */
        gsap.to(heroImg, {
          scale: imgScale,
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST),
        });
        if (deepBlur) {
          /* blurだけでは人物の黒い塊が「太いバンド」として残るため、
             brightnessで明度を持ち上げcontrastを落として、暖白の面へ
             色ごと拡散させる。opacityも同じカーブで下げる。
             power2.in により、1画面スクロール時点ではblur約2px＝従来の
             見え方に一致し、そこから先で滑らかに深くなる。 */
          gsap.fromTo(heroImg,
            { opacity: 1, filter: 'blur(0px) saturate(100%) brightness(1) contrast(1)' },
            {
              opacity: 0.62,
              filter: 'blur(26px) saturate(45%) brightness(1.35) contrast(0.72)',
              ease: 'power2.in',
              scrollTrigger: Object.assign({}, blurST),
            });
        } else {
          gsap.to(heroImg, {
            opacity: 0.92,
            filter: 'blur(2px)',
            ease: 'none',
            scrollTrigger: Object.assign({}, heroScrollST),
          });
        }
      }
      if (heroBgEl && !reduce) {
        gsap.set(heroBgEl, { transformOrigin: '65% 30%' }); /* 右上の光源方向へ寄っていく */
        gsap.to(heroBgEl, {
          scale: bgScale,
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST),
        });
        if (isDesktop) {
          /* 背景も人物と同じカーブで軽くぼかす。人物だけを溶かすと背景の
             光のエッジだけが残って層がちぐはぐになるため、量は控えめ。 */
          gsap.fromTo(heroBgEl,
            { filter: 'blur(0px)' },
            { filter: 'blur(6px)', ease: 'power2.in', scrollTrigger: Object.assign({}, blurST) });
        }
      }
      if (heroText && isDesktop && !reduce) {
        gsap.to(heroText, {
          '--heroTextY': '-10px',        /* わずかに手前（上）へ */
          ease: 'none',
          scrollTrigger: Object.assign({}, heroScrollST),
        });
      }
      /* Hero大見出しのフェード — Hero画像(heroImg)と同じ heroScrollST
         （start top top / end +=innerHeight / scrub 2.0）で、同じスクロール量・
         同じ「じわ〜っと薄まる」カーブに揃える。せり上がる記事すりガラスの
         向こうで、Heroと大見出しが一緒にボケながら霞んでいく。
         opacityは全ブレークポイントで、blurは動きを避けるためreduce時のみ無効。 */
      if (heroText) {
        gsap.to(heroText, {
          opacity: 0,
          filter: reduce ? 'blur(0px)' : 'blur(3px)',
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

    /* ===================================================
       ここから下（記事カード101件＋セクション見出し＋ランキング）の
       ScrollTrigger生成は、Heroタイトル演出と分離して実行する。
       ---------------------------------------------------
       理由（2026-07-27）: initScrollAnimations は window load で走るが、
       その大半を占めるのがカード1件ごとのScrollTrigger生成であり、
       long taskとして計測された（実測: 通常319ms / 4x CPUスロットル時1023ms）。
       これがちょうどHeroタイトルの横スライド開始点と重なり、
       2.5D画像の読み込みを分離した後も残る唯一の停止要因になっていた。

       上のHero用ScrollTrigger（camera前進・scrollヒント・content-section）は
       数個しかなく安価なので、従来どおりload時に作る。start/endの計算前提
       （scrollY=0で作り終える）も変えない。

       起動条件は「イベント」と「ユーザー操作」のどちらか早い方:
         - techsnap:hero-intro-complete … 何もしなければこちら
         - scroll / wheel / touchmove / keydown … intro中でも読者が
           スクロールしたら即座に生成する（.article-card はCSS既定が
           opacity:0 のため、生成を待たせるとカードが消えて見えるため）
       introの仕組みが無いページ（記事ページ等）は即実行する。
       =================================================== */
    let contentScrollDone = false;
    function initContentScrollAnimations() {
      if (contentScrollDone) return;
      contentScrollDone = true;
      buildContentScrollTriggers();
    }

    function buildContentScrollTriggers() {
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

    /* 新着比較記事のカードはGSAPで入場させない。
       折りたたみ（hidden属性）と入場トゥイーンが同じopacityを奪い合わないようにするため
       （see: CLAUDE.md 11.3 Animation Ownership）。展開時の演出はCSSの.is-entering側が持つ。 */
    }  /* /buildContentScrollTriggers */

    /* --- 起動条件の配線 --- */
    const introState = document.documentElement.getAttribute('data-hero-intro');
    if (introState === 'running') {
      const kick = () => initContentScrollAnimations();
      document.addEventListener('techsnap:hero-intro-complete', kick, { once: true });
      /* 読者が先にスクロール等をしたら待たずに生成する（カードを消さない） */
      const opts = { passive: true, once: true };
      window.addEventListener('scroll', kick, opts);
      window.addEventListener('wheel', kick, opts);
      window.addEventListener('touchmove', kick, opts);
      window.addEventListener('keydown', kick, { once: true });
      /* 万一イベントもスクロールも来ない場合の保険（Heroが空にならない設計と
         同じ考え方で、カードが永久に不可視のまま残る経路を作らない） */
      setTimeout(kick, 5000);
    } else {
      /* intro未実行・完了済み・introの仕組みが無いページ → 即実行 */
      initContentScrollAnimations();
    }

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
        /* ハッシュ遷移では着地点のカードが即座に見えている必要があるため、
           コンテンツ側ScrollTriggerの生成を遅らせずここで確定させる
           （scrollY=0のうちに全トリガーを作り終えてからrefreshする、という
             下記の前提を崩さないよう、refreshより前に呼ぶ）。 */
        initContentScrollAnimations();
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
