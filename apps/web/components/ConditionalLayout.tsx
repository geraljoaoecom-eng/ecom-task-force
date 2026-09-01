'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { BulkImportProvider } from '@/context/BulkImportContext';
import { SpyJobProvider } from '@/context/SpyJobContext';
import { BulkImportProgress } from './BulkImportProgress';
import { SpyProgress } from './SpyProgress';
import { NotificationBell } from './NotificationBell';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

function AppShell({ children, withSidebar }: { children: React.ReactNode; withSidebar: boolean }) {
  return (
    <>
      <NotificationBell />
      {withSidebar ? (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0c0f14' }}>
          <Sidebar />
          <main
            style={{
              flex: 1,
              padding: '1.5rem 1.25rem',
              paddingTop: '3.5rem',
              maxWidth: '1500px',
              marginLeft: 'auto',
              marginRight: 'auto',
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#0c0f14',
            }}
          >
            {children}
          </main>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', backgroundColor: '#0c0f14' }}>{children}</div>
      )}
      <BulkImportProgress />
      <SpyProgress />
    </>
  );
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const noSidebarPages = ['/', '/admin', '/landing', '/pricing', '/activate'];
  const shouldShowSidebar = !noSidebarPages.includes(pathname);

  return (
    <BulkImportProvider>
      <SpyJobProvider>
        <AppShell withSidebar={shouldShowSidebar}>{children}</AppShell>
      </SpyJobProvider>
    </BulkImportProvider>
  );
}
