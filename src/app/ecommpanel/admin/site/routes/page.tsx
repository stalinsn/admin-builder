import { redirect } from 'next/navigation';
import SiteRoutesManager from '@/features/ecommpanel/components/SiteRoutesManager';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function SiteRoutesAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!user.permissions.includes('site.content.manage')) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui a permissão `site.content.manage`.</p>
        </article>
      </section>
    );
  }

  return <SiteRoutesManager />;
}
