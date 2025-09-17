const { PrismaClient } = require('@prisma/client');
const express = require('express');
const path = require('path');

// Configurar o Prisma com o caminho correto do schema
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:./apps/api/prisma/atlas.db"
    }
  }
});

const app = express();

// Função para extrair todos os links das bibliotecas
async function getAllLibraryLinks() {
  try {
    console.log('🔍 Conectando ao banco de dados...');
    
    const libraries = await prisma.library.findMany({
      include: {
        pages: true,
        folder: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📚 Encontradas ${libraries.length} bibliotecas`);

    return libraries.map(library => ({
      id: library.id,
      name: library.name,
      sourceType: library.sourceType,
      sourceValue: library.sourceValue,
      country: library.country,
      language: library.language,
      activeAds: library.activeAds,
      lastCheckedAt: library.lastCheckedAt,
      folder: library.folder?.name || 'Sem pasta',
      pages: library.pages.map(page => page.url),
      tags: library.tags,
      nichos: library.nichos,
      estrategias: library.estrategias,
      produtos: library.produtos,
      status: library.activeAds > 0 ? 'Ativo' : 'Inativo'
    }));
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    return [];
  }
}

// Rota principal - página com todos os links
app.get('/', async (req, res) => {
  try {
    console.log('📄 Gerando página principal...');
    const libraries = await getAllLibraryLinks();
    
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atlas ECOM - Links das Bibliotecas Facebook Ads</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .stats {
            display: flex;
            justify-content: space-around;
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-label {
            color: #6c757d;
            font-size: 0.9rem;
        }
        
        .content {
            padding: 30px;
        }
        
        .library-card {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            margin-bottom: 20px;
            padding: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .library-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .library-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }
        
        .library-name {
            font-size: 1.3rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .library-status {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-ativo {
            background: #d4edda;
            color: #155724;
        }
        
        .status-inativo {
            background: #f8d7da;
            color: #721c24;
        }
        
        .library-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .info-item {
            display: flex;
            flex-direction: column;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #6c757d;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 3px;
        }
        
        .info-value {
            color: #2c3e50;
            font-weight: 500;
        }
        
        .links-section {
            margin-top: 15px;
        }
        
        .links-title {
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .link-item {
            display: block;
            padding: 10px 15px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            margin-bottom: 8px;
            text-decoration: none;
            color: #007bff;
            transition: all 0.2s ease;
            word-break: break-all;
        }
        
        .link-item:hover {
            background: #e9ecef;
            color: #0056b3;
        }
        
        .no-links {
            color: #6c757d;
            font-style: italic;
            padding: 10px;
            text-align: center;
        }
        
        .tags {
            margin-top: 10px;
        }
        
        .tag {
            display: inline-block;
            background: #e9ecef;
            color: #495057;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            margin-right: 5px;
            margin-bottom: 5px;
        }
        
        .search-box {
            margin-bottom: 30px;
            position: relative;
        }
        
        .search-input {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid #e9ecef;
            border-radius: 25px;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
        }
        
        .search-input:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .filter-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .filter-btn {
            padding: 8px 16px;
            border: 2px solid #e9ecef;
            background: white;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
        }
        
        .filter-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        
        .filter-btn:hover {
            border-color: #667eea;
        }
        
        .loading {
            text-align: center;
            padding: 50px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Atlas ECOM</h1>
            <p>Links das Bibliotecas Facebook Ads Library</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${libraries.length}</div>
                <div class="stat-label">Total de Bibliotecas</div>
            </div>
            <div class="stat">
                <div class="stat-number">${libraries.filter(lib => lib.status === 'Ativo').length}</div>
                <div class="stat-label">Bibliotecas Ativas</div>
            </div>
            <div class="stat">
                <div class="stat-number">${libraries.reduce((acc, lib) => acc + lib.pages.length, 0)}</div>
                <div class="stat-label">Total de Links</div>
            </div>
        </div>
        
        <div class="content">
            <div class="search-box">
                <input type="text" class="search-input" id="searchInput" placeholder="🔍 Pesquisar bibliotecas...">
            </div>
            
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all">Todas</button>
                <button class="filter-btn" data-filter="ativo">Ativas</button>
                <button class="filter-btn" data-filter="inativo">Inativas</button>
            </div>
            
            <div id="librariesContainer">
                ${libraries.map(library => `
                    <div class="library-card" data-status="${library.status.toLowerCase()}" data-name="${library.name.toLowerCase()}">
                        <div class="library-header">
                            <div>
                                <div class="library-name">${library.name}</div>
                                <div class="library-info">
                                    <div class="info-item">
                                        <span class="info-label">Tipo</span>
                                        <span class="info-value">${library.sourceType}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">País</span>
                                        <span class="info-value">${library.country || 'N/A'}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">Idioma</span>
                                        <span class="info-value">${library.language || 'N/A'}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">Anúncios Ativos</span>
                                        <span class="info-value">${library.activeAds}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">Pasta</span>
                                        <span class="info-value">${library.folder}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="library-status status-${library.status.toLowerCase()}">
                                ${library.status}
                            </div>
                        </div>
                        
                        ${library.pages.length > 0 ? `
                            <div class="links-section">
                                <div class="links-title">🔗 Links (${library.pages.length})</div>
                                ${library.pages.map(page => `
                                    <a href="${page}" target="_blank" class="link-item">${page}</a>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="links-section">
                                <div class="no-links">Nenhum link disponível</div>
                            </div>
                        `}
                        
                        ${library.tags ? `
                            <div class="tags">
                                ${library.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    
    <script>
        // Funcionalidade de busca
        const searchInput = document.getElementById('searchInput');
        const librariesContainer = document.getElementById('librariesContainer');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        let currentFilter = 'all';
        
        searchInput.addEventListener('input', filterLibraries);
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                filterLibraries();
            });
        });
        
        function filterLibraries() {
            const searchTerm = searchInput.value.toLowerCase();
            const cards = librariesContainer.querySelectorAll('.library-card');
            
            cards.forEach(card => {
                const name = card.dataset.name;
                const status = card.dataset.status;
                
                const matchesSearch = name.includes(searchTerm);
                const matchesFilter = currentFilter === 'all' || status === currentFilter;
                
                if (matchesSearch && matchesFilter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('❌ Erro ao gerar página:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1>❌ Erro</h1>
          <p>Erro ao carregar as bibliotecas: ${error.message}</p>
          <p>Verifique se o banco de dados está acessível.</p>
        </body>
      </html>
    `);
  }
});

// Rota para API JSON
app.get('/api/libraries', async (req, res) => {
  try {
    const libraries = await getAllLibraryLinks();
    res.json(libraries);
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Atlas ECOM rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log(`📊 API JSON: http://localhost:${PORT}/api/libraries`);
  console.log(`📚 Extraindo links das bibliotecas do Facebook Ads Library...`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});
