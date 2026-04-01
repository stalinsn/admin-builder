import type { NextRequest } from 'next/server';

import { createEntityRecord, listEntityRecords } from '@/features/ecommpanel/server/dataEntityRecords';
import { buildEntityReadScope, buildEntityWriteScope } from '@/features/public-api/integration';
import { errorIntegration, jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ entitySlug: string }> }) {
  const { entitySlug } = await params;
  return withIntegrationAccess(req, {
    scope: 'data.records.read',
    scopes: [buildEntityReadScope(entitySlug)],
    handler: async () => {
      const limit = Number.parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
      const offset = Number.parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

      try {
        return jsonIntegration({
          ok: true,
          ...(await listEntityRecords(entitySlug, { limit, offset })),
        });
      } catch (error) {
        return errorIntegration(400, error instanceof Error ? error.message : 'Falha ao listar registros.');
      }
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ entitySlug: string }> }) {
  const { entitySlug } = await params;
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
          ...(await createEntityRecord(entitySlug, body.record)),
        });
      } catch (error) {
        return errorIntegration(400, error instanceof Error ? error.message : 'Falha ao criar registro.');
      }
    },
  });
}
