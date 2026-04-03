import { redirect } from 'next/navigation';

import DataStudioManager from '@/features/ecommpanel/components/DataStudioManager';
import { getAdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';
import {
  generateDataStudioBundleResolved,
  getDataStudioRuntimeResolved,
  getDataStudioSnapshotResolved,
} from '@/features/ecommpanel/server/dataStudioStore';
import { listDatabaseTables } from '@/features/ecommpanel/server/dataTableCsvStore';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

function hasDataPermission(permissions: string[], permission: string): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes(permission);
}

export default async function EcommPanelDataStudioPage() {
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

  const canManageDatabaseTables = hasDataPermission(user.permissions, 'data.admin.manage');
  const databaseTables = canManageDatabaseTables ? await listDatabaseTables() : { available: false, tables: [] };
  const snapshot = await getDataStudioSnapshotResolved();
  const runtime = await getDataStudioRuntimeResolved(snapshot);
  const settings = getAdminBuilderSettings(snapshot);

  return (
    <DataStudioManager
      initialSettings={settings}
      initialSnapshot={snapshot}
      initialRuntime={runtime}
      initialBundle={await generateDataStudioBundleResolved(snapshot)}
      canManageConnections={hasDataPermission(user.permissions, 'data.connection.manage')}
      canManageBootstrap={hasDataPermission(user.permissions, 'data.bootstrap.manage')}
      canManageEntities={hasDataPermission(user.permissions, 'data.entities.manage')}
      canManageRecords={hasDataPermission(user.permissions, 'data.records.manage')}
      canManageDatabaseTables={canManageDatabaseTables}
      initialDatabaseTables={databaseTables.tables}
      initialDatabaseTablesAvailable={databaseTables.available}
    />
  );
}
