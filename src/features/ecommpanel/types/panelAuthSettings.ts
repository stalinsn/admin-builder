export const PANEL_AUTH_SETTINGS_SCHEMA_VERSION = 1;

export type PanelAuthSettings = {
  schemaVersion: number;
  updatedAt: string;
  adminSession: {
    hardTtlMinutes: number;
    idleTtlMinutes: number;
  };
  transport: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    smtpUser: string;
    smtpPasswordReference: string;
    tlsInsecure: boolean;
  };
  identity: {
    fromName: string;
    fromEmail: string;
  };
  links: {
    baseUrl: string;
  };
  customerRegistration: {
    requireEmailVerification: boolean;
    blockDisposableEmailDomains: boolean;
    pendingRegistrationTtlMinutes: number;
    extraBlockedDomains: string;
  };
};

export type PanelAuthSettingsDiagnostics = {
  mailEnabled: boolean;
  smtpPasswordReferenceResolved: boolean;
  effectiveFromEmail: string;
  effectiveSmtpUser: string;
};

export type PanelAuthSessionPolicy = {
  hardTtlMs: number;
  idleTtlMs: number;
};
