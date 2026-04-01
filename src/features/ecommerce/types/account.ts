import type { Address } from './orderForm';

export type CustomerAccountKind = 'individual' | 'company';
export type CustomerDocumentType = 'cpf' | 'cnpj';

export type CustomerAccountAddress = Address & {
  id: string;
  label: string;
  recipient?: string;
  reference?: string;
  phone?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
  updatedAt: string;
  createdAt?: string;
};

export type CustomerAccountOrderItem = {
  id: string;
  name: string;
  image?: string;
  quantity: number;
  price: number;
};

export type CustomerAccountOrder = {
  id: string;
  groupOrderId?: string;
  splitSequence?: number;
  splitTotal?: number;
  placedAt: string;
  status: 'created' | 'processing' | 'completed' | 'cancelled';
  paymentMethod: string;
  totalValue: number;
  shippingValue: number;
  itemsCount: number;
  items: CustomerAccountOrderItem[];
  addressSummary: string;
};

export type CustomerAccountProfile = {
  id: string;
  kind: CustomerAccountKind;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  alternatePhone?: string;
  birthDate?: string;
  taxDocumentType: CustomerDocumentType;
  taxDocument?: string;
  secondaryDocument?: string;
  companyName?: string;
  tradeName?: string;
  stateRegistration?: string;
  marketingOptIn: boolean;
  acceptedPrivacyAt?: string;
  acceptedTermsAt?: string;
  emailVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type CustomerAccountRecord = {
  profile: CustomerAccountProfile;
  addresses: CustomerAccountAddress[];
  orders: CustomerAccountOrder[];
  privacy: {
    active: boolean;
    deletedAt?: string;
    erasureRequestedAt?: string;
  };
};

export type CustomerAccountSession = {
  email: string;
  startedAt: string;
  expiresAt: string;
};

export type CustomerAccountMeResponse = {
  authenticated: boolean;
  session: CustomerAccountSession | null;
  account: CustomerAccountRecord | null;
};

export type CustomerRegistrationPayload = {
  kind: CustomerAccountKind;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  alternatePhone?: string;
  birthDate?: string;
  taxDocumentType: CustomerDocumentType;
  taxDocument: string;
  secondaryDocument?: string;
  companyName?: string;
  tradeName?: string;
  stateRegistration?: string;
  marketingOptIn: boolean;
  acceptedPrivacy: boolean;
  acceptedTerms: boolean;
};

export type CustomerRegistrationStartResult =
  | {
      ok: true;
      email: string;
      requiresVerification: true;
      expiresAt: string;
      debugCode?: string;
    }
  | {
      ok: true;
      email: string;
      requiresVerification: false;
    }
  | {
      ok: false;
      reason:
        | 'account-exists'
        | 'document-in-use'
        | 'cooldown-active'
        | 'database-unavailable'
        | 'mail-unavailable'
        | 'invalid-email-domain';
      retryAfterSeconds?: number;
      expiresAt?: string;
      blockedDomain?: string;
    };

export type CustomerPasswordLoginPayload = {
  identifier: string;
  password: string;
};

export type CustomerAdminSummary = {
  id: string;
  kind: CustomerAccountKind;
  email: string;
  name: string;
  phone?: string;
  active: boolean;
  deletedAt?: string;
  erasureRequestedAt?: string;
  marketingOptIn: boolean;
  ordersCount: number;
  addressesCount: number;
  lastLoginAt?: string;
  updatedAt: string;
};

export type CustomerAdminRecord = CustomerAccountRecord & {
  active: boolean;
  deletedAt?: string;
  erasureRequestedAt?: string;
  ordersCount: number;
  addressesCount: number;
};

export type CustomerLgpdRequestType = 'export' | 'erasure_request' | 'anonymization';
export type CustomerLgpdRequestStatus = 'open' | 'completed' | 'rejected';
export type CustomerLgpdReviewStatus = 'not_required' | 'pending_review' | 'approved' | 'rejected';
export type CustomerLgpdApprovalStage = 'review' | 'execution';
export type CustomerLgpdApprovalDecision = 'pending' | 'approved' | 'rejected';
export type CustomerRetentionAction = 'delete' | 'anonymize' | 'retain_minimum';

export type CustomerLgpdRequestRecord = {
  id: string;
  accountId?: string;
  accountEmail?: string;
  type: CustomerLgpdRequestType;
  status: CustomerLgpdRequestStatus;
  source: 'customer' | 'admin';
  notes?: string;
  createdAt: string;
  completedAt?: string;
  reviewStatus: CustomerLgpdReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  executionEligible: boolean;
};

export type CustomerLgpdApprovalRecord = {
  id: string;
  requestId: string;
  stage: CustomerLgpdApprovalStage;
  decision: CustomerLgpdApprovalDecision;
  actorUserId?: string;
  actorUserName?: string;
  notes?: string;
  createdAt: string;
  decidedAt?: string;
};

export type CustomerRetentionPolicyRecord = {
  id: string;
  entityKey: string;
  label: string;
  description: string;
  action: CustomerRetentionAction;
  retentionDays: number;
  legalBasis: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy?: string;
};

export type CustomerLgpdExportPackage = {
  generatedAt: string;
  account: CustomerAccountRecord | null;
  privacy: {
    deletedAt?: string;
    erasureRequestedAt?: string;
    active: boolean;
  };
  orders: CustomerAccountOrder[];
  addresses: CustomerAccountAddress[];
  auditTrail: Array<{
    id: string;
    event: string;
    outcome: string;
    target?: string;
    createdAt: string;
  }>;
};

export type CustomerAdminUpsertPayload = CustomerRegistrationPayload & {
  active?: boolean;
  addresses?: Array<
    Omit<CustomerAccountAddress, 'updatedAt' | 'createdAt'> & {
      id?: string;
    }
  >;
};
