import 'server-only';

import type { DataEntityDefinition, DataImportPayload, DataStudioBackup } from '@/features/ecommpanel/types/dataStudio';

import { listEntityRecords } from '@/features/ecommpanel/server/dataEntityRecords';
import { replaceEntityRecords, syncEntityPhysicalTable } from '@/features/ecommpanel/server/dataEntityRuntime';
import {
  getDataStudioSnapshotResolved,
  readImportRows,
  replaceDataStudioImportsByEntity,
  replaceDataStudioSnapshot,
} from '@/features/ecommpanel/server/dataStudioStore';

async function listAllEntityRecords(entity: DataEntityDefinition): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  let offset = 0;
  let total = 0;

  do {
    const listing = await listEntityRecords(entity.slug, { limit: 200, offset });
    total = listing.total;
    records.push(...listing.records);
    offset += listing.records.length;
    if (!listing.records.length) break;
  } while (offset < total);

  return records;
}

function normalizeBackup(input: unknown): DataStudioBackup {
  if (!input || typeof input !== 'object') {
    throw new Error('Backup inválido.');
  }

  const backup = input as Partial<DataStudioBackup>;
  if (!backup.snapshot || typeof backup.snapshot !== 'object') {
    throw new Error('Backup sem snapshot válido.');
  }

  return {
    version: Number.isFinite(backup.version) ? Number(backup.version) : 1,
    generatedAt: typeof backup.generatedAt === 'string' ? backup.generatedAt : new Date().toISOString(),
    recordsStatus: backup.recordsStatus === 'included' ? 'included' : 'unavailable',
    warnings:
      Array.isArray(backup.warnings)
        ? backup.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
        : [],
    snapshot: backup.snapshot,
    importsByEntity:
      backup.importsByEntity && typeof backup.importsByEntity === 'object'
        ? (backup.importsByEntity as Record<string, DataImportPayload[]>)
        : {},
    recordsByEntity:
      backup.recordsByEntity && typeof backup.recordsByEntity === 'object'
        ? (backup.recordsByEntity as Record<string, Record<string, unknown>[]>)
        : {},
  };
}

async function collectRecordsByEntity(
  entities: DataEntityDefinition[],
): Promise<Pick<DataStudioBackup, 'recordsByEntity' | 'recordsStatus' | 'warnings'>> {
  const recordsByEntity: Record<string, Record<string, unknown>[]> = {};
  const warnings: string[] = [];

  for (const entity of entities) {
    try {
      recordsByEntity[entity.slug] = await listAllEntityRecords(entity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao ler registros.';
      const loweredMessage = message.toLowerCase();

      if (
        loweredMessage.includes('banco indisponível') ||
        loweredMessage.includes('a tabela') ||
        loweredMessage.includes('não existe')
      ) {
        warnings.push(`Registros da entidade ${entity.slug} não puderam ser exportados: ${message}`);
        return {
          recordsByEntity: Object.fromEntries(entities.map((current) => [current.slug, []])),
          recordsStatus: 'unavailable',
          warnings,
        };
      }

      throw error;
    }
  }

  return {
    recordsByEntity,
    recordsStatus: 'included',
    warnings,
  };
}

export async function generateDataStudioBackup(): Promise<DataStudioBackup> {
  const snapshot = await getDataStudioSnapshotResolved();
  const importsByEntity: Record<string, DataImportPayload[]> = {};

  for (const entity of snapshot.entities) {
    importsByEntity[entity.slug] = readImportRows(entity.slug);
  }

  const recordsState = await collectRecordsByEntity(snapshot.entities);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    recordsStatus: recordsState.recordsStatus,
    warnings: recordsState.warnings,
    snapshot,
    importsByEntity,
    recordsByEntity: recordsState.recordsByEntity,
  };
}

export async function restoreDataStudioBackup(input: unknown): Promise<DataStudioBackup> {
  const backup = normalizeBackup(input);
  const restoredSnapshot = await replaceDataStudioSnapshot(backup.snapshot);
  await replaceDataStudioImportsByEntity(backup.importsByEntity);
  const warnings = [...(backup.warnings || [])];

  for (const entity of restoredSnapshot.entities) {
    const syncResult = await syncEntityPhysicalTable(entity);
    if (!syncResult.available) {
      warnings.push(`Entidade ${entity.slug} restaurada sem registros porque o banco não está disponível.`);
      continue;
    }
    await replaceEntityRecords(entity, backup.recordsByEntity[entity.slug] || []);
  }
  const generated = await generateDataStudioBackup();
  return {
    ...generated,
    warnings: [...(generated.warnings || []), ...warnings],
  };
}
