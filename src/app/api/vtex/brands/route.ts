import { NextResponse } from 'next/server';
import { getVtexBaseUrl, vtexHeaders } from '../_utils';

export async function GET() {
  try {
    const url = `${getVtexBaseUrl()}/api/catalog_system/pvt/brand/list`;
    const res = await fetch(url, { headers: vtexHeaders() });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'VTEX brands proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
