import type {
  CustomerAccountKind,
  CustomerAccountRecord,
  CustomerDocumentType,
} from '../../types/account';

export type ProfileFormState = {
  kind: CustomerAccountKind;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  alternatePhone: string;
  birthDate: string;
  taxDocumentType: CustomerDocumentType;
  taxDocument: string;
  secondaryDocument: string;
  companyName: string;
  tradeName: string;
  stateRegistration: string;
  marketingOptIn: boolean;
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
};

export const EMPTY_ADDRESS_FORM = {
  id: '',
  label: 'Casa',
  recipient: '',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  country: 'BRA',
  reference: '',
  phone: '',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

export const EMPTY_REGISTER_FORM: ProfileFormState = {
  kind: 'individual',
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  alternatePhone: '',
  birthDate: '',
  taxDocumentType: 'cpf',
  taxDocument: '',
  secondaryDocument: '',
  companyName: '',
  tradeName: '',
  stateRegistration: '',
  marketingOptIn: false,
  acceptedPrivacy: false,
  acceptedTerms: false,
};

export function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function maskCEP(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

export function maskUF(value: string) {
  return value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
}

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export function maskCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function buildProfileForm(account: CustomerAccountRecord | null): ProfileFormState {
  if (!account) return EMPTY_REGISTER_FORM;
  return {
    kind: account.profile.kind,
    email: account.profile.email || '',
    firstName: account.profile.firstName || '',
    lastName: account.profile.lastName || '',
    phone: account.profile.phone || '',
    alternatePhone: account.profile.alternatePhone || '',
    birthDate: account.profile.birthDate || '',
    taxDocumentType: account.profile.taxDocumentType,
    taxDocument: account.profile.taxDocument || '',
    secondaryDocument: account.profile.secondaryDocument || '',
    companyName: account.profile.companyName || '',
    tradeName: account.profile.tradeName || '',
    stateRegistration: account.profile.stateRegistration || '',
    marketingOptIn: Boolean(account.profile.marketingOptIn),
    acceptedPrivacy: Boolean(account.profile.acceptedPrivacyAt),
    acceptedTerms: Boolean(account.profile.acceptedTermsAt),
  };
}

export function buildAccountName(account: CustomerAccountRecord | null): string {
  if (!account) return '';
  if (account.profile.kind === 'company') {
    return account.profile.companyName || account.profile.tradeName || account.profile.email;
  }
  return [account.profile.firstName, account.profile.lastName].filter(Boolean).join(' ') || account.profile.email;
}

export function prevHasShipping(address: unknown): boolean {
  if (!address || typeof address !== 'object') return false;
  const current = address as Record<string, unknown>;
  return Boolean(current.postalCode || current.street || current.city || current.state);
}
