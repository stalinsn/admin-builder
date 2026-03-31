import { redirect } from 'next/navigation';
import StorefrontTemplateManager from '@/features/ecommpanel/components/StorefrontTemplateManager';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function SiteTemplateHeaderAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!user.permissions.includes('site.layout.manage')) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui a permissão `site.layout.manage`.</p>
        </article>
      </section>
    );
  }

  return <StorefrontTemplateManager scope="header" />;
}
