'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { isOn } from '../../config/featureFlags';
import { evaluateCustomerPassword, validateCustomerPassword } from '../../lib/passwordPolicy';
import { useOrderForm } from '../../state/OrderFormContext';
import type {
  CustomerAccountAddress,
  CustomerAccountMeResponse,
  CustomerAccountRecord,
  CustomerAccountSession,
  CustomerLgpdExportPackage,
} from '../../types/account';
import {
  buildAccountName,
  buildProfileForm,
  EMPTY_ADDRESS_FORM,
  EMPTY_REGISTER_FORM,
  formatCurrency,
  formatDate,
  maskCEP,
  maskCpfCnpj,
  maskPhone,
  maskUF,
  prevHasShipping,
  type ProfileFormState,
} from './accountView.shared';

type AccountTab = 'overview' | 'orders' | 'profile' | 'addresses' | 'privacy';
type AuthTab = 'login' | 'register';
type AccountEntryMode = 'account' | 'login';

export default function AccountView({
  initialAuthTab = 'login',
  entryMode = 'account',
}: {
  initialAuthTab?: AuthTab;
  entryMode?: AccountEntryMode;
}) {
  const { orderForm, setOrderForm } = useOrderForm();
  const canUseAccount = isOn('ecom.account');
  const [account, setAccount] = useState<CustomerAccountRecord | null>(null);
  const [session, setSession] = useState<CustomerAccountSession | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AccountTab>('overview');
  const [authTab, setAuthTab] = useState<AuthTab>(initialAuthTab);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showCodeLogin, setShowCodeLogin] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerVerifyLoading, setRegisterVerifyLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [privacyExportLoading, setPrivacyExportLoading] = useState(false);
  const [privacyErasureLoading, setPrivacyErasureLoading] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_REGISTER_FORM);
  const [registerForm, setRegisterForm] = useState<ProfileFormState & { password: string; passwordConfirm: string }>({
    ...EMPTY_REGISTER_FORM,
    password: '',
    passwordConfirm: '',
  });
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);
  const [privacyExportPackage, setPrivacyExportPackage] = useState<CustomerLgpdExportPackage | null>(null);
  const [privacyRequestRegistered, setPrivacyRequestRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [registerVerificationEmail, setRegisterVerificationEmail] = useState('');
  const [registerVerificationCode, setRegisterVerificationCode] = useState('');
  const [registerVerificationPending, setRegisterVerificationPending] = useState(false);

  async function loadAccount() {
    setLoading(true);
    try {
      const response = await fetch('/api/ecommerce/account/me', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as CustomerAccountMeResponse & { csrfToken?: string } | null;
      if (!response.ok || !payload) {
        setAccount(null);
        setSession(null);
        setCsrfToken('');
        return;
      }

      setSession(payload.session);
      setAccount(payload.account);
      setCsrfToken(payload.csrfToken || '');
      setPrivacyRequestRegistered(Boolean(payload.account?.privacy.erasureRequestedAt));
      setProfileForm(buildProfileForm(payload.account));
      if (payload.account) {
        setOrderForm((prev) => ({
          ...prev,
          loggedIn: true,
          clientProfileData: {
            ...prev.clientProfileData,
            firstName: payload.account?.profile.firstName || prev.clientProfileData?.firstName,
            lastName: payload.account?.profile.lastName || prev.clientProfileData?.lastName,
            email: payload.account?.profile.email || prev.clientProfileData?.email,
            phone: payload.account?.profile.phone || prev.clientProfileData?.phone,
            document: payload.account?.profile.taxDocument || prev.clientProfileData?.document,
          },
        }));
        if (!prevHasShipping(orderForm.shipping.selectedAddress) && payload.account.addresses[0]) {
          const defaultAddress = payload.account.addresses.find((entry) => entry.isDefaultShipping) || payload.account.addresses[0];
          setOrderForm((prev) => ({
            ...prev,
            shipping: {
              ...prev.shipping,
              selectedAddress: {
                street: defaultAddress.street,
                number: defaultAddress.number,
                complement: defaultAddress.complement,
                neighborhood: defaultAddress.neighborhood,
                city: defaultAddress.city,
                state: defaultAddress.state,
                postalCode: defaultAddress.postalCode,
                country: defaultAddress.country,
              },
            },
          }));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoginIdentifier(orderForm.clientProfileData?.email || '');
    setLoginEmail(orderForm.clientProfileData?.email || '');
    setRegisterForm((prev) => ({
      ...prev,
      email: orderForm.clientProfileData?.email || prev.email,
      firstName: orderForm.clientProfileData?.firstName || prev.firstName,
      lastName: orderForm.clientProfileData?.lastName || prev.lastName,
      phone: orderForm.clientProfileData?.phone || prev.phone,
      taxDocument: orderForm.clientProfileData?.document || prev.taxDocument,
    }));
  }, [orderForm.clientProfileData?.document, orderForm.clientProfileData?.email, orderForm.clientProfileData?.firstName, orderForm.clientProfileData?.lastName, orderForm.clientProfileData?.phone]);

  useEffect(() => {
    void loadAccount();
  }, []);

  useEffect(() => {
    setAuthTab(initialAuthTab);
  }, [initialAuthTab]);

  const stats = useMemo(() => ({
    totalOrders: account?.orders.length || 0,
    totalAddresses: account?.addresses.length || 0,
    lastOrder: account?.orders[0] || null,
    defaultAddress: account?.addresses.find((address) => address.isDefaultShipping) || account?.addresses[0] || null,
  }), [account]);

  const passwordChecks = useMemo(() => evaluateCustomerPassword(registerForm.password), [registerForm.password]);
  const passwordPolicyError = useMemo(() => validateCustomerPassword(registerForm.password.trim()), [registerForm.password]);

  async function loginWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setError('Informe e-mail ou CPF e sua senha.');
      return;
    }
    setVerifyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommerce/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; csrfToken?: string; account?: CustomerAccountRecord; session?: CustomerAccountSession } | null;
      if (!response.ok || !payload?.account || !payload?.session) {
        setError(payload?.error || 'Não foi possível entrar com essas credenciais.');
        return;
      }
      setAccount(payload.account);
      setSession(payload.session);
      setCsrfToken(payload.csrfToken || '');
      setProfileForm(buildProfileForm(payload.account));
      setSuccess('Conta carregada com sucesso.');
      setTab('overview');
      setCode('');
      setLoginPassword('');
      setOrderForm((prev) => ({
        ...prev,
        loggedIn: true,
        clientProfileData: {
          ...prev.clientProfileData,
          firstName: payload.account?.profile.firstName || prev.clientProfileData?.firstName,
          lastName: payload.account?.profile.lastName || prev.clientProfileData?.lastName,
          email: payload.account?.profile.email || prev.clientProfileData?.email,
          phone: payload.account?.profile.phone || prev.clientProfileData?.phone,
          document: payload.account?.profile.taxDocument || prev.clientProfileData?.document,
        },
      }));
    } finally {
      setVerifyLoading(false);
    }
  }

  async function requestCode() {
    if (!loginEmail.trim()) {
      setError('Informe o e-mail para solicitar o código.');
      return;
    }
    setRequestLoading(true);
    setError(null);
    setSuccess(null);
    setDebugCode(null);
    try {
      const response = await fetch('/api/ecommerce/account/login-token/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string; debugCode?: string } | null;
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível solicitar o código.');
        return;
      }
      setCodeSent(true);
      setSuccess(payload?.message || 'Código enviado com sucesso.');
      setDebugCode(payload?.debugCode || null);
    } finally {
      setRequestLoading(false);
    }
  }

  async function verifyCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!loginEmail.trim() || !code.trim()) {
      setError('Informe e-mail e código.');
      return;
    }
    setVerifyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommerce/account/login-token/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, code }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; csrfToken?: string; account?: CustomerAccountRecord; session?: CustomerAccountSession } | null;
      if (!response.ok || !payload?.account || !payload?.session) {
        setError(payload?.error || 'Código inválido ou expirado.');
        return;
      }

      setAccount(payload.account);
      setSession(payload.session);
      setCsrfToken(payload.csrfToken || '');
      setProfileForm(buildProfileForm(payload.account));
      setSuccess('Conta carregada com sucesso.');
      setCode('');
      setTab('overview');
      setOrderForm((prev) => ({
        ...prev,
        loggedIn: true,
        clientProfileData: {
          ...prev.clientProfileData,
          firstName: payload.account?.profile.firstName || prev.clientProfileData?.firstName,
          lastName: payload.account?.profile.lastName || prev.clientProfileData?.lastName,
          email: payload.account?.profile.email || prev.clientProfileData?.email,
          phone: payload.account?.profile.phone || prev.clientProfileData?.phone,
          document: payload.account?.profile.taxDocument || prev.clientProfileData?.document,
        },
      }));
    } finally {
      setVerifyLoading(false);
    }
  }

  async function submitRegistration() {
    if (!registerForm.password.trim()) {
      setError('Defina uma senha para acessar sua conta.');
      return;
    }
    if (passwordPolicyError) {
      setError(passwordPolicyError);
      return;
    }
    if (registerForm.password !== registerForm.passwordConfirm) {
      setError('A confirmação da senha não confere.');
      return;
    }
    setRegisterLoading(true);
    setError(null);
    setSuccess(null);
    setDebugCode(null);
    try {
      const response = await fetch('/api/ecommerce/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...registerForm,
          password: registerForm.password,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        email?: string;
        debugCode?: string;
        requiresVerification?: boolean;
      } | null;
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível concluir o cadastro.');
        return;
      }
      const nextEmail = payload?.email || registerForm.email;
      setLoginEmail(nextEmail);
      setLoginIdentifier(nextEmail);
      setSuccess(payload?.message || 'Cadastro concluído.');
      setCode('');
      if (payload?.requiresVerification) {
        setRegisterVerificationPending(true);
        setRegisterVerificationEmail(nextEmail);
        setRegisterVerificationCode('');
        setDebugCode(payload?.debugCode || null);
        return;
      }

      setAuthTab('login');
      setShowCodeLogin(false);
      setCodeSent(false);
      setRegisterVerificationPending(false);
      setRegisterVerificationEmail('');
      setRegisterVerificationCode('');
      setDebugCode(null);
    } finally {
      setRegisterLoading(false);
    }
  }

  async function registerAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitRegistration();
  }

  async function verifyRegisterCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!registerVerificationEmail.trim() || !registerVerificationCode.trim()) {
      setError('Informe o e-mail e o código para ativar o cadastro.');
      return;
    }

    setRegisterVerifyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommerce/account/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerVerificationEmail,
          code: registerVerificationCode,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        csrfToken?: string;
        account?: CustomerAccountRecord;
        session?: CustomerAccountSession;
      } | null;
      if (!response.ok || !payload?.account || !payload?.session) {
        setError(payload?.error || 'Não foi possível validar o cadastro.');
        return;
      }

      setAccount(payload.account);
      setSession(payload.session);
      setCsrfToken(payload.csrfToken || '');
      setProfileForm(buildProfileForm(payload.account));
      setRegisterVerificationPending(false);
      setRegisterVerificationCode('');
      setRegisterVerificationEmail('');
      setDebugCode(null);
      setSuccess('Cadastro confirmado e conta ativada com sucesso.');
      setTab('overview');
      setOrderForm((prev) => ({
        ...prev,
        loggedIn: true,
        clientProfileData: {
          ...prev.clientProfileData,
          firstName: payload.account?.profile.firstName || prev.clientProfileData?.firstName,
          lastName: payload.account?.profile.lastName || prev.clientProfileData?.lastName,
          email: payload.account?.profile.email || prev.clientProfileData?.email,
          phone: payload.account?.profile.phone || prev.clientProfileData?.phone,
          document: payload.account?.profile.taxDocument || prev.clientProfileData?.document,
        },
      }));
    } finally {
      setRegisterVerifyLoading(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken) return;
    setProfileSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommerce/account/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(profileForm),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; account?: CustomerAccountRecord } | null;
      if (!response.ok || !payload?.account) {
        setError(payload?.error || 'Não foi possível atualizar o cadastro.');
        return;
      }
      setAccount(payload.account);
      setProfileForm(buildProfileForm(payload.account));
      setSuccess('Cadastro atualizado com sucesso.');
      setOrderForm((prev) => ({
        ...prev,
        clientProfileData: {
          ...prev.clientProfileData,
          firstName: payload.account?.profile.firstName || prev.clientProfileData?.firstName,
          lastName: payload.account?.profile.lastName || prev.clientProfileData?.lastName,
          email: payload.account?.profile.email || prev.clientProfileData?.email,
          phone: payload.account?.profile.phone || prev.clientProfileData?.phone,
          document: payload.account?.profile.taxDocument || prev.clientProfileData?.document,
        },
      }));
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken) return;
    setAddressSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const target = addressForm.id ? `/api/ecommerce/account/addresses/${addressForm.id}` : '/api/ecommerce/account/addresses';
      const response = await fetch(target, {
        method: addressForm.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(addressForm),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; address?: CustomerAccountAddress } | null;
      if (!response.ok || !payload?.address) {
        setError(payload?.error || 'Não foi possível salvar o endereço.');
        return;
      }

      await loadAccount();
      setAddressForm(EMPTY_ADDRESS_FORM);
      setSuccess(addressForm.id ? 'Endereço atualizado.' : 'Endereço cadastrado.');
    } finally {
      setAddressSaving(false);
    }
  }

  async function deleteAddress(addressId: string) {
    if (!csrfToken) return;
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/ecommerce/account/addresses/${addressId}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error || 'Não foi possível remover o endereço.');
      return;
    }
    await loadAccount();
    setSuccess('Endereço removido.');
  }

  async function logout() {
    if (!csrfToken) return;
    await fetch('/api/ecommerce/account/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
    }).catch(() => undefined);
    setAccount(null);
    setSession(null);
    setCsrfToken('');
    setSuccess('Sessão encerrada.');
    setError(null);
    setCode('');
    setCodeSent(false);
    setDebugCode(null);
    setPrivacyExportPackage(null);
    setPrivacyRequestRegistered(false);
    setOrderForm((prev) => ({
      ...prev,
      loggedIn: false,
    }));
  }

  async function exportPrivacyPackage() {
    setPrivacyExportLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommerce/account/lgpd/export', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as { error?: string; data?: CustomerLgpdExportPackage } | null;
      if (!response.ok || !payload?.data) {
        setError(payload?.error || 'Não foi possível montar o pacote de dados da conta.');
        return;
      }

      setPrivacyExportPackage(payload.data);
      setPrivacyRequestRegistered(Boolean(payload.data.privacy.erasureRequestedAt));
      setSuccess('Pacote de dados gerado com sucesso.');
    } finally {
      setPrivacyExportLoading(false);
    }
  }

  async function requestErasure() {
    if (!csrfToken) return;
    setPrivacyErasureLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/ecommerce/account/lgpd/request-erasure', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setError(payload?.error || 'Não foi possível registrar a solicitação de exclusão.');
        return;
      }

      const requestedAt = new Date().toISOString();
      setPrivacyRequestRegistered(true);
      setAccount((current) =>
        current
          ? {
              ...current,
              privacy: {
                ...current.privacy,
                erasureRequestedAt: current.privacy.erasureRequestedAt || requestedAt,
              },
            }
          : current,
      );
      setSuccess(payload?.message || 'Solicitação registrada com sucesso.');
    } finally {
      setPrivacyErasureLoading(false);
    }
  }

  function editAddress(address: CustomerAccountAddress) {
    setAddressForm({
      id: address.id,
      label: address.label,
      recipient: address.recipient || '',
      postalCode: address.postalCode || '',
      street: address.street || '',
      number: address.number || '',
      complement: address.complement || '',
      neighborhood: address.neighborhood || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'BRA',
      reference: address.reference || '',
      phone: address.phone || '',
      isDefaultShipping: Boolean(address.isDefaultShipping),
      isDefaultBilling: Boolean(address.isDefaultBilling),
    });
    setTab('addresses');
  }

  if (!canUseAccount) {
    return (
      <section className="account-page">
        <article className="account-hero">
          <p className="account-kicker">Minha conta</p>
          <h1>Área do cliente desativada</h1>
          <p>O módulo de cliente ainda não está habilitado neste storefront.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="account-page">
      <article className="account-hero account-hero--customer">
        <div>
          <p className="account-kicker">{entryMode === 'login' ? 'Entrar' : 'Minha conta'}</p>
          <h1>{entryMode === 'login' ? 'Acesso do cliente e cadastro da loja' : 'Acesso do cliente, pedidos e dados de entrega'}</h1>
          <p>
            {entryMode === 'login'
              ? 'Entre na sua conta ou crie seu cadastro.'
              : 'Consulte pedidos, dados cadastrais e endereços.'}
          </p>
        </div>
        <div className="account-hero__actions">
          {session?.email ? <span className="account-session-chip">{session.email}</span> : <span className="account-badge">acesso por código</span>}
          {account ? (
            <button type="button" className="account-btn account-btn--ghost" onClick={logout}>
              Sair da conta
            </button>
          ) : null}
        </div>
      </article>

      {error ? <p className="account-feedback account-feedback--error">{error}</p> : null}
      {success ? <p className="account-feedback account-feedback--success">{success}</p> : null}

      {!account ? (
        <div className="account-auth-layout account-auth-layout--single">
          <article className="account-card">
            <div className="account-tabs">
              <button type="button" className={`account-tab ${authTab === 'login' ? 'is-active' : ''}`} onClick={() => setAuthTab('login')}>
                Entrar
              </button>
              <button
                type="button"
                className={`account-tab ${authTab === 'register' ? 'is-active' : ''}`}
                onClick={() => setAuthTab('register')}
              >
                Criar cadastro
              </button>
            </div>

            {authTab === 'login' ? (
              <form className="account-form" onSubmit={loginWithPassword}>
                <div className="account-section-head">
                  <h2>Entrar</h2>
                </div>
                <div className="account-form-grid">
                  <label>
                    <span>E-mail ou CPF</span>
                    <input
                      value={loginIdentifier}
                      onChange={(event) => setLoginIdentifier(event.target.value)}
                      autoComplete="username"
                    />
                  </label>
                  <label>
                    <span>Senha</span>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                </div>
                <div className="account-actions">
                  <button type="submit" className="account-btn" disabled={verifyLoading}>
                    {verifyLoading ? 'Entrando...' : 'Entrar'}
                  </button>
                  <button
                    type="button"
                    className="account-link-button"
                    onClick={() => {
                      setShowCodeLogin((current) => !current);
                      setLoginEmail(orderForm.clientProfileData?.email || loginEmail || (loginIdentifier.includes('@') ? loginIdentifier : ''));
                    }}
                  >
                    {showCodeLogin ? 'Fechar acesso por código' : 'Entrar com código'}
                  </button>
                </div>

                {showCodeLogin ? (
                  <div className="account-code-box">
                    <div className="account-form-grid">
                      <label>
                        <span>E-mail para o código</span>
                        <input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} autoComplete="email" />
                      </label>
                      <label>
                        <span>Código de acesso</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={code}
                          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                        />
                      </label>
                    </div>
                    <div className="account-actions">
                      <button type="button" className="account-btn account-btn--ghost" onClick={requestCode} disabled={requestLoading}>
                        {requestLoading ? 'Enviando...' : codeSent ? 'Reenviar código' : 'Enviar código'}
                      </button>
                      <button type="button" className="account-btn" disabled={verifyLoading} onClick={() => void verifyCode()}>
                        {verifyLoading ? 'Validando...' : 'Entrar com código'}
                      </button>
                    </div>
                    {debugCode ? <p className="account-inline-note">Código de desenvolvimento: <strong>{debugCode}</strong></p> : null}
                    {orderForm.clientProfileData?.email ? (
                      <button
                        type="button"
                        className="account-link-button"
                        onClick={() => setLoginEmail(orderForm.clientProfileData?.email || '')}
                      >
                        Usar o e-mail preenchido no checkout
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </form>
            ) : (
              <form className="account-form" onSubmit={registerAccount}>
                <div className="account-section-head">
                  <h2>Criar cadastro</h2>
                </div>

                <div className="account-choice-row">
                  <button
                    type="button"
                    className={`account-choice ${registerForm.kind === 'individual' ? 'is-active' : ''}`}
                    onClick={() => setRegisterForm((prev) => ({ ...prev, kind: 'individual', taxDocumentType: 'cpf' }))}
                  >
                    Pessoa física
                  </button>
                  <button
                    type="button"
                    className={`account-choice ${registerForm.kind === 'company' ? 'is-active' : ''}`}
                    onClick={() => setRegisterForm((prev) => ({ ...prev, kind: 'company', taxDocumentType: 'cnpj' }))}
                  >
                    Pessoa jurídica
                  </button>
                </div>

                <div className="account-form-grid">
                  <label>
                    <span>E-mail</span>
                    <input type="email" value={registerForm.email} onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))} />
                  </label>
                  <label>
                    <span>Senha</span>
                    <input type="password" value={registerForm.password} onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))} autoComplete="new-password" />
                  </label>
                  <label>
                    <span>Confirmar senha</span>
                    <input type="password" value={registerForm.passwordConfirm} onChange={(event) => setRegisterForm((prev) => ({ ...prev, passwordConfirm: event.target.value }))} autoComplete="new-password" />
                  </label>
                  <div className="account-password-card">
                    <strong>Requisitos da senha</strong>
                    <span className="account-inline-note">Proteja sua conta com uma senha forte para resguardar pedidos, endereços e dados pessoais.</span>
                    <ul className="account-password-checklist">
                      {passwordChecks.map((check) => (
                        <li key={check.id} className={check.passed ? 'is-valid' : 'is-pending'}>
                          <span aria-hidden="true">{check.passed ? '•' : '◦'}</span>
                          <span>{check.label}</span>
                        </li>
                      ))}
                      <li
                        className={
                          registerForm.passwordConfirm
                            ? registerForm.password === registerForm.passwordConfirm
                              ? 'is-valid'
                              : 'is-pending'
                            : 'is-pending'
                        }
                      >
                        <span aria-hidden="true">
                          {registerForm.passwordConfirm && registerForm.password === registerForm.passwordConfirm ? '•' : '◦'}
                        </span>
                        <span>Confirmação igual à senha</span>
                      </li>
                    </ul>
                  </div>
                  <label>
                    <span>Telefone principal</span>
                    <input value={maskPhone(registerForm.phone)} onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: maskPhone(event.target.value) }))} />
                  </label>
                  {registerForm.kind === 'individual' ? (
                    <>
                      <label>
                        <span>Primeiro nome</span>
                        <input value={registerForm.firstName} onChange={(event) => setRegisterForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Sobrenome</span>
                        <input value={registerForm.lastName} onChange={(event) => setRegisterForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Data de nascimento</span>
                        <input type="date" value={registerForm.birthDate} onChange={(event) => setRegisterForm((prev) => ({ ...prev, birthDate: event.target.value }))} />
                      </label>
                      <label>
                        <span>CPF</span>
                        <input value={maskCpfCnpj(registerForm.taxDocument)} onChange={(event) => setRegisterForm((prev) => ({ ...prev, taxDocument: maskCpfCnpj(event.target.value) }))} />
                      </label>
                      <label>
                        <span>RG</span>
                        <input value={registerForm.secondaryDocument} onChange={(event) => setRegisterForm((prev) => ({ ...prev, secondaryDocument: event.target.value }))} />
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        <span>Razão social</span>
                        <input value={registerForm.companyName} onChange={(event) => setRegisterForm((prev) => ({ ...prev, companyName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Nome fantasia</span>
                        <input value={registerForm.tradeName} onChange={(event) => setRegisterForm((prev) => ({ ...prev, tradeName: event.target.value }))} />
                      </label>
                      <label>
                        <span>CNPJ</span>
                        <input value={maskCpfCnpj(registerForm.taxDocument)} onChange={(event) => setRegisterForm((prev) => ({ ...prev, taxDocument: maskCpfCnpj(event.target.value) }))} />
                      </label>
                      <label>
                        <span>Inscrição estadual</span>
                        <input value={registerForm.stateRegistration} onChange={(event) => setRegisterForm((prev) => ({ ...prev, stateRegistration: event.target.value }))} />
                      </label>
                      <label>
                        <span>Telefone alternativo</span>
                        <input value={maskPhone(registerForm.alternatePhone)} onChange={(event) => setRegisterForm((prev) => ({ ...prev, alternatePhone: maskPhone(event.target.value) }))} />
                      </label>
                    </>
                  )}
                </div>

                <div className="account-consent-stack">
                  <label className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={registerForm.acceptedPrivacy}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, acceptedPrivacy: event.target.checked }))}
                    />
                    <span>Li e aceito a política de privacidade para uso dos meus dados de compra e conta.</span>
                  </label>
                  <label className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={registerForm.acceptedTerms}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, acceptedTerms: event.target.checked }))}
                    />
                    <span>Li e aceito os termos de uso da área do cliente.</span>
                  </label>
                  <label className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={registerForm.marketingOptIn}
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, marketingOptIn: event.target.checked }))}
                    />
                    <span>Quero receber novidades e ofertas por e-mail.</span>
                  </label>
                </div>

                <div className="account-actions">
                  <button type="submit" className="account-btn" disabled={registerLoading}>
                    {registerLoading ? 'Salvando...' : 'Criar cadastro'}
                  </button>
                </div>

                {registerVerificationPending ? (
                  <div className="account-code-box">
                    <div className="account-section-head">
                      <h2>Confirmar e-mail</h2>
                      <p>Ative o cadastro com o código enviado para {registerVerificationEmail}.</p>
                    </div>
                    <div className="account-form-grid">
                      <label>
                        <span>E-mail do cadastro</span>
                        <input
                          type="email"
                          value={registerVerificationEmail}
                          onChange={(event) => setRegisterVerificationEmail(event.target.value)}
                          autoComplete="email"
                        />
                      </label>
                      <label>
                        <span>Código de validação</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={registerVerificationCode}
                          onChange={(event) => setRegisterVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                        />
                      </label>
                    </div>
                    <div className="account-actions">
                      <button type="button" className="account-btn" disabled={registerVerifyLoading} onClick={() => void verifyRegisterCode()}>
                        {registerVerifyLoading ? 'Validando...' : 'Ativar cadastro'}
                      </button>
                      <button
                        type="button"
                        className="account-btn account-btn--ghost"
                        disabled={registerLoading}
                        onClick={() => void submitRegistration()}
                      >
                        {registerLoading ? 'Reenviando...' : 'Reenviar código'}
                      </button>
                    </div>
                    {debugCode ? <p className="account-inline-note">Código de desenvolvimento: <strong>{debugCode}</strong></p> : null}
                  </div>
                ) : null}
              </form>
            )}
          </article>

        </div>
      ) : null}

      {loading ? <article className="account-card"><p>Carregando área do cliente...</p></article> : null}

      {account ? (
        <>
          <div className="account-stats">
            <article className="account-stat">
              <span>Pedidos</span>
              <strong>{stats.totalOrders}</strong>
              <small>Histórico vinculado à sua conta</small>
            </article>
            <article className="account-stat">
              <span>Endereços</span>
              <strong>{stats.totalAddresses}</strong>
              <small>{stats.defaultAddress ? `Padrão: ${stats.defaultAddress.label}` : 'Sem padrão definido'}</small>
            </article>
            <article className="account-stat">
              <span>Último acesso</span>
              <strong>{formatDate(account.profile.lastLoginAt)}</strong>
              <small>{buildAccountName(account)}</small>
            </article>
          </div>

          <div className="account-tabs">
            {[
              { id: 'overview', label: 'Visão geral' },
              { id: 'orders', label: 'Pedidos' },
              { id: 'profile', label: 'Cadastro' },
              { id: 'addresses', label: 'Endereços' },
              { id: 'privacy', label: 'Privacidade' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`account-tab ${tab === item.id ? 'is-active' : ''}`}
                onClick={() => setTab(item.id as AccountTab)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="account-layout">
              <article className="account-card">
                <h2>Resumo da conta</h2>
                <div className="account-summary-grid">
                  <div>
                    <strong>Nome de exibição</strong>
                    <span>{buildAccountName(account)}</span>
                  </div>
                  <div>
                    <strong>E-mail</strong>
                    <span>{account.profile.email}</span>
                  </div>
                  <div>
                    <strong>Documento principal</strong>
                    <span>{account.profile.taxDocument || 'Não informado'}</span>
                  </div>
                  <div>
                    <strong>Telefone</strong>
                    <span>{account.profile.phone || 'Não informado'}</span>
                  </div>
                </div>
              </article>
              <article className="account-card">
                <h2>Ações rápidas</h2>
                <div className="account-action-list">
                  <Link href="/e-commerce/checkout" className="account-action-card">
                    <strong>Seguir para checkout</strong>
                    <span>Continue a compra usando os dados já vinculados à conta.</span>
                  </Link>
                  <button type="button" className="account-action-card" onClick={() => setTab('addresses')}>
                    <strong>Gerir endereços</strong>
                    <span>Cadastre múltiplos destinos para você, família ou empresa.</span>
                  </button>
                  <button type="button" className="account-action-card" onClick={() => setTab('profile')}>
                    <strong>Atualizar cadastro</strong>
                    <span>Revise documentos, nome, contatos e consentimentos.</span>
                  </button>
                  <button type="button" className="account-action-card" onClick={() => setTab('privacy')}>
                    <strong>Privacidade e dados</strong>
                    <span>Exporte seus dados e acompanhe solicitações LGPD da conta.</span>
                  </button>
                </div>
          </article>
        </div>
      ) : null}

          {tab === 'orders' ? (
            <article className="account-card">
              <h2>Pedidos</h2>
              {!account.orders.length ? <p>Nenhum pedido foi encontrado para esta conta.</p> : null}
              <div className="account-orders">
                {account.orders.map((order) => (
                  <article key={order.id} className="account-order-card">
                    <div className="account-order-card__head">
                      <div>
                        <strong>{order.id}</strong>
                        <span>{formatDate(order.placedAt)}</span>
                        {order.groupOrderId ? (
                          <span>
                            Grupo {order.groupOrderId} • subpedido {order.splitSequence || 1}/{order.splitTotal || 1}
                          </span>
                        ) : null}
                      </div>
                      <span className="account-badge">{order.status}</span>
                    </div>
                    <div className="account-order-card__meta">
                      <div>
                        <strong>Total</strong>
                        <span>{formatCurrency(order.totalValue)}</span>
                      </div>
                      <div>
                        <strong>Pagamento</strong>
                        <span>{order.paymentMethod}</span>
                      </div>
                      <div>
                        <strong>Entrega</strong>
                        <span>{order.addressSummary}</span>
                      </div>
                    </div>
                    <div className="account-order-items">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.id}`} className="account-order-item">
                          <strong>{item.name}</strong>
                          <span>{item.quantity} x {formatCurrency(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ) : null}

          {tab === 'profile' ? (
            <article className="account-card">
              <h2>Cadastro do cliente</h2>
              <form className="account-form" onSubmit={saveProfile}>
                <div className="account-choice-row">
                  <button
                    type="button"
                    className={`account-choice ${profileForm.kind === 'individual' ? 'is-active' : ''}`}
                    onClick={() => setProfileForm((prev) => ({ ...prev, kind: 'individual', taxDocumentType: 'cpf' }))}
                  >
                    Pessoa física
                  </button>
                  <button
                    type="button"
                    className={`account-choice ${profileForm.kind === 'company' ? 'is-active' : ''}`}
                    onClick={() => setProfileForm((prev) => ({ ...prev, kind: 'company', taxDocumentType: 'cnpj' }))}
                  >
                    Pessoa jurídica
                  </button>
                </div>

                <div className="account-form-grid">
                  <label>
                    <span>E-mail</span>
                    <input type="email" value={profileForm.email} onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))} />
                  </label>
                  <label>
                    <span>Telefone principal</span>
                    <input value={maskPhone(profileForm.phone)} onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: maskPhone(event.target.value) }))} />
                  </label>
                  {profileForm.kind === 'individual' ? (
                    <>
                      <label>
                        <span>Primeiro nome</span>
                        <input value={profileForm.firstName} onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Sobrenome</span>
                        <input value={profileForm.lastName} onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Data de nascimento</span>
                        <input type="date" value={profileForm.birthDate} onChange={(event) => setProfileForm((prev) => ({ ...prev, birthDate: event.target.value }))} />
                      </label>
                      <label>
                        <span>CPF</span>
                        <input value={maskCpfCnpj(profileForm.taxDocument)} onChange={(event) => setProfileForm((prev) => ({ ...prev, taxDocument: maskCpfCnpj(event.target.value) }))} />
                      </label>
                      <label>
                        <span>RG</span>
                        <input value={profileForm.secondaryDocument} onChange={(event) => setProfileForm((prev) => ({ ...prev, secondaryDocument: event.target.value }))} />
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        <span>Razão social</span>
                        <input value={profileForm.companyName} onChange={(event) => setProfileForm((prev) => ({ ...prev, companyName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Nome fantasia</span>
                        <input value={profileForm.tradeName} onChange={(event) => setProfileForm((prev) => ({ ...prev, tradeName: event.target.value }))} />
                      </label>
                      <label>
                        <span>CNPJ</span>
                        <input value={maskCpfCnpj(profileForm.taxDocument)} onChange={(event) => setProfileForm((prev) => ({ ...prev, taxDocument: maskCpfCnpj(event.target.value) }))} />
                      </label>
                      <label>
                        <span>Inscrição estadual</span>
                        <input value={profileForm.stateRegistration} onChange={(event) => setProfileForm((prev) => ({ ...prev, stateRegistration: event.target.value }))} />
                      </label>
                      <label>
                        <span>Telefone alternativo</span>
                        <input value={maskPhone(profileForm.alternatePhone)} onChange={(event) => setProfileForm((prev) => ({ ...prev, alternatePhone: maskPhone(event.target.value) }))} />
                      </label>
                    </>
                  )}
                </div>

                <div className="account-consent-stack">
                  <label className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={profileForm.acceptedPrivacy}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, acceptedPrivacy: event.target.checked }))}
                    />
                    <span>Consentimento de privacidade ativo.</span>
                  </label>
                  <label className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={profileForm.acceptedTerms}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, acceptedTerms: event.target.checked }))}
                    />
                    <span>Termos de uso da área do cliente aceitos.</span>
                  </label>
                  <label className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={profileForm.marketingOptIn}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, marketingOptIn: event.target.checked }))}
                    />
                    <span>Receber novidades e ofertas por e-mail.</span>
                  </label>
                </div>

                <div className="account-actions">
                  <button type="submit" className="account-btn" disabled={profileSaving}>
                    {profileSaving ? 'Salvando...' : 'Salvar cadastro'}
                  </button>
                </div>
              </form>
            </article>
          ) : null}

          {tab === 'addresses' ? (
            <div className="account-layout">
              <article className="account-card">
                <h2>{addressForm.id ? 'Editar endereço' : 'Novo endereço'}</h2>
                <form className="account-form" onSubmit={saveAddress}>
                  <div className="account-form-grid">
                    <label>
                      <span>Rótulo</span>
                      <input value={addressForm.label} onChange={(event) => setAddressForm((prev) => ({ ...prev, label: event.target.value }))} />
                    </label>
                    <label>
                      <span>Destinatário</span>
                      <input value={addressForm.recipient} onChange={(event) => setAddressForm((prev) => ({ ...prev, recipient: event.target.value }))} />
                    </label>
                    <label>
                      <span>CEP</span>
                      <input value={maskCEP(addressForm.postalCode)} onChange={(event) => setAddressForm((prev) => ({ ...prev, postalCode: maskCEP(event.target.value) }))} />
                    </label>
                    <label>
                      <span>Rua</span>
                      <input value={addressForm.street} onChange={(event) => setAddressForm((prev) => ({ ...prev, street: event.target.value }))} />
                    </label>
                    <label>
                      <span>Número</span>
                      <input value={addressForm.number} onChange={(event) => setAddressForm((prev) => ({ ...prev, number: event.target.value }))} />
                    </label>
                    <label>
                      <span>Complemento</span>
                      <input value={addressForm.complement} onChange={(event) => setAddressForm((prev) => ({ ...prev, complement: event.target.value }))} />
                    </label>
                    <label>
                      <span>Bairro</span>
                      <input value={addressForm.neighborhood} onChange={(event) => setAddressForm((prev) => ({ ...prev, neighborhood: event.target.value }))} />
                    </label>
                    <label>
                      <span>Cidade</span>
                      <input value={addressForm.city} onChange={(event) => setAddressForm((prev) => ({ ...prev, city: event.target.value }))} />
                    </label>
                    <label>
                      <span>UF</span>
                      <input value={maskUF(addressForm.state)} onChange={(event) => setAddressForm((prev) => ({ ...prev, state: maskUF(event.target.value) }))} />
                    </label>
                    <label>
                      <span>País</span>
                      <input value={addressForm.country} onChange={(event) => setAddressForm((prev) => ({ ...prev, country: event.target.value }))} />
                    </label>
                    <label>
                      <span>Referência</span>
                      <input value={addressForm.reference} onChange={(event) => setAddressForm((prev) => ({ ...prev, reference: event.target.value }))} />
                    </label>
                    <label>
                      <span>Telefone do endereço</span>
                      <input value={maskPhone(addressForm.phone)} onChange={(event) => setAddressForm((prev) => ({ ...prev, phone: maskPhone(event.target.value) }))} />
                    </label>
                  </div>
                  <div className="account-consent-stack">
                    <label className="account-checkbox">
                      <input type="checkbox" checked={addressForm.isDefaultShipping} onChange={(event) => setAddressForm((prev) => ({ ...prev, isDefaultShipping: event.target.checked }))} />
                      <span>Usar como endereço padrão de entrega.</span>
                    </label>
                    <label className="account-checkbox">
                      <input type="checkbox" checked={addressForm.isDefaultBilling} onChange={(event) => setAddressForm((prev) => ({ ...prev, isDefaultBilling: event.target.checked }))} />
                      <span>Usar como endereço padrão de cobrança.</span>
                    </label>
                  </div>
                  <div className="account-actions">
                    <button type="submit" className="account-btn" disabled={addressSaving}>
                      {addressSaving ? 'Salvando...' : addressForm.id ? 'Atualizar endereço' : 'Cadastrar endereço'}
                    </button>
                    {addressForm.id ? (
                      <button type="button" className="account-btn account-btn--ghost" onClick={() => setAddressForm(EMPTY_ADDRESS_FORM)}>
                        Cancelar edição
                      </button>
                    ) : null}
                  </div>
                </form>
              </article>

              <article className="account-card">
                <h2>Endereços salvos</h2>
                {!account.addresses.length ? <p>Nenhum endereço cadastrado.</p> : null}
                <div className="account-address-list">
                  {account.addresses.map((address) => (
                    <article key={address.id} className="account-address-card">
                      <div className="account-address-card__head">
                        <div>
                          <strong>{address.label}</strong>
                          <span>{address.recipient || buildAccountName(account)}</span>
                        </div>
                        <div className="account-address-card__badges">
                          {address.isDefaultShipping ? <span className="account-badge">entrega</span> : null}
                          {address.isDefaultBilling ? <span className="account-badge">cobrança</span> : null}
                        </div>
                      </div>
                      <span>{[address.street, address.number, address.neighborhood, address.city, address.state].filter(Boolean).join(', ')}</span>
                      <span>{address.postalCode || ''}</span>
                      <div className="account-actions">
                        <button type="button" className="account-btn account-btn--ghost" onClick={() => editAddress(address)}>
                          Editar
                        </button>
                        <button type="button" className="account-btn account-btn--ghost" onClick={() => void deleteAddress(address.id)}>
                          Remover
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          {tab === 'privacy' ? (
            <div className="account-layout">
              <article className="account-card">
                <h2>Privacidade e governança dos dados</h2>
                <p>
                  Esta área permite exportar os dados vinculados à sua conta e registrar solicitação de exclusão. A exclusão da conta não apaga automaticamente pedidos que precisem ser mantidos para operação, auditoria ou obrigação legal.
                </p>

                <div className="account-privacy-grid">
                  <article className="account-privacy-card">
                    <strong>Exportação da conta</strong>
                    <p>Gera um pacote com cadastro, endereços, pedidos vinculados e trilha essencial da conta.</p>
                    <button type="button" className="account-btn" disabled={privacyExportLoading} onClick={() => void exportPrivacyPackage()}>
                      {privacyExportLoading ? 'Gerando pacote...' : 'Gerar pacote dos meus dados'}
                    </button>
                  </article>

                  <article className="account-privacy-card">
                    <strong>Solicitação de exclusão</strong>
                    <p>
                      A solicitação entra em fila interna de tratamento. Dados de identificação da conta podem ser removidos ou anonimizados, enquanto registros obrigatórios do pedido permanecem sem vínculo pessoal direto.
                    </p>
                    <button
                      type="button"
                      className="account-btn account-btn--ghost"
                      disabled={privacyErasureLoading || privacyRequestRegistered}
                      onClick={() => void requestErasure()}
                    >
                      {privacyRequestRegistered ? 'Solicitação já registrada' : privacyErasureLoading ? 'Registrando...' : 'Solicitar exclusão da conta'}
                    </button>
                  </article>
                </div>

                <div className="account-privacy-grid">
                  <article className="account-privacy-card">
                    <strong>Status atual</strong>
                    <ul className="account-privacy-list">
                      <li>Conta ativa: {account.privacy.active ? 'sim' : 'não'}</li>
                      <li>
                        Solicitação de exclusão:{' '}
                        {account.privacy.erasureRequestedAt || privacyRequestRegistered
                          ? `registrada em ${formatDate(account.privacy.erasureRequestedAt || new Date().toISOString())}`
                          : 'não registrada'}
                      </li>
                      <li>Consentimento de privacidade: {account.profile.acceptedPrivacyAt ? `aceito em ${formatDate(account.profile.acceptedPrivacyAt)}` : 'pendente'}</li>
                    </ul>
                  </article>

                  <article className="account-privacy-card">
                    <strong>Retenção mínima necessária</strong>
                    <ul className="account-privacy-list">
                      <li>Endereços, sessões, tokens e preferências entram em remoção ou anonimização quando a solicitação é tratada.</li>
                      <li>Pedidos podem continuar existindo de forma sanitizada e desvinculada da conta para sustentar atendimento, logística e obrigação legal.</li>
                      <li>Não tratamos mascaramento reversível como anonimização definitiva.</li>
                    </ul>
                  </article>
                </div>

                {privacyExportPackage ? (
                  <label className="account-privacy-export">
                    <span>Pacote exportado</span>
                    <textarea readOnly rows={18} value={JSON.stringify(privacyExportPackage, null, 2)} />
                  </label>
                ) : null}
              </article>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
