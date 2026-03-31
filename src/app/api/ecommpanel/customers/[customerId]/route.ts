import type { NextRequest } from 'next/server';

import {
  getCustomerAccountAdminById,
  upsertCustomerAccountAdmin,
} from '@/features/ecommerce/server/customerAccountStore';
import { canAccessCustomerWorkspace, canManageCustomers } from '@/features/ecommerce/server/orderPermissions';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

async function requireCustomerPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessCustomerWorkspace(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para acessar clientes.') };
  }
  return { auth };
}

export async function GET(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const guard = await requireCustomerPermission(req);
  if ('error' in guard) return guard.error;

  const { customerId } = await context.params;
  const customer = await getCustomerAccountAdminById(customerId);
  if (!customer) return errorNoStore(404, 'Cliente não encontrado.');
  return jsonNoStore({ customer });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireCustomerPermission(req);
  if ('error' in guard) return guard.error;
  if (!canManageCustomers(guard.auth.user)) {
    return errorNoStore(403, 'Sem permissão para editar clientes.');
  }
  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorNoStore(400, 'Payload inválido.');

  const { customerId } = await context.params;
  const customer = await upsertCustomerAccountAdmin({
    accountId: customerId,
    kind: body.kind === 'company' ? 'company' : 'individual',
    email: String(body.email || ''),
    firstName: typeof body.firstName === 'string' ? body.firstName : undefined,
    lastName: typeof body.lastName === 'string' ? body.lastName : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    alternatePhone: typeof body.alternatePhone === 'string' ? body.alternatePhone : undefined,
    birthDate: typeof body.birthDate === 'string' ? body.birthDate : undefined,
    taxDocumentType: body.taxDocumentType === 'cnpj' ? 'cnpj' : 'cpf',
    taxDocument: String(body.taxDocument || ''),
    secondaryDocument: typeof body.secondaryDocument === 'string' ? body.secondaryDocument : undefined,
    companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
    tradeName: typeof body.tradeName === 'string' ? body.tradeName : undefined,
    stateRegistration: typeof body.stateRegistration === 'string' ? body.stateRegistration : undefined,
    marketingOptIn: Boolean(body.marketingOptIn),
    acceptedPrivacy: Boolean(body.acceptedPrivacy),
    acceptedTerms: Boolean(body.acceptedTerms),
    active: body.active === undefined ? true : Boolean(body.active),
    addresses: Array.isArray(body.addresses) ? (body.addresses as never[]) : [],
  });

  if (!customer) return errorNoStore(400, 'Não foi possível atualizar o cliente.');
  return jsonNoStore({ ok: true, customer });
}
