/**
 * Loop Gemini ↔ estado da biblioteca Meta (proxy, sem screenshots).
 */
const {
  isOpenRouterConfigured,
  callGeminiVertex,
  ANALYSIS_MODEL,
} = require('./spy-openrouter-shared');
const LIBRARY_AI_MODEL = process.env.SPY_LIBRARY_AI_MODEL || ANALYSIS_MODEL;
const MAX_AI_ROUNDS = parseInt(process.env.SPY_LIBRARY_AI_MAX_ROUNDS || '120', 10) || 120;

function parseAiDecision(text) {
  let raw = String(text || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[0]);
    const action = String(j.action || j.decisao || 'scroll').toLowerCase();
    if (!['scroll', 'stop', 'scroll_aggressive'].includes(action)) return { action: 'scroll', reason: 'parse_fallback' };
    return {
      action,
      reason: String(j.reason || j.motivo || '').slice(0, 200),
    };
  } catch {
    return null;
  }
}

async function decideLibraryScrollAction(state) {
  if (!isOpenRouterConfigured()) {
    return { action: 'scroll', reason: 'openrouter_off' };
  }

  const scrollMode = state.scrollToEnd
    ? 'MODO: scroll até ao FIM da lista — só "stop" quando várias rondas sem novos ads GraphQL E o texto da página indica fim de resultados.'
    : 'MODO: recolha eficiente mas completa.';

  const prompt = `És o operador SPY na Facebook Ads Library (${state.label || 'pesquisa'}).

${scrollMode}

Estado actual:
- Anúncios recolhidos (GraphQL): ${state.adsCollected}
- Objectivo máximo nesta pesquisa: ${state.maxAds}
- Scrolls feitos: ${state.scrollRounds}
- Rondas sem novos ads: ${state.stagnantRounds}
- Amostra de headlines: ${(state.sampleHeadlines || []).slice(0, 6).join(' | ') || 'nenhuma ainda'}
- Texto visível (trecho): ${(state.bodySnippet || '').slice(0, 900)}

Acções:
- "scroll" — mais conteúdo provável
- "scroll_aggressive" — lista longa / muitos resultados / loader visível
- "stop" — APENAS se estagnado há várias rondas E sem sinais de mais resultados (evita parar cedo)

Responde APENAS JSON: {"action":"scroll|scroll_aggressive|stop","reason":"..."}`;

  try {
    const content = await callGeminiVertex([{ role: 'user', content: prompt }], {
      model: LIBRARY_AI_MODEL, temperature: 0.2, max_tokens: 120, timeout: 20000,
    });
    return parseAiDecision(content) || { action: 'scroll', reason: 'invalid_json' };
  } catch (err) {
    return { action: 'scroll', reason: err.message?.slice(0, 80) || 'ai_error' };
  }
}

/** Loop de scroll guiado por IA (keyword + biblioteca quando scroll até ao fim). */
async function runAiGuidedScrollLoop(page, ctx) {
  const { collected, maxAds, maxStagnant, cfg, onProgress, label, scrollToEnd } = ctx;
  const maxRounds = ctx.maxScrollRounds || MAX_AI_ROUNDS;
  let scrollRounds = 0;
  let stagnantRounds = 0;
  let aiCalls = 0;

  const safetyCap = maxAds;
  const scrollUntilDry = scrollToEnd !== false;

  while (stagnantRounds < maxStagnant && scrollRounds < maxRounds) {
    if (!scrollUntilDry && collected.length >= safetyCap) break;
    if (scrollUntilDry && safetyCap < 100000 && collected.length >= safetyCap) break;
    const before = collected.length;
    const bodySnippet = await page.evaluate(() => document.body?.innerText?.slice(0, 1800) || '');
    const sampleHeadlines = collected
      .slice(-10)
      .map((a) => a.headline || a.adText || a.pageName)
      .filter(Boolean);

    const decision = await decideLibraryScrollAction({
      adsCollected: collected.length,
      maxAds,
      scrollRounds,
      stagnantRounds,
      bodySnippet,
      sampleHeadlines,
      label,
      scrollToEnd: scrollToEnd !== false,
    });
    aiCalls += 1;

    if (onProgress) {
      await onProgress({
        scrollRounds,
        adsCollected: collected.length,
        aiAction: decision.action,
        aiReason: decision.reason,
      });
    }

    if (decision.action === 'stop') {
      const minScrolls = scrollToEnd !== false ? 12 : 4;
      if (scrollRounds < minScrolls || stagnantRounds < Math.min(8, maxStagnant - 2)) {
        // Evita parar cedo no modo scroll-fim
      } else {
        console.log(`   🧠 SPY scroll IA: stop — ${decision.reason}`);
        break;
      }
    }

    const mult = decision.action === 'scroll_aggressive' ? 3.5 : 2.2;
    await page.evaluate((m) => window.scrollBy(0, window.innerHeight * m), mult);
    await new Promise((r) => setTimeout(r, cfg.delayMin + Math.random() * (cfg.delayMax - cfg.delayMin)));

    scrollRounds += 1;
    if (collected.length === before) stagnantRounds += 1;
    else stagnantRounds = 0;
  }

  return { scrollRounds, aiCalls };
}

function isLibraryAiEnabled() {
  return process.env.SPY_LIBRARY_AI_SCROLL !== 'false';
}

module.exports = {
  decideLibraryScrollAction,
  runAiGuidedScrollLoop,
  isLibraryAiEnabled,
  parseAiDecision,
};
