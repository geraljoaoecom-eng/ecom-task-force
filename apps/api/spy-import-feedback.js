/**
 * SPY Import Feedback — aprendizagem a partir de imports do utilizador.
 *
 * Quando o utilizador importa um discovery para a biblioteca, esse gesto é
 * o sinal mais forte possível: "é exactamente isto que quero".
 *
 * Este módulo fecha o ciclo:
 *   1. Boosta a keyword que trouxe esse discovery (+20 de score)
 *   2. Pede ao Gemini para extrair 5-10 novas keywords do nicho a partir
 *      do conteúdo do discovery importado
 *   3. Injeta essas keywords na spy_niche_intel para as próximas sessões
 */

const { upsertNicheKeyword, recordKeywordOutcome, ensureNicheIntelTable } = require('./spy-niche-intel');
const { callGeminiVertex, ANALYSIS_MODEL } = require('./spy-openrouter-shared');
const { pool } = require('./db');

const IMPORT_SCORE_BOOST = 20; // muito acima do boost normal de descoberta (+4)

/**
 * Extrai texto relevante do discovery para contexto do Gemini.
 */
function buildDiscoveryContext(discovery, session) {
  const card = discovery.cardData || {};
  const assets = (discovery.adAssets || []).slice(0, 5);

  const parts = [
    `Nome da página: ${discovery.name || card.name || ''}`,
    `Nicho: ${session.nicho || card.nichos || ''}`,
    `País: ${session.country || card.paises || ''}`,
    `Idioma: ${session.language || ''}`,
    `Keyword que encontrou: ${discovery.keywordOrigin || ''}`,
    `Ads activos: ${discovery.activeAds || 0}`,
  ];

  for (const asset of assets) {
    const txt = [asset.headline, asset.body, asset.bodyText, asset.text]
      .filter(Boolean)
      .map((s) => String(s).slice(0, 200))
      .join(' | ');
    if (txt) parts.push(`Anúncio: ${txt}`);
  }

  if (card.resumoMercado) parts.push(`Resumo mercado: ${String(card.resumoMercado).slice(0, 300)}`);

  return parts.filter((p) => !p.endsWith(': ')).join('\n');
}

/**
 * Usa Gemini para extrair keywords de pesquisa a partir do discovery importado.
 * Retorna array de strings (keywords em minúsculas).
 */
async function extractKeywordsFromDiscovery(discovery, session) {
  const context = buildDiscoveryContext(discovery, session);
  if (!context.trim()) return [];

  const prompt = `Analisas um anúncio de direct response que um utilizador importou como biblioteca de referência.
O teu objetivo é extrair keywords de pesquisa que encontrariam anúncios semelhantes na Meta Ads Library.

CONTEXTO DO DISCOVERY IMPORTADO:
${context}

Gera entre 5 e 10 keywords de pesquisa em texto livre (como se escrevesses na barra de pesquisa da Meta Ads Library).
Foca em: mecanismos do produto, promessas específicas, frases de CTA, variações do nicho.
Idioma: ${session.language || 'mesmo idioma dos anúncios acima'}.
Evita: nomes de marcas específicas, palavras genéricas como "comprar" ou "oferta".

Responde APENAS com JSON:
{"keywords": ["keyword1", "keyword2", "keyword3"]}`;

  try {
    const raw = await callGeminiVertex(
      [{ role: 'user', content: prompt }],
      { model: ANALYSIS_MODEL, temperature: 0.3, max_tokens: 500, timeout: 30000 }
    );

    let text = String(raw || '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    const kws = (parsed.keywords || [])
      .map((k) => String(k).trim().toLowerCase())
      .filter((k) => k.length >= 4 && k.length <= 80);
    return kws.slice(0, 10);
  } catch (err) {
    console.warn(`⚠️ SPY import feedback (Gemini): ${err.message}`);
    return [];
  }
}

/**
 * Ponto de entrada principal — chamado após import bem-sucedido.
 * Corre de forma assíncrona (não bloqueia o utilizador).
 *
 * @param {object} discovery   — objecto completo do discovery (mapDiscovery)
 * @param {object} session     — objecto da sessão SPY (nicho, country, language, etc.)
 */
async function onDiscoveryImported(discovery, session) {
  try {
    await ensureNicheIntelTable();

    const nicho = session.nicho || '';
    const country = session.country || '';
    const keyword = discovery.keywordOrigin || '';

    // 1. Boost forte na keyword que trouxe este discovery
    if (keyword && nicho) {
      await recordKeywordOutcome(nicho, country, keyword, {
        adsFound: discovery.activeAds || 0,
        relevantCount: 5,          // proxy conservador
        discoveriesCount: 3,       // peso equivalente a 3 discoveries normais
      });
      // Boost extra directo no score (o recordKeywordOutcome já dá +4 por discovery,
      // mas queremos sinalizar que o utilizador aprovou explicitamente)
      await pool.query(
        `UPDATE spy_niche_intel
         SET score = score + $3,
             last_seen_at = NOW()
         WHERE nicho = $1 AND keyword = $2`,
        [nicho.trim().toUpperCase(), keyword.trim().toLowerCase(), IMPORT_SCORE_BOOST]
      );
      console.log(`📥 SPY import feedback: keyword «${keyword}» → boost +${IMPORT_SCORE_BOOST} (nicho ${nicho})`);
    }

    // 2. Extrai novas keywords com Gemini
    const newKeywords = await extractKeywordsFromDiscovery(discovery, session);
    if (newKeywords.length) {
      console.log(`📥 SPY import feedback: ${newKeywords.length} novas keywords extraídas → ${newKeywords.join(', ')}`);
      for (const kw of newKeywords) {
        await upsertNicheKeyword(nicho || 'GLOBAL', country, kw, 'import_feedback', 3);
      }
    }

    // 3. Se não há nicho mas há keywords, guarda no nicho GLOBAL para reutilização cross-nicho
    if (!nicho && keyword) {
      await upsertNicheKeyword('GLOBAL', country, keyword, 'import_feedback', 5);
    }

  } catch (err) {
    // Nunca deixar falhar o import por causa do feedback
    console.warn(`⚠️ SPY import feedback erro: ${err.message}`);
  }
}

module.exports = { onDiscoveryImported };
