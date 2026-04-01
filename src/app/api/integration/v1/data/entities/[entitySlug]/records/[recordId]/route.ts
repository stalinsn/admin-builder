import type { NextRequest } from 'next/server';

import { deleteEntityRecord, getEntityRecord, updateEntityRecord } from '@/features/ecommpanel/server/dataEntityRecords';
import { buildEntityReadScope, buildEntityWriteScope } from '@/features/public-api/integration';
import { errorIntegration, jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ entitySlug: string; recordId: string }> }) {
  const { entitySlug, recordId } = await params;
  return withIntegrationAccess(req, {
    scope: 'data.records.read',
    scopes: [buildEntityReadScope(entitySlug)],
    handler: async () => {
      try {
        return jsonIntegration({
          ok: true,
          ...(await getEntityRecord(entitySlug, recordId)),
        });
      } catch (error) {
        return errorIntegration(400, error instanceof Error ? error.message : 'Falha ao consultar registro.');
      }
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ entitySlug: string; recordId: string }> }) {
  const { entitySlug, recordId } = await params;
  return withIntegrationAccess(req, {
    scope: 'data.records.write',
    scopes: [buildEntityWriteScope(entitySlug)],
    handler: async () => {
      const body = (await req.json().catch(() => null)) as { record?: Record<string, unknown> } | null;
      if (!body?.record || typeof body.record !== 'object') {
        return errorIntegration(400, 'Registro inválido.');
      }
      try {
        return jsonIntegration({
          ok: true,
          ...(await updateEntityRecord(entitySlug, recordId, body.record)),
        });
      } catch (error) {
        return errorIntegration(400, error instanceof Error ? error.message : 'Falha ao atualizar registro.');
      }
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ entitySlug: string; recordId: string }> }) {
  const { entitySlug, recordId } = await params;
  return withIntegrationAccess(req, {
    scope: 'data.records.write',
    scopes: [buildEntityWriteScope(entitySlug)],
    handler: async () => {
      try {
        return jsonIntegration({
          ok: true,
          ...(await deleteEntityRecord(entitySlug, recordId)),
        });
      } catch (error) {
        return errorIntegration(400, error instanceof Error ? error.message : 'Falha ao remover registro.');
      }
    },
  });
}
