import { redirect } from 'next/navigation';

import CatalogMediaManager from '@/features/ecommpanel/components/CatalogMediaManager';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';
import { canReadPanelMedia } from '@/features/ecommpanel/server/panelMediaAccess';

export default async function ArtmetaPanelMediaPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canReadPanelMedia(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à biblioteca de mídia da plataforma.</p>
        </article>
      </section>
    );
  }

  return <CatalogMediaManager />;
}
