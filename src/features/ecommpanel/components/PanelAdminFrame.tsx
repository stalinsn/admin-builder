'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import PanelAdminNav from '@/features/ecommpanel/components/PanelAdminNav';
import PanelLogoutButton from '@/features/ecommpanel/components/PanelLogoutButton';
import { safeJsonGet, safeJsonSet, withVersion } from '@/utils/safeStorage';

type PanelAdminFrameProps = {
  children: React.ReactNode;
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

type PanelShellUiState = {
  sidebarCollapsed: boolean;
};

const PANEL_SHELL_STORAGE_KEY = withVersion('ecommpanel.admin-shell.ui', 'v2');
const PANEL_THEME_STORAGE_KEY = withVersion('artmeta-panel.theme', 'v1');

const PANEL_ROUTE_TRAILS = [
  { prefix: '/ecommpanel/admin/data/dictionary', trail: ['Entidades & Dados', 'Dicionário interno'] },
  { prefix: '/ecommpanel/admin/records', trail: ['Entidades & Dados', 'Registros'] },
  { prefix: '/ecommpanel/admin/data', trail: ['Entidades & Dados', 'Modelagem'] },
  { prefix: '/ecommpanel/admin/game-endpoints', trail: ['Game Endpoints'] },
  { prefix: '/ecommpanel/admin/game-delivery', trail: ['Game Delivery'] },
  { prefix: '/ecommpanel/admin/users', trail: ['Usuários'] },
  { prefix: '/ecommpanel/admin/integrations', trail: ['API & Integrações'] },
  { prefix: '/ecommpanel/admin/settings/auth', trail: ['Configurações', 'Controle de Acesso'] },
  { prefix: '/ecommpanel/admin/settings/media', trail: ['Configurações', 'Mídia'] },
  { prefix: '/ecommpanel/admin/accounts/lgpd', trail: ['Contas', 'LGPD e dados'] },
  { prefix: '/ecommpanel/admin/accounts', trail: ['Contas'] },
  { prefix: '/ecommpanel/admin/analytics', trail: ['Analytics'] },
  { prefix: '/ecommpanel/admin/media', trail: ['Galeria de Mídia'] },
];

function resolvePanelTrail(pathname: string, view: string | null): string[] {
  if (pathname === '/ecommpanel/admin/integrations' || pathname.startsWith('/ecommpanel/admin/integrations/')) {
    switch (view) {
      case 'scopes':
        return ['API & Integrações', 'Escopos por entidade'];
      case 'reference':
        return ['API & Integrações', 'Referência'];
      case 'logs':
        return ['API & Integrações', 'Logs de acesso'];
      case 'keys':
      default:
        return ['API & Integrações', 'Chaves & tokens'];
    }
  }

  const match = PANEL_ROUTE_TRAILS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  return match?.trail || ['Dashboard'];
}

export default function PanelAdminFrame({
  children,
  userName,
  userEmail,
  canManageUsers,
  canReadAnalytics,
  canReadDataStudio,
  canReadCatalog,
  canReadOrders,
  canReadPanelSettings,
  canReadIntegrations,
}: PanelAdminFrameProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const trail = resolvePanelTrail(pathname, searchParams.get('view'));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1120px)');
    const state = safeJsonGet<PanelShellUiState>(PANEL_SHELL_STORAGE_KEY, {
      sidebarCollapsed: mediaQuery.matches,
    });
    const savedTheme = safeJsonGet<'dark' | 'light'>(PANEL_THEME_STORAGE_KEY, 'dark');
    setIsMobileViewport(mediaQuery.matches);
    setSidebarCollapsed(Boolean(state.sidebarCollapsed));
    setTheme(savedTheme === 'light' ? 'light' : 'dark');
    setUiReady(true);

    function syncViewport(event: MediaQueryListEvent) {
      setIsMobileViewport(event.matches);
      setSidebarCollapsed((current) => {
        if (event.matches) return true;
        return current;
      });
    }

    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!uiReady) return;
    safeJsonSet<PanelShellUiState>(PANEL_SHELL_STORAGE_KEY, { sidebarCollapsed });
  }, [sidebarCollapsed, uiReady]);

  useEffect(() => {
    if (!uiReady) return;
    safeJsonSet<'dark' | 'light'>(PANEL_THEME_STORAGE_KEY, theme);
  }, [theme, uiReady]);

  useEffect(() => {
    if (!isMobileViewport) return;
    setSidebarCollapsed(true);
  }, [pathname, isMobileViewport]);

  return (
    <div className="panel-admin-shell" data-panel-theme={theme}>
      <button
        type="button"
        className={`panel-nav-fab ${sidebarCollapsed ? '' : 'is-open'}`}
        onClick={() => setSidebarCollapsed((current) => !current)}
        aria-label={sidebarCollapsed ? 'Expandir menu principal' : 'Recolher menu principal'}
        title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-expanded={!sidebarCollapsed}
      >
        <span aria-hidden="true">{sidebarCollapsed ? '☰' : '✕'}</span>
      </button>

      {isMobileViewport && !sidebarCollapsed ? (
        <button
          type="button"
          className="panel-sidebar-backdrop"
          aria-label="Fechar menu principal"
          onClick={() => setSidebarCollapsed(true)}
        />
      ) : null}

      <div
        className={`panel-admin-grid ${sidebarCollapsed ? 'is-nav-collapsed' : ''} ${
          isMobileViewport && !sidebarCollapsed ? 'is-nav-open-mobile' : ''
        }`}
      >
        <aside className="panel-sidebar">
          <PanelAdminNav
            canManageUsers={canManageUsers}
            canReadAnalytics={canReadAnalytics}
            canReadDataStudio={canReadDataStudio}
            canReadCatalog={canReadCatalog}
            canReadOrders={canReadOrders}
            canReadPanelSettings={canReadPanelSettings}
            canReadIntegrations={canReadIntegrations}
            userName={userName}
            userEmail={userEmail}
          />
        </aside>
        <div className="panel-admin-content">
          <header className="panel-admin-header">
            <div className="panel-admin-breadcrumbs" aria-label="Trilha da página atual">
              {trail.map((label, index) => {
                const isLast = index === trail.length - 1;
                return (
                  <span key={`${label}-${index}`} className="panel-admin-breadcrumbs__item">
                    {index > 0 ? <span className="panel-admin-breadcrumbs__separator">›</span> : null}
                    {index === 0 && !isLast ? (
                      <Link href="/ecommpanel/admin" className="panel-admin-breadcrumbs__link">
                        {label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'panel-admin-breadcrumbs__current' : 'panel-admin-breadcrumbs__link'}>
                        {label}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="panel-admin-header__actions">
              <button
                type="button"
                className="panel-theme-toggle"
                aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
              </button>
              <PanelLogoutButton />
            </div>
          </header>
          <div className="panel-admin-content__scroll">
            <div className="panel-admin-content__body">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
