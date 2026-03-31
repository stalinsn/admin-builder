import type { NextRequest } from 'next/server';

import {
  getApiAuthContext,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import {
  deleteEntityRecord,
  getEntityRecord,
  updateEntityRecord,
} from '@/features/ecommpanel/server/dataEntityRecords';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { addAuditEvent } from '@/features/ecommpanel/server/panelStore';

export const dynamic = 'force-dynamic';

function canReadData(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.read');
}

function canWriteData(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.records.manage');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entitySlug: string; recordId: string }> },
) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para consultar registros.');
  }

  const { entitySlug, recordId } = await params;

  try {
    const result = await getEntityRecord(entitySlug, recordId);
    return jsonNoStore({ ok: true, ...result });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao consultar registro.');
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entitySlug: string; recordId: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canWriteData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para atualizar registros.');
  }
  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as { record?: Record<string, unknown> } | null;
  if (!body?.record || typeof body.record !== 'object') {
    return errorNoStore(400, 'Registro inválido.');
  }

  const { entitySlug, recordId } = await params;

  try {
    const result = await updateEntityRecord(entitySlug, recordId, body.record);
    addAuditEvent({
      actorUserId: auth.user.id,
      event: 'data-studio.record.updated',
      outcome: 'success',
      target: `${entitySlug}:${recordId}`,
      details: {
        entitySlug,
      },
    });
    return jsonNoStore({ ok: true, ...result });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao atualizar registro.');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entitySlug: string; recordId: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canWriteData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para remover registros.');
  }
  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { entitySlug, recordId } = await params;

  try {
    const result = await deleteEntityRecord(entitySlug, recordId);
    addAuditEvent({
      actorUserId: auth.user.id,
      event: 'data-studio.record.deleted',
      outcome: 'success',
      target: `${entitySlug}:${recordId}`,
      details: {
        entitySlug,
      },
    });
    return jsonNoStore({ ok: true, ...result });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao remover registro.');
  }
}
