-- Memória persistente de páginas Meta (ouro / rejeitadas) por nicho+país

CREATE TABLE IF NOT EXISTS spy_page_intel (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    page_id TEXT NOT NULL,
    nicho TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    page_name TEXT,
    library_url TEXT,
    tier TEXT NOT NULL DEFAULT 'neutral',
    relevance_score REAL NOT NULL DEFAULT 0.5,
    active_ads INTEGER NOT NULL DEFAULT 0,
    hit_count INTEGER NOT NULL DEFAULT 1,
    last_keyword TEXT,
    last_reason TEXT,
    cached_profile JSONB NOT NULL DEFAULT '{}',
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (nicho, country, page_id)
);

CREATE INDEX IF NOT EXISTS idx_spy_page_intel_lookup
    ON spy_page_intel (nicho, country, tier, relevance_score DESC, hit_count DESC);

CREATE INDEX IF NOT EXISTS idx_spy_page_intel_page
    ON spy_page_intel (page_id);

ALTER TABLE spy_page_intel OWNER TO taskforce;
GRANT ALL PRIVILEGES ON TABLE spy_page_intel TO taskforce;
