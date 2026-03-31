import { NextResponse } from 'next/server';

import { upsertCommerceOrderDraft } from '@/features/ecommerce/server/orderStore';
import type { CommerceOrderPaymentSnapshot } from '@/features/ecommerce/types/commerceOrder';
import type { OrderFormItem, Totalizer } from '@/features/ecommerce/types/orderForm';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? (body.items as OrderFormItem[]) : [];
  const totalizers = Array.isArray(body.totalizers) ? (body.totalizers as Totalizer[]) : [];
  const itemsValue = totalizers.find((item) => item.id === 'Items')?.value || 0;
  const shippingValue = totalizers.find((item) => item.id === 'Shipping')?.value || 0;
  const discountsValue = totalizers.find((item) => item.id === 'Discounts')?.value || 0;
  const itemsCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const draft = await upsertCommerceOrderDraft({
    orderFormId: String(body.orderFormId || ''),
    draftToken: typeof body.draftToken === 'string' ? body.draftToken : null,
    customerEmail: typeof body.customerEmail === 'string' ? body.customerEmail : null,
    customerAccountId: typeof body.customerAccountId === 'string' ? body.customerAccountId : null,
    items,
    clientProfileData: body.clientProfileData && typeof body.clientProfileData === 'object' ? body.clientProfileData : null,
    shippingAddress: body.shippingAddress && typeof body.shippingAddress === 'object' ? body.shippingAddress : null,
    shippingOptions: body.shippingOptions && typeof body.shippingOptions === 'object' ? body.shippingOptions : null,
    payments: Array.isArray(body.payments) ? (body.payments as CommerceOrderPaymentSnapshot[]) : [],
    totals: {
      value: Number(body.value || 0),
      itemsValue: Number(itemsValue || 0),
      shippingValue: Number(shippingValue || 0),
      discountsValue: Number(discountsValue || 0),
      totalizers,
      itemsCount,
    },
    customData: body.customData && typeof body.customData === 'object' ? body.customData : null,
  });

  if (!draft) {
    return NextResponse.json({ error: 'Não foi possível persistir o rascunho.' }, { status: 503 });
  }

  return NextResponse.json({ draft }, { status: 201 });
}
