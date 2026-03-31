import { redirect } from 'next/navigation';

import CustomerLgpdManager from '@/features/ecommpanel/components/CustomerLgpdManager';
import {
  canAccessCustomerWorkspace,
  canApproveCustomerLgpd,
  canExecuteCustomerLgpd,
  canManageCustomerRetention,
  canRequestCustomerLgpd,
} from '@/features/ecommerce/server/orderPermissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';
import { listCustomerAccountsAdmin, listCustomerLgpdRequestsAdmin, listCustomerRetentionPoliciesAdmin } from '@/features/ecommerce/server/customerAccountStore';

export default async function CustomerLgpdPage() {
  const user = await getPanelUserFromCookies();
  if (!user) redirect('/ecommpanel/login');

  if (!canAccessCustomerWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso ao centro LGPD de clientes.</p>
        </article>
      </section>
    );
  }

  return (
    <CustomerLgpdManager
      initialCustomers={await listCustomerAccountsAdmin()}
      initialRequests={await listCustomerLgpdRequestsAdmin()}
      initialPolicies={await listCustomerRetentionPoliciesAdmin()}
      capabilities={{
        canRequest: canRequestCustomerLgpd(user),
        canApprove: canApproveCustomerLgpd(user),
        canExecute: canExecuteCustomerLgpd(user),
        canManageRetention: canManageCustomerRetention(user),
      }}
    />
  );
}
