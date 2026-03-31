import { redirect } from 'next/navigation';

import CatalogTaxonomyManager from '@/features/ecommpanel/components/CatalogTaxonomyManager';
import { canAccessCatalogWorkspace } from '@/features/catalog/server/permissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function CatalogTaxonomyAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessCatalogWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à taxonomia do catálogo.</p>
        </article>
      </section>
    );
  }

  return <CatalogTaxonomyManager />;
}
