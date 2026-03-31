import { redirect } from 'next/navigation';
import StorefrontThemeManager from '@/features/ecommpanel/components/StorefrontThemeManager';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function SiteThemeAdminPage() {
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

  return <StorefrontThemeManager />;
}
