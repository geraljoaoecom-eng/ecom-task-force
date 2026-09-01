-- ROI de keywords entre sessões + prioridade na fila SPY

ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS sessions_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS discoveries_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS ads_found_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS relevant_ads_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS zero_yield_streak INTEGER NOT NULL DEFAULT 0;

ALTER TABLE spy_keywords ADD COLUMN IF NOT EXISTS priority REAL NOT NULL DEFAULT 0;
ALTER TABLE spy_keywords ADD COLUMN IF NOT EXISTS ads_relevant INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spy_keywords ADD COLUMN IF NOT EXISTS discoveries_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_spy_keywords_pending_priority
  ON spy_keywords (session_id, status, priority DESC);
