import { mapLogisticsResultToShippingResponse } from '@/features/ecommerce/server/logisticsApiMapping';
import { simulateLogisticsRuntime } from '@/features/ecommerce/server/logisticsStore';
import { errorPublic, jsonPublic, PUBLIC_API_SHORT_CACHE } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorPublic(400, 'Payload inválido para simulação logística.', PUBLIC_API_SHORT_CACHE);
  }

  const result = await simulateLogisticsRuntime({
    postalCode: typeof body.postalCode === 'string' ? body.postalCode : undefined,
    address: body.address && typeof body.address === 'object' ? body.address : undefined,
    mode: body.mode === 'pickup' || body.mode === 'delivery' ? body.mode : undefined,
    items: Array.isArray(body.items) ? body.items : [],
  });

  return jsonPublic(mapLogisticsResultToShippingResponse(result), {
    cacheControl: PUBLIC_API_SHORT_CACHE,
  });
}
