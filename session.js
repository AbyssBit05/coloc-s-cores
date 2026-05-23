/**
 * session.js — Session utilisateur et coloc globales.
 * Chargé après data.js sur toutes les pages.
 */

// ─── Coloc ────────────────────────────────────────────────────────────────────

function getCurrentColoc() {
  try {
    const raw = localStorage.getItem('currentColoc');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentColoc(coloc) {
  localStorage.setItem('currentColoc', JSON.stringify({
    id:   coloc.id,
    nom:  coloc.nom,
    code: coloc.code,
  }));
}

function clearCurrentColoc() {
  localStorage.removeItem('currentColoc');
  clearCurrentUser();
}

// ─── Modale "Rejoindre ou créer une coloc" ────────────────────────────────────

async function showColocModal() {
  const existing = document.getElementById('colocModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'colocModal';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9500;',
    'background:rgba(74,112,24,0.97);',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'padding:24px;font-family:Nunito,sans-serif;overflow-y:auto;',
  ].join('');

  overlay.innerHTML = `
    <div style="font-family:Fredoka,sans-serif;font-size:2.5rem;color:#fff;margin-bottom:4px;text-align:center;">
      🏠 Coloc's Chores
    </div>
    <div style="font-family:Fredoka,sans-serif;font-size:1.3rem;color:#EAF3DE;margin-bottom:32px;text-align:center;">
      Rejoins ou crée ta colocation
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;max-width:700px;width:100%;">

      <!-- Rejoindre -->
      <div style="background:#fff;border-radius:16px;padding:28px;flex:1;min-width:260px;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.2);">
        <div style="font-family:Fredoka,sans-serif;font-size:1.4rem;color:#4a7018;margin-bottom:16px;">🔑 Rejoindre</div>
        <label style="display:block;font-weight:700;font-size:0.85rem;color:#4b5563;margin-bottom:6px;">Code de la coloc</label>
        <input id="joinCode" type="text" placeholder="Ex : maison42"
          style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;
                 font-family:Nunito,sans-serif;font-size:16px;margin-bottom:16px;box-sizing:border-box;" />
        <button id="joinBtn"
          style="width:100%;padding:12px;background:#639922;color:#fff;border:none;border-radius:8px;
                 font-family:Nunito,sans-serif;font-size:1rem;font-weight:700;cursor:pointer;min-height:44px;">
          Rejoindre →
        </button>
        <div id="joinError" style="color:#ef4444;font-size:0.85rem;margin-top:10px;display:none;"></div>
      </div>

      <!-- Créer -->
      <div style="background:#fff;border-radius:16px;padding:28px;flex:1;min-width:260px;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.2);">
        <div style="font-family:Fredoka,sans-serif;font-size:1.4rem;color:#4a7018;margin-bottom:16px;">✨ Créer</div>
        <label style="display:block;font-weight:700;font-size:0.85rem;color:#4b5563;margin-bottom:6px;">Nom de la coloc</label>
        <input id="createNom" type="text" placeholder="Ex : Les Super Colocs"
          style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;
                 font-family:Nunito,sans-serif;font-size:16px;margin-bottom:12px;box-sizing:border-box;" />
        <label style="display:block;font-weight:700;font-size:0.85rem;color:#4b5563;margin-bottom:6px;">Code (à partager avec tes colocs)</label>
        <input id="createCode" type="text" placeholder="Ex : maison42"
          style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;
                 font-family:Nunito,sans-serif;font-size:16px;margin-bottom:16px;box-sizing:border-box;" />
        <button id="createBtn"
          style="width:100%;padding:12px;background:#639922;color:#fff;border:none;border-radius:8px;
                 font-family:Nunito,sans-serif;font-size:1rem;font-weight:700;cursor:pointer;min-height:44px;">
          Créer la coloc ✨
        </button>
        <div id="createError" style="color:#ef4444;font-size:0.85rem;margin-top:10px;display:none;"></div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.6' : '1';
  }

  document.getElementById('joinBtn').onclick = async () => {
    const code = document.getElementById('joinCode').value.trim();
    const errEl = document.getElementById('joinError');
    errEl.style.display = 'none';
    if (!code) { errEl.textContent = 'Saisis un code.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('joinBtn');
    setLoading(btn, true);
    const coloc = await getColocByCode(code);
    setLoading(btn, false);

    if (!coloc) {
      errEl.textContent = 'Code introuvable. Vérifie avec ta/ton coloc.';
      errEl.style.display = 'block';
      return;
    }
    setCurrentColoc(coloc);
    overlay.remove();
    await _initAfterColoc();
  };

  document.getElementById('createBtn').onclick = async () => {
    const nom  = document.getElementById('createNom').value.trim();
    const code = document.getElementById('createCode').value.trim();
    const errEl = document.getElementById('createError');
    errEl.style.display = 'none';

    if (!nom)  { errEl.textContent = 'Donne un nom à ta coloc.'; errEl.style.display = 'block'; return; }
    if (!code) { errEl.textContent = 'Choisis un code à partager.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('createBtn');
    setLoading(btn, true);

    const existing = await getColocByCode(code);
    if (existing) {
      setLoading(btn, false);
      errEl.textContent = 'Ce code est déjà pris. Choisis-en un autre.';
      errEl.style.display = 'block';
      return;
    }

    const coloc = await createColoc(nom, code);
    setLoading(btn, false);

    if (!coloc) {
      errEl.textContent = 'Erreur lors de la création. Réessaie.';
      errEl.style.display = 'block';
      return;
    }
    setCurrentColoc(coloc);
    overlay.remove();
    await _initAfterColoc();
  };
}

// ─── Utilisateur ──────────────────────────────────────────────────────────────

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

function updateNavbarColoc() {
  const coloc = getCurrentColoc();
  const existing = document.getElementById('navbarColoc');
  if (existing) existing.remove();
  if (!coloc) return;

  const div = document.createElement('div');
  div.id = 'navbarColoc';

  const nameEl = document.createElement('span');
  nameEl.className = 'coloc-name';
  nameEl.textContent = '🏠 ' + coloc.nom;

  const changeBtn = document.createElement('button');
  changeBtn.className = 'btn btn-secondary btn-sm';
  changeBtn.style.cssText = 'min-height:36px;';
  changeBtn.textContent = '⇄ Changer de coloc';
  changeBtn.onclick = () => {
    clearCurrentColoc();
    location.reload();
  };

  div.appendChild(nameEl);
  div.appendChild(changeBtn);

  const navLinks = document.getElementById('navLinks');
  if (navLinks) {
    const closeBtn = document.getElementById('navClose');
    if (closeBtn) closeBtn.after(div);
    else navLinks.prepend(div);
  }
}

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

async function _initAfterColoc() {
  // 1. Réinitialisation automatique si nouvelle semaine ISO
  await checkAndResetWeekIfNeeded();

  // 2. Valider que le user stocké existe encore dans la coloc courante
  const stored = getCurrentUser();
  if (stored) {
    const bobos = await getBobos();
    if (!bobos.find(b => b.id === stored.id)) clearCurrentUser();
  }

  // 3. Afficher coloc dans la navbar
  updateNavbarColoc();

  // 4. Afficher l'identité dans la navbar
  updateNavbarUser();

  // 5. Afficher la modale bobo si besoin
  const bobos = await getBobos();
  if (bobos.length > 0 && !getCurrentUser()) {
    await showUserModal();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const coloc = getCurrentColoc();
  if (!coloc) {
    await showColocModal();
    return;
  }
  await _initAfterColoc();
});
