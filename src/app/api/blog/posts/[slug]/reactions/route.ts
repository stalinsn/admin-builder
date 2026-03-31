import type { NextRequest } from 'next/server';

import { isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { sha256 } from '@/features/ecommpanel/server/crypto';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { normalizeBlogSlug } from '@/features/blog/slug';
import { getBlogReactionSummaryRuntime, setBlogReactionRuntime } from '@/features/blog/server/blogStore';
import type { BlogReactionValue } from '@/features/blog/types';

export const dynamic = 'force-dynamic';

type ReactionBody = {
  value?: BlogReactionValue | 'clear';
};

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const fingerprintHash = sha256(getRequestFingerprint(req));
  return jsonNoStore({ summary: await getBlogReactionSummaryRuntime(normalizeBlogSlug(slug), fingerprintHash) });
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const fingerprintHash = sha256(getRequestFingerprint(req));
  const rate = checkRateLimit(`blog-reaction:${fingerprintHash}`, 20, 1000 * 60 * 10);
  if (!rate.allowed) {
    return errorNoStore(429, 'Muitas interações registradas. Aguarde alguns instantes.', {
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const body = (await req.json().catch(() => null)) as ReactionBody | null;
  const value = body?.value;
  if (value !== 'like' && value !== 'dislike' && value !== 'clear') {
    return errorNoStore(400, 'Valor de reação inválido.');
  }

  const { slug } = await context.params;
  const summary = await setBlogReactionRuntime(normalizeBlogSlug(slug), {
    value,
    fingerprintHash,
  });

  if (!summary) {
    return errorNoStore(400, 'Não foi possível registrar a reação.');
  }

  return jsonNoStore({ ok: true, summary });
}
