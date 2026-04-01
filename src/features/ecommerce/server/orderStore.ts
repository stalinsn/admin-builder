import 'server-only';

import type { PoolClient } from 'pg';

import { randomToken } from '@/features/ecommpanel/server/crypto';
import { withPostgresClient, type PostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import type {
  CommerceOrderDraftRecord,
  CommerceOrderEventRecord,
  CommerceOrderFinancialStatus,
  CommerceOrderFulfillmentStatus,
  CommerceOrderPaymentSnapshot,
  CommerceOrderRecord,
  CommerceOrderStatus,
  CommerceOrderTotals,
  PublicOrderTrackingRecord,
} from '@/features/ecommerce/types/commerceOrder';
import type { Address, ClientProfileData, OrderFormItem, ShippingOption, Totalizer } from '@/features/ecommerce/types/orderForm';

const ORDER_DRAFT_ABANDONED_AFTER_MINUTES = 20;
const ORDER_DRAFT_RETENTION_DAYS = 5;

type OrderDraftRow = {
  id: string;
  public_token: string;
  order_form_id: string;
  status: CommerceOrderDraftRecord['status'];
  customer_email: string | null;
  customer_account_id: string | null;
  items_json: unknown;
  client_profile_json: unknown;
  shipping_json: unknown;
  payment_json: unknown;
  totals_json: unknown;
  custom_data_json: unknown;
  expires_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
  converted_at: string | Date | null;
};

type CommerceOrderRow = {
  id: string;
  public_token: string;
  group_order_id: string | null;
  split_role: 'single' | 'child';
  split_sequence: number;
  split_total: number;
  draft_id: string | null;
  customer_account_id: string | null;
  customer_email: string;
  status: CommerceOrderStatus;
  financial_status: CommerceOrderFinancialStatus;
  fulfillment_status: CommerceOrderFulfillmentStatus;
  source: 'storefront' | 'admin' | 'api';
  currency: string;
  items_json: unknown;
  totals_json: unknown;
  customer_snapshot_json: unknown;
  shipping_snapshot_json: unknown;
  payment_snapshot_json: unknown;
  logistics_json: unknown;
  created_at: string | Date;
  updated_at: string | Date;
  placed_at: string | Date;
};

type CommerceOrderEventRow = {
  id: string;
  order_id: string;
  kind: string;
  title: string;
  description: string | null;
  visibility: 'internal' | 'customer' | 'public';
  actor_type: 'system' | 'customer' | 'admin';
  actor_id: string | null;
  payload_json: unknown;
  created_at: string | Date;
};

type DraftUpsertInput = {
  orderFormId: string;
  draftToken?: string | null;
  customerEmail?: string | null;
  customerAccountId?: string | null;
  items: OrderFormItem[];
  clientProfileData?: ClientProfileData | null;
  shippingAddress?: Address | null;
  shippingOptions?: {
    deliveryOptions?: ShippingOption[];
    pickupOptions?: Array<ShippingOption & { address?: Address | null }>;
    selectedOptionId?: string | null;
    selectedMode?: 'delivery' | 'pickup' | null;
  } | null;
  payments?: CommerceOrderPaymentSnapshot[];
  totals: CommerceOrderTotals;
  customData?: Record<string, unknown> | null;
};

type FinalizeCheckoutInput = DraftUpsertInput & {
  orderId: string;
  source?: CommerceOrderRecord['source'];
  logistics?: Record<string, unknown> | null;
};

type FinalizeOrderResult = {
  groupOrderId: string;
  split: boolean;
  primaryOrder: CommerceOrderRecord;
  orders: CommerceOrderRecord[];
};

type OrderListFilters = {
  q?: string;
  status?: CommerceOrderStatus | null;
  financialStatus?: CommerceOrderFinancialStatus | null;
  fulfillmentStatus?: CommerceOrderFulfillmentStatus | null;
  limit?: number;
  page?: number;
};

type OrderUpdateInput = {
  status?: CommerceOrderStatus;
  financialStatus?: CommerceOrderFinancialStatus;
  fulfillmentStatus?: CommerceOrderFulfillmentStatus;
  items?: OrderFormItem[];
  totals?: CommerceOrderTotals;
  customerSnapshot?: ClientProfileData | Record<string, unknown> | null;
  shippingSnapshot?: CommerceOrderRecord['shippingSnapshot'];
  logistics?: Record<string, unknown> | null;
  title?: string;
  description?: string;
  visibility?: CommerceOrderEventRecord['visibility'];
  actorType?: CommerceOrderEventRecord['actorType'];
  actorId?: string | null;
  eventKind?: string;
  payload?: Record<string, unknown> | null;
};

declare global {
  var __ECOM_COMMERCE_ORDER_SCHEMA_READY_KEYS__: Set<string> | undefined;
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeEmail(value: string | null | undefined): string | undefined {
  const normalized = (value || '').trim().toLowerCase();
  return normalized || undefined;
}

function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object') return fallback;
  return value as T;
}

function parseJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function createPublicToken(prefix: string): string {
  return `${prefix}_${randomToken(10)}`;
}

function buildTotals(params: {
  value?: number;
  itemsValue?: number;
  shippingValue?: number;
  discountsValue?: number;
  totalizers?: Totalizer[];
  itemsCount?: number;
}): CommerceOrderTotals {
  return {
    value: Number(params.value || 0),
    itemsValue: Number(params.itemsValue || 0),
    shippingValue: Number(params.shippingValue || 0),
    discountsValue: Number(params.discountsValue || 0),
    totalizers: Array.isArray(params.totalizers) ? params.totalizers : [],
    itemsCount: Number(params.itemsCount || 0),
  };
}

function mapDraft(row: OrderDraftRow): CommerceOrderDraftRecord {
  const shipping = parseJsonObject<CommerceOrderRecord['shippingSnapshot'] | null>(row.shipping_json, null);
  return {
    id: row.id,
    publicToken: row.public_token,
    orderFormId: row.order_form_id,
    status: row.status,
    email: row.customer_email || undefined,
    items: parseJsonArray<OrderFormItem>(row.items_json),
    clientProfileData: parseJsonObject<ClientProfileData | null>(row.client_profile_json, null),
    shippingAddress: shipping?.selectedAddress || null,
    payments: parseJsonArray<CommerceOrderPaymentSnapshot>(row.payment_json),
    totals: parseJsonObject<CommerceOrderTotals>(
      row.totals_json,
      buildTotals({ itemsCount: parseJsonArray<OrderFormItem>(row.items_json).length }),
    ),
    customData: parseJsonObject<Record<string, unknown> | null>(row.custom_data_json, null),
    expiresAt: toIso(row.expires_at) || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    convertedAt: toIso(row.converted_at),
  };
}

function mapOrder(row: CommerceOrderRow): CommerceOrderRecord {
  return {
    id: row.id,
    publicToken: row.public_token,
    groupOrderId: row.group_order_id || undefined,
    splitRole: row.split_role || 'single',
    splitSequence: Number(row.split_sequence || 1),
    splitTotal: Number(row.split_total || 1),
    draftId: row.draft_id || undefined,
    customerAccountId: row.customer_account_id || undefined,
    customerEmail: row.customer_email,
    status: row.status,
    financialStatus: row.financial_status,
    fulfillmentStatus: row.fulfillment_status,
    source: row.source,
    currency: row.currency || 'BRL',
    items: parseJsonArray<OrderFormItem>(row.items_json),
    totals: parseJsonObject<CommerceOrderTotals>(row.totals_json, buildTotals({})),
    customerSnapshot: parseJsonObject<ClientProfileData | Record<string, unknown> | null>(row.customer_snapshot_json, null),
    shippingSnapshot: parseJsonObject<CommerceOrderRecord['shippingSnapshot'] | null>(row.shipping_snapshot_json, null),
    paymentSnapshot: parseJsonArray<CommerceOrderPaymentSnapshot>(row.payment_snapshot_json),
    logistics: parseJsonObject<Record<string, unknown> | null>(row.logistics_json, null),
    placedAt: toIso(row.placed_at) || new Date().toISOString(),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function mapEvent(row: CommerceOrderEventRow): CommerceOrderEventRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    title: row.title,
    description: row.description || undefined,
    visibility: row.visibility,
    actorType: row.actor_type,
    actorId: row.actor_id || undefined,
    payload: parseJsonObject<Record<string, unknown> | null>(row.payload_json, null),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
  };
}

function mapPublicOrderItems(items: OrderFormItem[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    image: item.image,
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    listPrice: item.listPrice,
    unit: item.unit,
    packSize: item.packSize,
  }));
}

