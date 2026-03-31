import Link from 'next/link';
import { redirect } from 'next/navigation';

import CatalogOverviewManager from '@/features/ecommpanel/components/CatalogOverviewManager';
import { canAccessCatalogWorkspace } from '@/features/catalog/server/permissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

const catalogModules = [
  {
    href: '/ecommpanel/admin/catalog/products',
    title: 'Produtos',
    description: 'Cadastro, preço, estoque, variações e publicação do sortimento.',
  },
  {
    href: '/ecommpanel/admin/catalog/taxonomy',
    title: 'Taxonomia',
    description: 'Categorias, coleções e estrutura comercial usada pelo catálogo.',
  },
  {
    href: '/ecommpanel/admin/catalog/media',
    title: 'Mídia',
    description: 'Biblioteca de imagens processadas para produto, conteúdo e campanhas.',
  },
  {
    href: '/ecommpanel/admin/settings/media',
    title: 'Política de imagem',
    description: 'Presets, compressão e limites de upload válidos para todo o sistema.',
  },
];

export default async function CatalogAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessCatalogWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à operação do catálogo.</p>
        </article>
      </section>
    );
  }

  return (
    <>
      <CatalogOverviewManager />
      <section className="panel-grid">
        <article className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Entradas do módulo</h2>
              <p className="panel-muted">Os atalhos abaixo continuam disponíveis como mapa rápido da área de catálogo.</p>
            </div>
          </div>
          <div className="panel-module-grid">
            {catalogModules.map((module) => (
              <Link key={module.href} href={module.href} className="panel-module-card">
                <strong>{module.title}</strong>
                <span>{module.description}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
