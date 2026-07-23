/* ============================================================
   article-promo.js
   記事ページの<body data-cat="...">を見て、該当カテゴリの
   記事だけに固定の広告/プロモブロックを自動挿入する。
   新しい記事を追加する際は、body要素にdata-cat属性を
   付けるだけで自動的に表示される（HTMLへの手動コピー不要）。
   ============================================================ */
(function () {
  'use strict';

  const cat = document.body.dataset.cat;

  /* オーディオカテゴリ: Amazon Music Unlimited CTA */
  if (cat === 'オーディオ') {
    const anchor = document.querySelector('.article-header');
    if (anchor) {
      const block = document.createElement('div');
      block.className = 'amazon-music-cta';
      block.innerHTML =
        '<div>' +
          '<p class="amazon-music-eyebrow">\u{1F3A7} 高音質な音楽配信を楽しもう</p>' +
          '<p class="amazon-music-title">Amazon Music Unlimited</p>' +
        '</div>' +
        '<a href="https://www.amazon.co.jp/music/unlimited/?tag=techsnap-22" target="_blank" rel="noopener sponsored" class="amazon-music-btn">無料体験で聴いてみる</a>';
      anchor.insertAdjacentElement('afterend', block);
    }
  }
})();