function buildPublicDeliverySummary(order: CommerceOrderRecord): PublicOrderTrackingRecord['delivery'] {
  const selectedDelivery =
    order.shippingSnapshot?.deliveryOptions?.find((option) => option.id === order.shippingSnapshot?.selectedOptionId) ||
    order.shippingSnapshot?.pickupOptions?.find((option) => option.id === order.shippingSnapshot?.selectedOptionId) ||
    order.shippingSnapshot?.deliveryOptions?.[0] ||
    order.shippingSnapshot?.pickupOptions?.[0] ||
    null;
  const logistics = order.logistics || {};
  const originName =
    (typeof logistics.originName === 'string' && logistics.originName) ||
    selectedDelivery?.originNames?.[0] ||
    null;
  const originId =
    (typeof logistics.originId === 'string' && logistics.originId) ||
    selectedDelivery?.originIds?.[0] ||
    null;
  return {
    mode: order.shippingSnapshot?.selectedMode || selectedDelivery?.mode || null,
    label:
      (typeof logistics.optionLabel === 'string' && logistics.optionLabel) ||
      selectedDelivery?.name ||
      null,
    estimate:
      (typeof logistics.estimate === 'string' && logistics.estimate) ||
      selectedDelivery?.estimate ||
      null,
    estimateDaysMin:
      typeof logistics.estimateDaysMin === 'number'
        ? logistics.estimateDaysMin
        : (selectedDelivery?.estimateDaysMin ?? null),
    estimateDaysMax:
      typeof logistics.estimateDaysMax === 'number'
        ? logistics.estimateDaysMax
        : (selectedDelivery?.estimateDaysMax ?? null),
    originId,
    originName,
    addressSummary:
      (typeof logistics.shippingAddressSummary === 'string' && logistics.shippingAddressSummary) ||
      null,
    pickupInstructions:
      (typeof logistics.pickupInstructions === 'string' && logistics.pickupInstructions) ||
      selectedDelivery?.pickupInstructions ||
      null,
  };
}

