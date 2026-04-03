import { redirect } from 'next/navigation';

import GameEndpointsCanvas from '@/features/ecommpanel/components/GameEndpointsCanvas';
import { getPanelUserFromCookies, hasPermission } from '@/features/ecommpanel/server/auth';
import { getDataStudioSnapshotResolved } from '@/features/ecommpanel/server/dataStudioStore';
import { buildGameEndpointsMap } from '@/features/ecommpanel/server/gameEndpointsMap';

export default async function GameEndpointsPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  const canRead = hasPermission(user, 'data.read') || hasPermission(user, 'data.admin.manage') || hasPermission(user, 'integrations.manage') || hasPermission(user, 'api.keys.manage');

  if (!canRead) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso para visualizar o mapa de endpoints do jogo.</p>
        </article>
      </section>
    );
  }

  const snapshot = await getDataStudioSnapshotResolved();

  return <GameEndpointsCanvas data={buildGameEndpointsMap(snapshot)} />;
}
