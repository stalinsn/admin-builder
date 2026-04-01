import 'server-only';

import type { NextRequest } from 'next/server';

import { getClientIp, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import {
  logApiIntegrationRequest,
  resolveApiAccessToken,
  type ApiClientRecord,
} from '@/features/ecommpanel/server/apiIntegrationStore';
import type { ApiIntegrationScope } from '@/features/public-api/integration';
import { errorPublic, jsonPublic } from '@/features/public-api/server';

const INTEGRATION_API_NO_STORE = 'no-store, max-age=0';

export type IntegrationAuthContext = {
  client: ApiClientRecord;
  scopes: ApiIntegrationScope[];
  ip: string;
  userAgent: string;
};

export function jsonIntegration<TData, TMeta = Record<string, unknown>>(
  data: TData,
  init?: {
    status?: number;
    generatedAt?: string;
    meta?: TMeta;
  },
) {
  return jsonPublic(data, {
    status: init?.status,
    generatedAt: init?.generatedAt,
    meta: init?.meta,
    cacheControl: INTEGRATION_API_NO_STORE,
  });
}

export function errorIntegration(status: number, message: string) {
  return errorPublic(status, message, INTEGRATION_API_NO_STORE);
}

async function logAttempt(req: NextRequest, input: {
  statusCode: number;
  scope?: ApiIntegrationScope;
  authMode: 'anonymous' | 'key' | 'token';
  clientId?: string | null;
  keyId?: string | null;
}) {
  await logApiIntegrationRequest({
    clientId: input.clientId,
    keyId: input.keyId,
    route: new URL(req.url).pathname,
    method: req.method.toUpperCase(),
    statusCode: input.statusCode,
    scope: input.scope,
    authMode: input.authMode,
    ipHash: getClientIp(req),
    userAgentHash: getUserAgent(req),
  });
}

export async function withIntegrationAccess(
  req: NextRequest,
  options: {
    scope?: ApiIntegrationScope;
    scopes?: ApiIntegrationScope[];
    handler: (context: IntegrationAuthContext) => Promise<Response>;
  },
): Promise<Response> {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const authHeader = req.headers.get('authorization')?.trim() || '';

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    await logAttempt(req, {
      statusCode: 401,
      scope: options.scope,
      authMode: 'anonymous',
    });
    return errorIntegration(401, 'Token bearer obrigatório.');
  }

  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) {
    await logAttempt(req, {
      statusCode: 401,
      scope: options.scope,
      authMode: 'token',
    });
    return errorIntegration(401, 'Token bearer inválido.');
  }

  const auth = await resolveApiAccessToken(accessToken);
  if (!auth) {
    await logAttempt(req, {
      statusCode: 401,
      scope: options.scope,
      authMode: 'token',
    });
    return errorIntegration(401, 'Token expirado, inválido ou revogado.');
  }

  const requiredScopes = [options.scope, ...(options.scopes || [])].filter(
    (scope): scope is ApiIntegrationScope => typeof scope === 'string' && scope.length > 0,
  );

  if (requiredScopes.length > 0 && !requiredScopes.some((scope) => auth.scopes.includes(scope))) {
    await logAttempt(req, {
      statusCode: 403,
      scope: requiredScopes[0],
      authMode: 'token',
      clientId: auth.client.id,
      keyId: auth.client.keyId,
    });
    return errorIntegration(403, 'Escopo insuficiente para acessar este recurso.');
  }

  try {
    const response = await options.handler({
      client: auth.client,
      scopes: auth.scopes,
      ip,
      userAgent,
    });

    response.headers.set('Cache-Control', INTEGRATION_API_NO_STORE);
    response.headers.set('X-App-Hub-Api-Client', auth.client.keyId);

    await logAttempt(req, {
      statusCode: response.status,
      scope: requiredScopes[0],
      authMode: 'token',
      clientId: auth.client.id,
      keyId: auth.client.keyId,
    });

    return response;
  } catch (error) {
    await logAttempt(req, {
      statusCode: 500,
      scope: requiredScopes[0],
      authMode: 'token',
      clientId: auth.client.id,
      keyId: auth.client.keyId,
    });
    throw error;
  }
}
