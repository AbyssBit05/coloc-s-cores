/**
 * data.js — Couche de données Supabase
 * Toutes les fonctions sont async.
 * Pour migrer vers un autre backend, seul ce fichier est à modifier.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://fjohibzfykjhgqzrodxc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_40c-Q6E--3Q3Z6X8n5hQiA_rUjESAbI';

function getDb() {
  if (!window._sbClient) {
    window._sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return window._sbClient;
}

// ─── Coloc courante (lecture depuis localStorage) ─────────────────────────────

function getCurrentColocId() {
  try {
    const raw = localStorage.getItem('currentColoc');
    if (!raw) {
      console.warn('[DEBUG] getCurrentColocId: "currentColoc" absent du localStorage');
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.id) {
      console.warn('[DEBUG] getCurrentColocId: objet présent mais id invalide :', parsed);
      return null;
    }
    return parsed.id;
  } catch (e) {
    console.error('[DEBUG] getCurrentColocId: erreur JSON.parse :', e);
    return null;
  }
}

// Helper écritures : affiche la modale si coloc_id est manquant
async function _requireColoc(context) {
  const raw      = localStorage.getItem('currentColoc');
  const coloc_id = getCurrentColocId();
  if (!coloc_id) {
    console.warn(`[DEBUG] ${context} → coloc_id NULL — localStorage :`, raw);
    if (typeof showColocModal === 'function') await showColocModal();
    return null;
  }
  console.log(`[DEBUG] ${context} → coloc_id :`, coloc_id);
  return coloc_id;
}

// ─── Colocs ───────────────────────────────────────────────────────────────────

async function getColocByCode(code) {
  const { data, error } = await getDb()
    .from('colocs')
    .select('*')
    .eq('code', code.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function createColoc(nom, code) {
  const { data, error } = await getDb()
    .from('colocs')
    .insert({ nom: nom.trim(), code: code.trim() })
    .select()
    .single();
  if (error) { console.error('createColoc:', error.message); return null; }
  return data;
}

// ─── Semaine ISO (sync) ───────────────────────────────────────────────────────

function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function currentWeek() {
  return getISOWeekKey(new Date());
}

// ─── Bobos ────────────────────────────────────────────────────────────────────

async function getBobos() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return [];
  console.log('[DEBUG] getBobos SELECT → coloc_id :', coloc_id);
  const { data, error } = await getDb()
    .from('bobos')
    .select('*')
    .eq('coloc_id', coloc_id)
    .order('created_at', { ascending: true });
  if (error) { console.error('getBobos:', error.message); return []; }
  console.log('[DEBUG] getBobos résultat :', data.length, 'bobo(s)');
  return data.map(b => ({ ...b, name: b.nom, photo: b.photo_url }));
}

async function addBobo(nom, photo_url = null) {
  const coloc_id = await _requireColoc('addBobo');
  if (!coloc_id) return null;
  console.log('[DEBUG] addBobo INSERT → { nom:', nom, ', coloc_id:', coloc_id, '}');
  const { data, error } = await getDb()
    .from('bobos')
    .insert({ nom, photo_url, credits: 0, coloc_id })
    .select()
    .single();
  if (error) { console.error('addBobo:', error.message); throw new Error(error.message); }
  console.log('[DEBUG] addBobo OK → id :', data.id);
  return { ...data, name: data.nom, photo: data.photo_url };
}

async function getBoboById(id) {
  const { data, error } = await getDb()
    .from('bobos')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return { ...data, name: data.nom, photo: data.photo_url };
}

async function _adjustBoboCredits(boboId, delta) {
  const { data: bobo, error: fe } = await getDb()
    .from('bobos').select('credits').eq('id', boboId).single();
  if (fe) return;
  await getDb()
    .from('bobos')
    .update({ credits: (bobo.credits || 0) + delta })
    .eq('id', boboId);
}

// ─── Tâches ───────────────────────────────────────────────────────────────────

async function getTasks() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return [];
  console.log('[DEBUG] getTasks SELECT → coloc_id :', coloc_id);
  const { data, error } = await getDb()
    .from('taches')
    .select('*')
    .eq('coloc_id', coloc_id)
    .order('created_at', { ascending: true });
  if (error) { console.error('getTasks:', error.message); return []; }
  console.log('[DEBUG] getTasks résultat :', data.length, 'tâche(s)');
  return data.map(t => ({
    id:      t.id,
    name:    t.nom,
    credits: t.credits,
    status:  t.statut,
    votes:   t.votes || {},
  }));
}

async function addTask(nom, credits) {
  const coloc_id = await _requireColoc('addTask');
  if (!coloc_id) return null;
  const bobos  = await getBobos();
  const statut = bobos.length === 0 ? 'validated' : 'vote';
  console.log('[DEBUG] addTask INSERT → { nom:', nom, ', credits:', credits, ', coloc_id:', coloc_id, '}');
  const { data, error } = await getDb()
    .from('taches')
    .insert({ nom, credits: parseInt(credits), statut, votes: {}, coloc_id })
    .select()
    .single();
  if (error) { console.error('addTask:', error.message); return null; }
  console.log('[DEBUG] addTask OK → id :', data.id);
  return { id: data.id, name: data.nom, credits: data.credits, status: data.statut, votes: data.votes || {} };
}

async function voteTask(taskId, boboId, approve) {
  const { data: row, error: fe } = await getDb()
    .from('taches').select('*').eq('id', taskId).single();
  if (fe || !row || row.statut === 'validated') return null;

  const votes    = { ...(row.votes || {}), [boboId]: approve };
  const bobos    = await getBobos();
  const yesCount = Object.values(votes).filter(Boolean).length;
  const majority = Math.floor(bobos.length / 2) + 1;
  const statut   = yesCount >= majority ? 'validated' : 'vote';

  const { data, error } = await getDb()
    .from('taches')
    .update({ votes, statut })
    .eq('id', taskId)
    .select()
    .single();
  if (error) { console.error('voteTask:', error.message); return null; }
  return { id: data.id, name: data.nom, credits: data.credits, status: data.statut, votes: data.votes || {} };
}

// ─── Gages ────────────────────────────────────────────────────────────────────

async function getGages() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return [];
  console.log('[DEBUG] getGages SELECT → coloc_id :', coloc_id);
  const { data, error } = await getDb()
    .from('gages')
    .select('*')
    .eq('coloc_id', coloc_id)
    .eq('semaine', currentWeek())
    .order('created_at', { ascending: true });
  if (error) { console.error('getGages:', error.message); return []; }
  console.log('[DEBUG] getGages résultat :', data.length, 'gage(s)');
  return data.map(g => ({
    id:       g.id,
    text:     g.description,
    likes:    g.votes_pour   || [],
    dislikes: g.votes_contre || [],
  }));
}

async function addGage(description) {
  const coloc_id = await _requireColoc('addGage');
  if (!coloc_id) return null;
  console.log('[DEBUG] addGage INSERT → { description:', description, ', coloc_id:', coloc_id, '}');
  const { data, error } = await getDb()
    .from('gages')
    .insert({ description, votes_pour: [], votes_contre: [], votants: [], semaine: currentWeek(), statut: 'active', coloc_id })
    .select()
    .single();
  if (error) { console.error('addGage:', error.message); return null; }
  console.log('[DEBUG] addGage OK → id :', data.id);
  return { id: data.id, text: data.description, likes: [], dislikes: [] };
}

async function voteGage(gageId, boboId, isLike) {
  const { data: row, error: fe } = await getDb()
    .from('gages').select('*').eq('id', gageId).single();
  if (fe || !row) return null;

  let votes_pour   = (row.votes_pour   || []).filter(id => id !== boboId);
  let votes_contre = (row.votes_contre || []).filter(id => id !== boboId);
  if (isLike) votes_pour.push(boboId);
  else        votes_contre.push(boboId);
  const votants = [...new Set([...votes_pour, ...votes_contre])];

  const { data, error } = await getDb()
    .from('gages')
    .update({ votes_pour, votes_contre, votants })
    .eq('id', gageId)
    .select()
    .single();
  if (error) { console.error('voteGage:', error.message); return null; }
  return { id: data.id, text: data.description, likes: data.votes_pour || [], dislikes: data.votes_contre || [] };
}

async function getWinningGage() {
  const gages = await getGages();
  if (!gages.length) return null;
  const maxLikes = Math.max(...gages.map(g => g.likes.length));
  if (maxLikes === 0) return null;
  const winners = gages.filter(g => g.likes.length === maxLikes);
  return winners.length === 1 ? winners[0] : winners;
}

// ─── Occurrences (Bobo fini) ──────────────────────────────────────────────────

async function getCompletion(taskId, boboId) {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return 0;
  const { data } = await getDb()
    .from('occurrences')
    .select('count')
    .eq('tache_id', taskId)
    .eq('bobo_id', boboId)
    .eq('semaine', currentWeek())
    .eq('coloc_id', coloc_id)
    .maybeSingle();
  return data ? data.count : 0;
}

async function setCompletion(taskId, boboId, count) {
  const coloc_id = await _requireColoc('setCompletion');
  if (!coloc_id) return;
  console.log('[DEBUG] setCompletion UPSERT → { taskId:', taskId, ', boboId:', boboId, ', count:', count, ', coloc_id:', coloc_id, '}');
  const { error } = await getDb()
    .from('occurrences')
    .upsert(
      { bobo_id: boboId, tache_id: taskId, semaine: currentWeek(), count, coloc_id },
      { onConflict: 'bobo_id,tache_id,semaine,coloc_id' }
    );
  if (error) console.error('setCompletion:', error.message);
}

async function incrementCompletion(taskId, boboId) {
  const current = await getCompletion(taskId, boboId);
  await setCompletion(taskId, boboId, current + 1);
}

async function decrementCompletion(taskId, boboId) {
  const current = await getCompletion(taskId, boboId);
  if (current > 0) await setCompletion(taskId, boboId, current - 1);
}

async function getAllCompletionsForWeek() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return [];
  console.log('[DEBUG] getAllCompletionsForWeek SELECT → coloc_id :', coloc_id);
  const { data, error } = await getDb()
    .from('occurrences')
    .select('*')
    .eq('semaine', currentWeek())
    .eq('coloc_id', coloc_id);
  if (error) { console.error('getAllCompletionsForWeek:', error.message); return []; }
  return data || [];
}

// ─── Classement ───────────────────────────────────────────────────────────────

async function getRankings() {
  const [bobos, tasks, occs] = await Promise.all([
    getBobos(),
    getTasks(),
    getAllCompletionsForWeek(),
  ]);
  const validTasks = tasks.filter(t => t.status === 'validated');

  return bobos
    .map(bobo => {
      let totalCredits = bobo.credits || 0;
      validTasks.forEach(task => {
        const occ = occs.find(o => o.bobo_id === bobo.id && o.tache_id === task.id);
        totalCredits += (occ ? occ.count : 0) * task.credits;
      });
      return { bobo, totalCredits };
    })
    .sort((a, b) => b.totalCredits - a.totalCredits);
}

// ─── Requêtes ─────────────────────────────────────────────────────────────────

async function getRequests() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return [];
  console.log('[DEBUG] getRequests SELECT → coloc_id :', coloc_id);
  const { data, error } = await getDb()
    .from('requetes')
    .select('*')
    .eq('coloc_id', coloc_id)
    .order('created_at', { ascending: true });
  if (error) { console.error('getRequests:', error.message); return []; }
  console.log('[DEBUG] getRequests résultat :', data.length, 'requête(s)');
  return data.map(r => ({
    id:          r.id,
    auteur:      r.auteur,
    situation:   r.situation,
    demand:      r.demande,
    status:      r.statut,
    likes:       r.votes_pour   || [],
    dislikes:    r.votes_contre || [],
    applyResult: r.apply_result || null,
  }));
}

async function addRequest(situation, demande, auteur = null) {
  const coloc_id = await _requireColoc('addRequest');
  if (!coloc_id) return null;
  console.log('[DEBUG] addRequest INSERT → { situation:', situation, ', coloc_id:', coloc_id, '}');
  const { data, error } = await getDb()
    .from('requetes')
    .insert({ auteur, situation, demande, statut: 'pending', votes_pour: [], votes_contre: [], votants: [], coloc_id })
    .select()
    .single();
  if (error) { console.error('addRequest:', error.message); return null; }
  console.log('[DEBUG] addRequest OK → id :', data.id);
  return { id: data.id, situation: data.situation, demand: data.demande, status: data.statut, likes: [], dislikes: [] };
}

async function voteRequest(requestId, boboId, isLike) {
  const { data: row, error: fe } = await getDb()
    .from('requetes').select('*').eq('id', requestId).single();
  if (fe || !row || row.statut !== 'pending') return null;

  let votes_pour   = (row.votes_pour   || []).filter(id => id !== boboId);
  let votes_contre = (row.votes_contre || []).filter(id => id !== boboId);
  if (isLike) votes_pour.push(boboId);
  else        votes_contre.push(boboId);
  const votants = [...new Set([...votes_pour, ...votes_contre])];

  const bobos    = await getBobos();
  const majority = Math.floor(bobos.length / 2) + 1;

  let statut       = 'pending';
  let apply_result = row.apply_result || null;

  if (votes_pour.length >= majority) {
    statut = 'approved';
    apply_result = await appliquerRequete({ demand: row.demande });
  } else if (votes_contre.length >= majority) {
    statut = 'rejected';
  }

  const { data, error } = await getDb()
    .from('requetes')
    .update({ votes_pour, votes_contre, votants, statut, apply_result })
    .eq('id', requestId)
    .select()
    .single();
  if (error) { console.error('voteRequest:', error.message); return null; }

  return {
    id:          data.id,
    situation:   data.situation,
    demand:      data.demande,
    status:      data.statut,
    likes:       data.votes_pour   || [],
    dislikes:    data.votes_contre || [],
    applyResult: data.apply_result || null,
  };
}

async function appliquerRequete(requete) {
  const raw   = (requete.demand || '').trim();
  const match = raw.match(/^(retirer|ajouter)\s+(\d+)\s+cr[eé]dits?\s+[aà]\s+(.+)$/i);

  if (!match) {
    return { ok: false, reason: `Format non reconnu : "${raw}". Attendu : "retirer X crédits à Prénom".` };
  }

  const action     = match[1].toLowerCase();
  const amount     = parseInt(match[2], 10);
  const targetName = match[3].trim();

  const bobos  = await getBobos();
  const target = bobos.find(b => b.nom.toLowerCase() === targetName.toLowerCase());
  if (!target) return { ok: false, reason: `Bobo "${targetName}" introuvable.` };

  const delta = action === 'retirer' ? -amount : amount;
  await _adjustBoboCredits(target.id, delta);

  return { ok: true, action, amount, boboName: target.nom };
}

// ─── Historique ───────────────────────────────────────────────────────────────

async function getHistory() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return [];
  console.log('[DEBUG] getHistory SELECT → coloc_id :', coloc_id);
  const { data, error } = await getDb()
    .from('historique')
    .select('*')
    .eq('coloc_id', coloc_id)
    .order('semaine', { ascending: true });
  if (error) { console.error('getHistory:', error.message); return []; }
  return data.map(h => ({
    week:       h.semaine,
    first:      h.premier_nom ? { name: h.premier_nom, credits: h.premier_credits } : null,
    last:       h.dernier_nom ? { name: h.dernier_nom, credits: h.dernier_credits } : null,
    gage:       h.gage || '—',
    gageStatus: h.gage_effectue,
    archivedAt: h.archived_at,
  }));
}

async function updateLastGageStatus(status) {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return;
  const { data: rows } = await getDb()
    .from('historique')
    .select('id')
    .eq('coloc_id', coloc_id)
    .order('semaine', { ascending: false })
    .limit(1);
  if (!rows || !rows.length) return;
  await getDb().from('historique').update({ gage_effectue: status }).eq('id', rows[0].id);
}

async function getCurrentWeekNumber() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return 1;
  const { data } = await getDb()
    .from('historique')
    .select('semaine')
    .eq('coloc_id', coloc_id)
    .order('semaine', { ascending: false })
    .limit(1);
  return data && data.length ? data[0].semaine + 1 : 1;
}

async function archiveAndResetWeek(gageStatus = 'pending') {
  const coloc_id = await _requireColoc('archiveAndResetWeek');
  if (!coloc_id) return;
  const [rankings, winGage, weekNum] = await Promise.all([
    getRankings(),
    getWinningGage(),
    getCurrentWeekNumber(),
  ]);

  const first = rankings[0] || null;
  const last  = rankings[rankings.length - 1] || null;

  const gageText = Array.isArray(winGage)
    ? winGage.map(g => g.text).join(' / ')
    : (winGage ? winGage.text : '—');

  console.log('[DEBUG] archiveAndResetWeek INSERT → coloc_id :', coloc_id);
  await getDb().from('historique').insert({
    semaine:         weekNum,
    premier_id:      first ? first.bobo.id : null,
    premier_nom:     first ? first.bobo.nom : null,
    premier_credits: first ? first.totalCredits : 0,
    dernier_id:      last  ? last.bobo.id  : null,
    dernier_nom:     last  ? last.bobo.nom  : null,
    dernier_credits: last  ? last.totalCredits  : 0,
    gage:            gageText,
    gage_effectue:   gageStatus,
    coloc_id,
  });
}

// ─── Réinitialisation auto (semaine ISO) ──────────────────────────────────────

async function checkAndResetWeekIfNeeded() {
  const coloc_id = getCurrentColocId();
  if (!coloc_id) return;

  const currentKey = currentWeek();
  const storedKey  = localStorage.getItem('cc_iso_week_' + coloc_id);

  if (!storedKey) {
    localStorage.setItem('cc_iso_week_' + coloc_id, currentKey);
    return;
  }

  if (storedKey !== currentKey) {
    await archiveAndResetWeek('pending');
    localStorage.setItem('cc_iso_week_' + coloc_id, currentKey);
  }
}
