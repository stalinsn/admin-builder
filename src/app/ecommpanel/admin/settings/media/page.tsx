import { redirect } from 'next/navigation';

import PanelMediaSettingsManager from '@/features/ecommpanel/components/PanelMediaSettingsManager';
import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import {
  getPanelMediaSettingsDiagnostics,
  getPanelMediaSettingsRuntime,
} from '@/features/ecommpanel/server/panelMediaSettingsStore';

export default async function PanelMediaSettingsAdminPage() {
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
          <p className="panel-muted">Seu perfil atual não possui permissão para visualizar a configuração de mídia.</p>
        </article>
      </section>
    );
  }

  try {
    const settings = await getPanelMediaSettingsRuntime();
    const diagnostics = getPanelMediaSettingsDiagnostics(settings);

    return (
      <PanelMediaSettingsManager
        initialSettings={settings}
        initialDiagnostics={diagnostics}
        canManage={canRead}
      />
    );
  } catch (error) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Mídia e imagens indisponível</h1>
          <p className="panel-muted">{error instanceof Error ? error.message : 'Não foi possível carregar a configuração de mídia.'}</p>
        </article>
      </section>
    );
  }
}
