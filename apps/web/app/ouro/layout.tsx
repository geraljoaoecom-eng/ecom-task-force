'use client';

import AdminGuard from '../../components/AdminGuard';

export default function OuroLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
