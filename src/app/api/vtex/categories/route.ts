import { NextResponse } from 'next/server';
import { getVtexBaseUrl, vtexHeaders } from '../_utils';

export const revalidate = 3600; // 1 hour ISR for route handlers

export async function GET() {
  try {
    const url = `${getVtexBaseUrl()}/api/catalog_system/pub/category/tree/3`;
    const res = await fetch(url, { headers: vtexHeaders(), next: { revalidate } });
    const data = await res.json();
    return new NextResponse(JSON.stringify(data), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'VTEX categories proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
