'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type PanelAdminNavProps = {
  canManageUsers: boolean;
  canReadAnalytics: boolean;
  canReadDataStudio: boolean;
  canReadCatalog: boolean;
  canReadOrders: boolean;
  canReadPanelSettings: boolean;
  canReadIntegrations: boolean;
};

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
  match?: string[];
  tone?: 'default' | 'primary';
};

function PanelNavIcon({ children }: { children: ReactNode }) {
  return <span className="panel-nav-icon" aria-hidden="true">{children}</span>;
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="5" height="5" rx="1.5" />
      <rect x="12" y="3" width="5" height="8" rx="1.5" />
      <rect x="3" y="12" width="5" height="5" rx="1.5" />
      <rect x="12" y="14" width="5" height="3" rx="1.5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M7 8.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
      <path d="M13.25 9.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
      <path d="M2.75 16.25c0-2.3 1.9-4 4.25-4s4.25 1.7 4.25 4" />
      <path d="M10.5 15.75c.28-1.45 1.48-2.5 3.25-2.5 1.85 0 3.25 1.16 3.5 2.75" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 2.75 4.5 5v4.25c0 3.4 2.06 6.31 5.5 8 3.44-1.69 5.5-4.6 5.5-8V5L10 2.75Z" />
      <path d="m7.5 9.75 1.55 1.55 3.45-3.55" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="5.25" rx="5.75" ry="2.5" />
      <path d="M4.25 5.25v4.75c0 1.38 2.57 2.5 5.75 2.5s5.75-1.12 5.75-2.5V5.25" />
      <path d="M4.25 10v4.75c0 1.38 2.57 2.5 5.75 2.5s5.75-1.12 5.75-2.5V10" />
    </svg>
  );
}

function IconWorkflow() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 4.75h4v4H4z" />
      <path d="M12 11.25h4v4h-4z" />
      <path d="M8 6.75h2.5a2 2 0 0 1 2 2v2.5" />
      <path d="m11.5 10.25 1 1 1-1" />
    </svg>
  );
}

function IconPlug() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M7 3v5" />
      <path d="M13 3v5" />
      <path d="M6 8h8v1.5A4.5 4.5 0 0 1 9.5 14H8v3" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="m10 2.75 1.1 1.25 1.65-.1.65 1.5 1.55.55-.1 1.65L16.1 9 15 10l.85 1.4-.75 1.5-1.65.2-.7 1.5-1.65-.15L10 17.25l-1.1-1.25-1.65.1-.65-1.5-1.55-.55.1-1.65L3.9 11 5 10l-.85-1.4.75-1.5 1.65-.2.7-1.5 1.65.15L10 2.75Z" />
      <circle cx="10" cy="10" r="2.35" />
    </svg>
  );
}

function isPathActive(pathname: string, item: NavItem): boolean {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const possibilities = [item.href, ...(item.match || [])].map((entry) => entry.replace(/\/+$/, '') || '/');
  return possibilities.some((entry) => normalizedPath === entry || normalizedPath.startsWith(`${entry}/`));
}

export default function PanelAdminNav({
  canManageUsers,
  canReadAnalytics,
  canReadDataStudio,
  canReadCatalog,
  canReadOrders,
  canReadPanelSettings,
  canReadIntegrations,
}: PanelAdminNavProps) {
  const pathname = usePathname();

  const primaryItems: NavItem[] = [
    {
      id: 'dashboard',
      href: '/ecommpanel/admin',
      label: 'Dashboard',
      icon: (
        <PanelNavIcon>
          <IconDashboard />
        </PanelNavIcon>
      ),
    },
    ...(canManageUsers
      ? [
          {
            id: 'users',
            href: '/ecommpanel/admin/users',
            label: 'Usuários',
            icon: (
              <PanelNavIcon>
                <IconUsers />
              </PanelNavIcon>
            ),
          },
        ]
      : []),
    ...(canReadPanelSettings
      ? [
          {
            id: 'access',
            href: '/ecommpanel/admin/settings/auth',
            label: 'Controle de Acesso',
            icon: (
              <PanelNavIcon>
                <IconShield />
              </PanelNavIcon>
            ),
          },
        ]
      : []),
    ...(canReadDataStudio
      ? [
          {
            id: 'records',
            href: '/ecommpanel/admin/records',
            label: 'Entidades & Registros',
            icon: (
              <PanelNavIcon>
                <IconDatabase />
              </PanelNavIcon>
            ),
          },
          {
            id: 'operations',
            href: '/ecommpanel/admin/data',
            label: 'Dados & Estrutura',
            match: ['/ecommpanel/admin/data', '/ecommpanel/admin/data/dictionary'],
            icon: (
              <PanelNavIcon>
                <IconWorkflow />
              </PanelNavIcon>
            ),
            tone: 'primary' as const,
          },
        ]
      : []),
    ...((canReadIntegrations || canReadAnalytics)
      ? [
          {
            id: 'integrations',
            href: '/ecommpanel/admin/integrations',
            label: 'API & Integrações',
            icon: (
              <PanelNavIcon>
                <IconPlug />
              </PanelNavIcon>
            ),
          },
        ]
      : []),
  ];

  const footerItems: NavItem[] = [
    {
      id: 'settings',
      href: canReadPanelSettings ? '/ecommpanel/admin/settings/auth' : '/ecommpanel/admin',
      label: 'Configurações',
      icon: (
        <PanelNavIcon>
          <IconGear />
        </PanelNavIcon>
      ),
    },
  ];

  return (
    <nav className="panel-nav" aria-label="Menu administrativo">
      <div className="panel-nav-header">
        <div className="panel-nav-header__copy">
          <strong>Artmeta Panel</strong>
          <small>Admin Dashboard</small>
        </div>
      </div>

      <div className="panel-nav-links panel-nav-links--primary">
        {primaryItems.map((item) => {
          const active = isPathActive(pathname, item);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`panel-nav-link panel-nav-link--compact ${item.tone === 'primary' ? 'panel-nav-link--primary' : ''} ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span className="panel-nav-link-label">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="panel-nav-footer">
        {footerItems.map((item) => {
          const active = isPathActive(pathname, item);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`panel-nav-link panel-nav-link--compact ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span className="panel-nav-link-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
