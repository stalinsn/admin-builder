import { redirect } from 'next/navigation';
import AdminUsersManager from '@/features/ecommpanel/components/AdminUsersManager';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function EcommPanelUsersPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!user.permissions.includes('users.manage')) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui a permissão `users.manage`.</p>
        </article>
      </section>
    );
  }

  return <AdminUsersManager />;
}
