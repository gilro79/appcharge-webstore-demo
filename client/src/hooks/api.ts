const BASE = '/api/dashboard';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Players
  getPlayers: () => request<any[]>('/players'),
  getPlayer: (id: string) => request<any>(`/players/${id}`),
  createPlayer: (data: any) => request<any>('/players', { method: 'POST', body: JSON.stringify(data) }),
  updatePlayer: (id: string, data: any) => request<any>(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlayer: (id: string) => request<any>(`/players/${id}`, { method: 'DELETE' }),
  activatePlayer: (id: string) => request<any>(`/players/${id}/activate`, { method: 'POST' }),

  // Tiers
  getTiers: () => request<any[]>('/tiers'),
  getTier: (id: string) => request<any>(`/tiers/${id}`),
  createTier: (data: any) => request<any>('/tiers', { method: 'POST', body: JSON.stringify(data) }),
  updateTier: (id: string, data: any) => request<any>(`/tiers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTier: (id: string) => request<any>(`/tiers/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: () => request<any[]>('/events'),
  clearEvents: () => request<any>('/events', { method: 'DELETE' }),

  // Logs
  getLogs: () => request<any[]>('/logs'),
  clearLogs: () => request<any>('/logs', { method: 'DELETE' }),

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (data: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  refreshStore: () => request<any>('/settings/refresh-store', { method: 'POST' }),

  // Appcharge proxy (create product / offer)
  getOfferUis: () => request<any[]>('/appcharge/offer-uis'),
  createAppchargeProduct: (data: any) =>
    request<any>('/appcharge/products', { method: 'POST', body: JSON.stringify(data) }),
  createAppchargeOffer: (data: any) =>
    request<any>('/appcharge/offers', { method: 'POST', body: JSON.stringify(data) }),
};
