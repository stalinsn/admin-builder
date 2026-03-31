import { redirect } from 'next/navigation';

import PanelAuthSettingsManager from '@/features/ecommpanel/components/PanelAuthSettingsManager';
import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import {
  getPanelAuthSettingsDiagnosticsRuntime,
  getPanelAuthSettingsRuntime,
} from '@/features/ecommpanel/server/panelAuthSettingsStore';

export default async function PanelAuthSettingsAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  const canRead = hasPermission(user, 'store.settings.manage') || hasPermission(user, 'integrations.manage');
  if (!canRead) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui permissão para visualizar a configuração de auth e e-mail.</p>
        </article>
      </section>
    );
  }

  try {
    const settings = await getPanelAuthSettingsRuntime();
    const diagnostics = await getPanelAuthSettingsDiagnosticsRuntime(settings);

    return (
      <PanelAuthSettingsManager
        initialSettings={settings}
        initialDiagnostics={diagnostics}
        canManage={canRead}
      />
    );
  } catch (error) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Auth e e-mail indisponível</h1>
          <p className="panel-muted">{error instanceof Error ? error.message : 'Não foi possível carregar a configuração de auth e e-mail.'}</p>
        </article>
      </section>
    );
  }
}
