-- Copy Vault — ads por biblioteca + banco de copies (admin)

CREATE TABLE IF NOT EXISTS library_copy_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    ads_scanned INTEGER NOT NULL DEFAULT 0,
    ads_eligible INTEGER NOT NULL DEFAULT 0,
    copies_created INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (library_id)
);

CREATE TABLE IF NOT EXISTS library_ads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    meta_ad_id TEXT NOT NULL,
    page_id TEXT,
    page_name TEXT,
    headline TEXT,
    body_text TEXT,
    media_type TEXT NOT NULL DEFAULT 'unknown',
    video_url TEXT,
    image_url TEXT,
    image_local_path TEXT,
    landing_url TEXT,
    library_url TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    days_active INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    creative_hash TEXT,
    eligible_for_copy BOOLEAN NOT NULL DEFAULT false,
    filter_reason TEXT,
    pipeline_status TEXT NOT NULL DEFAULT 'tracked',
    transcript TEXT,
    ai_analysis JSONB DEFAULT '{}',
    raw_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (library_id, meta_ad_id)
);

CREATE TABLE IF NOT EXISTS copy_vault (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    library_ad_id TEXT NOT NULL REFERENCES library_ads(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT '',
    nicho TEXT NOT NULL DEFAULT '',
    produto TEXT NOT NULL DEFAULT '',
    headline TEXT,
    body_text TEXT,
    transcript TEXT,
    media_type TEXT,
    image_path TEXT,
    video_url TEXT,
    landing_url TEXT,
    library_url TEXT,
    meta_ad_id TEXT,
    page_name TEXT,
    days_active INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    rank_score REAL NOT NULL DEFAULT 0,
    active_ads_snapshot INTEGER NOT NULL DEFAULT 0,
    ai_analysis JSONB DEFAULT '{}',
    pipeline_status TEXT NOT NULL DEFAULT 'pending_ai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (library_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_library_ads_library ON library_ads (library_id, eligible_for_copy);
CREATE INDEX IF NOT EXISTS idx_library_ads_rank ON library_ads (library_id, duplicate_count DESC, days_active DESC);
CREATE INDEX IF NOT EXISTS idx_copy_vault_taxonomy ON copy_vault (language, nicho, produto);
CREATE INDEX IF NOT EXISTS idx_copy_vault_rank ON copy_vault (rank_score DESC, days_active DESC, duplicate_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_copy_jobs_status ON library_copy_jobs (status);

ALTER TABLE library_copy_jobs OWNER TO taskforce;
ALTER TABLE library_ads OWNER TO taskforce;
ALTER TABLE copy_vault OWNER TO taskforce;
GRANT ALL PRIVILEGES ON TABLE library_copy_jobs TO taskforce;
GRANT ALL PRIVILEGES ON TABLE library_ads TO taskforce;
GRANT ALL PRIVILEGES ON TABLE copy_vault TO taskforce;
