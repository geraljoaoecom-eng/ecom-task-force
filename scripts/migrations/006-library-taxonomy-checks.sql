-- Controlo de validação de taxonomia nas primeiras actualizações (refresh)
ALTER TABLE libraries
  ADD COLUMN IF NOT EXISTS taxonomy_check_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE libraries
  ADD COLUMN IF NOT EXISTS taxonomy_last_checked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_libraries_taxonomy_checks
  ON libraries (taxonomy_check_count)
  WHERE taxonomy_check_count < 3;
