const { launchBrowser } = require('./browser-manager');
const { pool } = require('./db');
const {
  assertLibrarySourceIsUnique,
  LIBRARY_DUPLICATE_MESSAGE,
  resolveCanonicalSourceValue,
} = require('./library-constants');
const { parseAdCountFromText } = require('./ad-count-parser');

function normalizeAdsLibraryUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) {
      throw new Error('URL deve ser da Facebook Ads Library');
    }
    if (!parsed.pathname.includes('/ads/library')) {
      throw new Error('URL inválida da Ads Library');
    }
    return parsed.toString();
  } catch (error) {
    if (error.message.startsWith('URL')) throw error;
    throw new Error('URL inválida');
  }
}

function extractPageId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('view_all_page_id') || parsed.searchParams.get('page_id') || null;
  } catch {
    return null;
  }
}

function parseAdCount(text) {
  return parseAdCountFromText(text);
}

function extractPageName(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const idx = lines.findIndex((l) => l === 'Ads' || l === 'Anúncios');
  if (idx > 0) {
    const candidate = lines[idx - 1];
    if (candidate && !/^(Meta Ad Library|Ad Library|Log in|Search)/i.test(candidate)) {
      return candidate;
    }
  }
  const sponsoredIdx = lines.findIndex((l) => l === 'Sponsored' || l === 'Patrocinado');
  if (sponsoredIdx > 0) {
    const candidate = lines[sponsoredIdx - 1];
    if (candidate && candidate.length > 2) return candidate;
  }
  return '';
}

function extractAdTexts(text) {
  const chunks = [];
  const sponsoredParts = text.split(/Sponsored|Patrocinado/);
  for (const part of sponsoredParts.slice(1, 6)) {
    const snippet = part.split(/Active status|Library ID|Open Dropdown|See summary|Ver detalhes/i)[0];
    if (snippet && snippet.trim().length > 20) {
      chunks.push(snippet.trim().slice(0, 500));
    }
  }
  return chunks;
}

function extractDomains(text) {
  const regex = /\b([a-z0-9][a-z0-9-]*\.(?:com|com\.br|net|org|io|shop|online|site|co|app)(?:\.[a-z]{2})?)\b/gi;
  const found = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const domain = match[1].toLowerCase();
    if (!domain.includes('facebook') && !domain.includes('instagram') && !domain.includes('meta')) {
      found.add(domain);
    }
  }
  return [...found];
}

function normalizeOption(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function matchFilterOption(options, text, rules) {
  const normalizedText = normalizeOption(text);
  for (const rule of rules) {
    const keywords = rule.keywords.map(normalizeOption);
    if (keywords.some((kw) => normalizedText.includes(kw))) {
      const match = options.find((opt) => normalizeOption(opt) === normalizeOption(rule.value));
      if (match) return match;
      return rule.value;
    }
  }
  return '';
}

async function getFilterOptionsMap() {
  const { rows } = await pool.query('SELECT type, value FROM filter_options ORDER BY type, value');
  const map = {};
  for (const row of rows) {
    if (!map[row.type]) map[row.type] = [];
    map[row.type].push(row.value);
  }
  return map;
}

function extractAdLinkUrls(html) {
  const urls = new Set();
  const regex = /"link_url":"([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1].replace(/\\\//g, '/');
    if (url.startsWith('http') && !url.includes('facebook.com') && !url.includes('instagram.com')) {
      urls.add(url);
    }
  }
  return [...urls];
}

