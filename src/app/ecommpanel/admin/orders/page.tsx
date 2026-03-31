import { redirect } from 'next/navigation';

import OrderOperationsManager from '@/features/ecommpanel/components/OrderOperationsManager';
import { canAccessOrderWorkspace } from '@/features/ecommerce/server/orderPermissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';

export default async function EcommPanelOrdersPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!canAccessOrderWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso à operação de pedidos.</p>
        </article>
      </section>
    );
  }

  return <OrderOperationsManager />;
}
