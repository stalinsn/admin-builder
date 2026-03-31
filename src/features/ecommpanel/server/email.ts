import 'server-only';

import nodemailer from 'nodemailer';
import { getPanelAuthSettingsDiagnosticsRuntime, getPanelAuthSettingsRuntime } from './panelAuthSettingsStore';

type PanelMailRuntime = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  tlsInsecure: boolean;
  fromName: string;
  fromEmail: string;
};

declare global {
  var __ECOMMPANEL_SMTP_TRANSPORTER__:
    | {
        key: string;
        transporter: ReturnType<typeof nodemailer.createTransport>;
      }
    | undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function getPanelMailRuntime(): Promise<PanelMailRuntime> {
  try {
    const settings = await getPanelAuthSettingsRuntime();
    const diagnostics = await getPanelAuthSettingsDiagnosticsRuntime(settings);
    const host = settings.transport.host || process.env.PANEL_SMTP_HOST?.trim() || '';
    const port = Number(settings.transport.port || process.env.PANEL_SMTP_PORT || 587);
    const secure = settings.transport.secure ?? parseBoolean(process.env.PANEL_SMTP_SECURE, port === 465);
    const user = settings.transport.smtpUser || process.env.PANEL_SMTP_USER?.trim() || undefined;
    const passwordReference = settings.transport.smtpPasswordReference || process.env.PANEL_SMTP_PASSWORD_REFERENCE?.trim() || 'PANEL_SMTP_PASSWORD';
    const password = process.env[passwordReference]?.trim() || process.env.PANEL_SMTP_PASSWORD?.trim() || undefined;
    const tlsInsecure = settings.transport.tlsInsecure ?? parseBoolean(process.env.PANEL_SMTP_TLS_INSECURE, false);
    const fromName = settings.identity.fromName || process.env.PANEL_MAIL_FROM_NAME?.trim() || 'EcommPanel';
    const fromEmail = settings.identity.fromEmail || process.env.PANEL_MAIL_FROM_EMAIL?.trim() || user || '';

    return {
      enabled: diagnostics.mailEnabled,
      host,
      port,
      secure,
      user,
      password,
      tlsInsecure,
      fromName,
      fromEmail,
    };
  } catch {
    const user = process.env.PANEL_SMTP_USER?.trim() || undefined;
    const fromEmail = process.env.PANEL_MAIL_FROM_EMAIL?.trim() || user || '';
    return {
      enabled: false,
      host: process.env.PANEL_SMTP_HOST?.trim() || '',
      port: Number(process.env.PANEL_SMTP_PORT || 587),
      secure: parseBoolean(process.env.PANEL_SMTP_SECURE, false),
      user,
      password: process.env.PANEL_SMTP_PASSWORD?.trim() || undefined,
      tlsInsecure: parseBoolean(process.env.PANEL_SMTP_TLS_INSECURE, false),
      fromName: process.env.PANEL_MAIL_FROM_NAME?.trim() || 'EcommPanel',
      fromEmail,
    };
  }
}

async function getTransporter() {
  const runtime = await getPanelMailRuntime();
  if (!runtime.enabled) return null;

  const key = JSON.stringify({
    host: runtime.host,
    port: runtime.port,
    secure: runtime.secure,
    user: runtime.user,
    fromEmail: runtime.fromEmail,
    tlsInsecure: runtime.tlsInsecure,
  });

  if (!global.__ECOMMPANEL_SMTP_TRANSPORTER__ || global.__ECOMMPANEL_SMTP_TRANSPORTER__.key !== key) {
    global.__ECOMMPANEL_SMTP_TRANSPORTER__ = {
      key,
      transporter: nodemailer.createTransport({
      host: runtime.host,
      port: runtime.port,
      secure: runtime.secure,
      auth: runtime.user || runtime.password ? { user: runtime.user, pass: runtime.password } : undefined,
      tls: runtime.tlsInsecure ? { rejectUnauthorized: false } : undefined,
      }),
    };
  }

  return global.__ECOMMPANEL_SMTP_TRANSPORTER__.transporter;
}

function buildFromAddress(runtime: PanelMailRuntime): string {
  if (!runtime.fromName) return runtime.fromEmail;
  return `"${runtime.fromName.replaceAll('"', '')}" <${runtime.fromEmail}>`;
}

async function resolveResetBaseUrl(origin: string): Promise<string> {
  try {
    const settings = await getPanelAuthSettingsRuntime();
    const configuredBase = settings.links.baseUrl || process.env.PANEL_AUTH_BASE_URL?.trim();
    return configuredBase || origin;
  } catch {
    return process.env.PANEL_AUTH_BASE_URL?.trim() || origin;
  }
}

export async function isPanelMailEnabled(): Promise<boolean> {
  return (await getPanelMailRuntime()).enabled;
}

export async function buildResetPasswordUrl(origin: string, rawToken: string): Promise<string> {
  const base = (await resolveResetBaseUrl(origin)).replace(/\/+$/, '');
  return `${base}/ecommpanel/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function sendPanelResetPasswordEmail(input: {
  to: string;
  name: string;
  rawToken: string;
  origin: string;
  ttlMinutes: number;
}): Promise<boolean> {
  const runtime = await getPanelMailRuntime();
  const transporter = await getTransporter();
  if (!runtime.enabled || !transporter) return false;

  const resetUrl = await buildResetPasswordUrl(input.origin, input.rawToken);
  const safeName = escapeHtml(input.name || input.to);
  const safeResetUrl = escapeHtml(resetUrl);
  const safeToken = escapeHtml(input.rawToken);

  await transporter.sendMail({
    from: buildFromAddress(runtime),
    to: input.to,
    subject: 'Recuperação de acesso ao EcommPanel',
    text: [
      `Olá, ${input.name || input.to}.`,
      '',
      'Recebemos um pedido para redefinir a senha do seu acesso administrativo.',
      `Este link expira em ${input.ttlMinutes} minutos.`,
      '',
      `Abrir redefinição: ${resetUrl}`,
      `Token: ${input.rawToken}`,
      '',
      'Se você não solicitou esta ação, ignore esta mensagem.',
    ].join('\n'),
    html: [
      `<p>Olá, ${safeName}.</p>`,
      '<p>Recebemos um pedido para redefinir a senha do seu acesso administrativo.</p>',
      `<p>Este link expira em <strong>${input.ttlMinutes} minutos</strong>.</p>`,
      `<p><a href="${safeResetUrl}">Abrir redefinição de senha</a></p>`,
      `<p>Se preferir, use este token manualmente:</p>`,
      `<p><code>${safeToken}</code></p>`,
      '<p>Se você não solicitou esta ação, ignore esta mensagem.</p>',
    ].join(''),
  });

  return true;
}

export async function sendPanelLoginTokenEmail(input: {
  to: string;
  name: string;
  code: string;
  ttlMinutes: number;
}): Promise<boolean> {
  const runtime = await getPanelMailRuntime();
  const transporter = await getTransporter();
  if (!runtime.enabled || !transporter) return false;

  const safeName = escapeHtml(input.name || input.to);
  const safeCode = escapeHtml(input.code);

  await transporter.sendMail({
    from: buildFromAddress(runtime),
    to: input.to,
    subject: 'Seu código de acesso ao EcommPanel',
    text: [
      `Olá, ${input.name || input.to}.`,
      '',
      'Use o código abaixo para concluir seu acesso ao painel:',
      '',
      input.code,
      '',
      `Este código expira em ${input.ttlMinutes} minutos e só pode ser usado uma vez.`,
      'Se você não solicitou este acesso, ignore esta mensagem.',
    ].join('\n'),
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;padding:32px;">',
      '<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2ea;">',
      '<p style="margin:0 0 12px;color:#3a4b61;font-size:15px;">EcommPanel</p>',
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#101828;">Olá, ${safeName}</h1>`,
      '<p style="margin:0 0 20px;color:#475467;font-size:16px;line-height:1.6;">Use este código para concluir seu acesso administrativo.</p>',
      `<div style="margin:28px 0;padding:24px 20px;border-radius:18px;background:linear-gradient(135deg,#102a5c,#2158a8);text-align:center;">`,
      `<div style="color:#d9e6ff;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">Código de acesso</div>`,
      `<div style="font-size:40px;letter-spacing:0.28em;font-weight:700;color:#ffffff;font-family:'Courier New',monospace;">${safeCode}</div>`,
      '</div>',
      `<p style="margin:0 0 12px;color:#475467;font-size:15px;line-height:1.6;">Este código expira em <strong>${input.ttlMinutes} minutos</strong> e só pode ser usado uma vez.</p>`,
      '<p style="margin:0;color:#667085;font-size:14px;line-height:1.5;">Se você não solicitou este acesso, ignore esta mensagem.</p>',
      '</div>',
      '</div>',
    ].join(''),
  });

  return true;
}

