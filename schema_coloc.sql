-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : ajout du système multi-colocs
-- À exécuter dans l'éditeur SQL de Supabase (une fois)
-- La table `colocs` (id, nom, code, created_at) doit déjà exister.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ajout de la colonne coloc_id sur chaque table

ALTER TABLE bobos
  ADD COLUMN IF NOT EXISTS coloc_id UUID REFERENCES colocs(id) ON DELETE CASCADE;

ALTER TABLE taches
  ADD COLUMN IF NOT EXISTS coloc_id UUID REFERENCES colocs(id) ON DELETE CASCADE;

ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS coloc_id UUID REFERENCES colocs(id) ON DELETE CASCADE;

ALTER TABLE requetes
  ADD COLUMN IF NOT EXISTS coloc_id UUID REFERENCES colocs(id) ON DELETE CASCADE;

ALTER TABLE gages
  ADD COLUMN IF NOT EXISTS coloc_id UUID REFERENCES colocs(id) ON DELETE CASCADE;

ALTER TABLE historique
  ADD COLUMN IF NOT EXISTS coloc_id UUID REFERENCES colocs(id) ON DELETE CASCADE;


-- 2. Mise à jour de la contrainte d'unicité sur occurrences
--    (l'ancienne portait sur bobo_id + tache_id + semaine uniquement)
--    Remplace le nom ci-dessous par le vrai nom de ta contrainte si différent.

ALTER TABLE occurrences
  DROP CONSTRAINT IF EXISTS occurrences_bobo_id_tache_id_semaine_key;

ALTER TABLE occurrences
  ADD CONSTRAINT occurrences_unique_per_coloc
  UNIQUE (bobo_id, tache_id, semaine, coloc_id);


-- 3. Index pour accélérer les lectures filtrées par coloc_id

CREATE INDEX IF NOT EXISTS idx_bobos_coloc       ON bobos(coloc_id);
CREATE INDEX IF NOT EXISTS idx_taches_coloc      ON taches(coloc_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_coloc ON occurrences(coloc_id);
CREATE INDEX IF NOT EXISTS idx_requetes_coloc    ON requetes(coloc_id);
CREATE INDEX IF NOT EXISTS idx_gages_coloc       ON gages(coloc_id);
CREATE INDEX IF NOT EXISTS idx_historique_coloc  ON historique(coloc_id);


-- 4. (Optionnel) Rendre coloc_id NOT NULL après avoir migré les données existantes
--    À n'exécuter QUE si tu veux forcer l'intégrité et que toutes les lignes
--    existantes ont déjà un coloc_id renseigné.
--
-- ALTER TABLE bobos       ALTER COLUMN coloc_id SET NOT NULL;
-- ALTER TABLE taches      ALTER COLUMN coloc_id SET NOT NULL;
-- ALTER TABLE occurrences ALTER COLUMN coloc_id SET NOT NULL;
-- ALTER TABLE requetes    ALTER COLUMN coloc_id SET NOT NULL;
-- ALTER TABLE gages       ALTER COLUMN coloc_id SET NOT NULL;
-- ALTER TABLE historique  ALTER COLUMN coloc_id SET NOT NULL;
