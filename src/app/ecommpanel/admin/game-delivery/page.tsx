import { redirect } from 'next/navigation';

import GameDeliveryManager from '@/features/ecommpanel/components/GameDeliveryManager';
import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import { getGameDeliveryBundle, getGameDeliverySettings } from '@/features/ecommpanel/server/gameDeliveryStore';

export default async function GameDeliveryPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  const canRead =
    hasPermission(user, 'data.read') ||
    hasPermission(user, 'data.admin.manage') ||
    hasPermission(user, 'integrations.manage') ||
    hasPermission(user, 'api.keys.manage');
  const canManage =
    hasPermission(user, 'data.admin.manage') ||
    hasPermission(user, 'integrations.manage') ||
    hasPermission(user, 'api.keys.manage');

  if (!canRead) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso para visualizar a camada de publicação do jogo.</p>
        </article>
      </section>
    );
  }

  return (
    <GameDeliveryManager
      initialSettings={getGameDeliverySettings()}
      initialBundle={await getGameDeliveryBundle()}
      canManage={canManage}
    />
  );
}
