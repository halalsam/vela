'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { PanelSkeleton } from '@/components/sections/Loading';
import { ButtonLink, Card, Container } from '@/components/ui';
import { adminConfigured, adminFetch, AdminError, type StaffRole } from '@/lib/adminApi';
import { authClient } from '@/lib/authClient';
import { cn, type } from '@/lib/type';

const RoleContext = createContext<StaffRole>('support');
export const useStaffRole = () => useContext(RoleContext);

type Access = { state: 'loading' } | { state: 'denied'; message: string } | { state: 'ready'; role: StaffRole };

const links = [
  { href: '/admin', label: 'Orders' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/blog', label: 'Blog' },
];

function Notice({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Container className="py-16">
      <Card className="flex max-w-lg flex-col items-start gap-4 p-section">
        <h1 className={type.displayMd}>{title}</h1>
        <p className={cn(type.callout, 'text-fg-secondary')}>{body}</p>
        {action}
      </Card>
    </Container>
  );
}

function AdminLoading() {
  return (
    <Container className="py-16">
      <PanelSkeleton />
    </Container>
  );
}

function Frame({ role, demo = false, children }: { role: StaffRole; demo?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleContext.Provider value={role}>
      <header className="border-b border-line">
        <Container className="flex h-16 items-center gap-6">
          <span className={type.title}>vela admin</span>
          <nav className="flex gap-1" aria-label="Admin">
            {links.map((link) => {
              const active = link.href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/orders') : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(type.calloutStrong, 'rounded-button px-4 py-2', active ? 'bg-surface-2 text-fg' : 'text-fg-secondary hover:text-fg')}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <span className={cn(type.caption, 'ms-auto text-fg-tertiary')}>{role}</span>
        </Container>
      </header>
      {demo ? (
        <div className="border-b border-line bg-accent-tint">
          <Container className={cn(type.caption, 'py-2 text-accent')}>Demo data. Nothing here is real, and changes reset when you reload.</Container>
        </div>
      ) : null}
      <Container className="flex flex-col gap-8 py-10">{children}</Container>
    </RoleContext.Provider>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const session = authClient?.useSession();
  const [access, setAccess] = useState<Access>({ state: 'loading' });
  const signedIn = Boolean(session?.data);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    adminFetch<{ role: StaffRole }>('/v1/admin/me').then(
      (me) => !cancelled && setAccess({ state: 'ready', role: me.role }),
      (error: unknown) =>
        !cancelled &&
        setAccess({ state: 'denied', message: error instanceof AdminError && error.status === 403 ? 'This account isn’t staff.' : 'Couldn’t reach the API.' }),
    );
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!adminConfigured || !authClient) {
    return (
      <Frame role="admin" demo>
        {children}
      </Frame>
    );
  }
  if (!session || session.isPending) return <AdminLoading />;
  if (!session.data) {
    return <Notice title="staff sign-in" body="Sign in with your staff account, then come back here." action={<ButtonLink href="/en/account">Sign in</ButtonLink>} />;
  }
  if (access.state === 'loading') return <AdminLoading />;
  if (access.state === 'denied') return <Notice title="no access" body={access.message} />;

  return (
    <Frame role={access.role}>{children}</Frame>
  );
}
