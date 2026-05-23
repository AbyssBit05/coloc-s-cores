-- ============================================================
-- Coloc's Chores — Schema Supabase
-- À coller et exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- ── Bobos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bobos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  photo_url  TEXT,
  credits    INTEGER NOT NULL DEFAULT 0,   -- ajustements via requêtes
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Tâches ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  credits    INTEGER NOT NULL,
  statut     TEXT NOT NULL DEFAULT 'vote', -- 'vote' | 'validated'
  votes      JSONB NOT NULL DEFAULT '{}',  -- { "boboId": true|false }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Occurrences (Bobo fini) ────────────────────────────────
-- scoped par semaine ISO "YYYY-WXX" → réinitialisation auto
CREATE TABLE IF NOT EXISTS occurrences (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bobo_id   UUID NOT NULL REFERENCES bobos(id) ON DELETE CASCADE,
  tache_id  UUID NOT NULL REFERENCES taches(id) ON DELETE CASCADE,
  semaine   TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bobo_id, tache_id, semaine)
);

-- ── Requêtes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requetes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auteur        TEXT,
  situation     TEXT NOT NULL,
  demande       TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  votes_pour    TEXT[] NOT NULL DEFAULT '{}',
  votes_contre  TEXT[] NOT NULL DEFAULT '{}',
  votants       TEXT[] NOT NULL DEFAULT '{}',
  apply_result  JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Gages ──────────────────────────────────────────────────
-- scoped par semaine ISO → nouveau départ chaque semaine
CREATE TABLE IF NOT EXISTS gages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description   TEXT NOT NULL,
  votes_pour    TEXT[] NOT NULL DEFAULT '{}',
  votes_contre  TEXT[] NOT NULL DEFAULT '{}',
  votants       TEXT[] NOT NULL DEFAULT '{}',
  semaine       TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Historique ─────────────────────────────────────────────
-- Snapshot à la fin de chaque semaine
CREATE TABLE IF NOT EXISTS historique (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine          INTEGER NOT NULL,
  premier_id       UUID REFERENCES bobos(id) ON DELETE SET NULL,
  premier_nom      TEXT,
  premier_credits  INTEGER DEFAULT 0,
  dernier_id       UUID REFERENCES bobos(id) ON DELETE SET NULL,
  dernier_nom      TEXT,
  dernier_credits  INTEGER DEFAULT 0,
  gage             TEXT,
  gage_effectue    TEXT NOT NULL DEFAULT 'pending', -- 'done' | 'pending' | 'skipped'
  archived_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security — accès libre (pas d'auth dans ce projet)
-- ============================================================

ALTER TABLE bobos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE requetes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON bobos       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON taches      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON occurrences FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON requetes    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON gages       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON historique  FOR ALL TO anon USING (true) WITH CHECK (true);
