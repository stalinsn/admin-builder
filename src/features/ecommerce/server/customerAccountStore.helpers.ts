import { nowIso } from '@/features/ecommpanel/server/crypto';
import type {
  CustomerAccountOrder,
  CustomerAccountProfile,
  CustomerAccountSession,
  CustomerRegistrationPayload,
} from '@/features/ecommerce/types/account';
import type { Address } from '@/features/ecommerce/types/orderForm';

import { decryptCustomerData, hashLookupValue } from './customerCrypto';
import type {
  CustomerAccountRow,
  CustomerAddressRow,
  CustomerOrderRow,
  CustomerSessionRow,
} from './customerAccountStore.types';

export function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) return undefined;
  return next.toISOString();
}

export function normalizeLine(value: string | null | undefined, max = 160): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseRegistrationPayload(value: string | null | undefined): CustomerRegistrationPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CustomerRegistrationPayload> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if ((parsed.kind !== 'individual' && parsed.kind !== 'company') || (parsed.taxDocumentType !== 'cpf' && parsed.taxDocumentType !== 'cnpj')) {
      return null;
    }
    if (typeof parsed.email !== 'string' || typeof parsed.taxDocument !== 'string') return null;
    return {
      kind: parsed.kind,
      email: parsed.email,
      password: typeof parsed.password === 'string' ? parsed.password : undefined,
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName : undefined,
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      alternatePhone: typeof parsed.alternatePhone === 'string' ? parsed.alternatePhone : undefined,
      birthDate: typeof parsed.birthDate === 'string' ? parsed.birthDate : undefined,
      taxDocumentType: parsed.taxDocumentType,
      taxDocument: parsed.taxDocument,
      secondaryDocument: typeof parsed.secondaryDocument === 'string' ? parsed.secondaryDocument : undefined,
      companyName: typeof parsed.companyName === 'string' ? parsed.companyName : undefined,
      tradeName: typeof parsed.tradeName === 'string' ? parsed.tradeName : undefined,
      stateRegistration: typeof parsed.stateRegistration === 'string' ? parsed.stateRegistration : undefined,
      marketingOptIn: Boolean(parsed.marketingOptIn),
      acceptedPrivacy: Boolean(parsed.acceptedPrivacy),
      acceptedTerms: Boolean(parsed.acceptedTerms),
    };
  } catch {
    return null;
  }
}

export function normalizeDigits(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits || undefined;
}

export function normalizeLoginIdentifier(value: string): { email?: string; taxDocumentHash?: string } {
  const raw = value.trim();
  if (!raw) return {};
  if (raw.includes('@')) {
    return { email: normalizeEmail(raw) };
  }
  const digits = normalizeDigits(raw);
  if (!digits) return {};
  const taxDocumentType = digits.length > 11 ? 'cnpj' : 'cpf';
  const taxDocumentHash = hashLookupValue(`${taxDocumentType}:${digits}`) || undefined;
  return { taxDocumentHash };
}

export function parseItems(value: unknown): CustomerAccountOrder['items'] {
  if (!Array.isArray(value)) return [];
  return value
    .map<CustomerAccountOrder['items'][number] | null>((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const current = entry as Record<string, unknown>;
      return {
        id: String(current.id || ''),
        name: String(current.name || ''),
        image: current.image ? String(current.image) : undefined,
        quantity: Number(current.quantity || 0),
        price: Number(current.price || 0),
      };
    })
    .filter((entry): entry is CustomerAccountOrder['items'][number] => Boolean(entry && entry.id && entry.name));
}

export function mapAccountProfile(row: CustomerAccountRow): CustomerAccountProfile {
  return {
    id: row.id,
    kind: row.kind,
    email: row.email,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    fullName: row.full_name || undefined,
    phone: row.phone || undefined,
    alternatePhone: row.alternate_phone || undefined,
    birthDate: decryptCustomerData(row.birth_date_encrypted),
    taxDocumentType: row.tax_document_type,
    taxDocument: decryptCustomerData(row.tax_document_encrypted),
    secondaryDocument: decryptCustomerData(row.secondary_document_encrypted),
    companyName: row.company_name || undefined,
    tradeName: row.trade_name || undefined,
    stateRegistration: decryptCustomerData(row.state_registration_encrypted),
    marketingOptIn: Boolean(row.marketing_opt_in),
    acceptedPrivacyAt: toIso(row.accepted_privacy_at),
    acceptedTermsAt: toIso(row.accepted_terms_at),
    emailVerifiedAt: toIso(row.email_verified_at),
    createdAt: toIso(row.created_at) || nowIso(),
    updatedAt: toIso(row.updated_at) || nowIso(),
    lastLoginAt: toIso(row.last_login_at),
  };
}

export function mapAddress(row: CustomerAddressRow) {
  return {
    id: row.id,
    label: row.label,
    recipient: row.recipient || undefined,
    postalCode: row.postal_code || undefined,
    street: row.street || undefined,
    number: row.number || undefined,
    complement: row.complement || undefined,
    neighborhood: row.neighborhood || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    country: row.country || undefined,
    reference: row.reference || undefined,
    phone: row.phone || undefined,
    isDefaultShipping: Boolean(row.is_default_shipping),
    isDefaultBilling: Boolean(row.is_default_billing),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at) || nowIso(),
  };
}

export function mapOrder(row: CustomerOrderRow): CustomerAccountOrder {
  return {
    id: row.id,
    groupOrderId: row.group_order_id || undefined,
    splitSequence: row.split_sequence ? Number(row.split_sequence) : undefined,
    splitTotal: row.split_total ? Number(row.split_total) : undefined,
    placedAt: toIso(row.placed_at) || nowIso(),
    status: row.status,
    paymentMethod: row.payment_method,
    totalValue: Number(row.total_value || 0),
    shippingValue: Number(row.shipping_value || 0),
    itemsCount: Number(row.items_count || 0),
    items: parseItems(row.items_json),
    addressSummary: row.address_summary || 'Endereço não informado',
  };
}

export function mapSession(row: CustomerSessionRow, email: string): CustomerAccountSession {
  return {
    email,
    startedAt: toIso(row.created_at) || nowIso(),
    expiresAt: toIso(row.expires_at) || nowIso(),
  };
}

export function formatAddressSummary(address: Address | null | undefined): string {
  if (!address) return 'Endereço não informado';
  return [address.street, address.number, address.neighborhood, address.city, address.state].filter(Boolean).join(', ');
}
