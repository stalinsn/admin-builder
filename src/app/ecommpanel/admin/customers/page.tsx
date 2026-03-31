import { redirect } from 'next/navigation';

import CustomerOperationsManager from '@/features/ecommpanel/components/CustomerOperationsManager';
import { canAccessCustomerWorkspace } from '@/features/ecommerce/server/orderPermissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function EcommPanelCustomersPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessCustomerWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à operação de clientes.</p>
        </article>
      </section>
    );
  }

  return <CustomerOperationsManager />;
}
