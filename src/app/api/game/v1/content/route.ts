import { NextResponse } from 'next/server';

import { getGameDeliveryBundle } from '@/features/ecommpanel/server/gameDeliveryStore';

export async function GET() {
  const bundle = await getGameDeliveryBundle();
  return NextResponse.json(bundle, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
