'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useSpyJob } from '@/context/SpyJobContext';

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } = useSpyJob();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const user = localStorage.getItem('user');
      if (user) setIsAdmin(JSON.parse(user).role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  if (!isAdmin) return null;

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1.25rem', zIndex: 9997 }}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount) markAllRead();
        }}
        style={{
          position: 'relative',
          background: '#141823',
          border: '1px solid rgba(245,210,108,0.25)',
          borderRadius: '0.5rem',
          padding: '0.5rem',
          cursor: 'pointer',
          color: '#F5D26C',
        }}
        title="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              borderRadius: '999px',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 0.5rem)',
            width: 'min(320px, calc(100vw - 2rem))',
            background: '#141823',
            border: '1px solid rgba(245,210,108,0.25)',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxHeight: '360px',
            overflowY: 'auto',
          }}
        >
          {notifications.length === 0 ? (
            <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>Sem notificações</div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid rgba(245,210,108,0.08)',
                  background: n.read ? 'transparent' : 'rgba(96,165,250,0.06)',
                }}
                onClick={() => markRead(n.id)}
              >
                <div style={{ color: '#E8EDF2', fontWeight: 600, fontSize: '0.8125rem' }}>{n.title}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>{n.message}</div>
                {n.sessionId && (
                  <Link
                    href={`/spy/${n.sessionId}`}
                    onClick={() => setOpen(false)}
                    style={{ color: '#60a5fa', fontSize: '0.75rem', marginTop: '0.375rem', display: 'inline-block' }}
                  >
                    Abrir pesquisa →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