function sampleUrls(urls, limit = 5) {
  if (urls.length <= limit) return urls;
  const shuffled = [...urls].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

function detectStrategyFromLanding({ text, url, title, hasVideo, html }) {
  const strategies = new Set();
  const blob = `${text}\n${url}\n${title}\n${html}`.toLowerCase();

  if (/quiz|pergunta|questionário|questionario|question|step \d|segundos|teste para|diagnóstico|diagnostico|inlead\.digital|typeform|\/sf\/|sfunnel/i.test(blob)) {
    strategies.add('QUIZ');
  }

  if (
    hasVideo &&
    (/clique para ouvir|watch now|assista agora|vsl|video sales|\/watch|0:00 \//i.test(blob) ||
      (text.length < 2000 && !strategies.has('QUIZ')))
  ) {
    strategies.add('VSL');
  }

  const hasSalesSignals = /compre agora|buy now|add to cart|carrinho|finalizar compra|order now|shop now|adicionar ao carrinho/i.test(
    text.toLowerCase()
  );
  if (hasSalesSignals && !strategies.has('QUIZ')) {
    strategies.add('PÁG. VENDAS');
  } else if (hasSalesSignals && strategies.has('QUIZ') && /checkout|pagamento|payment/i.test(text.toLowerCase()) && text.length > 1200) {
    strategies.add('PÁG. VENDAS');
  }

  if (/shopify|myshopify|\/products\/|\/collections\//i.test(blob)) {
    strategies.add('Store');
  }

  if (/advertorial|advetorial|publicado em|escrito por/i.test(blob)) {
    strategies.add('Advetorial');
  }

  return [...strategies];
}

function resolveEstrategiasLabel(strategies, filterOptions) {
  if (!strategies.length) return '';

  const canonical = {
    QUIZ: 'QUIZ',
    VSL: 'VSL',
    'PÁG. VENDAS': 'PÁG. VENDAS',
    Store: 'Store',
    Advetorial: 'Advetorial',
  };

  const normalized = strategies.map((s) => canonical[s] || s);

  if (normalized.length === 1) {
    const match = (filterOptions.estrategias || []).find(
      (opt) => normalizeOption(opt) === normalizeOption(normalized[0])
    );
    return match || normalized[0];
  }

  const combined = normalized.join(' + ');
  const options = filterOptions.estrategias || [];

  const exact = options.find((opt) => normalizeOption(opt) === normalizeOption(combined));
  if (exact) return exact;

  const sorted = [...normalized].sort();
  const fuzzy = options.find((opt) => {
    const parts = normalizeOption(opt).split('+').map((p) => p.trim());
    return (
      parts.length === sorted.length &&
      sorted.every((s) => parts.some((p) => p === normalizeOption(s)))
    );
  });
  if (fuzzy) return fuzzy;

  return combined;
}

async function extractAdLinkUrlsFromPage(page) {
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await new Promise((r) => setTimeout(r, 4000));

  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await new Promise((r) => setTimeout(r, 1500));
  }

  const html = await page.content();
  return extractAdLinkUrls(html);
}

async function analyzeSingleDestination(browser, url) {
  const userAgents = {
    desktop:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  };

  const visits = {};
  for (const [label, ua] of Object.entries(userAgents)) {
    const page = await browser.newPage();
    await page.setUserAgent(ua);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
      const finalUrl = page.url();
      const title = await page.title();
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || '');
      const html = await page.evaluate(() => document.documentElement?.innerHTML?.slice(0, 8000) || '');
      const hasVideo = await page.evaluate(() => !!document.querySelector('video'));
      visits[label] = { finalUrl, title, text, html, hasVideo, domain: new URL(finalUrl).hostname };
    } catch (error) {
      visits[label] = { error: error.message };
    }
    await page.close();
  }

  const desktop = visits.desktop || {};
  const googlebot = visits.googlebot || {};
  const facebook = visits.facebook || {};

  const domains = new Set([desktop.domain, googlebot.domain, facebook.domain].filter(Boolean));
  const titles = [desktop.title, googlebot.title, facebook.title].filter(Boolean);
  const uniqueTitles = new Set(titles.map((t) => normalizeOption(t)));

  let isCloaker = false;
  if (domains.size > 2) isCloaker = true;
  if (uniqueTitles.size > 1 && titles.length >= 2) {
    const desktopLen = desktop.text?.length || 0;
    const botLen = Math.max(googlebot.text?.length || 0, facebook.text?.length || 0);
    if (desktopLen > 200 && botLen > 0 && botLen < desktopLen * 0.3) isCloaker = true;
  }

  const strategies = detectStrategyFromLanding({
    text: desktop.text || '',
    url: desktop.finalUrl || url,
    title: desktop.title || '',
    hasVideo: desktop.hasVideo,
    html: desktop.html || '',
  });

  return {
    sourceUrl: url,
    salesPage: isCloaker ? 'CLOAKER.com' : desktop.finalUrl || url,
    isCloaker,
    strategies,
    landingText: desktop.text || '',
  };
}

