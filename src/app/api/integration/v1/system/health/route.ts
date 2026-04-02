import type { NextRequest } from 'next/server';

import { listApiClients } from '@/features/ecommpanel/server/apiIntegrationStore';
import { getAdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';
import { getDataStudioSnapshotResolved } from '@/features/ecommpanel/server/dataStudioStore';
import { listUsers } from '@/features/ecommpanel/server/panelStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'system.health.read',
    handler: async () => {
      const snapshot = await getDataStudioSnapshotResolved();
      const settings = getAdminBuilderSettings(snapshot);
      const users = await listUsers();
      const apiClients = await listApiClients();
      const primaryConnection =
        snapshot.connections.find((connection) => connection.id === snapshot.bootstrap.activeConnectionId) ||
        snapshot.connections[0] ||
        null;

      return jsonIntegration({
        status: 'ok',
        runtime: {
          app: 'admin-builder',
          baseUrl: process.env.PANEL_AUTH_BASE_URL?.trim() || null,
          database: {
            host: process.env.APP_DB_HOST?.trim() || '127.0.0.1',
            port: Number(process.env.APP_DB_PORT?.trim() || '5432'),
            name: process.env.APP_DB_NAME?.trim() || null,
            user: process.env.APP_DB_USER?.trim() || null,
          },
        },
        dataStudio: {
          entities: snapshot.entities.length,
          readyEntities: snapshot.entities.filter((entity) => entity.status === 'ready').length,
          connections: snapshot.connections.length,
          primaryConnection: primaryConnection
            ? {
                label: primaryConnection.label,
                database: primaryConnection.database,
                host: primaryConnection.host,
                port: primaryConnection.port,
              }
            : null,
        },
        accounts: {
          workspaceMode: settings.accountWorkspace.mode,
          workspaceEntitySlug: settings.accountWorkspace.entitySlug || null,
          panelUsers: users.length,
          activePanelUsers: users.filter((user) => user.active).length,
        },
        integrations: {
          clients: apiClients.length,
          activeClients: apiClients.filter((client) => client.active).length,
        },
      });
    },
  });
}
