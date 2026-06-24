// Category filter
const catBtns = document.querySelectorAll('.cat-btn');
const cards = document.querySelectorAll('.article-card');

catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    cards.forEach(card => {
      card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
    });
  });
});

// Mobile hamburger menu
const toggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
if (toggle && mobileNav) {
  toggle.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
  });
}
