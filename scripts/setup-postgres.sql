-- ECOM TaskForce - PostgreSQL schema (self-hosted)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role VARCHAR(20) DEFAULT 'user',
    current_plan_id TEXT,
    stripe_customer_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, user_id)
);

CREATE TABLE IF NOT EXISTS libraries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_value TEXT NOT NULL,
    country TEXT,
    language TEXT,
    notes TEXT,
    tags TEXT,
    active_ads INTEGER DEFAULT 0,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES folders(id),
    estrategias TEXT,
    idiomas TEXT,
    nichos TEXT,
    paises TEXT,
    produtos TEXT,
    status TEXT,
    tipos TEXT,
    nota TEXT,
    taxonomy_check_count INTEGER NOT NULL DEFAULT 0,
    taxonomy_last_checked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    url TEXT NOT NULL,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS filter_options (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(type, value)
);

CREATE TABLE IF NOT EXISTS ad_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    ads_count INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deletion_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_name TEXT NOT NULL,
    source_type TEXT,
    source_value TEXT,
    country TEXT,
    language TEXT,
    notes TEXT,
    tags TEXT,
    estrategias TEXT,
    idiomas TEXT,
    nichos TEXT,
    paises TEXT,
    produtos TEXT,
    status TEXT,
    tipos TEXT,
    nota TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    libraries_limit INTEGER NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_annual INTEGER NOT NULL,
    stripe_product_id TEXT UNIQUE,
    stripe_monthly_price_id TEXT UNIQUE,
    stripe_annual_price_id TEXT UNIQUE,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    billing_cycle TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES subscriptions(id),
    stripe_payment_intent_id TEXT UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_libraries_active_ads ON libraries(active_ads, updated_at);
CREATE INDEX IF NOT EXISTS idx_ad_history_library_date ON ad_history(library_id, date);
CREATE INDEX IF NOT EXISTS idx_deletion_history_deleted_at ON deletion_history(deleted_at);
CREATE INDEX IF NOT EXISTS idx_filter_options_type ON filter_options(type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_libraries_updated_at ON libraries;
CREATE TRIGGER update_libraries_updated_at BEFORE UPDATE ON libraries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO filter_options (type, value) VALUES
('status', 'active'),
('nichos', 'EMAGRECIMENTO'),
('nichos', 'DIABETES'),
('nichos', 'SEXUAL'),
('nichos', 'RELIGIOSO'),
('nichos', 'EDUCACIONAL'),
('estrategias', 'VSL'),
('estrategias', 'PÁG. VENDAS'),
('estrategias', 'QUIZ'),
('produtos', 'NUTRA'),
('produtos', 'INFO'),
('produtos', 'SORTEIOS'),
('idiomas', 'pt'),
('idiomas', 'EN'),
('idiomas', 'es'),
('paises', 'BR'),
('paises', 'USA'),
('paises', 'LATAM')
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO plans (name, description, libraries_limit, price_monthly, price_annual, stripe_product_id, stripe_monthly_price_id, stripe_annual_price_id, features) VALUES
('Básico', '50 bibliotecas - Monitoramento básico com atualizações 6x por dia', 50, 2000, 19920, 'prod_TDeKhkgYLACQDx', 'price_1SHD1aAAQoQG6nci6KhrIbEQ', 'price_1SHD1bAAQoQG6nciQQBb9osJ', '["Monitoramento básico", "Atualizações 6x por dia", "Suporte por email", "Relatórios básicos"]'::jsonb),
('Pro', '200 bibliotecas - Monitoramento avançado', 200, 4000, 39840, 'prod_TDeKZs9j30xu7n', 'price_1SHD1cAAQoQG6nciwFIEBpcz', 'price_1SHD1cAAQoQG6nciOOB3dzzE', '["Monitoramento avançado", "Atualizações em tempo real", "Suporte prioritário"]'::jsonb),
('Enterprise', 'Bibliotecas ilimitadas', -1, 10000, 99600, 'prod_TDeKRzpTHGKhAo', 'price_1SHD1dAAQoQG6nciTI8nWF4O', 'price_1SHD1eAAQoQG6ncib9MIrCeJ', '["Monitoramento completo", "API personalizada", "Suporte dedicado"]'::jsonb)
ON CONFLICT (stripe_product_id) DO NOTHING;

UPDATE users SET role = 'admin' WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com');

-- SPY Meta scraper (3 fases) — migration aditiva
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS ad_started_at TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS ad_status TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS scrape_phase TEXT;
ALTER TABLE spy_ad_candidates ADD COLUMN IF NOT EXISTS meta_details JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_spy_ad_candidates_meta_ad ON spy_ad_candidates(session_id, meta_ad_id);

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