async function withOrderDb<T>(
  handler: (client: PoolClient, runtime: PostgresRuntime) => Promise<T>,
): Promise<{ available: true; value: T } | { available: false }> {
  const runtime = await withPostgresClient(async (_client, runtimeValue) => runtimeValue);
  if (!runtime.available) return { available: false };
  await ensureCommerceOrderSchema(runtime.value);
  return withPostgresClient(handler);
}

async function ensureCommerceOrderSchema(runtime: PostgresRuntime): Promise<void> {
  const readyKeys = global.__ECOM_COMMERCE_ORDER_SCHEMA_READY_KEYS__ || new Set<string>();
  global.__ECOM_COMMERCE_ORDER_SCHEMA_READY_KEYS__ = readyKeys;
  if (readyKeys.has(runtime.key)) return;

  await withPostgresClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_order_drafts (
        id TEXT PRIMARY KEY,
        public_token TEXT NOT NULL UNIQUE,
        order_form_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        customer_email TEXT NULL,
        customer_account_id TEXT NULL,
        items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        client_profile_json JSONB NULL,
        shipping_json JSONB NULL,
        payment_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        custom_data_json JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
        converted_at TIMESTAMPTZ NULL
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_order_drafts_status ON commerce_order_drafts (status, updated_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_order_drafts_email ON commerce_order_drafts (customer_email, updated_at DESC)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_orders (
        id TEXT PRIMARY KEY,
        public_token TEXT NOT NULL UNIQUE,
        group_order_id TEXT NULL,
        split_role TEXT NOT NULL DEFAULT 'single',
        split_sequence INTEGER NOT NULL DEFAULT 1,
        split_total INTEGER NOT NULL DEFAULT 1,
        draft_id TEXT NULL REFERENCES commerce_order_drafts(id) ON DELETE SET NULL,
        customer_account_id TEXT NULL,
        customer_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        financial_status TEXT NOT NULL DEFAULT 'pending',
        fulfillment_status TEXT NOT NULL DEFAULT 'pending',
        source TEXT NOT NULL DEFAULT 'storefront',
        currency TEXT NOT NULL DEFAULT 'BRL',
        items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        customer_snapshot_json JSONB NULL,
        shipping_snapshot_json JSONB NULL,
        payment_snapshot_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        logistics_json JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS group_order_id TEXT NULL`);
    await client.query(`ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS split_role TEXT NOT NULL DEFAULT 'single'`);
    await client.query(`ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS split_sequence INTEGER NOT NULL DEFAULT 1`);
    await client.query(`ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS split_total INTEGER NOT NULL DEFAULT 1`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_orders_status ON commerce_orders (status, placed_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_orders_email ON commerce_orders (customer_email, placed_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_orders_account ON commerce_orders (customer_account_id, placed_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_orders_group ON commerce_orders (group_order_id, placed_at DESC)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_order_events (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NULL,
        visibility TEXT NOT NULL DEFAULT 'internal',
        actor_type TEXT NOT NULL DEFAULT 'system',
        actor_id TEXT NULL,
        payload_json JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_commerce_order_events_order_id ON commerce_order_events (order_id, created_at DESC)');
  });

  readyKeys.add(runtime.key);
}

async function cleanupCommerceOrderDrafts(client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE commerce_order_drafts
     SET status = 'abandoned',
         expires_at = LEAST(expires_at, updated_at + INTERVAL '${ORDER_DRAFT_RETENTION_DAYS} days')
     WHERE status = 'active'
       AND updated_at <= NOW() - INTERVAL '${ORDER_DRAFT_ABANDONED_AFTER_MINUTES} minutes'`,
  );

  await client.query(
    `DELETE FROM commerce_order_drafts
     WHERE status IN ('abandoned', 'expired')
       AND expires_at <= NOW()`,
  );
}

function buildShippingSnapshot(input: DraftUpsertInput): CommerceOrderRecord['shippingSnapshot'] {
  return {
    selectedAddress: input.shippingAddress || null,
    deliveryOptions: input.shippingOptions?.deliveryOptions || [],
    pickupOptions: input.shippingOptions?.pickupOptions || [],
    selectedOptionId: input.shippingOptions?.selectedOptionId || null,
    selectedMode: input.shippingOptions?.selectedMode || null,
  };
}

function resolveSelectedShippingOptionFromInput(input: DraftUpsertInput): ShippingOption | null {
  const deliveryOptions = Array.isArray(input.shippingOptions?.deliveryOptions) ? input.shippingOptions.deliveryOptions : [];
  const pickupOptions = Array.isArray(input.shippingOptions?.pickupOptions) ? input.shippingOptions.pickupOptions : [];
  const selectedId = input.shippingOptions?.selectedOptionId || '';
  return (
    deliveryOptions.find((option) => option.id === selectedId) ||
    pickupOptions.find((option) => option.id === selectedId) ||
    (input.shippingOptions?.selectedMode === 'pickup' ? pickupOptions[0] : deliveryOptions[0]) ||
    deliveryOptions[0] ||
    pickupOptions[0] ||
    null
  );
}

function allocateTotalsAcrossSplits(values: number[], total: number): number[] {
  if (!values.length) return [];
  const normalizedTotal = Number(total || 0);
  const base = values.reduce((sum, value) => sum + Number(value || 0), 0);
  if (!base) {
    return values.map((_, index) => (index === 0 ? Number(normalizedTotal.toFixed(2)) : 0));
  }

  let remaining = Number(normalizedTotal.toFixed(2));
  return values.map((value, index) => {
    if (index === values.length - 1) return Number(remaining.toFixed(2));
    const share = Number(((Number(value || 0) / base) * normalizedTotal).toFixed(2));
    remaining = Number((remaining - share).toFixed(2));
    return share;
  });
}

function buildChildShippingOption(params: {
  selectedOption: ShippingOption;
  groupItemsValue: number;
  groupShippingValue: number;
  groupTotal: number;
  splitSequence: number;
  allocationGroup: NonNullable<ShippingOption['allocations']>;
}): ShippingOption {
  const firstAllocation = params.allocationGroup[0];
  const originId = firstAllocation?.originId || '';
  const originName = firstAllocation?.originName || originId;
  const pickupAddress =
    params.selectedOption.pickupAddress && params.selectedOption.mode === 'pickup'
      ? params.selectedOption.pickupAddress
      : null;

  return {
    ...params.selectedOption,
    id: `${params.selectedOption.id}-split-${params.splitSequence}`,
    name: `${params.selectedOption.name} • ${originName}`,
    price: Number(params.groupShippingValue.toFixed(2)),
    originIds: originId ? [originId] : [],
    originNames: originName ? [originName] : [],
    allocations: params.allocationGroup,
    splitShipment: false,
    itemValue: Number(params.groupItemsValue.toFixed(2)),
    totalValue: Number(params.groupTotal.toFixed(2)),
    pickupAddress,
  };
}

async function createOrderEvent(
  client: PoolClient,
  orderId: string,
  input: {
    kind: string;
    title: string;
    description?: string;
    visibility?: CommerceOrderEventRecord['visibility'];
    actorType?: CommerceOrderEventRecord['actorType'];
    actorId?: string | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO commerce_order_events (
      id, order_id, kind, title, description, visibility, actor_type, actor_id, payload_json, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW()
    )`,
    [
      `oev-${randomToken(6)}`,
      orderId,
      input.kind,
      input.title,
      input.description || null,
      input.visibility || 'internal',
      input.actorType || 'system',
      input.actorId || null,
      JSON.stringify(input.payload || null),
    ],
  );
}

export async function upsertCommerceOrderDraft(input: DraftUpsertInput): Promise<CommerceOrderDraftRecord | null> {
  if (!input.orderFormId) return null;

  const result = await withOrderDb(async (client) => {
    await cleanupCommerceOrderDrafts(client);

    const byToken = input.draftToken
      ? await client.query<OrderDraftRow>(
          `SELECT * FROM commerce_order_drafts
           WHERE public_token = $1
           LIMIT 1`,
          [input.draftToken],
        )
      : null;
    const current =
      byToken?.rows[0] ||
      (
        await client.query<OrderDraftRow>(
          `SELECT * FROM commerce_order_drafts
           WHERE order_form_id = $1
           LIMIT 1`,
          [input.orderFormId],
        )
      ).rows[0];

    const draftId = current?.id || `odr-${randomToken(6)}`;
    const publicToken = current?.public_token || createPublicToken('draft');
    const itemsCount = input.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totals = buildTotals({ ...input.totals, itemsCount });

    await client.query(
      `INSERT INTO commerce_order_drafts (
        id, public_token, order_form_id, status, customer_email, customer_account_id, items_json,
        client_profile_json, shipping_json, payment_json, totals_json, custom_data_json, created_at, updated_at, expires_at
      ) VALUES (
        $1, $2, $3, 'active', $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, NOW(), NOW(), NOW() + INTERVAL '30 days'
      )
      ON CONFLICT (order_form_id) DO UPDATE SET
        public_token = EXCLUDED.public_token,
        status = 'active',
        customer_email = EXCLUDED.customer_email,
        customer_account_id = COALESCE(EXCLUDED.customer_account_id, commerce_order_drafts.customer_account_id),
        items_json = EXCLUDED.items_json,
        client_profile_json = EXCLUDED.client_profile_json,
        shipping_json = EXCLUDED.shipping_json,
        payment_json = EXCLUDED.payment_json,
        totals_json = EXCLUDED.totals_json,
        custom_data_json = EXCLUDED.custom_data_json,
        updated_at = NOW(),
        expires_at = NOW() + INTERVAL '30 days'`,
      [
        draftId,
        publicToken,
        input.orderFormId,
        normalizeEmail(input.customerEmail) || null,
        input.customerAccountId || null,
        JSON.stringify(input.items || []),
        JSON.stringify(input.clientProfileData || null),
        JSON.stringify(buildShippingSnapshot(input)),
        JSON.stringify(input.payments || []),
        JSON.stringify(totals),
        JSON.stringify(input.customData || null),
      ],
    );

    const query = await client.query<OrderDraftRow>(
      `SELECT * FROM commerce_order_drafts
       WHERE order_form_id = $1
       LIMIT 1`,
      [input.orderFormId],
    );
    return query.rows[0] ? mapDraft(query.rows[0]) : null;
  });

  return result.available ? result.value : null;
}

export async function finalizeCommerceOrderFromCheckout(input: FinalizeCheckoutInput): Promise<FinalizeOrderResult | null> {
  if (!input.orderId) return null;

  const result = await withOrderDb(async (client) => {
    await cleanupCommerceOrderDrafts(client);

    const draftQuery = input.draftToken
      ? await client.query<OrderDraftRow>(
          `SELECT * FROM commerce_order_drafts
           WHERE public_token = $1
           LIMIT 1`,
          [input.draftToken],
        )
      : await client.query<OrderDraftRow>(
          `SELECT * FROM commerce_order_drafts
           WHERE order_form_id = $1
           LIMIT 1`,
          [input.orderFormId],
        );
    const draft = draftQuery.rows[0];

    const existing = await client.query<CommerceOrderRow>(
      `SELECT * FROM commerce_orders
       WHERE id = $1
       LIMIT 1`,
      [input.orderId],
    );
    if (existing.rows[0]) {
      const existingOrder = mapOrder(existing.rows[0]);
      return {
        groupOrderId: existingOrder.groupOrderId || existingOrder.id,
        split: existingOrder.splitRole === 'child' && existingOrder.splitTotal > 1,
        primaryOrder: existingOrder,
        orders: [existingOrder],
      } satisfies FinalizeOrderResult;
    }

    const itemsCount = input.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const selectedOption = resolveSelectedShippingOptionFromInput(input);
    const splitAllocations = Array.isArray(selectedOption?.allocations) ? selectedOption.allocations : [];
    const groupedAllocations = new Map<string, typeof splitAllocations>();

    for (const allocation of splitAllocations) {
      const key = allocation.originId || `origin-${groupedAllocations.size + 1}`;
      const current = groupedAllocations.get(key) || [];
      current.push(allocation);
      groupedAllocations.set(key, current);
    }

    const shouldSplit = Boolean(selectedOption?.splitShipment && groupedAllocations.size > 1);
    const sourceItemsById = new Map(input.items.map((item) => [item.id, item]));
    const splitGroups = shouldSplit
      ? Array.from(groupedAllocations.entries()).map(([originId, allocations], index, source) => {
          const groupItems: OrderFormItem[] = allocations
            .map((allocation): OrderFormItem | null => {
              const original = sourceItemsById.get(allocation.productId);
              if (!original) return null;
              return {
                ...original,
                quantity: allocation.quantity,
                price: Number(allocation.unitPrice || original.price || 0),
                listPrice: allocation.listPrice ?? original.listPrice,
              };
            })
            .filter((item): item is OrderFormItem => item !== null);
          const groupItemsValue = Number(
            allocations.reduce((sum, allocation) => sum + Number(allocation.lineTotal || 0), 0).toFixed(2),
          );
          return {
            id: `${input.orderId}-${String(index + 1).padStart(2, '0')}`,
            splitSequence: index + 1,
            splitTotal: source.length,
            originId,
            originName: allocations[0]?.originName || originId,
            allocations,
            items: groupItems,
            itemsValue: groupItemsValue,
          };
        })
      : [
          {
            id: input.orderId,
            splitSequence: 1,
            splitTotal: 1,
            originId: selectedOption?.originIds?.[0] || '',
            originName: selectedOption?.originNames?.[0] || '',
            allocations: splitAllocations,
            items: input.items,
            itemsValue: Number(input.totals.itemsValue || 0),
          },
        ];

    const shippingValues = allocateTotalsAcrossSplits(
      splitGroups.map((group) => group.itemsValue),
      Number(input.totals.shippingValue || 0),
    );
    const discountsValues = allocateTotalsAcrossSplits(
      splitGroups.map((group) => group.itemsValue),
      Number(input.totals.discountsValue || 0),
    );

    const createdOrders: CommerceOrderRecord[] = [];
    const customerEmail = normalizeEmail(input.customerEmail) || '';
    const customerAccountId = input.customerAccountId || draft?.customer_account_id || null;

    for (const [index, group] of splitGroups.entries()) {
      const groupShippingValue = Number(shippingValues[index] || 0);
      const groupDiscountsValue = Number(discountsValues[index] || 0);
      const groupTotals = buildTotals({
        value: Number((group.itemsValue + groupShippingValue + groupDiscountsValue).toFixed(2)),
        itemsValue: group.itemsValue,
        shippingValue: groupShippingValue,
        discountsValue: groupDiscountsValue,
        totalizers: [
          { id: 'Items', name: 'Items', value: group.itemsValue },
          { id: 'Shipping', name: 'Shipping', value: groupShippingValue },
          { id: 'Discounts', name: 'Discounts', value: groupDiscountsValue },
        ],
        itemsCount: group.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      });
      const childOption = selectedOption
        ? buildChildShippingOption({
            selectedOption,
            groupItemsValue: group.itemsValue,
            groupShippingValue,
            groupTotal: groupTotals.value,
            splitSequence: group.splitSequence,
            allocationGroup: group.allocations,
          })
        : null;
      const shippingSnapshot: CommerceOrderRecord['shippingSnapshot'] = {
        selectedAddress: input.shippingAddress || null,
        deliveryOptions: childOption && childOption.mode !== 'pickup' ? [childOption] : [],
        pickupOptions:
          childOption && childOption.mode === 'pickup'
            ? [{ ...childOption, address: childOption.pickupAddress || null }]
            : [],
        selectedOptionId: childOption?.id || input.shippingOptions?.selectedOptionId || null,
        selectedMode: childOption?.mode || input.shippingOptions?.selectedMode || null,
      };
      const logistics = {
        ...(input.logistics || {}),
        lastEventAt: new Date().toISOString(),
        selectedOptionId: childOption?.id || input.shippingOptions?.selectedOptionId || null,
        selectedMode: childOption?.mode || input.shippingOptions?.selectedMode || null,
        shippingAddressSummary: input.shippingAddress
          ? [input.shippingAddress.street, input.shippingAddress.number, input.shippingAddress.city, input.shippingAddress.state]
              .filter(Boolean)
              .join(', ')
          : null,
        groupOrderId: shouldSplit ? input.orderId : null,
        splitRole: shouldSplit ? 'child' : 'single',
        splitSequence: group.splitSequence,
        splitTotal: group.splitTotal,
        originId: group.originId || null,
        originName: group.originName || null,
        allocations: group.allocations,
      };
      const publicToken =
        shouldSplit || !draft?.public_token || index > 0 ? createPublicToken('ord') : draft.public_token;

      await client.query(
        `INSERT INTO commerce_orders (
          id, public_token, group_order_id, split_role, split_sequence, split_total, draft_id, customer_account_id, customer_email,
          status, financial_status, fulfillment_status, source, currency, items_json, totals_json, customer_snapshot_json,
          shipping_snapshot_json, payment_snapshot_json, logistics_json, created_at, updated_at, placed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          'pending', 'pending', 'pending', $10, 'BRL', $11::jsonb, $12::jsonb, $13::jsonb,
          $14::jsonb, $15::jsonb, $16::jsonb, NOW(), NOW(), NOW()
        )`,
        [
          group.id,
          publicToken,
          shouldSplit ? input.orderId : null,
          shouldSplit ? 'child' : 'single',
          group.splitSequence,
          group.splitTotal,
          draft?.id || null,
          customerAccountId,
          customerEmail,
          input.source || 'storefront',
          JSON.stringify(group.items || []),
          JSON.stringify(groupTotals),
          JSON.stringify(input.clientProfileData || null),
          JSON.stringify(shippingSnapshot),
          JSON.stringify(input.payments || []),
          JSON.stringify(logistics),
        ],
      );

      await createOrderEvent(client, group.id, {
        kind: 'order_created',
        title: shouldSplit ? `Subpedido ${group.splitSequence}/${group.splitTotal} recebido` : 'Pedido recebido',
        description: shouldSplit
          ? `Pedido consolidado para a origem ${group.originName || group.originId}.`
          : 'Pedido consolidado a partir do checkout da loja.',
        visibility: 'public',
        actorType: 'system',
        payload: {
          itemsCount: groupTotals.itemsCount,
          value: groupTotals.value,
          groupOrderId: shouldSplit ? input.orderId : null,
          splitSequence: group.splitSequence,
          splitTotal: group.splitTotal,
          originId: group.originId || null,
          originName: group.originName || null,
        },
      });

      const query = await client.query<CommerceOrderRow>(
        `SELECT * FROM commerce_orders
         WHERE id = $1
         LIMIT 1`,
        [group.id],
      );
      if (query.rows[0]) {
        createdOrders.push(mapOrder(query.rows[0]));
      }
    }

    if (draft?.id) {
      await client.query(
        `UPDATE commerce_order_drafts
         SET status = 'converted', converted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [draft.id],
      );
    }
    if (!createdOrders.length) return null;
    return {
      groupOrderId: input.orderId,
      split: shouldSplit,
      primaryOrder: createdOrders[0],
      orders: createdOrders,
    } satisfies FinalizeOrderResult;
  });

  return result.available ? result.value : null;
}

