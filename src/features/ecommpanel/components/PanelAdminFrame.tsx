'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PanelAdminNav from '@/features/ecommpanel/components/PanelAdminNav';
import { safeJsonGet, safeJsonSet, withVersion } from '@/utils/safeStorage';

type PanelAdminFrameProps = {
  children: React.ReactNode;
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

const PANEL_SHELL_STORAGE_KEY = withVersion('ecommpanel.admin-shell.ui', 'v1');

const PANEL_ROUTE_TRAILS = [
  { prefix: '/ecommpanel/admin/data/dictionary', trail: ['Painel', 'Dados & Estrutura', 'Dicionário interno'] },
  { prefix: '/ecommpanel/admin/records', trail: ['Painel', 'Entidades & Registros'] },
  { prefix: '/ecommpanel/admin/data', trail: ['Painel', 'Dados & Estrutura'] },
  { prefix: '/ecommpanel/admin/users', trail: ['Painel', 'Usuários'] },
  { prefix: '/ecommpanel/admin/integrations', trail: ['Painel', 'API & Integrações'] },
  { prefix: '/ecommpanel/admin/settings/auth', trail: ['Painel', 'Controle de Acesso'] },
  { prefix: '/ecommpanel/admin/accounts/lgpd', trail: ['Painel', 'Contas', 'LGPD e dados'] },
  { prefix: '/ecommpanel/admin/accounts', trail: ['Painel', 'Contas'] },
  { prefix: '/ecommpanel/admin/analytics', trail: ['Painel', 'Analytics'] },
  { prefix: '/ecommpanel/admin/media', trail: ['Painel', 'Mídia'] },
];

function resolvePanelTrail(pathname: string): string[] {
  const match = PANEL_ROUTE_TRAILS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  return match?.trail || ['Painel'];
}

export default function PanelAdminFrame({
  children,
  canManageUsers,
  canReadAnalytics,
  canReadDataStudio,
  canReadCatalog,
  canReadOrders,
  canReadPanelSettings,
  canReadIntegrations,
}: PanelAdminFrameProps) {
  const pathname = usePathname();
  const trail = resolvePanelTrail(pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [uiReady, setUiReady] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1120px)');
    const state = safeJsonGet<PanelShellUiState>(PANEL_SHELL_STORAGE_KEY, {
      sidebarCollapsed: mediaQuery.matches,
    });
    setIsMobileViewport(mediaQuery.matches);
    setSidebarCollapsed(Boolean(state.sidebarCollapsed));
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
    if (!isMobileViewport) return;
    setSidebarCollapsed(true);
  }, [pathname, isMobileViewport]);

  return (
    <div className="panel-admin-shell">
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
          />
        </aside>
        <div className="panel-admin-content">
          <div className="panel-admin-contextbar">
            <div className="panel-admin-breadcrumbs" aria-label="Trilha da página atual">
              {trail.map((label, index) => {
                const isLast = index === trail.length - 1;
                return (
                  <span key={`${label}-${index}`} className="panel-admin-breadcrumbs__item">
                    {index === 0 ? (
                      <Link href="/ecommpanel/admin" className="panel-admin-breadcrumbs__link">
                        {label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'panel-admin-breadcrumbs__current' : undefined}>{label}</span>
                    )}
                    {!isLast ? <span className="panel-admin-breadcrumbs__separator">/</span> : null}
                  </span>
                );
              })}
            </div>
            <span className="panel-admin-contextbar__path">{pathname}</span>
          </div>
          <div className="panel-admin-content__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