export async function sendCustomerLoginTokenEmail(input: {
  to: string;
  name: string;
  code: string;
  ttlMinutes: number;
}): Promise<boolean> {
  const runtime = await getPanelMailRuntime();
  const transporter = await getTransporter();
  if (!runtime.enabled || !transporter) return false;

  const safeName = escapeHtml(input.name || input.to);
  const safeCode = escapeHtml(input.code);

  await transporter.sendMail({
    from: buildFromAddress(runtime),
    to: input.to,
    subject: 'Seu código de acesso à sua conta',
    text: [
      `Olá, ${input.name || input.to}.`,
      '',
      'Use o código abaixo para entrar em Minha conta:',
      '',
      input.code,
      '',
      `Este código expira em ${input.ttlMinutes} minutos e só pode ser usado uma vez.`,
      'Se você não solicitou este acesso, ignore esta mensagem.',
    ].join('\n'),
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;padding:32px;">',
      '<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2ea;">',
      '<p style="margin:0 0 12px;color:#3a4b61;font-size:15px;">Minha conta</p>',
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#101828;">Olá, ${safeName}</h1>`,
      '<p style="margin:0 0 20px;color:#475467;font-size:16px;line-height:1.6;">Use este código para concluir o acesso à sua área de cliente.</p>',
      `<div style="margin:28px 0;padding:24px 20px;border-radius:18px;background:linear-gradient(135deg,#102a5c,#2158a8);text-align:center;">`,
      `<div style="color:#d9e6ff;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">Código de acesso</div>`,
      `<div style="font-size:40px;letter-spacing:0.28em;font-weight:700;color:#ffffff;font-family:'Courier New',monospace;">${safeCode}</div>`,
      '</div>',
      `<p style="margin:0 0 12px;color:#475467;font-size:15px;line-height:1.6;">Este código expira em <strong>${input.ttlMinutes} minutos</strong> e só pode ser usado uma vez.</p>`,
      '<p style="margin:0;color:#667085;font-size:14px;line-height:1.5;">Se você não solicitou este acesso, ignore esta mensagem.</p>',
      '</div>',
      '</div>',
    ].join(''),
  });

  return true;
}

