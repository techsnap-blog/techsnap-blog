// Category filter
const catBtns = document.querySelectorAll('.cat-btn');
const cards = document.querySelectorAll('.article-card');

catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    cards.forEach(card => {
      if (cat === 'all' || card.dataset.cat === cat) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// Mobile menu toggle (simple)
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.style.display === 'flex';
    nav.style.display = open ? 'none' : 'flex';
    nav.style.flexDirection = 'column';
    nav.style.position = 'absolute';
    nav.style.top = '60px';
    nav.style.left = '0';
    nav.style.right = '0';
    nav.style.background = '#0d1117';
    nav.style.padding = '16px 20px';
    nav.style.borderBottom = '1px solid #30363d';
    if (open) nav.style.display = 'none';
  });
}