export async function listCommerceOrders(filters: OrderListFilters = {}): Promise<{ items: CommerceOrderRecord[]; total: number }> {
  const result = await withOrderDb(async (client) => {
    await cleanupCommerceOrderDrafts(client);
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const values: Array<string | number> = [];
    const where: string[] = [];

    if (filters.q?.trim()) {
      values.push(`%${filters.q.trim().toLowerCase()}%`);
      where.push(`(LOWER(id) LIKE $${values.length} OR LOWER(customer_email) LIKE $${values.length})`);
    }
    if (filters.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }
    if (filters.financialStatus) {
      values.push(filters.financialStatus);
      where.push(`financial_status = $${values.length}`);
    }
    if (filters.fulfillmentStatus) {
      values.push(filters.fulfillmentStatus);
      where.push(`fulfillment_status = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countQuery = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM commerce_orders ${whereSql}`);

    values.push(limit);
    values.push((page - 1) * limit);
    const query = await client.query<CommerceOrderRow>(
      `SELECT *
       FROM commerce_orders
       ${whereSql}
       ORDER BY placed_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );

    return {
      items: query.rows.map(mapOrder),
      total: Number(countQuery.rows[0]?.total || 0),
    };
  });

  return result.available ? result.value : { items: [], total: 0 };
}

export async function getCommerceOrderById(orderId: string): Promise<(CommerceOrderRecord & { events: CommerceOrderEventRecord[] }) | null> {
  if (!orderId) return null;

  const result = await withOrderDb(async (client) => {
    await cleanupCommerceOrderDrafts(client);
    const orderQuery = await client.query<CommerceOrderRow>(
      `SELECT * FROM commerce_orders
       WHERE id = $1
       LIMIT 1`,
      [orderId],
    );
    const row = orderQuery.rows[0];
    if (!row) return null;
    const eventsQuery = await client.query<CommerceOrderEventRow>(
      `SELECT *
       FROM commerce_order_events
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId],
    );
    return {
      ...mapOrder(row),
      events: eventsQuery.rows.map(mapEvent),
    };
  });

  return result.available ? result.value : null;
}

