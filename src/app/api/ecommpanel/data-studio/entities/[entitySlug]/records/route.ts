import type { NextRequest } from 'next/server';

import {
  getApiAuthContext,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import {
  createEntityRecord,
  listEntityRecords,
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ entitySlug: string }> }) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para consultar registros.');
  }

  const { entitySlug } = await params;
  const limit = Number.parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
  const offset = Number.parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

  try {
    const result = await listEntityRecords(entitySlug, { limit, offset });
    return jsonNoStore({ ok: true, ...result });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao listar registros.');
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ entitySlug: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canWriteData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para criar registros.');
  }
  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as { record?: Record<string, unknown> } | null;
  if (!body?.record || typeof body.record !== 'object') {
    return errorNoStore(400, 'Registro inválido.');
  }

  const { entitySlug } = await params;

  try {
    const result = await createEntityRecord(entitySlug, body.record);
    addAuditEvent({
      actorUserId: auth.user.id,
      event: 'data-studio.record.created',
      outcome: 'success',
      target: `${entitySlug}:${String(result.record.id || '')}`,
      details: {
        entitySlug,
      },
    });
    return jsonNoStore({ ok: true, ...result });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha ao criar registro.');
  }
}
