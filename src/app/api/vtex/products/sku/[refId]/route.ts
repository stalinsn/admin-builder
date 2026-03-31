import { NextRequest, NextResponse } from 'next/server';
import { getVtexBaseUrl, vtexHeaders } from '../../../_utils';

// Lookup SKU information by product refId via VTEX search API as a fallback. VTEX has different endpoints per setup.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ refId: string }> }) {
  try {
  const { refId } = await ctx.params;
  const term = refId;
    const url = `${getVtexBaseUrl()}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=0`;
    const res = await fetch(url, { headers: vtexHeaders() });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'VTEX sku lookup error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
