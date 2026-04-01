import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';

export type PasswordPolicyCheck = {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol';
  label: string;
  passed: boolean;
};

export function evaluateCustomerPassword(password: string): PasswordPolicyCheck[] {
  const value = password || '';
  const policy = CUSTOMER_ACCOUNT_SECURITY.passwordPolicy;

  return [
    {
      id: 'length',
      label: `Pelo menos ${policy.minLength} caracteres`,
      passed: value.length >= policy.minLength,
    },
    {
      id: 'uppercase',
      label: 'Ao menos 1 letra maiúscula',
      passed: !policy.requireUppercase || /[A-ZÀ-Ý]/.test(value),
    },
    {
      id: 'lowercase',
      label: 'Ao menos 1 letra minúscula',
      passed: !policy.requireLowercase || /[a-zà-ÿ]/.test(value),
    },
    {
      id: 'number',
      label: 'Ao menos 1 número',
      passed: !policy.requireNumber || /\d/.test(value),
    },
    {
      id: 'symbol',
      label: 'Ao menos 1 símbolo',
      passed: !policy.requireSymbol || /[^A-Za-zÀ-ÿ0-9]/.test(value),
    },
  ];
}

export function validateCustomerPassword(password: string): string | null {
  const failed = evaluateCustomerPassword(password).filter((check) => !check.passed);
  if (!failed.length) return null;

  switch (failed[0]?.id) {
    case 'length':
      return `A senha deve ter pelo menos ${CUSTOMER_ACCOUNT_SECURITY.passwordPolicy.minLength} caracteres.`;
    case 'uppercase':
      return 'A senha precisa ter pelo menos uma letra maiúscula.';
    case 'lowercase':
      return 'A senha precisa ter pelo menos uma letra minúscula.';
    case 'number':
      return 'A senha precisa ter pelo menos um número.';
    case 'symbol':
      return 'A senha precisa ter pelo menos um símbolo.';
    default:
      return 'A senha não atende à política de segurança.';
  }
}
