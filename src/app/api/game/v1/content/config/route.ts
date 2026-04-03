import { NextResponse } from 'next/server';

import { getGameDeliveryBundle } from '@/features/ecommpanel/server/gameDeliveryStore';

export async function GET() {
  const bundle = await getGameDeliveryBundle();
  return NextResponse.json(
    {
      generatedAt: bundle.generatedAt,
      manifest: bundle.manifest,
      config: bundle.config,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
