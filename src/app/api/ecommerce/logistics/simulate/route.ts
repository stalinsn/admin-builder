import { NextResponse } from 'next/server';

import { mapLogisticsResultToShippingResponse } from '@/features/ecommerce/server/logisticsApiMapping';
import { simulateLogisticsRuntime } from '@/features/ecommerce/server/logisticsStore';
import type { Address } from '@/features/ecommerce/types/orderForm';
import type { LogisticsServiceMode, LogisticsSimulationItemInput } from '@/features/ecommerce/types/logistics';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const items = Array.isArray((body as { items?: unknown[] }).items)
    ? ((body as { items: LogisticsSimulationItemInput[] }).items || [])
    : [];
  const address = body.address && typeof body.address === 'object' ? (body.address as Address) : null;
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode : address?.postalCode;
  const mode = body.mode === 'pickup' ? 'pickup' : body.mode === 'delivery' ? 'delivery' : undefined;

  const result = await simulateLogisticsRuntime({
    items,
    address,
    postalCode,
    mode: mode as LogisticsServiceMode | undefined,
  });

  return NextResponse.json(mapLogisticsResultToShippingResponse(result), { status: 200 });
}