async function analyzeAdDestinations(browser, adUrls, filterOptions) {
  if (!adUrls.length) {
    return {
      salesPage: '',
      isCloaker: false,
      estrategias: '',
      landingText: '',
      analyzedUrls: [],
      strategyDetails: [],
    };
  }

  const sampled = sampleUrls(adUrls, 5);
  const results = [];

  for (const adUrl of sampled) {
    try {
      results.push(await analyzeSingleDestination(browser, adUrl));
    } catch (error) {
      console.log(`⚠️ Falha ao analisar destino do anúncio: ${adUrl} — ${error.message}`);
    }
  }

  const allStrategies = new Set();
  for (const result of results) {
    for (const strategy of result.strategies) allStrategies.add(strategy);
  }

  const nonCloaker = results.filter((r) => !r.isCloaker && r.salesPage !== 'CLOAKER.com');
  const primary = nonCloaker[0] || results[0];
  const isCloaker = results.length > 0 && results.every((r) => r.isCloaker);

  return {
    salesPage: isCloaker ? 'CLOAKER.com' : primary?.salesPage || '',
    isCloaker,
    estrategias: resolveEstrategiasLabel([...allStrategies], filterOptions),
    landingText: results.map((r) => r.landingText).join('\n'),
    analyzedUrls: sampled,
    strategyDetails: results.map((r) => ({
      url: r.sourceUrl,
      salesPage: r.salesPage,
      strategies: r.strategies,
      isCloaker: r.isCloaker,
    })),
  };
}

function inferFilters(combinedText, filterOptions) {
  const blob = normalizeOption(combinedText);

  const isStreaming =
    /MINISERIE|MINI SERIE|DRAMABOX|DRAMA BOX|EPISODIO|EPISÓDIO|STREAMING|SERIE|WATCH FREE EPISODE/i.test(blob);
  const isShapewear = /CINTA|MODELADOR|SHAPEWEAR|FAJA|COMPRESSION|COLABIANA/i.test(blob);
  const hasAppStore = /PLAY STORE|APP STORE|DOWNLOAD.*APP|GET THE APP|BAIXE O APP/i.test(blob);

  const nichosRules = [
    { value: 'EMAGRECIMENTO', keywords: ['emagrec', 'barriga', 'diastase', 'diástase', 'peso', 'gordura', 'desincha', 'mounjaro', 'ozempic', 'weight loss', 'fat burn', 'slim', 'modelador', 'cinta', 'shapewear', 'faja'] },
    { value: 'DIABETES', keywords: ['diabetes', 'glicose', 'insulina', 'blood sugar'] },
    { value: 'SEXUAL', keywords: ['sexual', 'libido', 'erec', 'impot', 'prazer', 'chup'] },
    { value: 'RELIGIOSO', keywords: ['oracao', 'oração', 'deus', 'biblia', 'bíblia', 'padre', 'igreja', 'prosperidade'] },
    { value: 'RELACIONAMENTO', keywords: ['namoro', 'casamento', 'ex namorad', 'alma gemea', 'alma gêmea', 'relacionamento amoroso', 'conquistar homem', 'conquistar mulher'] },
    { value: 'EDUCACIONAL', keywords: ['curso', 'aula', 'aprenda', 'método', 'metodo', 'treinamento'] },
    { value: 'TINNITUS', keywords: ['tinnitus', 'zumbido', 'ouvido'] },
    { value: 'MEMÓRIA', keywords: ['memoria', 'memória', 'alzheimer', 'cognit'] },
    { value: 'VISÃO', keywords: ['visao', 'visão', 'olho', 'vista'] },
    { value: 'SORTEIO E RIFAS', keywords: ['rifa', 'sorteio', 'raffle', 'lottery'] },
  ];

  const produtosRules = [
    { value: 'INFO', keywords: ['curso', 'método', 'metodo', 'desafio', 'programa', 'treino', 'aula', 'mães', 'maes', 'projeto', 'método msb', 'miniserie', 'mini serie', 'dramabox', 'episodio', 'episódio', 'streaming'] },
    { value: 'APP', keywords: ['aplicativo', 'play store', 'app store', 'baixe o app', 'get the app'] },
    { value: 'SORTEIOS', keywords: ['rifa', 'sorteio', 'raffle'] },
    { value: 'NUTRA', keywords: ['suplement', 'capsula', 'cápsula', 'nutra', 'pink salt', 'mounjaro', 'ozempic', 'fórmula natural', 'capsules'] },
  ];

  const idiomasRules = [
    { value: 'pt', keywords: ['desafio', 'mães', 'maes', 'barriga', 'você', 'voce', 'saiba mais', 'garanta', 'treino', 'gravidez', 'compre agora', 'emagrec'] },
    { value: 'EN', keywords: ['weight loss', 'buy now', 'learn more', 'shop now', 'free shipping', 'order now', 'watch now'] },
    { value: 'es', keywords: ['compra', 'gratis', 'descubre', 'adelgaz', 'peso', 'ahora'] },
  ];

  const paisesRules = [
    { value: 'BR', keywords: ['.COM.BR', 'BRASIL', 'REAL', 'PIX'] },
    { value: 'USA', keywords: ['UNITED STATES', 'FREE SHIPPING', ' DOLLAR', ' USD'] },
    { value: 'LATAM', keywords: ['LATAM', 'MEXICO', 'COLOMBIA', 'ARGENTINA'] },
    { value: 'PORTUGAL', keywords: ['PORTUGAL', 'PORTUGUES EUROPEU'] },
  ];

  let nichos = matchFilterOption(filterOptions.nichos || [], combinedText, nichosRules);
  let produtos = matchFilterOption(filterOptions.produtos || [], combinedText, produtosRules);
  const idiomas = matchFilterOption(filterOptions.idiomas || [], combinedText, idiomasRules);
  const paises = matchFilterOption(filterOptions.paises || [], combinedText, paisesRules);

  if (isShapewear) nichos = 'EMAGRECIMENTO';
  if (isStreaming && !hasAppStore) produtos = 'INFO';
  else if (produtos === 'APP' && !hasAppStore) produtos = 'INFO';

  return { nichos, produtos, idiomas, paises };
}

