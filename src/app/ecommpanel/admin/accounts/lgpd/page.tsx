import { redirect } from 'next/navigation';

import CustomerLgpdManager from '@/features/ecommpanel/components/CustomerLgpdManager';
import { getAdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';
import {
  canAccessCustomerWorkspace,
  canApproveCustomerLgpd,
  canExecuteCustomerLgpd,
  canManageCustomerRetention,
  canRequestCustomerLgpd,
} from '@/features/ecommerce/server/orderPermissions';
import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';
import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';
import {
  listCustomerAccountsAdmin,
  listCustomerLgpdRequestsAdmin,
  listCustomerRetentionPoliciesAdmin,
} from '@/features/ecommerce/server/customerAccountStore';

export default async function ArtmetaPanelAccountsLgpdPage() {
  const user = await getPanelUserFromCookies();
  if (!user) redirect('/ecommpanel/login');

  if (!canAccessCustomerWorkspace(user)) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui acesso ao centro LGPD de contas.</p>
        </article>
      </section>
    );
  }

  const settings = getAdminBuilderSettings(getDataStudioSnapshot());
  if (settings.accountWorkspace.mode === 'entity') {
    return (
      <section className="panel-grid">
        <article className="panel-card panel-card-hero panel-card-hero--compact">
          <p className="panel-kicker">Contas</p>
          <h1>LGPD indisponível neste modo</h1>
          <p className="panel-muted">O centro LGPD operacional funciona apenas quando o workspace de contas está apontando para as contas nativas do auth-kit.</p>
          <p className="panel-muted">
            Se você quiser usar a fila de exportação, retenção e anonimização, volte o workspace de contas para o modo nativo em{' '}
            <strong>/ecommpanel/admin/accounts</strong>.
          </p>
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
