import { NextRequest, NextResponse } from 'next/server';
import { getVtexBaseUrl, vtexHeaders } from '../../_utils';

async function forward(req: NextRequest, method: 'GET'|'POST'|'PUT'|'DELETE') {
  try {
    const { pathname, search } = new URL(req.url);
    const parts = pathname.split('/api/vtex/checkout/')[1] || '';
    const target = `${getVtexBaseUrl()}/api/checkout/pub/${parts}${search || ''}`;
    const headers: Record<string, string> = { ...vtexHeaders(), 'Content-Type': req.headers.get('content-type') || 'application/json' };
    const init: RequestInit = { method, headers };
    if (method !== 'GET') {
      init.body = await req.text();
    }
    const res = await fetch(target, init);
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'VTEX checkout proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest)  { return forward(req, 'GET'); }
export async function POST(req: NextRequest) { return forward(req, 'POST'); }
export async function PUT(req: NextRequest)  { return forward(req, 'PUT'); }
export async function DELETE(req: NextRequest){ return forward(req, 'DELETE'); }
