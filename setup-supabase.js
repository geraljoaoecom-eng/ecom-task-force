const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:TaskForce2024!@db.gghsdrusnjderipykmhu.supabase.co:5432/postgres'
    }
  }
});

async function createTables() {
  try {
    console.log('🚀 Criando tabelas no Supabase...');
    
    // Criar usuário de teste
    const user = await prisma.user.create({
      data: {
        email: 'directbpsquad@gmail.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
        name: 'Direct BP Squad'
      }
    });
    
    console.log('✅ Usuário criado:', user.email);
    
    // Criar algumas opções de filtro
    const filterOptions = [
      { type: 'status', value: 'active' },
      { type: 'nichos', value: 'EMAGRECIMENTO' },
      { type: 'nichos', value: 'DIABETES' },
      { type: 'nichos', value: 'SEXUAL' },
      { type: 'estrategias', value: 'VSL' },
      { type: 'estrategias', value: 'PÁG. VENDAS' },
      { type: 'produtos', value: 'NUTRA' },
      { type: 'produtos', value: 'INFO' },
      { type: 'idiomas', value: 'pt' },
      { type: 'idiomas', value: 'EN' },
      { type: 'paises', value: 'BR' },
      { type: 'paises', value: 'USA' }
    ];
    
    for (const option of filterOptions) {
      await prisma.filterOption.upsert({
        where: { 
          type_value: {
            type: option.type,
            value: option.value
          }
        },
        update: {},
        create: option
      });
    }
    
    console.log('✅ Opções de filtro criadas');
    
    console.log('🎉 Tabelas criadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTables();
