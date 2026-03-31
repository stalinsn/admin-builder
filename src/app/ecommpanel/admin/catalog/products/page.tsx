import { redirect } from 'next/navigation';

import CatalogProductsManager from '@/features/ecommpanel/components/CatalogProductsManager';
import { canAccessCatalogWorkspace } from '@/features/catalog/server/permissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function CatalogProductsAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessCatalogWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à operação de produtos.</p>
        </article>
      </section>
    );
  }

  return <CatalogProductsManager />;
}
