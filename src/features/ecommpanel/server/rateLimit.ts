import 'server-only';
import { nowIso } from './crypto';

type Bucket = {
  count: number;
  windowStart: number;
};

type RateLimitStore = Map<string, Bucket>;

declare global {
  var __ECOMMPANEL_RATE_LIMIT__: RateLimitStore | undefined;
}

function getStore(): RateLimitStore {
  if (!global.__ECOMMPANEL_RATE_LIMIT__) {
    global.__ECOMMPANEL_RATE_LIMIT__ = new Map();
  }
  return global.__ECOMMPANEL_RATE_LIMIT__;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  now: string;
} {
  const store = getStore();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: 0,
      now: nowIso(),
    };
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfter),
      now: nowIso(),
    };
  }

  bucket.count += 1;
  store.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: 0,
    now: nowIso(),
  };
}
