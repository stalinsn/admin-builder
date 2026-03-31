import { NextRequest, NextResponse } from 'next/server';
import { getVtexBaseUrl, vtexHeaders } from '../../vtex/_utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'Missing GraphQL query' }, { status: 400 });
    }
    const res = await fetch(`${getVtexBaseUrl()}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vtexHeaders() },
      body: JSON.stringify({ query: body.query, variables: body.variables || {} }),
      // VTEX GraphQL often accepts unauthenticated queries; headers added when configured
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'VTEX GraphQL proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
