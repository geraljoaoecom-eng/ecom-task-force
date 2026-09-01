-- Base persistente de keywords/intel por nicho (sobrevive entre sessões SPY)

CREATE TABLE IF NOT EXISTS spy_niche_intel (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nicho TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT '',
    keyword TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'ad_text',
    score REAL NOT NULL DEFAULT 1,
    hit_count INTEGER NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (nicho, country, keyword)
);

CREATE INDEX IF NOT EXISTS idx_spy_niche_intel_lookup
    ON spy_niche_intel (nicho, country, score DESC, hit_count DESC);
