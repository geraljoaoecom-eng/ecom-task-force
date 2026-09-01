-- Adicionar coluna role na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Atualizar usuários específicos para admin
UPDATE users SET role = 'admin' WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com');

-- Garantir que todos os outros são 'user'
UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';

-- Verificar resultado
SELECT email, role FROM users ORDER BY role DESC, email ASC;

