import type { NextRequest } from 'next/server';

import { issueApiAccessToken, logApiIntegrationRequest } from '@/features/ecommpanel/server/apiIntegrationStore';
import { getClientIp, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import { errorIntegration, jsonIntegration } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

type AuthTokenBody = {
  keyId?: unknown;
  secret?: unknown;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as AuthTokenBody | null;
  const keyId = typeof body?.keyId === 'string' ? body.keyId.trim() : req.headers.get('x-api-key')?.trim() || '';
  const secret = typeof body?.secret === 'string' ? body.secret.trim() : req.headers.get('x-api-secret')?.trim() || '';
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  if (!keyId || !secret) {
    await logApiIntegrationRequest({
      keyId: keyId || null,
      route: new URL(req.url).pathname,
      method: 'POST',
      statusCode: 400,
      authMode: 'key',
      ipHash: ip,
      userAgentHash: userAgent,
    });
    return errorIntegration(400, 'Informe keyId e secret para emitir o token.');
  }

  const token = await issueApiAccessToken({
    keyId,
    secret,
    ip,
    userAgent,
  });

  if (!token) {
    await logApiIntegrationRequest({
      keyId,
      route: new URL(req.url).pathname,
      method: 'POST',
      statusCode: 401,
      authMode: 'key',
      ipHash: ip,
      userAgentHash: userAgent,
    });
    return errorIntegration(401, 'Credenciais inválidas, expiradas ou sem permissão para emitir token.');
  }

  await logApiIntegrationRequest({
    clientId: token.client.id,
    keyId: token.client.keyId,
    route: new URL(req.url).pathname,
    method: 'POST',
    statusCode: 200,
    authMode: 'key',
    ipHash: ip,
    userAgentHash: userAgent,
  });

  return jsonIntegration({
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    client: {
      id: token.client.id,
      keyId: token.client.keyId,
      name: token.client.name,
      scopes: token.scopes,
    },
  });
}
