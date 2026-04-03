'use client';

import { useEffect, useState } from 'react';
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
    <div
      className={`panel-admin-grid ${sidebarCollapsed ? 'is-nav-collapsed' : ''} ${
        isMobileViewport && !sidebarCollapsed ? 'is-nav-open-mobile' : ''
      }`}
    >
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
      <div className="panel-admin-content">{children}</div>
    </div>
  );
}
