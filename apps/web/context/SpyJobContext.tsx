'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { spyApi } from '@/lib/api';
import {
  dismissSpyPanel,
  loadSpyJobTrack,
  loadSpyNotifications,
  pushSpyNotification,
  saveSpyJobTrack,
  trackSpySession,
  type SpyNotification,
} from '@/lib/spy-job-storage';

export interface SpySessionLive {
  id: string;
  name: string;
  status: string;
  stats: Record<string, number>;
  discoveriesCount?: number;
  country?: string;
  nicho?: string;
  startedAt?: string;
  errorMessage?: string;
}

interface SpyJobContextValue {
  activeSessions: SpySessionLive[];
  panelSessions: SpySessionLive[];
  panelVisible: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  dismissPanel: () => void;
  startSpySearch: (params: {
    name?: string;
    country?: string;
    language?: string;
    keywordSeed?: string;
    nicho?: string;
    produto?: string;
    maxAdsLimit?: string;
    discoveryTarget?: string;
    minActiveAds?: string;
    minDaysActive?: string;
    maxDaysActive?: string;
    maxHours?: string;
    marketIntel?: Record<string, unknown>;
    consultantBrief?: string;
    ctaHunt?: string[];
    mobilePlatform?: 'mac' | 'windows' | 'ipad' | 'iphone';
  }) => Promise<SpySessionLive | null>;
  refreshSessions: () => Promise<void>;
  notifications: SpyNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  pauseSession: (id: string) => Promise<void>;
  cancelSession: (id: string) => Promise<void>;
  resumeSession: (id: string) => Promise<void>;
}

const SpyJobContext = createContext<SpyJobContextValue | null>(null);

const ACTIVE = new Set(['queued', 'running', 'paused']);

export function SpyJobProvider({ children }: { children: React.ReactNode }) {
  const [activeSessions, setActiveSessions] = useState<SpySessionLive[]>([]);
  const [trackedSessions, setTrackedSessions] = useState<SpySessionLive[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const [notifications, setNotifications] = useState<SpyNotification[]>([]);
  const prevStatsRef = useRef<Record<string, number>>({});

  const refreshSessions = useCallback(async () => {
    try {
      const all: SpySessionLive[] = await spyApi.listSessions();
      const track = loadSpyJobTrack();
      const relevant = all.filter(
        (s) => track.sessionIds.includes(s.id) && !track.dismissedIds.includes(s.id)
      );
      const live = relevant.filter((s) => ACTIVE.has(s.status));
      setTrackedSessions(relevant);
      setActiveSessions(live);

      for (const s of all) {
        const prev = prevStatsRef.current[s.id] || 0;
        const count = s.discoveriesCount ?? s.stats?.discoveriesCount ?? 0;
        if (count > prev && prev > 0) {
          pushSpyNotification({
            type: 'spy_new_discoveries',
            title: 'SPY — novos discoveries',
            message: `+${count - prev} em «${s.name}» (total ${count})`,
            sessionId: s.id,
          });
        }
        prevStatsRef.current[s.id] = count;

        if (
          ['completed', 'timeout', 'cancelled'].includes(s.status) &&
          track.sessionIds.includes(s.id) &&
          !track.lastSeenCompleted.includes(s.id)
        ) {
          track.lastSeenCompleted.push(s.id);
          saveSpyJobTrack(track);
          if (s.status === 'completed' || s.status === 'timeout') {
            pushSpyNotification({
              type: 'spy_completed',
              title: 'SPY — pesquisa concluída',
              message: `«${s.name}» — ${count} discoveries`,
              sessionId: s.id,
            });
          }
          setPanelDismissed(false);
        }
      }

      setNotifications(loadSpyNotifications());
    } catch {
      // ignore poll errors
    }
  }, []);

  useEffect(() => {
    refreshSessions();
    const t = setInterval(refreshSessions, 12000);
    const onNotif = () => setNotifications(loadSpyNotifications());
    window.addEventListener('spy-notifications-changed', onNotif);
    return () => {
      clearInterval(t);
      window.removeEventListener('spy-notifications-changed', onNotif);
    };
  }, [refreshSessions]);

  const startSpySearch = useCallback(
    async (params: Parameters<SpyJobContextValue['startSpySearch']>[0]) => {
      const res = await spyApi.createSession(params);
      if (res?.session?.id) {
        trackSpySession(res.session.id);
        setPanelDismissed(false);
        setExpanded(true);
        await refreshSessions();
        return res.session;
      }
      return null;
    },
    [refreshSessions]
  );

  const dismissPanel = useCallback(() => {
    trackedSessions.forEach((s) => {
      if (!ACTIVE.has(s.status)) dismissSpyPanel(s.id);
    });
    setPanelDismissed(true);
  }, [trackedSessions]);

  const markAllRead = useCallback(() => {
    const list = loadSpyNotifications().map((n) => ({ ...n, read: true }));
    localStorage.setItem('ecom-spy-notifications', JSON.stringify(list));
    setNotifications(list);
  }, []);

  const markRead = useCallback((id: string) => {
    const list = loadSpyNotifications().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    localStorage.setItem('ecom-spy-notifications', JSON.stringify(list));
    setNotifications(list);
  }, []);

  const hasLive = activeSessions.some((s) => ACTIVE.has(s.status));
  const hasTracked = trackedSessions.length > 0;
  const panelVisible = hasTracked && (!panelDismissed || hasLive);

  return (
    <SpyJobContext.Provider
      value={{
        activeSessions,
        panelSessions: trackedSessions,
        panelVisible,
        expanded,
        setExpanded,
        dismissPanel,
        startSpySearch,
        refreshSessions,
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        markAllRead,
        markRead,
        pauseSession: async (id) => {
          await spyApi.pauseSession(id);
          await refreshSessions();
        },
        cancelSession: async (id) => {
          await spyApi.cancelSession(id);
          await refreshSessions();
        },
        resumeSession: async (id) => {
          await spyApi.resumeSession(id);
          await refreshSessions();
        },
      }}
    >
      {children}
    </SpyJobContext.Provider>
  );
}

export function useSpyJob() {
  const ctx = useContext(SpyJobContext);
  if (!ctx) throw new Error('useSpyJob must be used within SpyJobProvider');
  return ctx;
}
