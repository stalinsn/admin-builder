import { NextRequest, NextResponse } from 'next/server';

import { getApiAuthContext, hasPermission } from '@/features/ecommpanel/server/auth';
import { getGameDeliveryBundle, getGameDeliverySettings, publishGameDelivery, updateGameDeliverySettings } from '@/features/ecommpanel/server/gameDeliveryStore';

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req, { touch: false });

  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const canRead =
    hasPermission(auth.user, 'data.read') ||
    hasPermission(auth.user, 'data.admin.manage') ||
    hasPermission(auth.user, 'integrations.manage') ||
    hasPermission(auth.user, 'api.keys.manage');

  if (!canRead) {
    return NextResponse.json({ error: 'Sem permissão para visualizar a publicação do jogo.' }, { status: 403 });
  }

  const settings = getGameDeliverySettings();
  const bundle = await getGameDeliveryBundle();
  return NextResponse.json({ settings, bundle });
}

export async function POST(req: NextRequest) {
  const auth = await getApiAuthContext(req);

  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const canManage =
    hasPermission(auth.user, 'data.admin.manage') ||
    hasPermission(auth.user, 'integrations.manage') ||
    hasPermission(auth.user, 'api.keys.manage');

  if (!canManage) {
    return NextResponse.json({ error: 'Sem permissão para alterar a publicação do jogo.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        action?: 'save' | 'publish';
        settings?: unknown;
      }
    | null;

  try {
    if (body?.action === 'publish') {
      const result = await publishGameDelivery(body.settings);
      return NextResponse.json(result);
    }

    const settings = updateGameDeliverySettings(body?.settings || {});
    const bundle = await getGameDeliveryBundle();
    return NextResponse.json({ settings, bundle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao atualizar a publicação do jogo.' },
      { status: 400 },
    );
  }
}
