import type {
  CustomerAccountAddress,
  CustomerAccountOrder,
  CustomerLgpdApprovalDecision,
  CustomerLgpdApprovalStage,
  CustomerLgpdRequestStatus,
  CustomerLgpdRequestType,
  CustomerLgpdReviewStatus,
  CustomerRetentionAction,
} from '@/features/ecommerce/types/account';

export type CustomerAccountRow = {
  id: string;
  email: string;
  kind: 'individual' | 'company';
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  alternate_phone: string | null;
  birth_date_encrypted: string | null;
  tax_document_type: 'cpf' | 'cnpj';
  tax_document_encrypted: string | null;
  tax_document_last4: string | null;
  tax_document_hash: string | null;
  secondary_document_encrypted: string | null;
  company_name: string | null;
  trade_name: string | null;
  state_registration_encrypted: string | null;
  password_hash: string | null;
  failed_attempts: number;
  lock_until: string | Date | null;
  marketing_opt_in: boolean;
  accepted_privacy_at: string | Date | null;
  accepted_terms_at: string | Date | null;
  email_verified_at: string | Date | null;
  active: boolean;
  deleted_at: string | Date | null;
  erasure_requested_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  last_login_at: string | Date | null;
};

export type CustomerAddressRow = {
  id: string;
  account_id: string;
  label: string;
  recipient: string | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  reference: string | null;
  phone: string | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
};

export type CustomerOrderRow = {
  id: string;
  account_id: string | null;
  group_order_id: string | null;
  split_sequence: number | null;
  split_total: number | null;
  placed_at: string | Date;
  status: 'created' | 'processing' | 'completed' | 'cancelled';
  payment_method: string;
  total_value: string | number;
  shipping_value: string | number;
  items_count: number;
  items_json: unknown;
  address_summary: string | null;
};

export type CustomerAdminListRow = CustomerAccountRow & {
  orders_count: string | number;
  addresses_count: string | number;
};

export type CustomerAuditEventRow = {
  id: string;
  account_id: string | null;
  event: string;
  outcome: string;
  target: string | null;
  created_at: string | Date;
};

export type CustomerLgpdRequestRow = {
  id: string;
  account_id: string | null;
  account_email: string | null;
  request_type: CustomerLgpdRequestType;
  status: CustomerLgpdRequestStatus;
  source: 'customer' | 'admin';
  notes: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
  review_status?: CustomerLgpdReviewStatus | null;
  reviewed_at?: string | Date | null;
  reviewed_by?: string | null;
  execution_eligible?: boolean | null;
};

export type CustomerLgpdApprovalRow = {
  id: string;
  request_id: string;
  stage: CustomerLgpdApprovalStage;
  decision: CustomerLgpdApprovalDecision;
  actor_user_id: string | null;
  actor_user_name: string | null;
  notes: string | null;
  created_at: string | Date;
  decided_at: string | Date | null;
};

export type CustomerRetentionPolicyRow = {
  id: string;
  entity_key: string;
  label: string;
  description: string;
  action: CustomerRetentionAction;
  retention_days: number;
  legal_basis: string;
  enabled: boolean;
  updated_by: string | null;
  updated_at: string | Date;
};

export type CustomerLoginTokenRow = {
  id: string;
  account_id: string;
  code_hash: string;
  created_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
  channel: 'email';
};

export type CustomerSessionRow = {
  id: string;
  account_id: string;
  csrf_token: string;
  created_at: string | Date;
  hard_expires_at: string | Date;
  expires_at: string | Date;
  last_seen_at: string | Date;
  user_agent_hash: string;
  ip_hash: string;
};

export type CustomerPendingRegistrationRow = {
  id: string;
  email: string;
  payload_encrypted: string;
  password_hash: string;
  tax_document_hash: string | null;
  code_hash: string;
  created_at: string | Date;
  last_sent_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
  channel: 'email';
};

export const DEFAULT_CUSTOMER_RETENTION_POLICIES: Array<{
  id: string;
  entityKey: string;
  label: string;
  description: string;
  action: CustomerRetentionAction;
  retentionDays: number;
  legalBasis: string;
}> = [
  {
    id: 'crp-account-profile',
    entityKey: 'customer_accounts',
    label: 'Conta do cliente',
    description: 'Dados de identificação e consentimento da conta do cliente.',
    action: 'anonymize',
    retentionDays: 30,
    legalBasis: 'Atendimento ao titular e encerramento controlado da relação.',
  },
  {
    id: 'crp-addresses',
    entityKey: 'customer_addresses',
    label: 'Endereços da conta',
    description: 'Endereços salvos para entrega e cobrança.',
    action: 'delete',
    retentionDays: 30,
    legalBasis: 'Dados acessórios da conta, removidos após tratamento.',
  },
  {
    id: 'crp-sessions',
    entityKey: 'customer_sessions',
    label: 'Sessões autenticadas',
    description: 'Sessões ativas e histórico técnico mínimo da autenticação.',
    action: 'delete',
    retentionDays: 7,
    legalBasis: 'Segurança operacional e encerramento da sessão.',
  },
  {
    id: 'crp-login-tokens',
    entityKey: 'customer_login_tokens',
    label: 'Códigos de acesso',
    description: 'Tokens de login por código enviados ao cliente.',
    action: 'delete',
    retentionDays: 2,
    legalBasis: 'Segurança e prevenção de reuso indevido.',
  },
  {
    id: 'crp-pending-registrations',
    entityKey: 'customer_pending_registrations',
    label: 'Cadastros pendentes',
    description: 'Solicitações de cadastro ainda não validadas por e-mail.',
    action: 'delete',
    retentionDays: 2,
    legalBasis: 'Prevenção a abuso, segurança e conclusão assistida do cadastro.',
  },
  {
    id: 'crp-customer-orders',
    entityKey: 'customer_orders',
    label: 'Projeção de pedidos da conta',
    description: 'Visão de pedidos vinculada à conta para área Minha conta.',
    action: 'anonymize',
    retentionDays: 30,
    legalBasis: 'Desvinculação da conta com preservação do histórico operacional mínimo.',
  },
  {
    id: 'crp-commerce-orders',
    entityKey: 'commerce_orders',
    label: 'Pedido operacional',
    description: 'Pedido consolidado, timeline comercial e dados sanitizados de operação.',
    action: 'retain_minimum',
    retentionDays: 1825,
    legalBasis: 'Operação, auditoria, defesa do negócio e obrigações legais.',
  },
  {
    id: 'crp-order-events',
    entityKey: 'commerce_order_events',
    label: 'Eventos do pedido',
    description: 'Timeline logística, financeira e de atendimento do pedido.',
    action: 'retain_minimum',
    retentionDays: 1825,
    legalBasis: 'Rastreabilidade operacional e auditoria do pedido.',
  },
  {
    id: 'crp-audit',
    entityKey: 'customer_audit_events',
    label: 'Auditoria da conta',
    description: 'Trilha mínima de segurança e tratamento da conta do cliente.',
    action: 'retain_minimum',
    retentionDays: 365,
    legalBasis: 'Segurança, prevenção a fraude e auditoria interna.',
  },
];

export type ParsedCustomerOrderItems = CustomerAccountOrder['items'];
export type ParsedCustomerAddress = CustomerAccountAddress;
