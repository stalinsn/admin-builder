import type { NextRequest } from 'next/server';

import {
  getPanelAuthSettingsDiagnosticsRuntime,
  getPanelAuthSettingsRuntime,
  normalizePanelAuthSettings,
  updatePanelAuthSettingsRuntime,
} from '@/features/ecommpanel/server/panelAuthSettingsStore';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

type UpdatePanelAuthSettingsBody = {
  settings?: unknown;
};

async function requireReadAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };

  if (!hasPermission(auth.user, 'store.settings.manage') && !hasPermission(auth.user, 'integrations.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para visualizar as configurações de autenticação.') };
  }

  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireReadAccess(req);
  if ('error' in guard) return guard.error;

  try {
    const settings = await getPanelAuthSettingsRuntime();
    return jsonNoStore({
      settings,
      diagnostics: await getPanelAuthSettingsDiagnosticsRuntime(settings),
    });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar a configuração de auth e e-mail.');
  }
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireReadAccess(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as UpdatePanelAuthSettingsBody | null;
  if (!body?.settings) {
    return errorNoStore(400, 'Payload de configuração é obrigatório.');
  }

  try {
    const settings = await updatePanelAuthSettingsRuntime(normalizePanelAuthSettings(body.settings));
    return jsonNoStore({
      ok: true,
      settings,
      diagnostics: await getPanelAuthSettingsDiagnosticsRuntime(settings),
    });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível salvar a configuração de auth e e-mail.');
  }
}
