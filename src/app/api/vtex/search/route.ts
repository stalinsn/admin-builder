import { NextRequest, NextResponse } from 'next/server';
import { getVtexBaseUrl, vtexHeaders } from '../_utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get('term') || '';
    const categoryIds = (searchParams.get('categoryIds') || '').split(',').filter(Boolean);
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '16');
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const qa: string[] = [];
    if (term) qa.push(`ft=${encodeURIComponent(term)}`);
    for (const id of categoryIds) qa.push(`fq=C:${encodeURIComponent(id)}`);
    qa.push(`_from=${from}`);
    qa.push(`_to=${to}`);
    const url = `${getVtexBaseUrl()}/api/catalog_system/pub/products/search?${qa.join('&')}`;

    const res = await fetch(url, { headers: vtexHeaders() });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'VTEX search proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
