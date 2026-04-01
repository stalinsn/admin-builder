export const CUSTOMER_ACCOUNT_SECURITY = {
  sessionCookieName: 'ecom_customer_session',
  csrfCookieName: 'ecom_customer_csrf',
  sessionTtlMs: 1000 * 60 * 60 * 24 * 30,
  sessionIdleTtlMs: 1000 * 60 * 60 * 24 * 7,
  loginTokenTtlMs: 1000 * 60 * 10,
  loginTokenRequestCooldownMs: 1000 * 90,
  registrationVerificationTtlMs: 1000 * 60 * 30,
  registrationVerificationRequestCooldownMs: 1000 * 90,
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
  },
  rateLimits: {
    register: { limit: 8, windowMs: 1000 * 60 * 15 },
    registerVerify: { limit: 10, windowMs: 1000 * 60 * 15 },
    loginPassword: { limit: 12, windowMs: 1000 * 60 * 10 },
    loginTokenRequest: { limit: 4, windowMs: 1000 * 60 * 10 },
    loginTokenVerify: { limit: 10, windowMs: 1000 * 60 * 10 },
    profileMutation: { limit: 40, windowMs: 1000 * 60 * 5 },
    addressMutation: { limit: 60, windowMs: 1000 * 60 * 5 },
    lgpdExport: { limit: 6, windowMs: 1000 * 60 * 60 },
    lgpdErasureRequest: { limit: 3, windowMs: 1000 * 60 * 60 },
  },
} as const;

export const CUSTOMER_ACCOUNT_RUNTIME = {
  secureCookie: process.env.NODE_ENV === 'production',
} as const;
