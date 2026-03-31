import { getPublicOrderTracking } from '@/features/ecommerce/server/orderStore';
import { errorPublic, jsonPublic, PUBLIC_API_SHORT_CACHE } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await context.params;
  const tracking = await getPublicOrderTracking(publicToken);
  if (!tracking) {
    return errorPublic(404, 'Pedido não encontrado.', PUBLIC_API_SHORT_CACHE);
  }

  return jsonPublic(tracking);
}
