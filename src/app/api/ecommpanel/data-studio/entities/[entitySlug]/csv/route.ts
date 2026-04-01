import type { NextRequest } from 'next/server';

import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { exportEntityRecordsCsv, importEntityRecordsCsv } from '@/features/ecommpanel/server/dataEntityRecords';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { addAuditEvent } from '@/features/ecommpanel/server/panelStore';

export const dynamic = 'force-dynamic';

function canReadData(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.read');
}

function canWriteData(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.records.manage');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ entitySlug: string }> }) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para exportar registros.');
  }

  const { entitySlug } = await params;

  try {
    const csvExport = await exportEntityRecordsCsv(entitySlug);
    return jsonNoStore({ ok: true, csvExport });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao exportar CSV.');
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ entitySlug: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canWriteData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para importar registros.');
  }
  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as { csvContent?: string; mode?: 'append' | 'upsert' } | null;
  if (!body?.csvContent?.trim()) {
    return errorNoStore(400, 'Conteúdo CSV é obrigatório.');
  }

  const { entitySlug } = await params;

  try {
    const csvImportResult = await importEntityRecordsCsv(entitySlug, {
      csvContent: body.csvContent,
      mode: body.mode === 'upsert' ? 'upsert' : 'append',
    });
    addAuditEvent({
      actorUserId: auth.user.id,
      event: 'data-studio.record.csv-imported',
      outcome: 'success',
      target: entitySlug,
      details: {
        mode: csvImportResult.mode,
        processedRows: csvImportResult.processedRows,
      },
    });
    return jsonNoStore({ ok: true, csvImportResult });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao importar CSV.');
  }
}