export async function updateCommerceOrder(orderId: string, input: OrderUpdateInput): Promise<(CommerceOrderRecord & { events: CommerceOrderEventRecord[] }) | null> {
  if (!orderId) return null;

  const result = await withOrderDb(async (client) => {
    await cleanupCommerceOrderDrafts(client);
    const currentQuery = await client.query<CommerceOrderRow>(
      `SELECT * FROM commerce_orders
       WHERE id = $1
       LIMIT 1`,
      [orderId],
    );
    const current = currentQuery.rows[0];
    if (!current) return null;

    const currentOrder = mapOrder(current);
    const next = {
      status: input.status || currentOrder.status,
      financialStatus: input.financialStatus || currentOrder.financialStatus,
      fulfillmentStatus: input.fulfillmentStatus || currentOrder.fulfillmentStatus,
      items: input.items || currentOrder.items,
      totals: input.totals || currentOrder.totals,
      customerSnapshot: input.customerSnapshot === undefined ? currentOrder.customerSnapshot : input.customerSnapshot,
      shippingSnapshot: input.shippingSnapshot === undefined ? currentOrder.shippingSnapshot : input.shippingSnapshot,
      logistics:
        input.logistics === undefined
          ? currentOrder.logistics
          : {
              ...(currentOrder.logistics || {}),
              ...(input.logistics || {}),
              lastEventAt: new Date().toISOString(),
            },
    };

    await client.query(
      `UPDATE commerce_orders
       SET status = $2,
           financial_status = $3,
           fulfillment_status = $4,
           items_json = $5::jsonb,
           totals_json = $6::jsonb,
           customer_snapshot_json = $7::jsonb,
           shipping_snapshot_json = $8::jsonb,
           logistics_json = $9::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        orderId,
        next.status,
        next.financialStatus,
        next.fulfillmentStatus,
        JSON.stringify(next.items),
        JSON.stringify(next.totals),
        JSON.stringify(next.customerSnapshot || null),
        JSON.stringify(next.shippingSnapshot || null),
        JSON.stringify(next.logistics || null),
      ],
    );

    if (
      input.title ||
      input.description ||
      input.eventKind ||
      input.status ||
      input.financialStatus ||
      input.fulfillmentStatus ||
      input.items ||
      input.customerSnapshot !== undefined ||
      input.shippingSnapshot !== undefined ||
      input.logistics
    ) {
      await createOrderEvent(client, orderId, {
        kind: input.eventKind || 'order_updated',
        title:
          input.title ||
          (input.status ? `Status alterado para ${input.status}` : 'Pedido atualizado'),
        description: input.description,
        visibility: input.visibility || 'customer',
        actorType: input.actorType || 'admin',
        actorId: input.actorId || null,
        payload: input.payload || {
          status: input.status,
          financialStatus: input.financialStatus,
          fulfillmentStatus: input.fulfillmentStatus,
        },
      });
    }

    const orderQuery = await client.query<CommerceOrderRow>(
      `SELECT * FROM commerce_orders
       WHERE id = $1
       LIMIT 1`,
      [orderId],
    );
    const eventsQuery = await client.query<CommerceOrderEventRow>(
      `SELECT *
       FROM commerce_order_events
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId],
    );
    return orderQuery.rows[0]
      ? {
          ...mapOrder(orderQuery.rows[0]),
          events: eventsQuery.rows.map(mapEvent),
        }
      : null;
  });

  return result.available ? result.value : null;
}

