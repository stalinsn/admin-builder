'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

type PanelAdminNavProps = {
  userName: string;
  userEmail: string;
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
  tone?: 'default' | 'primary';
  children?: NavItem[];
};

type SectionId = 'dashboard' | 'users' | 'access' | 'data' | 'media' | 'integrations' | 'game-endpoints' | 'game-delivery' | 'settings';
type DataSectionId =
  | 'data-modeling'
  | 'data-connections'
  | 'data-bootstrap'
  | 'data-records'
  | 'data-import'
  | 'data-csv'
  | 'data-bundle'
  | 'data-dictionary';
type IntegrationSectionId = 'integrations-keys' | 'integrations-scopes' | 'integrations-reference' | 'integrations-logs';

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

function IconPlug() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M7 3v5" />
      <path d="M13 3v5" />
      <path d="M6 8h8v1.5A4.5 4.5 0 0 1 9.5 14H8v3" />
    </svg>
  );
}

function IconTopology() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="2.75" y="3" width="4.5" height="4.5" rx="1.25" />
      <rect x="12.75" y="3" width="4.5" height="4.5" rx="1.25" />
      <rect x="7.75" y="12.5" width="4.5" height="4.5" rx="1.25" />
      <path d="M7.25 5.25h5.5" />
      <path d="M10 7.5v5" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <circle cx="7.5" cy="8" r="1.25" />
      <path d="m5.5 13 3.2-3.2a1.5 1.5 0 0 1 2.12 0L14.5 13" />
      <path d="m11.75 11.25 1.15-1.15a1.5 1.5 0 0 1 2.1 0L16.25 11.35" />
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

function IconChevron() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="m7.5 5.75 5 4.25-5 4.25" />
    </svg>
  );
}

function resolveSection(pathname: string): SectionId | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/ecommpanel/admin') return 'dashboard';
  if (normalizedPath === '/ecommpanel/admin/users' || normalizedPath.startsWith('/ecommpanel/admin/users/')) return 'users';
  if (normalizedPath === '/ecommpanel/admin/settings/auth' || normalizedPath.startsWith('/ecommpanel/admin/settings/auth/')) return 'access';
  if (normalizedPath === '/ecommpanel/admin/media' || normalizedPath.startsWith('/ecommpanel/admin/media/')) return 'media';
  if (
    normalizedPath === '/ecommpanel/admin/data' ||
    normalizedPath.startsWith('/ecommpanel/admin/data/') ||
    normalizedPath === '/ecommpanel/admin/records' ||
    normalizedPath.startsWith('/ecommpanel/admin/records/')
  ) {
    return 'data';
  }
  if (normalizedPath === '/ecommpanel/admin/integrations' || normalizedPath.startsWith('/ecommpanel/admin/integrations/')) return 'integrations';
  if (normalizedPath === '/ecommpanel/admin/game-endpoints' || normalizedPath.startsWith('/ecommpanel/admin/game-endpoints/')) return 'game-endpoints';
  if (normalizedPath === '/ecommpanel/admin/game-delivery' || normalizedPath.startsWith('/ecommpanel/admin/game-delivery/')) return 'game-delivery';
  if (normalizedPath === '/ecommpanel/admin/settings/media' || normalizedPath.startsWith('/ecommpanel/admin/settings/media/')) return 'settings';
  return null;
}

function resolveDataSection(pathname: string, module: string | null): DataSectionId {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/ecommpanel/admin/records' || normalizedPath.startsWith('/ecommpanel/admin/records/')) return 'data-records';
  if (normalizedPath === '/ecommpanel/admin/data/dictionary' || normalizedPath.startsWith('/ecommpanel/admin/data/dictionary/')) return 'data-dictionary';

  switch (module) {
    case 'connections':
      return 'data-connections';
    case 'bootstrap':
      return 'data-bootstrap';
    case 'import':
      return 'data-import';
    case 'csv':
      return 'data-csv';
    case 'bundle':
      return 'data-bundle';
    case 'modeling':
    default:
      return 'data-modeling';
  }
}

function resolveIntegrationSection(view: string | null): IntegrationSectionId {
  switch (view) {
    case 'scopes':
      return 'integrations-scopes';
    case 'reference':
      return 'integrations-reference';
    case 'logs':
      return 'integrations-logs';
    case 'keys':
    default:
      return 'integrations-keys';
  }
}

