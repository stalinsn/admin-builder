import type { NextRequest } from 'next/server';

import {
  deleteDataEntity,
  deleteDataConnection,
  generateDataStudioBundle,
  getDataStudioSnapshot,
  importDataRows,
  importDataStudioBundle,
  inspectDataProvisioning,
  probeDataConnection,
  provisionDataConnection,
  saveDataConnection,
  saveDataEntity,
  updateDataBootstrapState,
} from '@/features/ecommpanel/server/dataStudioStore';
import { generateDataStudioBackup, restoreDataStudioBackup } from '@/features/ecommpanel/server/dataStudioBackup';
import { generateDataStudioContracts } from '@/features/ecommpanel/server/dataEntityContracts';
import {
  exportDatabaseTableCsv,
  importDatabaseTableCsv,
  listDatabaseTables,
} from '@/features/ecommpanel/server/dataTableCsvStore';
import {
  getApiAuthContext,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { addAuditEvent } from '@/features/ecommpanel/server/panelStore';

export const dynamic = 'force-dynamic';

function toObjectList(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];
  return input.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
}

function hasAnyDataPermission(permissions: string[]): boolean {
  return permissions.some((permission) => permission.startsWith('data.')) || permissions.includes('data.admin.manage');
}

function canReadData(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.read');
}

function canManageConnections(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.connection.manage');
}

function canManageBootstrap(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.bootstrap.manage');
}

function canManageEntities(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.entities.manage');
}

function canManageRecords(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.records.manage');
}

function canManageDatabaseTables(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage');
}

type DataStudioActionBody =
  | {
      action: 'saveEntity';
      entity?: {
        id?: string;
        slug?: string;
        label?: string;
        tableName?: string;
        description?: string;
        status?: 'draft' | 'ready';
        fields?: unknown[];
      };
    }
  | {
      action: 'deleteEntity';
      entityId?: string;
    }
  | {
      action: 'importRows';
      entityId?: string;
      sourceLabel?: string;
      rows?: unknown[];
    }
  | {
      action: 'importBundle';
      bundle?: {
        entities?: unknown;
        records?: Record<string, unknown[]>;
      };
    }
  | {
      action: 'generateBundle';
    }
  | {
      action: 'generateBackup';
    }
  | {
      action: 'restoreBackup';
      backup?: unknown;
    }
  | {
      action: 'saveConnection';
      connection?: {
        id?: string;
        label?: string;
        engine?: 'postgresql' | 'mysql';
        host?: string;
        port?: number;
        database?: string;
        username?: string;
        passwordReference?: string;
        appHostPattern?: string;
        sslMode?: 'disable' | 'prefer' | 'require';
        provisioningMethod?: 'manual' | 'ssh_postgres' | 'ssh_mysql';
        sshHost?: string;
        sshPort?: number;
        sshUsername?: string;
        adminDatabase?: string;
        adminUsername?: string;
        adminPasswordReference?: string;
        notes?: string;
        active?: boolean;
      };
    }
  | {
      action: 'deleteConnection';
      connectionId?: string;
    }
  | {
      action: 'probeConnection';
      connectionId?: string;
    }
  | {
      action: 'updateBootstrap';
      bootstrap?: {
        activeConnectionId?: string;
        credentialsVerified?: boolean;
        databaseProvisioned?: boolean;
        seedAdminProvisioned?: boolean;
        boilerplateProvisioned?: boolean;
        notes?: string;
      };
    }
  | {
      action: 'inspectProvisioning';
      connectionId?: string;
      secrets?: {
        sshPassword?: string;
        adminPassword?: string;
        mainAdminEmail?: string;
      };
    }
  | {
      action: 'provisionConnection';
      connectionId?: string;
      secrets?: {
        sshPassword?: string;
        adminPassword?: string;
        appPassword?: string;
        mainAdminName?: string;
        mainAdminEmail?: string;
        mainAdminPassword?: string;
      };
    }
  | {
      action: 'refreshDatabaseTables';
    }
  | {
      action: 'exportTableCsv';
      tableName?: string;
    }
  | {
      action: 'importTableCsv';
      tableName?: string;
      csvContent?: string;
      mode?: 'append' | 'upsert';
    };

