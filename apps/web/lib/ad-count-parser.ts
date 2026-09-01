export function parseNumberToken(raw: string): number {
  const cleaned = String(raw || '').replace(/[\s.,]/g, '');
  const value = parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : 0;
}

function getHeaderSection(text: string): string {
  const markers = [
    /Library ID/i,
    /ID da biblioteca/i,
    /Identificação da biblioteca/i,
    /Started running on/i,
    /Começou a veicular em/i,
    /Veiculação iniciada em/i,
    /Active status/i,
    /Estado:\s*Ativo/i,
    /Open Dropdown/i,
    /Abrir menu/i,
  ];

  let endIndex = text.length;
  for (const marker of markers) {
    const match = marker.exec(text);
    if (match && match.index > 80 && match.index < endIndex) {
      endIndex = match.index;
    }
  }

  return text.slice(0, Math.min(endIndex, 5000));
}

export function parseAdCountFromText(text: string): number {
  if (!text) return 0;

  const headerSection = getHeaderSection(text);
  const patterns = [
    /~\s*([\d\s.,]+)\s*(resultados?|results?|résultats?|risultati?|ergebnisse?)/i,
    /([\d\s.,]+)\s*(resultados?|results?|résultats?|risultati?|ergebnisse?)/i,
  ];

  for (const pattern of patterns) {
    const match = headerSection.match(pattern);
    if (match) {
      const count = parseNumberToken(match[1]);
      if (count > 0 && count < 500000) {
        return count;
      }
    }
  }

  return 0;
}