export default function PanelAdminNav({
  userName,
  userEmail,
  canManageUsers,
  canReadAnalytics,
  canReadDataStudio,
  canReadCatalog,
  canReadOrders,
  canReadPanelSettings,
  canReadIntegrations,
}: PanelAdminNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = resolveSection(pathname);
  const activeDataSection = resolveDataSection(pathname, searchParams.get('module'));
  const activeIntegrationSection = resolveIntegrationSection(searchParams.get('view'));
  const canReadMedia = canReadPanelSettings;

  const primaryItems: NavItem[] = [
    {
      id: 'dashboard',
      href: '/ecommpanel/admin',
      label: 'Dashboard',
      icon: <PanelNavIcon><IconDashboard /></PanelNavIcon>,
    },
    ...(canManageUsers
      ? [{
          id: 'users',
          href: '/ecommpanel/admin/users',
          label: 'Usuários',
          icon: <PanelNavIcon><IconUsers /></PanelNavIcon>,
        }]
      : []),
    ...(canReadPanelSettings
      ? [{
          id: 'access',
          href: '/ecommpanel/admin/settings/auth',
          label: 'Controle de acesso',
          icon: <PanelNavIcon><IconShield /></PanelNavIcon>,
        }]
      : []),
    ...(canReadDataStudio
      ? [{
          id: 'data',
          href: '/ecommpanel/admin/data',
          label: 'Entidades & Dados',
          tone: 'primary' as const,
          icon: <PanelNavIcon><IconDatabase /></PanelNavIcon>,
          children: [
            { id: 'data-modeling', href: '/ecommpanel/admin/data?module=modeling', label: 'Modelagem', icon: null },
            { id: 'data-connections', href: '/ecommpanel/admin/data?module=connections', label: 'Conexões', icon: null },
            { id: 'data-bootstrap', href: '/ecommpanel/admin/data?module=bootstrap', label: 'Implantação', icon: null },
            { id: 'data-records', href: '/ecommpanel/admin/records', label: 'Registros', icon: null },
            { id: 'data-import', href: '/ecommpanel/admin/data?module=import', label: 'Importação', icon: null },
            { id: 'data-csv', href: '/ecommpanel/admin/data?module=csv', label: 'CSV', icon: null },
            { id: 'data-bundle', href: '/ecommpanel/admin/data?module=bundle', label: 'Pacote Base', icon: null },
            { id: 'data-dictionary', href: '/ecommpanel/admin/data/dictionary', label: 'Dicionário', icon: null },
          ],
        }]
      : []),
    ...(canReadMedia
      ? [{
          id: 'media',
          href: '/ecommpanel/admin/media',
          label: 'Galeria de Mídia',
          icon: <PanelNavIcon><IconImage /></PanelNavIcon>,
        }]
      : []),
    ...((canReadIntegrations || canReadAnalytics)
      ? [{
          id: 'integrations',
          href: '/ecommpanel/admin/integrations',
          label: 'API & Integrações',
          icon: <PanelNavIcon><IconPlug /></PanelNavIcon>,
          children: [
            { id: 'integrations-keys', href: '/ecommpanel/admin/integrations?view=keys', label: 'Chaves & Tokens', icon: null },
            { id: 'integrations-scopes', href: '/ecommpanel/admin/integrations?view=scopes', label: 'Escopos por Entidade', icon: null },
            { id: 'integrations-reference', href: '/ecommpanel/admin/integrations?view=reference', label: 'Referência', icon: null },
            { id: 'integrations-logs', href: '/ecommpanel/admin/integrations?view=logs', label: 'Logs de Acesso', icon: null },
          ],
        }]
      : []),
    ...((canReadDataStudio || canReadIntegrations)
      ? [{
          id: 'game-endpoints',
          href: '/ecommpanel/admin/game-endpoints',
          label: 'Game Endpoints',
          icon: <PanelNavIcon><IconTopology /></PanelNavIcon>,
        }]
      : []),
    ...((canReadDataStudio || canReadIntegrations)
      ? [{
          id: 'game-delivery',
          href: '/ecommpanel/admin/game-delivery',
          label: 'Game Delivery',
          icon: <PanelNavIcon><IconTopology /></PanelNavIcon>,
        }]
      : []),
    ...(canReadPanelSettings
      ? [{
          id: 'settings',
          href: '/ecommpanel/admin/settings/media',
          label: 'Configurações',
          icon: <PanelNavIcon><IconGear /></PanelNavIcon>,
        }]
      : []),
  ];

  void canReadCatalog;
  void canReadOrders;

  return (
    <nav className="panel-nav" aria-label="Menu administrativo">
      <div className="panel-nav-header">
        <div className="panel-nav-brandmark" aria-hidden="true">A</div>
        <div className="panel-nav-header__copy">
          <strong>Artmeta Panel</strong>
          <small>Admin Dashboard</small>
        </div>
      </div>

      <div className="panel-nav-links panel-nav-links--primary">
        {primaryItems.map((item) => {
          const active = item.id === activeSection;
          if (item.children?.length) {
            return (
              <details key={item.id} className="panel-nav-branch panel-nav-branch--compact" open={active}>
                <summary
                  className={`panel-nav-link panel-nav-link--compact panel-nav-link--branch ${item.tone === 'primary' ? 'panel-nav-link--primary' : ''} ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="panel-nav-link-branch-main">
                    {item.icon}
                    <span className="panel-nav-link-copy">
                      <span className="panel-nav-link-label">{item.label}</span>
                    </span>
                  </span>
                  <span className="panel-nav-link-meta">
                    <span className="panel-nav-link-chevron" aria-hidden="true">
                      <IconChevron />
                    </span>
                  </span>
                </summary>
                <div className="panel-nav-submenu">
                  <p className="panel-nav-submenu__eyebrow">{item.id === 'integrations' ? 'Superfícies da API' : 'Fluxos do módulo'}</p>
                  <div className="panel-nav-children panel-nav-children--compact">
                  {item.children.map((child) => {
                    const childActive =
                      item.id === 'data'
                        ? child.id === activeDataSection
                        : item.id === 'integrations'
                          ? child.id === activeIntegrationSection
                          : false;
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={`panel-nav-link panel-nav-link--compact panel-nav-link--nested ${childActive ? 'is-active' : ''}`}
                        aria-current={childActive ? 'page' : undefined}
                      >
                        <span className="panel-nav-link-copy">
                          <span className="panel-nav-link-label">{child.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                  </div>
                </div>
              </details>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`panel-nav-link panel-nav-link--compact ${item.tone === 'primary' ? 'panel-nav-link--primary' : ''} ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span className="panel-nav-link-copy">
                <span className="panel-nav-link-label">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="panel-nav-footer">
        <div className="panel-nav-usercard">
          <div className="panel-nav-usercard__avatar" aria-hidden="true">
            {userName.trim().charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="panel-nav-usercard__copy">
            <strong>{userName}</strong>
            <small>{userEmail}</small>
          </div>
        </div>
      </div>
    </nav>
  );
}
