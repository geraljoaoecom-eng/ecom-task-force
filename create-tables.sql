-- Criar tabelas no Supabase usando SQL direto
-- Execute este SQL no dashboard do Supabase

-- 1. Criar tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de pastas
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, user_id)
);

-- 3. Criar tabela de bibliotecas
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
    nota TEXT
);

-- 4. Criar tabela de páginas
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    url TEXT NOT NULL,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE
);

-- 5. Criar tabela de opções de filtro
CREATE TABLE IF NOT EXISTS filter_options (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(type, value)
);

-- 6. Criar tabela de histórico de anúncios
CREATE TABLE IF NOT EXISTS ad_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    ads_count INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Criar tabela de histórico de exclusões
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

-- 8. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_libraries_active_ads ON libraries(active_ads, updated_at);
CREATE INDEX IF NOT EXISTS idx_ad_history_library_date ON ad_history(library_id, date);
CREATE INDEX IF NOT EXISTS idx_deletion_history_deleted_at ON deletion_history(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deletion_history_library_name ON deletion_history(library_name);
CREATE INDEX IF NOT EXISTS idx_filter_options_type ON filter_options(type);

-- 9. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. Triggers para atualizar updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_libraries_updated_at BEFORE UPDATE ON libraries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Inserir algumas opções de filtro padrão
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