import type { NextRequest } from 'next/server';

import { jsonNoStore, errorNoStore } from '@/features/ecommpanel/server/http';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import {
  getCustomerRegistrationSettingsRuntime,
} from '@/features/ecommpanel/server/panelAuthSettingsStore';
import {
  isPanelMailEnabled,
  sendCustomerRegistrationVerificationEmail,
} from '@/features/ecommpanel/server/email';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import { findBlockedEmailDomain } from '@/features/ecommerce/lib/disposableEmailDomains';
import { validateCustomerPassword } from '@/features/ecommerce/lib/passwordPolicy';
import { isTrustedCustomerOrigin } from '@/features/ecommerce/server/customerAuth';
import { registerCustomerAccount, startCustomerRegistration } from '@/features/ecommerce/server/customerAccountStore';
import type { CustomerRegistrationPayload } from '@/features/ecommerce/types/account';

export const dynamic = 'force-dynamic';

function validateRegistration(payload: CustomerRegistrationPayload): string | null {
  if (!payload.email?.trim()) return 'Informe um e-mail.';
  if (!payload.taxDocument?.trim()) return 'Informe CPF ou CNPJ.';
  if (!payload.password?.trim()) return 'Defina uma senha para acessar sua conta.';
  const passwordError = validateCustomerPassword(payload.password.trim());
  if (passwordError) return passwordError;
  if (!payload.acceptedPrivacy || !payload.acceptedTerms) return 'É necessário aceitar os termos e a política de privacidade.';
  if (payload.kind === 'individual') {
    if (!payload.firstName?.trim()) return 'Informe o primeiro nome.';
    if (!payload.lastName?.trim()) return 'Informe o sobrenome.';
    if (!payload.birthDate?.trim()) return 'Informe a data de nascimento.';
  }
  if (payload.kind === 'company' && !payload.companyName?.trim()) {
    return 'Informe a razão social da empresa.';
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `customer:register:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.register.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.register.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas de cadastro. Aguarde para continuar.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as CustomerRegistrationPayload | null;
  if (!body) {
    return errorNoStore(400, 'Dados de cadastro inválidos.');
  }

  const validationError = validateRegistration(body);
  if (validationError) {
    return errorNoStore(400, validationError);
  }

  const settings = await getCustomerRegistrationSettingsRuntime().catch(() => null);
  const registrationSettings = settings || {
    requireEmailVerification: true,
    blockDisposableEmailDomains: true,
    pendingRegistrationTtlMinutes: 30,
    extraBlockedDomains: '',
  };

  if (registrationSettings.blockDisposableEmailDomains) {
    const blockedDomain = findBlockedEmailDomain(body.email, registrationSettings.extraBlockedDomains);
    if (blockedDomain) {
      return errorNoStore(400, 'Este domínio de e-mail não está liberado para cadastro no momento.', {
        blockedDomain,
      });
    }
  }

  if (!registrationSettings.requireEmailVerification) {
    const account = await registerCustomerAccount(body, { verifiedEmail: true });
    if (!account) {
      return errorNoStore(503, 'Não foi possível concluir o cadastro no momento.');
    }

    return jsonNoStore({
      ok: true,
      requiresVerification: false,
      message: 'Cadastro concluído. Agora você já pode entrar com e-mail ou CPF e sua senha.',
      email: account.profile.email,
    });
  }

  const mailEnabled = await isPanelMailEnabled();
  if (!mailEnabled && process.env.NODE_ENV === 'production') {
    return errorNoStore(503, 'A validação por e-mail está indisponível no momento.');
  }

  const staged = await startCustomerRegistration(body, {
    ttlMs: registrationSettings.pendingRegistrationTtlMinutes * 60 * 1000,
    requestCooldownMs: CUSTOMER_ACCOUNT_SECURITY.registrationVerificationRequestCooldownMs,
  });

  if (!staged.ok) {
    if (staged.reason === 'account-exists') {
      return errorNoStore(409, 'Já existe uma conta ativa com este e-mail. Entre na sua conta para continuar.');
    }
    if (staged.reason === 'document-in-use') {
      return errorNoStore(409, 'Este CPF ou CNPJ já está vinculado a outro cadastro.');
    }
    if (staged.reason === 'cooldown-active') {
      const response = errorNoStore(429, 'Já existe um código recente para este cadastro. Aguarde para solicitar outro.', {
        expiresAt: staged.expiresAt,
        retryAfterSeconds: staged.retryAfterSeconds,
      });
      if (staged.retryAfterSeconds) {
        response.headers.set('Retry-After', String(staged.retryAfterSeconds));
      }
      return response;
    }
    if (staged.reason === 'invalid-email-domain') {
      return errorNoStore(400, 'Este domínio de e-mail não está liberado para cadastro no momento.');
    }
    if (staged.reason === 'mail-unavailable') {
      return errorNoStore(503, 'O envio do código de validação está indisponível no momento.');
    }
    return errorNoStore(503, 'Não foi possível iniciar o cadastro no momento.');
  }

  if (!staged.requiresVerification) {
    return errorNoStore(500, 'A política de cadastro retornou um estado inesperado.');
  }

  try {
    if (mailEnabled) {
      await sendCustomerRegistrationVerificationEmail({
        to: staged.email,
        name: body.kind === 'company' ? body.companyName || body.tradeName || staged.email : [body.firstName, body.lastName].filter(Boolean).join(' ') || staged.email,
        code: staged.debugCode || '',
        ttlMinutes: registrationSettings.pendingRegistrationTtlMinutes,
      });
    }
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return errorNoStore(503, 'Não foi possível enviar o código de validação no momento.');
    }
  }

  return jsonNoStore({
    ok: true,
    requiresVerification: true,
    message: 'Código enviado. Confirme o e-mail para ativar a conta.',
    email: staged.email,
    expiresAt: staged.expiresAt,
    ...(process.env.NODE_ENV !== 'production' && staged.debugCode ? { debugCode: staged.debugCode } : {}),
  });
}
