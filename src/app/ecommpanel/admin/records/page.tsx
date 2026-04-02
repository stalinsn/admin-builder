import { redirect } from 'next/navigation';

import DataEntityRecordsWorkspace from '@/features/ecommpanel/components/DataEntityRecordsWorkspace';
import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';
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
      <PanelPageHeader
        eyebrow="Registros"
        title="Entidades & Registros"
        titleId="records-workspace-title"
        description="Escolha a entidade ativa, visualize os registros em tabela e edite tudo em um fluxo compacto com modal."
      />

      <DataEntityRecordsWorkspace
        entities={snapshot.entities}
        canManageRecords={hasDataPermission(user.permissions, 'data.records.manage')}
      />
    </section>
  );
}
