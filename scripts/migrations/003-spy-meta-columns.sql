-- SPY Meta scraper (3 fases) — colunas aditivas

ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS ad_started_at TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS ad_status TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS scrape_phase TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS meta_details JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_spy_ad_candidates_meta_ad ON spy_ad_candidates(session_id, meta_ad_id);

-- Staging de alto volume (metadados + detalhes por fase)
CREATE TABLE IF NOT EXISTS spy_meta_staging (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES spy_sessions(id) ON DELETE CASCADE,
    keyword_id TEXT REFERENCES spy_keywords(id) ON DELETE SET NULL,
    search_url TEXT,
    meta_ad_id TEXT NOT NULL,
    page_id TEXT,
    page_name TEXT,
    headline TEXT,
    thumbnail_url TEXT,
    ad_started_at TEXT,
    ad_status TEXT,
    relevance TEXT DEFAULT 'pending',
    scrape_phase TEXT DEFAULT 'metadata',
    raw_metadata JSONB DEFAULT '{}',
    full_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, meta_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_spy_meta_staging_session ON spy_meta_staging(session_id, scrape_phase);
CREATE INDEX IF NOT EXISTS idx_spy_meta_staging_relevance ON spy_meta_staging(session_id, relevance);
