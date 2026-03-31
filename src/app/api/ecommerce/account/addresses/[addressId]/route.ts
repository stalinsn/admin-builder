import type { NextRequest } from 'next/server';

import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import { getCustomerApiAuthContext, hasValidCustomerCsrf, isTrustedCustomerOrigin } from '@/features/ecommerce/server/customerAuth';
import { deleteCustomerAddress, upsertCustomerAddress } from '@/features/ecommerce/server/customerAccountStore';
import type { CustomerAccountAddress } from '@/features/ecommerce/types/account';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getCustomerApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Sessão do cliente não encontrada.');
  }

  if (!hasValidCustomerCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const rate = checkRateLimit(
    `customer:address:update:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.addressMutation.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.addressMutation.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas alterações em endereços. Aguarde para continuar.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const { addressId } = await params;
  const body = (await req.json().catch(() => null)) as Partial<CustomerAccountAddress> | null;
  if (!body || !addressId) {
    return errorNoStore(400, 'Endereço inválido.');
  }

  const address = await upsertCustomerAddress(auth.account.profile.id, {
    id: addressId,
    label: body.label || 'Endereço',
    recipient: body.recipient,
    postalCode: body.postalCode,
    street: body.street,
    number: body.number,
    complement: body.complement,
    neighborhood: body.neighborhood,
    city: body.city,
    state: body.state,
    country: body.country,
    reference: body.reference,
    phone: body.phone,
    isDefaultShipping: body.isDefaultShipping,
    isDefaultBilling: body.isDefaultBilling,
  });

  if (!address) {
    return errorNoStore(400, 'Não foi possível atualizar o endereço.');
  }

  return jsonNoStore({ ok: true, address });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getCustomerApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Sessão do cliente não encontrada.');
  }

  if (!hasValidCustomerCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { addressId } = await params;
  const deleted = await deleteCustomerAddress(auth.account.profile.id, addressId);
  if (!deleted) {
    return errorNoStore(404, 'Endereço não encontrado.');
  }

  return jsonNoStore({ ok: true });
}
