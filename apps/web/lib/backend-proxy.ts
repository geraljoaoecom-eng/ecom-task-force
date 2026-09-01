/**
 * Encaminha pedidos para a API Express (ecom-api :4000) com o scraper corrigido.
 * O scraper em lib/scraper.ts está obsoleto — não usar para refresh.
 */
const BACKEND_URL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000';

export async function proxyToBackend(
  path: string,
  init: RequestInit & { authHeader?: string | null }
): Promise<Response> {
  const { authHeader, headers, ...rest } = init;
  const url = `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;

  return fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(headers as Record<string, string>),
    },
  });
}

export async function proxyToBackendJson(
  path: string,
  init: RequestInit & { authHeader?: string | null }
) {
  const res = await proxyToBackend(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Backend ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return data;
}
