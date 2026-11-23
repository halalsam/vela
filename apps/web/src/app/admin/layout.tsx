import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { colors } from '@vela/tokens';
import { AdminShell } from '@/components/admin/AdminShell';
import '../globals.css';

export const metadata: Metadata = {
  title: 'vela admin',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: colors.canvas.DEFAULT,
  colorScheme: 'dark',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="flex min-h-dvh flex-col">
        <main className="flex-1">
          <AdminShell>{children}</AdminShell>
        </main>
      </body>
    </html>
  );
}
