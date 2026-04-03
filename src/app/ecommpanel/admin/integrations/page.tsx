import { redirect } from 'next/navigation';

import ApiIntegrationsManager from '@/features/ecommpanel/components/ApiIntegrationsManager';
import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import { listApiClients, listApiLogs } from '@/features/ecommpanel/server/apiIntegrationStore';
import { getDataStudioSnapshotResolved } from '@/features/ecommpanel/server/dataStudioStore';
import { getApiIntegrationScopeOptions, listReferenceByExposure } from '@/features/public-api/integration';

export default async function PanelIntegrationsPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  const canManage = hasPermission(user, 'integrations.manage') || hasPermission(user, 'api.keys.manage');
  if (!canManage) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso para administrar integrações e chaves de API.</p>
        </article>
      </section>
    );
  }

  const snapshot = await getDataStudioSnapshotResolved();

  return (
    <ApiIntegrationsManager
      initialClients={await listApiClients()}
      initialLogs={await listApiLogs(60)}
      referenceItems={listReferenceByExposure('integration', snapshot)}
      entityFieldsBySlug={Object.fromEntries(snapshot.entities.map((entity) => [entity.slug, entity.fields]))}
      availableScopes={getApiIntegrationScopeOptions(snapshot)}
      canManage={canManage}
    />
  );
}
