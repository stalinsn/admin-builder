import type { NextRequest } from 'next/server';

import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { sha256 } from '@/features/ecommpanel/server/crypto';
import { normalizeBlogSlug } from '@/features/blog/slug';
import { createBlogCommentRuntime, listPublicBlogCommentsRuntime } from '@/features/blog/server/blogStore';

export const dynamic = 'force-dynamic';

type CreateCommentBody = {
  authorName?: string;
  content?: string;
};

export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  return jsonNoStore({ comments: await listPublicBlogCommentsRuntime(normalizeBlogSlug(slug)) });
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const fingerprintHash = sha256(getRequestFingerprint(req));
  const rate = checkRateLimit(`blog-comment:${fingerprintHash}`, 5, 1000 * 60 * 10);
  if (!rate.allowed) {
    return errorNoStore(429, 'Muitas tentativas de comentário. Tente novamente em alguns minutos.', {
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const { slug } = await context.params;
  const body = (await req.json().catch(() => null)) as CreateCommentBody | null;
  const result = await createBlogCommentRuntime(
    normalizeBlogSlug(slug),
    {
      authorName: body?.authorName || '',
      content: body?.content || '',
    },
    fingerprintHash,
  );

  if (!result) {
    return errorNoStore(400, 'Não foi possível registrar o comentário.');
  }

  return jsonNoStore({
    ok: true,
    visibility: result.visibility,
    comment: result.visibility === 'approved' ? result.comment : null,
  });
}
