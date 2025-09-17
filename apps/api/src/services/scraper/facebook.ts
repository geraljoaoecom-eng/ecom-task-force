import { SourceType } from '../../types';

// Constrói URL da Ads Library baseado no tipo de fonte
export function buildSearchUrl(type: SourceType, value: string): string {
  if (type === 'URL') {
    return value;
  }
  
  // Para palavra-chave, monta URL padrão da Ads Library
  const q = encodeURIComponent(value);
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=keyword_unordered&q=${q}`;
}