async function scrapeAdsLibrary(page, url) {
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  const adLinkUrls = await extractAdLinkUrlsFromPage(page);
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  const pageName = extractPageName(bodyText);
  const activeAds = parseAdCount(bodyText);
  const adTexts = extractAdTexts(bodyText);

  return { pageName, activeAds, adTexts, bodyText, adLinkUrls };
}

async function scrapeFacebookAbout(page, pageId) {
  if (!pageId) return { website: '', aboutText: '', categories: [] };

  const aboutUrl = `https://www.facebook.com/${pageId}/about`;
  await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  const aboutData = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const websiteMatch = text.match(/https?:\/\/[^\s]+/i);
    const websites = [...text.matchAll(/https?:\/\/[^\s/]+(?:\/[^\s]*)?/gi)].map((m) => m[0]);
    const cleanWebsites = websites.filter(
      (w) => !w.includes('facebook.com') && !w.includes('instagram.com') && !w.includes('meta.com')
    );
    const categories = [];
    if (/Health\/beauty|Saúde\/beleza/i.test(text)) categories.push('Health/beauty');
    return {
      website: cleanWebsites[0] || '',
      aboutText: text.slice(0, 2500),
      categories,
    };
  });

  return aboutData;
}

function buildNotes({ pageName, activeAds, adTexts, categories, isCloaker, landingText }) {
  const parts = [];
  if (activeAds > 0) parts.push(`~${activeAds} anúncios ativos na biblioteca.`);
  if (categories.length) parts.push(`Categoria FB: ${categories.join(', ')}.`);
  if (adTexts[0]) {
    const snippet = adTexts[0].replace(/\s+/g, ' ').slice(0, 120);
    parts.push(`Anúncio: "${snippet}..."`);
  }
  if (isCloaker) parts.push('Possível cloaker detectado na página de destino.');
  if (/desafio|treino|mãe|mae|barriga|emagrec/i.test(`${adTexts.join(' ')} ${landingText}`)) {
    parts.push('Biblioteca de fitness/emagrecimento para mães.');
  }
  return parts.join(' ');
}

