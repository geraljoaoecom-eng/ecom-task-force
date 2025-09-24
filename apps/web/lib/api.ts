// Configuração da API  
export const API_BASE = '/api';

// Função utilitária para chamadas à API
export async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(`API error: ${response.status}`);
    (error as any).response = { data: errorData, status: response.status };
    throw error;
  }

  return response.json();
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
    
    return api(`/libraries?${searchParams.toString()}`);
  },
  
  create: (data: any) => api('/libraries', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: any) => api(`/libraries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => api(`/libraries/${id}`, {
    method: 'DELETE',
  }),
  
  refresh: (id: string) => api(`/libraries/${id}/refresh`, {
    method: 'POST',
  }),

  getHistory: (id: string, days = 15) => 
    api(`/libraries/${id}/history?days=${days}`)
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

// API para opções de filtros
export const filterOptionsApi = {
  getAll: () => api('/filter-options'),
  
  getByType: (type: string) => api(`/filter-options/${type}`),
  
  create: (type: string, value: string) => 
    api(`/filter-options/${type}`, {
      method: 'POST',
      body: JSON.stringify({ value })
    }),
  
  delete: (type: string, value: string) => 
    api(`/filter-options/${type}/${encodeURIComponent(value)}`, { 
      method: 'DELETE' 
    })
};
