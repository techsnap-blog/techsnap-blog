// ===== MOBILE MENU =====
const toggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
if (toggle && mobileNav) {
  toggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
}

// ===== 記事データ（新記事追加時はここに追記する） =====
const ARTICLES = [
  {
    id: "slik-tube-light-review",
    title: "SLIK チューブ型撮影用ライト｜これ1本で「映える写真」の光が手に入る理由",
    category: "撮影機材",
    date: "2026年6月25日",
    score: "8.9",
    image: "images/slik-tube-light.jpg",
    url: "articles/slik-tube-light-review.html",
    excerpt: "光の質を変えるだけで、同じカメラ・同じ被写体が別物のように写る。2500K〜6500K・8種エフェクト搭載のSLIKチューブライトを徹底レビュー。"
  },
  {
    id: "canon-eos-6d-mark2-review",
    title: "Canon EOS 6D Mark II レンズキット｜ミラーレス全盛の今、あえてこれを選ぶ理由",
    category: "カメラ",
    date: "2026年6月25日",
    score: "8.7",
    image: "images/canon-6d-mark2.jpg",
    url: "articles/canon-eos-6d-mark2-review.html",
    excerpt: "フルサイズ一眼レフへの先入観を、この軽さが一瞬で壊してくれる。2,620万画素が描く空気感とLレンズの解像力——「これで十分」と気づいた日の話。"
  }
];

// ===== トップページ構築 =====
function buildTopPage() {
  const grid = document.getElementById('article-grid');
  const rankList = document.getElementById('rank-list');
  const heroCard = document.getElementById('hero-card');
  if (!grid) return;

  // Hero: 最新記事（先頭）
  if (heroCard && ARTICLES.length > 0) {
    const a = ARTICLES[0];
    heroCard.innerHTML = `
      <a href="${a.url}">
        <div class="hero-card-img">
          <img src="${a.image}" alt="${a.title}" loading="lazy">
        </div>
        <div class="hero-card-body">
          <div class="hero-card-meta">
            <span class="tag">${a.category}</span>
            <span class="date">${a.date}</span>
          </div>
          <h3>${a.title}</h3>
          <p class="hero-score">総合スコア ${a.score} / 10</p>
        </div>
      </a>
    `;
  }

  // 記事グリッド
  grid.innerHTML = '';
  ARTICLES.forEach(a => {
    const card = document.createElement('article');
    card.className = 'article-card';
    card.dataset.cat = a.category;
    card.innerHTML = `
      <div class="card-img">
        <img src="${a.image}" alt="${a.title}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="tag">${a.category}</span>
          <span class="date">${a.date}</span>
        </div>
        <h3><a href="${a.url}">${a.title}</a></h3>
        <p class="card-excerpt">${a.excerpt}</p>
        <p class="card-score">${a.score} / 10</p>
      </div>
    `;
    grid.appendChild(card);
  });

  // ランキング（スコア降順）
  if (rankList) {
    const sorted = [...ARTICLES].sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    rankList.innerHTML = sorted.map((a, i) => `
      <li class="rank-item">
        <span class="rank-num">${i + 1}</span>
        <div class="rank-body">
          <span class="tag sm">${a.category}</span>
          <a href="${a.url}">${a.title}</a>
        </div>
        <span class="rank-score">${a.score}</span>
      </li>
    `).join('');
  }

  // カテゴリフィルター
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      document.querySelectorAll('.article-card').forEach(card => {
        card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
      });
    });
  });
}

buildTopPage();
