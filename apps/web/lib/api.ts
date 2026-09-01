// Configuração da API  
export const API_BASE = '/api';

// Função utilitária para chamadas à API
export async function api(path: string, init?: RequestInit) {
  const token = localStorage.getItem('authToken');
  
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...init?.headers,
    },
    ...init,
  });

  const text = await response.text();

  if (!response.ok) {
    let errorData: Record<string, unknown> = {};
    try {
      errorData = text ? JSON.parse(text) : {};
    } catch {
      // ignore
    }
    const error = new Error(
      (errorData as { error?: string }).error || `API error: ${response.status}`
    );
    (error as any).response = { data: errorData, status: response.status };
    throw error;
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isRetryableApiError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  const message = err instanceof Error ? err.message : String(err)
  return status === 504 || status === 502 || status === 503 || message.includes('504')
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 4000): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries && isRetryableApiError(err)) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      throw err
    }
  }
  throw lastError
}

// Funções específicas da API
export const librariesApi = {
  getAll: (params?: {
    q?: string;
    folderId?: string;
    order?: string;
    tags?: string[];
    status?: string;
    nichos?: string;
    estrategias?: string;
    produtos?: string;
    idiomas?: string;
    paises?: string;
    showAll?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.append('q', params.q);
    if (params?.folderId) searchParams.append('folderId', params.folderId);
    if (params?.order) searchParams.append('order', params.order);
    if (params?.tags) params.tags.forEach(tag => searchParams.append('tags', tag));
    if (params?.status) searchParams.append('status', params.status);
    if (params?.nichos) searchParams.append('nichos', params.nichos);
    if (params?.estrategias) searchParams.append('estrategias', params.estrategias);
    if (params?.produtos) searchParams.append('produtos', params.produtos);
    if (params?.idiomas) searchParams.append('idiomas', params.idiomas);
    if (params?.paises) searchParams.append('paises', params.paises);
    if (params?.showAll) searchParams.append('showAll', params.showAll);
    
    return api(`/libraries?${searchParams.toString()}`);
  },
  
  create: (data: any) => api('/libraries', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: any) => api(`/libraries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => api(`/libraries/${id}`, {
    method: 'DELETE',
  }),
  
  refresh: (id: string) => api(`/libraries/${id}/refresh`, {
    method: 'POST',
  }),

  refreshAll: () => api('/libraries/refresh-all', {
    method: 'POST',
  }),

  getHistory: (id: string, days: number | 'all' = 15) =>
    api(`/libraries/${id}/history?days=${days}`),

  analytics: (params?: { country?: string; niche?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.country) q.set('country', params.country);
    if (params?.niche) q.set('niche', params.niche);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api(`/libraries/analytics${qs ? `?${qs}` : ''}`) as Promise<{
      totals: { libraries: number; ads_ativos: number; libs_com_ads: number };
      scaled: { id: string; name: string; paises: string; nichos: string; active_ads: number }[];
      byCountry: { pais: string; libs: number; total_ads: number }[];
      byNiche: { nicho: string; libs: number; total_ads: number }[];
      longevity: { library_id: string; name: string; paises: string; max_dias: number; ads_ativos: number }[];
      duplicated: { library_id: string; name: string; dup: number; dias: number; copy: string }[];
    }>;
  },
};

export const foldersApi = {
  getAll: () => api('/folders'),
  
  create: (data: { name: string }) => api('/folders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: { name: string }) => api(`/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => api(`/folders/${id}`, {
    method: 'DELETE',
  }),
};

export const pagesApi = {
  create: (libraryId: string, data: { url: string }) => api(`/pages/${libraryId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: { url: string }) => api(`/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => api(`/pages/${id}`, {
    method: 'DELETE',
  }),
};

export const filterOptionsApi = {
  getAll: () => Promise.resolve([]), // Não implementado no servidor
  
  getByType: (type: string) => api(`/filter-options/${type}`),
  
  create: (type: string, value: string) =>
    api('/filter-options', {
      method: 'POST',
      body: JSON.stringify({ type, value }),
    }),
  
  deleteByTypeAndValue: (type: string, value: string) => 
    api(`/filter-options/${type}/${encodeURIComponent(value)}`, { method: 'DELETE' })
};

export const adminLibraryApi = {
  analyze: (url: string) =>
    withRetry(() =>
      api('/admin/libraries/analyze', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
    ),

  import: (draft: Record<string, unknown>) =>
    withRetry(() =>
      api('/admin/libraries/import', {
        method: 'POST',
        body: JSON.stringify({ draft }),
      })
    ),
};

export const spyApi = {
  getFormOptions: () =>
    api('/spy/form-options') as Promise<{
      countries: { code: string; label: string }[];
      languages: { value: string; label: string }[];
      nichos: string[];
      produtos: string[];
    }>,
  listSessions: () => api('/spy/sessions'),
  createSession: (data: {
    name?: string;
    country?: string;
    language?: string;
    keywordSeed?: string;
    nicho?: string;
    produto?: string;
    /** 50 | 100 | 1000 | 10000 | 100000 | unlimited */
    maxAdsLimit?: string;
    discoveryTarget?: string;
    marketIntel?: Record<string, unknown>;
    consultantBrief?: string;
    /** Tipos de funil para CTA Hunt: quiz | vsl | lead | venda | sorteio */
    ctaHunt?: string[];
    minActiveAds?: string;
    minDaysActive?: string;
    maxDaysActive?: string;
    maxHours?: string;
    mobilePlatform?: 'mac' | 'windows' | 'ipad' | 'iphone';
  }) =>
    api('/spy/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sweepPreview: (params: { country?: string; language?: string }) => {
    const q = new URLSearchParams()
    if (params.country) q.set('country', params.country)
    if (params.language) q.set('language', params.language)
    return api(`/spy/sweep-preview?${q.toString()}`) as Promise<{
      isSweep: boolean
      countries: { code: string; label: string }[]
    }>
  },
  getTrends: () =>
    api('/spy/trends') as Promise<{
      trends: { title: string; why: string }[]
      novelties: { title: string; why: string }[]
      updatedAt: string | null
    }>,
  previewKeywords: (data: {
    country?: string;
    language?: string;
    nicho?: string;
    produto?: string;
    keywordSeed?: string;
    brief?: string;
    previousIntel?: Record<string, unknown>;
    feedback?: string;
  }) =>
    api('/spy/keywords/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ success: boolean; marketIntel: Record<string, unknown> }>,
  getSession: (id: string) => api(`/spy/sessions/${id}`),
  deleteSession: (id: string) => api(`/spy/sessions/${id}`, { method: 'DELETE' }),
  pauseSession: (id: string) => api(`/spy/sessions/${id}/pause`, { method: 'POST' }),
  cancelSession: (id: string) => api(`/spy/sessions/${id}/cancel`, { method: 'POST' }),
  resumeSession: (id: string) => api(`/spy/sessions/${id}/resume`, { method: 'POST' }),
  listDiscoveries: (sessionId: string, params?: Record<string, string>) => {
    const clean: Record<string, string> = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '' && value !== 'undefined') clean[key] = value;
      }
    }
    const q = new URLSearchParams(clean);
    const qs = q.toString();
    return api(`/spy/sessions/${sessionId}/discoveries${qs ? `?${qs}` : ''}`);
  },
  importDiscoveries: (discoveryIds: string[]) =>
    api('/spy/discoveries/import', {
      method: 'POST',
      body: JSON.stringify({ discoveryIds }),
    }),
  getImportJob: (jobId: string) => api(`/spy/import-jobs/${jobId}`),
  deleteDiscovery: (sessionId: string, discoveryId: string) =>
    api(`/spy/sessions/${sessionId}/discoveries/${discoveryId}`, { method: 'DELETE' }),
  getConfig: () => api('/spy/config'),
  getMobileStatus: () =>
    api('/spy/mobile/status') as Promise<{
      required: boolean
      ready: boolean
      agentCount: number
      agents: { id: string; deviceName: string; ip: string; isp: string }[]
      message: string
    }>,
  checkNetwork: (opts?: { fresh?: boolean }) => {
    const q = opts?.fresh ? '?fresh=1' : '';
    return api(`/spy/network-check${q}`) as Promise<{
      ip: string
      mobile: boolean
      org: string
      isp: string
      country?: string
      asn?: string
      reason?: string
      cached?: boolean
    }>;
  },
  createMobilePairing: () =>
    api('/spy/mobile/pairing', { method: 'POST' }) as Promise<{
      pairingToken: string
      apiUrl: string
      projectDir: string
      windowsProjectDir?: string
      localPort: number
      expiresInSec: number
      resumeCommand: string
      activateCommand: string
      resumeCommandWindows?: string
      activateCommandWindows?: string
      activateCommandWindowsCmd?: string
    }>,
  getMobileTerminal: (platform: 'mac' | 'windows' = 'mac') =>
    api(`/spy/mobile/terminal?platform=${encodeURIComponent(platform)}`) as Promise<{
      platform?: string
      projectDir: string
      resumeCommand: string
      resumeCommandCmd?: string
      hint: string
    }>,
  downloadMobileInstaller: async (pairingToken: string, platform: 'mac' | 'windows' = 'mac') => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(
      `${API_BASE}/spy/mobile/install-script?pairingToken=${encodeURIComponent(pairingToken)}&platform=${encodeURIComponent(platform)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    if (!res.ok) {
      const text = await res.text()
      let msg = 'Não foi possível gerar o activador'
      try {
        msg = JSON.parse(text).error || msg
      } catch {
        // ignore
      }
      throw new Error(msg)
    }
    return res.blob()
  },
  downloadAutostartInstaller: async () => {
    const token = localStorage.getItem('authToken')
    const res = await fetch(`${API_BASE}/spy/mobile/autostart-script`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const text = await res.text()
      let msg = 'Não foi possível gerar o instalador'
      try {
        msg = JSON.parse(text).error || msg
      } catch {
        // ignore
      }
      throw new Error(msg)
    }
    return res.blob()
  },
  getCopyBank: (sessionId: string, q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return api(`/spy/sessions/${sessionId}/copy-bank${params}`);
  },
};

export const copyApi = {
  list: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params || {}).toString();
    return api(`/copy${q ? `?${q}` : ''}`);
  },
  taxonomy: () => api('/copy/taxonomy'),
  rankings: (type: string, limit = 20) =>
    api(`/copy/rankings/${type}?limit=${limit}`),
  scanLibrary: (libraryId: string) =>
    api(`/copy/scan/${libraryId}`, { method: 'POST' }),
};

// Instagram Talks (Fase 0)
export const instagramApi = {
  networkCheck: () => api('/spy/network-check'),
  listAccounts: () => api('/ig/accounts'),
  login: (username: string, password: string) =>
    api('/ig/accounts/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  sessionImport: (username: string, sessionid: string) =>
    api('/ig/accounts/session-import', { method: 'POST', body: JSON.stringify({ username, sessionid }) }),
  submit2fa: (pendingId: string, code: string) =>
    api('/ig/accounts/2fa', { method: 'POST', body: JSON.stringify({ pendingId, code }) }),
  check: (id: number) => api(`/ig/accounts/${id}/check`, { method: 'POST' }),
  disconnect: (id: number) => api(`/ig/accounts/${id}/disconnect`, { method: 'POST' }),
  inbox: (id: number, limit = 20) => api(`/ig/accounts/${id}/inbox?limit=${limit}`),
  send: (id: number, username: string, text: string) =>
    api(`/ig/accounts/${id}/send`, { method: 'POST', body: JSON.stringify({ username, text }) }),
};
