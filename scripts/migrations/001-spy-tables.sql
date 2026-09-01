-- SPY module tables

CREATE TABLE IF NOT EXISTS spy_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    country TEXT,
    language TEXT,
    keyword_seed TEXT,
    nicho TEXT,
    produto TEXT,
    pause_search BOOLEAN NOT NULL DEFAULT false,
    stats JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    deadline_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spy_keywords (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES spy_sessions(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'seed',
    ads_found INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, keyword)
);

CREATE TABLE IF NOT EXISTS spy_ad_candidates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES spy_sessions(id) ON DELETE CASCADE,
    keyword_id TEXT REFERENCES spy_keywords(id) ON DELETE SET NULL,
    library_url TEXT,
    page_id TEXT,
    ad_text TEXT,
    image_url TEXT,
    video_url TEXT,
    landing_url TEXT,
    relevance_score REAL,
    relevance_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spy_discoveries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES spy_sessions(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    page_id TEXT,
    name TEXT NOT NULL,
    active_ads INTEGER NOT NULL DEFAULT 0,
    card_data JSONB NOT NULL DEFAULT '{}',
    ad_assets JSONB NOT NULL DEFAULT '[]',
    keyword_origin TEXT,
    relevance_score REAL,
    already_imported BOOLEAN NOT NULL DEFAULT false,
    imported_library_id TEXT REFERENCES libraries(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, source_value)
);

CREATE TABLE IF NOT EXISTS spy_learned_terms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT REFERENCES spy_sessions(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    score REAL NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spy_sessions_user ON spy_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spy_sessions_status ON spy_sessions(status);
CREATE INDEX IF NOT EXISTS idx_spy_keywords_session ON spy_keywords(session_id, status);
CREATE INDEX IF NOT EXISTS idx_spy_ad_candidates_session ON spy_ad_candidates(session_id, status);
CREATE INDEX IF NOT EXISTS idx_spy_discoveries_session ON spy_discoveries(session_id, active_ads DESC);
CREATE INDEX IF NOT EXISTS idx_spy_discoveries_expires ON spy_discoveries(expires_at);
CREATE INDEX IF NOT EXISTS idx_spy_learned_terms_session ON spy_learned_terms(session_id);

DROP TRIGGER IF EXISTS update_spy_sessions_updated_at ON spy_sessions;
CREATE TRIGGER update_spy_sessions_updated_at
    BEFORE UPDATE ON spy_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
