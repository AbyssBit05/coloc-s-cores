/**
 * session.js — Session utilisateur globale (sessionStorage).
 * Chargé après data.js sur toutes les pages.
 * Toutes les fonctions qui touchent Supabase sont async.
 */

// ─── Lecture / écriture ───────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(bobo) {
  sessionStorage.setItem('currentUser', JSON.stringify({
    id:    bobo.id,
    name:  bobo.nom || bobo.name,
    photo: bobo.photo_url || bobo.photo || null,
  }));
}

function clearCurrentUser() {
  sessionStorage.removeItem('currentUser');
}

// ─── Modale "Qui es-tu ?" ─────────────────────────────────────────────────────

function _buildModalShell() {
  const overlay = document.createElement('div');
  overlay.id = 'userModal';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9000;',
    'background:rgba(99,153,34,0.97);',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'padding:24px;font-family:Nunito,sans-serif;',
  ].join('');
  overlay.innerHTML = `
    <div style="font-family:Fredoka,sans-serif;font-size:2.5rem;color:#fff;margin-bottom:6px;text-align:center;">
      🏠 Coloc's Chores
    </div>
    <div style="font-family:Fredoka,sans-serif;font-size:1.6rem;color:#EAF3DE;margin-bottom:32px;text-align:center;">
      Qui es-tu ?
    </div>
    <div id="modalBoboList" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;max-width:640px;"></div>
    <div id="modalNoBobos" style="color:#EAF3DE;font-size:1rem;text-align:center;display:none;margin-top:16px;">
      Aucun bobo enregistré.<br>
      <a href="index.html" style="color:#fff;font-weight:700;text-decoration:underline;">
        Ajoute les bobos d'abord →
      </a>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

async function _populateModal() {
  const bobos  = await getBobos();
  const list   = document.getElementById('modalBoboList');
  const noBobo = document.getElementById('modalNoBobos');
  if (!list) return;

  list.innerHTML = '';

  if (!bobos.length) {
    noBobo.style.display = 'block';
    return;
  }
  noBobo.style.display = 'none';

  bobos.forEach(bobo => {
    const btn = document.createElement('button');
    btn.style.cssText = [
      'background:#fff;border:none;border-radius:16px;padding:22px 30px;',
      'cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:12px;',
      'min-width:110px;box-shadow:0 4px 16px rgba(0,0,0,.15);',
      'transition:transform .15s,box-shadow .15s;font-family:Nunito,sans-serif;',
    ].join('');

    const av = document.createElement('div');
    av.style.cssText = [
      'width:64px;height:64px;border-radius:50%;',
      'background:#639922;color:#fff;font-size:1.5rem;font-weight:700;',
      'display:flex;align-items:center;justify-content:center;overflow:hidden;',
    ].join('');
    if (bobo.photo_url) {
      const img = document.createElement('img');
      img.src = bobo.photo_url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      av.appendChild(img);
    } else {
      av.textContent = bobo.nom.slice(0, 2).toUpperCase();
    }

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight:700;font-size:1.05rem;color:#1f2937;';
    nameEl.textContent = bobo.nom;

    btn.appendChild(av);
    btn.appendChild(nameEl);

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-4px)';
      btn.style.boxShadow = '0 10px 28px rgba(0,0,0,.22)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 16px rgba(0,0,0,.15)';
    });

    btn.onclick = async () => {
      setCurrentUser(bobo);
      const modal = document.getElementById('userModal');
      if (modal) modal.remove();
      updateNavbarUser();
      if (typeof window.onUserSelected === 'function') await window.onUserSelected();
    };

    list.appendChild(btn);
  });
}

async function showUserModal() {
  const existing = document.getElementById('userModal');
  if (existing) existing.remove();
  _buildModalShell();
  await _populateModal();
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function updateNavbarUser() {
  const user = getCurrentUser();

  let el = document.getElementById('navbarUser');
  if (!el) {
    el = document.createElement('div');
    el.id = 'navbarUser';
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:0 6px;flex-shrink:0;';
    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.appendChild(el);
  }

  el.innerHTML = '';
  if (!user) return;

  const av = document.createElement('div');
  av.style.cssText = [
    'width:30px;height:30px;border-radius:50%;',
    'background:#639922;color:#fff;font-size:0.75rem;font-weight:700;',
    'display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;',
  ].join('');
  if (user.photo) {
    const img = document.createElement('img');
    img.src = user.photo;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    av.appendChild(img);
  } else {
    av.textContent = user.name.slice(0, 2).toUpperCase();
  }

  const nameSpan = document.createElement('span');
  nameSpan.style.cssText = 'font-weight:700;font-size:0.85rem;color:#4a7018;white-space:nowrap;';
  nameSpan.textContent = user.name;

  const changeBtn = document.createElement('button');
  changeBtn.className = 'btn btn-secondary btn-sm';
  changeBtn.textContent = '⇄ Changer';
  changeBtn.onclick = async () => {
    clearCurrentUser();
    el.innerHTML = '';
    await showUserModal();
  };

  el.appendChild(av);
  el.appendChild(nameSpan);
  el.appendChild(changeBtn);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Réinitialisation automatique si nouvelle semaine ISO
  await checkAndResetWeekIfNeeded();

  // 2. Valider que le user stocké existe encore dans les bobos
  const stored = getCurrentUser();
  if (stored) {
    const bobos = await getBobos();
    if (!bobos.find(b => b.id === stored.id)) clearCurrentUser();
  }

  // 3. Afficher l'identité dans la navbar
  updateNavbarUser();

  // 4. Afficher la modale si des bobos existent mais aucun user n'est connecté
  const bobos = await getBobos();
  if (bobos.length > 0 && !getCurrentUser()) {
    await showUserModal();
  }
});
