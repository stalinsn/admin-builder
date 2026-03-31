export const PANEL_SECURITY = {
  sessionCookieName: 'ecommpanel_session',
  csrfCookieName: 'ecommpanel_csrf',
  sessionTtlMs: 1000 * 60 * 60 * 8,
  sessionIdleTtlMs: 1000 * 60 * 30,
  demoSessionTtlMs: 1000 * 60 * 30,
  resetPasswordTtlMs: 1000 * 60 * 15,
  loginTokenTtlMs: 1000 * 60 * 10,
  loginTokenRequestCooldownMs: 1000 * 90,
  loginMaxAttempts: 5,
  loginLockMs: 1000 * 60 * 15,
  rateLimits: {
    login: { limit: 10, windowMs: 1000 * 60 * 10 },
    loginTokenRequest: { limit: 3, windowMs: 1000 * 60 * 10 },
    loginTokenVerify: { limit: 10, windowMs: 1000 * 60 * 10 },
    forgotPassword: { limit: 5, windowMs: 1000 * 60 * 15 },
    resetPassword: { limit: 10, windowMs: 1000 * 60 * 15 },
    adminMutations: { limit: 120, windowMs: 1000 * 60 },
  },
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
  },
} as const;

export const PANEL_RUNTIME = {
  secureCookie: process.env.NODE_ENV === 'production',
} as const;
