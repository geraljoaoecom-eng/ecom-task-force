export interface PersistedSpyJobTrack {
  sessionIds: string[];
  dismissedIds: string[];
  lastSeenCompleted: string[];
}

const STORAGE_KEY = 'ecom-spy-job-track';

export function loadSpyJobTrack(): PersistedSpyJobTrack {
  if (typeof window === 'undefined') {
    return { sessionIds: [], dismissedIds: [], lastSeenCompleted: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessionIds: [], dismissedIds: [], lastSeenCompleted: [] };
    return JSON.parse(raw);
  } catch {
    return { sessionIds: [], dismissedIds: [], lastSeenCompleted: [] };
  }
}

export function saveSpyJobTrack(track: PersistedSpyJobTrack): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(track));
}

export function trackSpySession(sessionId: string): void {
  const track = loadSpyJobTrack();
  if (!track.sessionIds.includes(sessionId)) {
    track.sessionIds.push(sessionId);
    saveSpyJobTrack(track);
  }
}

export function dismissSpyPanel(sessionId: string): void {
  const track = loadSpyJobTrack();
  if (!track.dismissedIds.includes(sessionId)) track.dismissedIds.push(sessionId);
  saveSpyJobTrack(track);
}

export interface SpyNotification {
  id: string;
  type: 'spy_completed' | 'spy_new_discoveries' | 'spy_expiring';
  title: string;
  message: string;
  sessionId?: string;
  read: boolean;
  createdAt: number;
}

const NOTIF_KEY = 'ecom-spy-notifications';

export function loadSpyNotifications(): SpyNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSpyNotifications(list: SpyNotification[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, 50)));
}

export function pushSpyNotification(n: Omit<SpyNotification, 'id' | 'read' | 'createdAt'>): void {
  const list = loadSpyNotifications();
  list.unshift({
    ...n,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    createdAt: Date.now(),
  });
  saveSpyNotifications(list);
  window.dispatchEvent(new CustomEvent('spy-notifications-changed'));
}
