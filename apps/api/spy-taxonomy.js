/**
 * Taxonomia SPY: prioriza nicho/produto/idioma/país da pesquisa sobre heurísticas do texto.
 */

function applySessionTaxonomy(fields, session) {
  if (!session) return { ...fields };
  const out = { ...fields };
  if (session.nicho) out.nichos = session.nicho;
  if (session.produto) out.produtos = session.produto;
  if (session.language) out.idiomas = session.language;
  if (session.country) out.paises = session.country;
  return out;
}

function patchDiscoveryForDisplay(discovery, session) {
  if (!discovery || !session) return discovery;
  const tags = applySessionTaxonomy(
    {
      nichos: discovery.nichos || discovery.cardData?.nichos || '',
      produtos: discovery.produtos || discovery.cardData?.produtos || '',
      idiomas: discovery.idiomas || discovery.cardData?.idiomas || '',
      paises: discovery.paises || discovery.cardData?.paises || '',
    },
    session
  );
  return { ...discovery, ...tags };
}

function buildImportDraft(discovery, session) {
  const card = discovery.cardData || {};
  const merged = applySessionTaxonomy(
    {
      name: discovery.name || card.name || 'Biblioteca',
      sourceType: card.sourceType || 'URL',
      sourceValue: discovery.sourceValue,
      activeAdsEstimate: discovery.activeAds || card.activeAdsEstimate || card.activeAds || 0,
      nichos: card.nichos || discovery.nichos || '',
      produtos: card.produtos || discovery.produtos || '',
      idiomas: card.idiomas || discovery.idiomas || '',
      paises: card.paises || discovery.paises || '',
      estrategias: card.estrategias || discovery.estrategias || '',
      notes: card.notes || card.nota || discovery.notes || '',
      nota: card.nota || card.notes || discovery.notes || '',
      pages: Array.isArray(card.pages) ? card.pages.filter(Boolean) : [],
    },
    session
  );
  return merged;
}

function applySessionToDraft(draft, session) {
  return applySessionTaxonomy(
    {
      ...draft,
      nichos: draft.nichos || '',
      produtos: draft.produtos || '',
      idiomas: draft.idiomas || '',
      paises: draft.paises || '',
    },
    session
  );
}

module.exports = {
  applySessionTaxonomy,
  patchDiscoveryForDisplay,
  buildImportDraft,
  applySessionToDraft,
};
