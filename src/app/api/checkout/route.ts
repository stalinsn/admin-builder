import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildCheckoutPurchaseEvent } from '@/features/analytics/server/eventStore';
import {
  ensureCustomerCheckoutAccount,
  projectCustomerCheckoutOrders,
} from '@/features/ecommerce/server/customerAccountStore';
import { finalizeCommerceOrderFromCheckout } from '@/features/ecommerce/server/orderStore';
import type { ShippingOption } from '@/features/ecommerce/types/orderForm';

function resolveSelectedShippingOption(body: {
  shipping?: {
    deliveryOptions?: ShippingOption[];
    pickupOptions?: Array<ShippingOption & { address?: Record<string, unknown> | null }>;
    selectedOptionId?: string | null;
    selectedMode?: 'delivery' | 'pickup' | null;
  };
}): ShippingOption | null {
  const deliveryOptions = Array.isArray(body.shipping?.deliveryOptions) ? body.shipping.deliveryOptions : [];
  const pickupOptions = Array.isArray(body.shipping?.pickupOptions) ? body.shipping.pickupOptions : [];
  const selectedId = typeof body.shipping?.selectedOptionId === 'string' ? body.shipping.selectedOptionId : '';

  return (
    deliveryOptions.find((option) => option.id === selectedId) ||
    pickupOptions.find((option) => option.id === selectedId) ||
    (body.shipping?.selectedMode === 'pickup' ? pickupOptions[0] : deliveryOptions[0]) ||
    deliveryOptions[0] ||
    pickupOptions[0] ||
    null
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Quick validations similar to VTEX order placement expectations
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
  }
  if (!body.clientProfileData || !body.clientProfileData.email) {
    return NextResponse.json({ error: 'Dados do cliente incompletos' }, { status: 400 });
  }
  if (!body.shipping || !body.shipping.selectedAddress) {
    return NextResponse.json({ error: 'Endereço não informado' }, { status: 400 });
  }
  if (!Array.isArray(body.payments) || body.payments.length === 0) {
    return NextResponse.json({ error: 'Forma de pagamento não selecionada' }, { status: 400 });
  }

  // Emulate order id creation
  const orderId = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  const itemsCount = Array.isArray(body.items)
    ? body.items.reduce((sum: number, item: { quantity?: number }) => sum + (Number(item?.quantity) || 0), 0)
    : 0;
  const itemsValue = Array.isArray(body.totalizers)
    ? body.totalizers.find((item: { id?: string }) => item?.id === 'Items')?.value || 0
    : 0;
  const shippingValue = Array.isArray(body.totalizers)
    ? body.totalizers.find((item: { id?: string }) => item?.id === 'Shipping')?.value || 0
    : 0;
  const discountValue = Array.isArray(body.totalizers)
    ? body.totalizers.find((item: { id?: string }) => item?.id === 'Discounts')?.value || 0
    : 0;
  const selectedShippingOption = resolveSelectedShippingOption(body);

  await buildCheckoutPurchaseEvent(req, {
    orderId,
    value: Number(body.value) || 0,
    itemsCount,
    paymentMethod: body.payments?.[0]?.system,
    shippingValue: Number(shippingValue) || 0,
    discountValue: Number(discountValue) || 0,
    postalCode: body.shipping?.selectedAddress?.postalCode,
    city: body.shipping?.selectedAddress?.city,
    state: body.shipping?.selectedAddress?.state,
    country: body.shipping?.selectedAddress?.country,
  });

  const accountId = await ensureCustomerCheckoutAccount({
    email: String(body.clientProfileData?.email || ''),
    shippingAddress: body.shipping?.selectedAddress || null,
    clientProfileData: body.clientProfileData || null,
  });

  const orderResult = await finalizeCommerceOrderFromCheckout({
    orderId,
    orderFormId: String(body.orderFormId || ''),
    draftToken: typeof body.draftToken === 'string' ? body.draftToken : null,
    customerEmail: String(body.clientProfileData?.email || ''),
    customerAccountId: accountId,
    items: Array.isArray(body.items) ? body.items : [],
    clientProfileData: body.clientProfileData || null,
    shippingAddress: body.shipping?.selectedAddress || null,
    shippingOptions: {
      deliveryOptions: Array.isArray(body.shipping?.deliveryOptions) ? body.shipping.deliveryOptions : [],
      pickupOptions: Array.isArray(body.shipping?.pickupOptions) ? body.shipping.pickupOptions : [],
      selectedOptionId: typeof body.shipping?.selectedOptionId === 'string' ? body.shipping.selectedOptionId : selectedShippingOption?.id || null,
      selectedMode:
        body.shipping?.selectedMode === 'pickup' || body.shipping?.selectedMode === 'delivery'
          ? body.shipping.selectedMode
          : selectedShippingOption?.mode || null,
    },
    payments: Array.isArray(body.payments) ? body.payments : [],
    totals: {
      value: Number(body.value) || 0,
      itemsValue: Number(itemsValue) || 0,
      shippingValue: Number(shippingValue) || 0,
      discountsValue: Number(discountValue) || 0,
      totalizers: Array.isArray(body.totalizers) ? body.totalizers : [],
      itemsCount,
    },
    customData: body.customData && typeof body.customData === 'object' ? body.customData : null,
    logistics: selectedShippingOption
      ? {
          selectedOptionId: selectedShippingOption.id,
          selectedMode: selectedShippingOption.mode,
          optionLabel: selectedShippingOption.name,
          estimate: selectedShippingOption.estimate,
          estimateDaysMin: selectedShippingOption.estimateDaysMin,
          estimateDaysMax: selectedShippingOption.estimateDaysMax,
          originIds: selectedShippingOption.originIds,
          originNames: selectedShippingOption.originNames,
          policyIds: selectedShippingOption.policyIds,
          matchedZoneIds: selectedShippingOption.matchedZoneIds,
          pickupInstructions: selectedShippingOption.pickupInstructions || null,
          pickupAddress: selectedShippingOption.pickupAddress || null,
          splitShipment: Boolean(selectedShippingOption.splitShipment),
        }
      : null,
  });

  if (!orderResult) {
    return NextResponse.json({ error: 'Não foi possível consolidar o pedido.' }, { status: 500 });
  }

  if (accountId && orderResult.orders.length) {
    await projectCustomerCheckoutOrders({
      accountId,
      paymentMethod: String(body.payments?.[0]?.system || 'não informado'),
      orders: orderResult.orders.map((order) => ({
        id: order.id,
        groupOrderId: order.groupOrderId || null,
        splitSequence: order.splitSequence,
        splitTotal: order.splitTotal,
        totalValue: order.totals.value,
        shippingValue: order.totals.shippingValue,
        items: order.items,
        shippingAddress: order.shippingSnapshot?.selectedAddress || null,
      })),
    });
  }

  // In real integration, forward to a gateway and persist. Here we just acknowledge.
  return NextResponse.json(
    {
      orderId,
      split: Boolean(orderResult.split),
      orderIds: orderResult.orders.map((order) => order.id),
      primaryOrderId: orderResult.primaryOrder.id || orderId,
      status: 'created',
      publicToken: orderResult.primaryOrder.publicToken || null,
      publicTokens: orderResult.orders.map((order) => ({
        orderId: order.id,
        publicToken: order.publicToken,
      })),
    },
    { status: 201 },
  );
}