export async function sendCustomerRegistrationVerificationEmail(input: {
  to: string;
  name: string;
  code: string;
  ttlMinutes: number;
}): Promise<boolean> {
  const runtime = await getPanelMailRuntime();
  const transporter = await getTransporter();
  if (!runtime.enabled || !transporter) return false;

  const safeName = escapeHtml(input.name || input.to);
  const safeCode = escapeHtml(input.code);

  await transporter.sendMail({
    from: buildFromAddress(runtime),
    to: input.to,
    subject: 'Confirme seu cadastro na loja',
    text: [
      `Olá, ${input.name || input.to}.`,
      '',
      'Use o código abaixo para confirmar o seu cadastro:',
      '',
      input.code,
      '',
      `Este código expira em ${input.ttlMinutes} minutos.`,
      'Se você não iniciou este cadastro, ignore esta mensagem.',
    ].join('\n'),
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;padding:32px;">',
      '<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2ea;">',
      '<p style="margin:0 0 12px;color:#3a4b61;font-size:15px;">Minha conta</p>',
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#101828;">Olá, ${safeName}</h1>`,
      '<p style="margin:0 0 20px;color:#475467;font-size:16px;line-height:1.6;">Confirme o seu cadastro para ativar a conta e proteger os acessos da loja.</p>',
      `<div style="margin:28px 0;padding:24px 20px;border-radius:18px;background:linear-gradient(135deg,#102a5c,#2158a8);text-align:center;">`,
      `<div style="color:#d9e6ff;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">Código de validação</div>`,
      `<div style="font-size:40px;letter-spacing:0.28em;font-weight:700;color:#ffffff;font-family:'Courier New',monospace;">${safeCode}</div>`,
      '</div>',
      `<p style="margin:0 0 12px;color:#475467;font-size:15px;line-height:1.6;">Este código expira em <strong>${input.ttlMinutes} minutos</strong>.</p>`,
      '<p style="margin:0;color:#667085;font-size:14px;line-height:1.5;">Se você não iniciou este cadastro, ignore esta mensagem.</p>',
      '</div>',
      '</div>',
    ].join(''),
  });

  return true;
}
