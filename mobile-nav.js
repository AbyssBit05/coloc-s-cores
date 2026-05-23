document.addEventListener('DOMContentLoaded', () => {
  const btn     = document.getElementById('burgerBtn');
  const panel   = document.getElementById('navLinks');
  const overlay = document.getElementById('navOverlay');
  const close   = document.getElementById('navClose');

  function openMenu() {
    panel.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openMenu);
  close.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  panel.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
});
