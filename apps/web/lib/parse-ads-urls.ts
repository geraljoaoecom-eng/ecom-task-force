const ADS_LIBRARY_REGEX =
  /https?:\/\/(?:www\.|web\.)?facebook\.com\/ads\/library\/[^\s"'<>,]+/gi;

export function parseAdsLibraryUrls(input: string): string[] {
  if (!input?.trim()) return [];

  const found = input.match(ADS_LIBRARY_REGEX) || [];
  const normalized = found.map((url) => {
    try {
      const parsed = new URL(url.replace(/[),.;]+$/, ''));
      return parsed.toString();
    } catch {
      return url.trim();
    }
  });

  return [...new Set(normalized)];
}

export async function parseAdsLibraryUrlsFromFile(file: File): Promise<string[]> {
  const text = await file.text();
  return parseAdsLibraryUrls(text);
}
