-- Adicionar tabelas para sistema de planos e pagamentos

-- Tabela de planos
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    libraries_limit INTEGER NOT NULL,
    price_monthly INTEGER NOT NULL, -- em centavos
    price_annual INTEGER NOT NULL, -- em centavos
    stripe_product_id TEXT UNIQUE,
    stripe_monthly_price_id TEXT UNIQUE,
    stripe_annual_price_id TEXT UNIQUE,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, etc
    billing_cycle TEXT NOT NULL, -- monthly, annual
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES subscriptions(id),
    stripe_payment_intent_id TEXT UNIQUE,
    amount INTEGER NOT NULL, -- em centavos
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL, -- succeeded, failed, pending, etc
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna de plano atual ao usuário
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_plan_id TEXT REFERENCES plans(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_users_current_plan ON users(current_plan_id);

-- Inserir planos padrão
INSERT INTO plans (name, description, libraries_limit, price_monthly, price_annual, stripe_product_id, stripe_monthly_price_id, stripe_annual_price_id, features) VALUES 
(
    'Básico',
    '50 bibliotecas - Monitoramento básico com atualizações 6x por dia',
    50,
    2000, -- $20.00
    19920, -- $199.20 (17% desconto)
    'prod_TDeKhkgYLACQDx',
    'price_1SHD1aAAQoQG6nci6KhrIbEQ',
    'price_1SHD1bAAQoQG6nciQQBb9osJ',
    '["Monitoramento básico", "Atualizações 6x por dia", "Suporte por email", "Relatórios básicos"]'::jsonb
),
(
    'Pro',
    '200 bibliotecas - Monitoramento avançado com atualizações em tempo real',
    200,
    4000, -- $40.00
    39840, -- $398.40 (17% desconto)
    'prod_TDeKZs9j30xu7n',
    'price_1SHD1cAAQoQG6nciwFIEBpcz',
    'price_1SHD1cAAQoQG6nciOOB3dzzE',
    '["Monitoramento avançado", "Atualizações em tempo real", "Suporte prioritário", "Relatórios detalhados", "Análise de tendências"]'::jsonb
),
(
    'Enterprise',
    'Bibliotecas ilimitadas - Monitoramento completo com API personalizada',
    -1, -- -1 significa ilimitado
    10000, -- $100.00
    99600, -- $996.00 (17% desconto)
    'prod_TDeKRzpTHGKhAo',
    'price_1SHD1dAAQoQG6nciTI8nWF4O',
    'price_1SHD1eAAQoQG6ncib9MIrCeJ',
    '["Monitoramento completo", "API personalizada", "Suporte dedicado", "Relatórios customizados", "Integração avançada", "Consultoria incluída"]'::jsonb
)
ON CONFLICT (stripe_product_id) DO NOTHING;

-- Função para verificar limite de bibliotecas
CREATE OR REPLACE FUNCTION check_library_limit(user_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_plan_id TEXT;
    plan_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Buscar plano atual do usuário
    SELECT current_plan_id INTO user_plan_id
    FROM users 
    WHERE id = user_id_param;
    
    -- Se não tem plano, usar limite básico (50)
    IF user_plan_id IS NULL THEN
        plan_limit := 50;
    ELSE
        -- Buscar limite do plano
        SELECT libraries_limit INTO plan_limit
        FROM plans 
        WHERE id = user_plan_id;
        
        -- Se não encontrou plano, usar limite básico
        IF plan_limit IS NULL THEN
            plan_limit := 50;
        END IF;
    END IF;
    
    -- Se limite é -1 (ilimitado), sempre permitir
    IF plan_limit = -1 THEN
        RETURN TRUE;
    END IF;
    
    -- Contar bibliotecas atuais do usuário
    SELECT COUNT(*) INTO current_count
    FROM libraries 
    WHERE userId = user_id_param;
    
    -- Verificar se pode adicionar mais
    RETURN current_count < plan_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
