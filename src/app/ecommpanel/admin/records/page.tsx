import { redirect } from 'next/navigation';

import DataEntityRecordsWorkspace from '@/features/ecommpanel/components/DataEntityRecordsWorkspace';
import { getDataStudioSnapshotResolved } from '@/features/ecommpanel/server/dataStudioStore';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

function hasDataPermission(permissions: string[], permission: string): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes(permission);
}

export default async function ArtmetaPanelRecordsPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!hasDataPermission(user.permissions, 'data.read')) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui a permissão `data.read`.</p>
        </article>
      </section>
    );
  }

  const snapshot = await getDataStudioSnapshotResolved();

  return (
    <section className="panel-grid" aria-labelledby="records-workspace-title">
      <article className="panel-card panel-page-intro">
        <div className="panel-page-intro__copy">
          <h1 id="records-workspace-title">Entidades & Registros</h1>
          <p className="panel-muted">
            Escolha a entidade ativa, visualize os registros em tabela e edite tudo em um fluxo compacto com modal.
          </p>
        </div>
      </article>

      <DataEntityRecordsWorkspace
        entities={snapshot.entities}
        canManageRecords={hasDataPermission(user.permissions, 'data.records.manage')}
      />
    </section>
  );
}
