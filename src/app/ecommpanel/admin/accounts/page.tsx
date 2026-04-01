import { redirect } from 'next/navigation';

import AccountWorkspaceManager from '@/features/ecommpanel/components/AccountWorkspaceManager';
import { getAdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';
import { canAccessCustomerWorkspace } from '@/features/ecommerce/server/orderPermissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';
import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';

export default async function ArtmetaPanelAccountsPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessCustomerWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à área de contas do sistema.</p>
        </article>
      </section>
    );
  }

  const snapshot = getDataStudioSnapshot();

  return <AccountWorkspaceManager initialSettings={getAdminBuilderSettings(snapshot)} entities={snapshot.entities} />;
}
