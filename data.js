/**
 * data.js — Couche de données Supabase
 * Toutes les fonctions sont async.
 * Pour migrer vers un autre backend, seul ce fichier est à modifier.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://fjohibzfykjhgqzrodxc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_40c-Q6E--3Q3Z6X8n5hQiA_rUjESAbI';

/** Client Supabase initialisé une seule fois (lazy). */
function getDb() {
  if (!window._sbClient) {
    window._sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return window._sbClient;
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
  const { data, error } = await getDb()
    .from('bobos')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('getBobos:', error.message); return []; }
  // Expose name / photo pour la compatibilité avec le reste du code UI
  return data.map(b => ({ ...b, name: b.nom, photo: b.photo_url }));
}

async function addBobo(nom, photo_url = null) {
  const { data, error } = await getDb()
    .from('bobos')
    .insert({ nom, photo_url, credits: 0 })
    .select()
    .single();
  if (error) { console.error('addBobo:', error.message); return null; }
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

// Ajuste les crédits bonus (résultats de requêtes approuvées)
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
  const { data, error } = await getDb()
    .from('taches')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('getTasks:', error.message); return []; }
  return data.map(t => ({
    id:      t.id,
    name:    t.nom,
    credits: t.credits,
    status:  t.statut,
    votes:   t.votes || {},
  }));
}

async function addTask(nom, credits) {
  const bobos = await getBobos();
  const statut = bobos.length === 0 ? 'validated' : 'vote';
  const { data, error } = await getDb()
    .from('taches')
    .insert({ nom, credits: parseInt(credits), statut, votes: {} })
    .select()
    .single();
  if (error) { console.error('addTask:', error.message); return null; }
  return { id: data.id, name: data.nom, credits: data.credits, status: data.statut, votes: data.votes || {} };
}

async function voteTask(taskId, boboId, approve) {
  const { data: row, error: fe } = await getDb()
    .from('taches').select('*').eq('id', taskId).single();
  if (fe || !row || row.statut === 'validated') return null;

  const votes  = { ...(row.votes || {}), [boboId]: approve };
  const bobos  = await getBobos();
  const yesCount = Object.values(votes).filter(Boolean).length;
  const majority = Math.floor(bobos.length / 2) + 1;
  const statut = yesCount >= majority ? 'validated' : 'vote';

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
  const { data, error } = await getDb()
    .from('gages')
    .select('*')
    .eq('semaine', currentWeek())
    .order('created_at', { ascending: true });
  if (error) { console.error('getGages:', error.message); return []; }
  return data.map(g => ({
    id:       g.id,
    text:     g.description,
    likes:    g.votes_pour   || [],
    dislikes: g.votes_contre || [],
  }));
}

async function addGage(description) {
  const { data, error } = await getDb()
    .from('gages')
    .insert({ description, votes_pour: [], votes_contre: [], votants: [], semaine: currentWeek(), statut: 'active' })
    .select()
    .single();
  if (error) { console.error('addGage:', error.message); return null; }
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
  const { data } = await getDb()
    .from('occurrences')
    .select('count')
    .eq('tache_id', taskId)
    .eq('bobo_id', boboId)
    .eq('semaine', currentWeek())
    .maybeSingle();
  return data ? data.count : 0;
}

async function setCompletion(taskId, boboId, count) {
  const { error } = await getDb()
    .from('occurrences')
    .upsert(
      { bobo_id: boboId, tache_id: taskId, semaine: currentWeek(), count },
      { onConflict: 'bobo_id,tache_id,semaine' }
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

/** Retourne toutes les occurrences de la semaine courante (pour pré-chargement). */
async function getAllCompletionsForWeek() {
  const { data, error } = await getDb()
    .from('occurrences')
    .select('*')
    .eq('semaine', currentWeek());
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
      let totalCredits = bobo.credits || 0; // bonus de requêtes
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
  const { data, error } = await getDb()
    .from('requetes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('getRequests:', error.message); return []; }
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
  const { data, error } = await getDb()
    .from('requetes')
    .insert({ auteur, situation, demande, statut: 'pending', votes_pour: [], votes_contre: [], votants: [] })
    .select()
    .single();
  if (error) { console.error('addRequest:', error.message); return null; }
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

/**
 * Parse et applique une demande de crédit au format strict :
 *   "retirer X crédits à Prénom"  →  soustrait X à bobos.credits
 *   "ajouter X crédits à Prénom"  →  ajoute    X à bobos.credits
 */
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
  const { data, error } = await getDb()
    .from('historique')
    .select('*')
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
  const { data: rows } = await getDb()
    .from('historique')
    .select('id')
    .order('semaine', { ascending: false })
    .limit(1);
  if (!rows || !rows.length) return;
  await getDb().from('historique').update({ gage_effectue: status }).eq('id', rows[0].id);
}

async function getCurrentWeekNumber() {
  const { data } = await getDb()
    .from('historique')
    .select('semaine')
    .order('semaine', { ascending: false })
    .limit(1);
  return data && data.length ? data[0].semaine + 1 : 1;
}

async function archiveAndResetWeek(gageStatus = 'pending') {
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
  });
  // Occurrences et gages sont scopés par semaine → la nouvelle semaine repart à zéro automatiquement
}

// ─── Réinitialisation auto (semaine ISO) ──────────────────────────────────────

async function checkAndResetWeekIfNeeded() {
  const currentKey = currentWeek();
  const storedKey  = localStorage.getItem('cc_iso_week');

  if (!storedKey) {
    localStorage.setItem('cc_iso_week', currentKey);
    return;
  }

  if (storedKey !== currentKey) {
    await archiveAndResetWeek('pending');
    localStorage.setItem('cc_iso_week', currentKey);
  }
}