async function requireAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasAnyDataPermission(auth.user.permissions) || !canReadData(auth.user.permissions)) {
    return { error: errorNoStore(403, 'Sem permissão para operar o módulo de dados.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireAccess(req);
  if ('error' in guard) return guard.error;

  const canUseDatabaseTables = canManageDatabaseTables(guard.auth.user.permissions);
  const databaseTables = canUseDatabaseTables ? await listDatabaseTables() : { available: false, tables: [] };

  return jsonNoStore({
    snapshot: getDataStudioSnapshot(),
    bundle: generateDataStudioBundle(),
    contracts: generateDataStudioContracts(getDataStudioSnapshot()),
    databaseTables: databaseTables.tables,
    databaseTablesAvailable: databaseTables.available,
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireAccess(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as DataStudioActionBody | null;
  if (!body?.action) {
    return errorNoStore(400, 'Ação inválida.');
  }

  try {
    switch (body.action) {
      case 'saveEntity': {
        if (!canManageEntities(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para criar ou alterar entidades.');
        }

        if (!body.entity?.slug || !body.entity?.label) {
          return errorNoStore(400, 'Slug e nome da entidade são obrigatórios.');
        }

        const snapshot = saveDataEntity({
          id: body.entity.id,
          slug: body.entity.slug,
          label: body.entity.label,
          tableName: body.entity.tableName,
          description: body.entity.description,
          status: body.entity.status,
          fields: toObjectList(body.entity.fields),
        });

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.entity.saved',
          outcome: 'success',
          target: body.entity.slug,
          details: {
            fields: Array.isArray(body.entity.fields) ? body.entity.fields.length : 0,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'deleteEntity': {
        if (!canManageEntities(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para remover entidades.');
        }

        if (!body.entityId) {
          return errorNoStore(400, 'Entidade é obrigatória para remoção.');
        }

        const snapshot = deleteDataEntity(body.entityId);
        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.entity.deleted',
          outcome: 'success',
          target: body.entityId,
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'importRows': {
        if (!canManageRecords(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para importar ou alterar registros.');
        }

        if (!body.entityId || !Array.isArray(body.rows)) {
          return errorNoStore(400, 'Entidade e registros são obrigatórios para importação.');
        }

        const snapshot = importDataRows({
          entityId: body.entityId,
          sourceLabel: body.sourceLabel,
          rows: toObjectList(body.rows),
        });

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.rows.imported',
          outcome: 'success',
          target: body.entityId,
          details: {
            rows: body.rows.length,
            source: body.sourceLabel || 'importacao-manual',
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'importBundle': {
        if (!canManageEntities(guard.auth.user.permissions) && !canManageRecords(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para importar pacotes de dados.');
        }

        if (!body.bundle) {
          return errorNoStore(400, 'Pacote de importação é obrigatório.');
        }

        const snapshot = importDataStudioBundle(body.bundle);
        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.bundle.imported',
          outcome: 'success',
          target: 'bundle',
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'generateBundle': {
        if (!canManageEntities(guard.auth.user.permissions) && !canManageBootstrap(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para gerar o pacote base.');
        }

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.bundle.generated',
          outcome: 'success',
          target: 'bundle',
        });

        return jsonNoStore({
          ok: true,
          snapshot: getDataStudioSnapshot(),
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(getDataStudioSnapshot()),
        });
      }

      case 'generateBackup': {
        if (!canManageEntities(guard.auth.user.permissions) && !canManageRecords(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para gerar backup do Data Studio.');
        }

        const snapshot = getDataStudioSnapshot();
        const backup = await generateDataStudioBackup();

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.backup.generated',
          outcome: 'success',
          target: 'backup',
          details: {
            entities: backup.entities.length,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
          backup,
        });
      }

      case 'restoreBackup': {
        if (!canManageEntities(guard.auth.user.permissions) || !canManageRecords(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para restaurar backup do Data Studio.');
        }

        if (!body.backup || typeof body.backup !== 'object') {
          return errorNoStore(400, 'Backup inválido.');
        }

        const snapshot = await restoreDataStudioBackup(body.backup);

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.backup.restored',
          outcome: 'success',
          target: 'backup',
          details: {
            entities: snapshot.entities.length,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'saveConnection': {
        if (!canManageConnections(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para cadastrar ou alterar conexões.');
        }

        if (!body.connection?.label || !body.connection.host || !body.connection.database || !body.connection.username) {
          return errorNoStore(400, 'Nome, host, banco e usuário são obrigatórios para a conexão.');
        }

        const snapshot = saveDataConnection({
          id: body.connection.id,
          label: body.connection.label,
          engine: body.connection.engine,
          host: body.connection.host,
          port: body.connection.port,
          database: body.connection.database,
          username: body.connection.username,
          passwordReference: body.connection.passwordReference,
          appHostPattern: body.connection.appHostPattern,
          sslMode: body.connection.sslMode,
          provisioningMethod: body.connection.provisioningMethod,
          sshHost: body.connection.sshHost,
          sshPort: body.connection.sshPort,
          sshUsername: body.connection.sshUsername,
          adminDatabase: body.connection.adminDatabase,
          adminUsername: body.connection.adminUsername,
          adminPasswordReference: body.connection.adminPasswordReference,
          notes: body.connection.notes,
          active: body.connection.active,
        });
        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.connection.saved',
          outcome: 'success',
          target: body.connection.label,
          details: {
            host: body.connection.host,
            database: body.connection.database,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'deleteConnection': {
        if (!canManageConnections(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para remover conexões.');
        }

        if (!body.connectionId) {
          return errorNoStore(400, 'Conexão é obrigatória para remoção.');
        }

        const snapshot = deleteDataConnection(body.connectionId);
        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.connection.deleted',
          outcome: 'success',
          target: body.connectionId,
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'probeConnection': {
        if (!canManageConnections(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para testar conexões.');
        }

        if (!body.connectionId) {
          return errorNoStore(400, 'Conexão é obrigatória para teste.');
        }

        const snapshot = await probeDataConnection(body.connectionId);
        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.connection.probed',
          outcome: 'success',
          target: body.connectionId,
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'inspectProvisioning': {
        if (!canManageConnections(guard.auth.user.permissions) && !canManageBootstrap(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para inspecionar o provisionamento.');
        }

        if (!body.connectionId) {
          return errorNoStore(400, 'Conexão é obrigatória para inspecionar a VPS.');
        }

        const snapshot = await inspectDataProvisioning(body.connectionId, {
          sshPassword: body.secrets?.sshPassword || '',
          adminPassword: body.secrets?.adminPassword || '',
          mainAdminEmail: body.secrets?.mainAdminEmail,
        });

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.provisioning.inspected',
          outcome: 'success',
          target: body.connectionId,
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'provisionConnection': {
        if (!canManageConnections(guard.auth.user.permissions) && !canManageBootstrap(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para provisionar a conexão.');
        }

        if (!body.connectionId) {
          return errorNoStore(400, 'Conexão é obrigatória para provisionar a VPS.');
        }

        if (
          !body.secrets?.sshPassword ||
          !body.secrets.appPassword ||
          !body.secrets.mainAdminName ||
          !body.secrets.mainAdminEmail ||
          !body.secrets.mainAdminPassword
        ) {
          return errorNoStore(400, 'SSH, senha do app e dados do main admin são obrigatórios.');
        }

        const snapshot = await provisionDataConnection(body.connectionId, {
          sshPassword: body.secrets.sshPassword,
          adminPassword: body.secrets.adminPassword,
          appPassword: body.secrets.appPassword,
          mainAdminName: body.secrets.mainAdminName,
          mainAdminEmail: body.secrets.mainAdminEmail,
          mainAdminPassword: body.secrets.mainAdminPassword,
        });

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.provisioning.executed',
          outcome: 'success',
          target: body.connectionId,
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(snapshot),
        });
      }

      case 'updateBootstrap': {
        if (!canManageBootstrap(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para alterar o estado de bootstrap.');
        }

        const snapshot = updateDataBootstrapState(body.bootstrap || {});
        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.bootstrap.updated',
          outcome: 'success',
          target: snapshot.bootstrap.activeConnectionId || 'bootstrap',
        });

        return jsonNoStore({
          ok: true,
          snapshot,
          bundle: generateDataStudioBundle(),
        });
      }

      case 'refreshDatabaseTables': {
        if (!canManageDatabaseTables(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para consultar a estrutura física da base.');
        }

        const databaseTables = await listDatabaseTables();

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.database-tables.refreshed',
          outcome: 'success',
          target: 'database-tables',
          details: {
            tables: databaseTables.tables.length,
            available: databaseTables.available,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot: getDataStudioSnapshot(),
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(getDataStudioSnapshot()),
          databaseTables: databaseTables.tables,
          databaseTablesAvailable: databaseTables.available,
        });
      }

      case 'exportTableCsv': {
        if (!canManageDatabaseTables(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para exportar tabelas da base.');
        }

        if (!body.tableName) {
          return errorNoStore(400, 'Tabela é obrigatória para exportação CSV.');
        }

        const csvExport = await exportDatabaseTableCsv(body.tableName);
        const databaseTables = await listDatabaseTables();

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.table.csv-exported',
          outcome: 'success',
          target: body.tableName,
          details: {
            rows: csvExport.rowCount,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot: getDataStudioSnapshot(),
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(getDataStudioSnapshot()),
          databaseTables: databaseTables.tables,
          databaseTablesAvailable: databaseTables.available,
          csvExport,
        });
      }

      case 'importTableCsv': {
        if (!canManageDatabaseTables(guard.auth.user.permissions)) {
          return errorNoStore(403, 'Sem permissão para importar CSV na base.');
        }

        if (!body.tableName || !body.csvContent?.trim()) {
          return errorNoStore(400, 'Tabela e conteúdo CSV são obrigatórios para importação.');
        }

        const csvImportResult = await importDatabaseTableCsv({
          tableName: body.tableName,
          csvContent: body.csvContent,
          mode: body.mode === 'upsert' ? 'upsert' : 'append',
        });
        const databaseTables = await listDatabaseTables();

        addAuditEvent({
          actorUserId: guard.auth.user.id,
          event: 'data-studio.table.csv-imported',
          outcome: 'success',
          target: body.tableName,
          details: {
            mode: csvImportResult.mode,
            processedRows: csvImportResult.processedRows,
            insertedRows: csvImportResult.insertedRows,
            updatedRows: csvImportResult.updatedRows,
          },
        });

        return jsonNoStore({
          ok: true,
          snapshot: getDataStudioSnapshot(),
          bundle: generateDataStudioBundle(),
          contracts: generateDataStudioContracts(getDataStudioSnapshot()),
          databaseTables: databaseTables.tables,
          databaseTablesAvailable: databaseTables.available,
          csvImportResult,
        });
      }

      default:
        return errorNoStore(400, 'Ação não suportada.');
    }
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao processar o módulo de dados.');
  }
}