export async function getPublicOrderTracking(publicToken: string): Promise<PublicOrderTrackingRecord | null> {
  if (!publicToken) return null;

  const result = await withOrderDb(async (client) => {
    await cleanupCommerceOrderDrafts(client);
    const orderQuery = await client.query<CommerceOrderRow>(
      `SELECT *
       FROM commerce_orders
       WHERE public_token = $1
       LIMIT 1`,
      [publicToken],
    );
    const row = orderQuery.rows[0];
    if (!row) return null;

    const eventQuery = await client.query<CommerceOrderEventRow>(
      `SELECT *
       FROM commerce_order_events
       WHERE order_id = $1
         AND visibility IN ('public', 'customer')
       ORDER BY created_at DESC`,
      [row.id],
    );

    const order = mapOrder(row);
    const relatedOrders =
      order.groupOrderId || order.splitTotal > 1
        ? (
            await client.query<CommerceOrderRow>(
              `SELECT *
               FROM commerce_orders
               WHERE group_order_id = $1
                  OR id = $1
               ORDER BY split_sequence ASC, placed_at ASC`,
              [order.groupOrderId || order.id],
            )
          ).rows
            .map(mapOrder)
            .filter((related) => related.id !== order.id)
            .map((related) => ({
              orderId: related.id,
              publicToken: related.publicToken,
              splitSequence: related.splitSequence,
              splitTotal: related.splitTotal,
              status: related.status,
              financialStatus: related.financialStatus,
              fulfillmentStatus: related.fulfillmentStatus,
              totals: {
                value: related.totals.value,
                shippingValue: related.totals.shippingValue,
                itemsCount: related.totals.itemsCount,
              },
              items: mapPublicOrderItems(related.items),
              delivery: buildPublicDeliverySummary(related),
            }))
        : [];
    return {
      orderId: order.id,
      publicToken: order.publicToken,
      groupOrderId: order.groupOrderId,
      splitRole: order.splitRole,
      splitSequence: order.splitSequence,
      splitTotal: order.splitTotal,
      status: order.status,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      placedAt: order.placedAt,
      updatedAt: order.updatedAt,
      totals: {
        value: order.totals.value,
        shippingValue: order.totals.shippingValue,
        itemsCount: order.totals.itemsCount,
      },
      items: mapPublicOrderItems(order.items),
      delivery: buildPublicDeliverySummary(order),
      timeline: eventQuery.rows.map(mapEvent),
      relatedOrders: relatedOrders.length ? relatedOrders : undefined,
    };
  });

  return result.available ? result.value : null;
}