async function analyzeLibraryFromUrl(rawUrl) {
  const sourceValue = normalizeAdsLibraryUrl(rawUrl);
  await assertLibrarySourceIsUnique(pool, sourceValue);
  const pageId = extractPageId(sourceValue);
  const filterOptions = await getFilterOptionsMap();

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    const adsData = await scrapeAdsLibrary(page, sourceValue);
    const aboutData = await scrapeFacebookAbout(page, pageId);

    const adAnalysis = await analyzeAdDestinations(browser, adsData.adLinkUrls, filterOptions);

    const combinedText = [
      adsData.pageName,
      adsData.bodyText,
      aboutData.aboutText,
      adAnalysis.landingText,
      adAnalysis.salesPage,
      adsData.adTexts.join(' '),
    ].join('\n');

    const filters = inferFilters(combinedText, filterOptions);

    const draft = {
      name: adsData.pageName || `Biblioteca ${pageId || 'FB'}`,
      sourceType: 'URL',
      sourceValue,
      pages: adAnalysis.salesPage ? [adAnalysis.salesPage] : [],
      nichos: filters.nichos || '',
      estrategias: adAnalysis.estrategias || '',
      produtos: filters.produtos || '',
      idiomas: filters.idiomas || '',
      paises: filters.paises || '',
      notes: buildNotes({
        pageName: adsData.pageName,
        activeAds: adsData.activeAds,
        adTexts: adsData.adTexts,
        categories: aboutData.categories,
        isCloaker: adAnalysis.isCloaker,
        landingText: adAnalysis.landingText,
      }),
      nota: buildNotes({
        pageName: adsData.pageName,
        activeAds: adsData.activeAds,
        adTexts: adsData.adTexts,
        categories: aboutData.categories,
        isCloaker: adAnalysis.isCloaker,
        landingText: adAnalysis.landingText,
      }),
      activeAdsEstimate: adsData.activeAds,
      analysis: {
        pageId,
        adLinkUrls: adsData.adLinkUrls,
        analyzedAdUrls: adAnalysis.analyzedUrls,
        strategyDetails: adAnalysis.strategyDetails,
        websiteFound: aboutData.website || null,
        isCloaker: adAnalysis.isCloaker,
        adTexts: adsData.adTexts.slice(0, 3),
        confidence: {
          name: adsData.pageName ? 'high' : 'low',
          salesPage: adAnalysis.salesPage ? (adAnalysis.isCloaker ? 'cloaker' : 'high') : 'none',
          estrategias: adAnalysis.estrategias ? 'high' : 'none',
          filters: Object.fromEntries(
            Object.entries(filters).map(([k, v]) => [k, v ? 'medium' : 'none'])
          ),
        },
      },
    };

    return draft;
  } finally {
    if (browser) await browser.close();
  }
}

async function createLibraryFromAnalysis(userId, draft, folderId = null) {
  const hints = { country: draft.country, paises: draft.paises };
  const { canonical } = resolveCanonicalSourceValue(draft.sourceValue, hints);
  if (canonical) draft.sourceValue = canonical;

  await assertLibrarySourceIsUnique(pool, draft.sourceValue, hints);
  const { rows } = await pool.query(
    `INSERT INTO libraries (
      name, source_type, source_value, country, language, notes, tags,
      active_ads, user_id, folder_id, estrategias, idiomas, nichos, paises,
      produtos, status, tipos, nota
    ) VALUES ($1,$2,$3,'','',$4,'',$5,$6,$7,$8,$9,$10,$11,$12,'active','',$13)
    RETURNING *`,
    [
      draft.name,
      draft.sourceType || 'URL',
      draft.sourceValue,
      draft.notes || '',
      draft.activeAdsEstimate || 0,
      userId,
      folderId,
      draft.estrategias || '',
      draft.idiomas || '',
      draft.nichos || '',
      draft.paises || '',
      draft.produtos || '',
      draft.nota || draft.notes || '',
    ]
  );

  const library = rows[0];

  if (draft.pages?.length) {
    for (const pageUrl of draft.pages.filter(Boolean)) {
      await pool.query('INSERT INTO pages (url, library_id) VALUES ($1, $2)', [pageUrl, library.id]);
    }
  }

  return library;
}

module.exports = {
  analyzeLibraryFromUrl,
  createLibraryFromAnalysis,
  normalizeAdsLibraryUrl,
  inferFilters,
  LIBRARY_DUPLICATE_MESSAGE,
};
