import { NextResponse } from 'next/server';

import { getLogisticsStorefrontSettingsRuntime } from '@/features/ecommerce/server/logisticsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getLogisticsStorefrontSettingsRuntime();
  return NextResponse.json(settings, { status: 200 });
}
