-- ============================================================
-- SETUP COMPLETO DO SISTEMA DE ADMIN
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar coluna role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- 2. Atualizar usuários existentes para 'user' se não tiverem role
UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';

-- 3. Definir admins existentes
UPDATE users 
SET role = 'admin' 
WHERE email IN (
  'directbpsquad@gmail.com',
  'geral.joaoecoom@gmail.com'
);

-- 4. Verificar resultado
SELECT 
  email, 
  name, 
  role,
  created_at
FROM users 
ORDER BY 
  CASE role 
    WHEN 'admin' THEN 1 
    ELSE 2 
  END,
  created_at DESC;

-- ============================================================
-- RESULTADO ESPERADO:
-- Você deve ver os emails com role 'admin' ou 'user'
-- ============================================================

