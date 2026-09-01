const axios = require('axios');

const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

async function addRoleViaRPC() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 EXECUTANDO SQL PARA ADICIONAR COLUNA ROLE');
    console.log('═══════════════════════════════════════════════════════\n');

    // Tentar executar via RPC ou query direta
    console.log('📝 Execute este SQL no Supabase SQL Editor:\n');
    console.log('-- Adicionar coluna role');
    console.log("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';\n");
    console.log('-- Definir admins');
    console.log("UPDATE users SET role = 'admin' WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com');\n");
    console.log('-- Garantir users');
    console.log("UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';\n");
    console.log('-- Verificar');
    console.log("SELECT email, role FROM users ORDER BY role DESC;\n");

    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  INSTRUÇÕES:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. Acesse: https://supabase.com/dashboard');
    console.log('2. Vá para seu projeto → SQL Editor');
    console.log('3. Cole o SQL acima');
    console.log('4. Execute (RUN)');
    console.log('5. Volte aqui e execute: node add-role-column.js');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

addRoleViaRPC();

