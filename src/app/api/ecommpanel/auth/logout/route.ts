import type { NextRequest } from 'next/server';
import { clearAuthCookies, getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { addAuditEvent, deleteSession } from '@/features/ecommpanel/server/panelStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req, { touch: false });

  // Idempotent logout to simplify client behavior.
  if (!auth) {
    const response = jsonNoStore({ ok: true });
    clearAuthCookies(response);
    return response;
  }

  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  await deleteSession(auth.rawSessionId);
  addAuditEvent({
    actorUserId: auth.user.id,
    event: 'auth.logout',
    outcome: 'success',
    target: auth.user.email,
  });

  const response = jsonNoStore({ ok: true });
  clearAuthCookies(response);
  return response;
}
