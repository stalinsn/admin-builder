'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type LoginState = {
  email: string;
  password: string;
};

type LoginTokenRequestResponse = {
  message?: string;
  error?: string;
  deliveryMode?: 'email' | 'debug';
  debugCode?: string;
  expiresAt?: string;
  details?: {
    expiresAt?: string;
  };
};

type AuthMode = 'password' | 'code';

export default function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState<LoginState>({
    email: '',
    password: '',
  });
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [tokenCode, setTokenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<'email' | 'debug' | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/ecommpanel/auth/me', { cache: 'no-store' })
      .then((res) => {
        if (!mounted || !res.ok) return;
        router.replace('/ecommpanel/admin');
      })
      .catch(() => {
        // no-op
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch('/api/ecommpanel/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setIsError(true);
        setMessage(payload?.error || 'Falha ao autenticar.');
        return;
      }

      router.replace('/ecommpanel/admin');
    } catch {
      setIsError(true);
      setMessage('Erro de rede ao autenticar.');
    } finally {
      setLoading(false);
    }
  }

  async function requestLoginCode() {
    if (tokenLoading) return;
    setTokenLoading(true);
    setTokenError(null);
    setTokenMessage(null);
    setDebugCode(null);

    try {
      const response = await fetch('/api/ecommpanel/auth/login-token/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });

      const payload = (await response.json().catch(() => null)) as LoginTokenRequestResponse | null;
      if (!response.ok) {
        setTokenError(payload?.error || 'Falha ao enviar código.');
        return;
      }

      setDeliveryMode(payload?.deliveryMode || null);
      setDebugCode(payload?.debugCode || null);
      setTokenMessage(payload?.message || 'Código enviado.');
    } catch {
      setTokenError('Erro de rede ao solicitar código.');
    } finally {
      setTokenLoading(false);
    }
  }

  async function submitLoginCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tokenSubmitting) return;

    setTokenSubmitting(true);
    setTokenError(null);
    setTokenMessage(null);

    try {
      const response = await fetch('/api/ecommpanel/auth/login-token/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: tokenCode }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setTokenError(payload?.error || 'Falha ao validar código.');
        return;
      }

      router.replace('/ecommpanel/admin');
    } catch {
      setTokenError('Erro de rede ao validar código.');
    } finally {
      setTokenSubmitting(false);
    }
  }

  function toggleAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setMessage(null);
    setIsError(false);
    setTokenError(null);
  }

  return (
    <section className="panel-auth" aria-labelledby="panel-login-title">
      <header className="panel-auth-header">
        <h2 id="panel-login-title">Entrar no painel</h2>
        <p>Acesse o admin builder para orquestrar dados, mídia, APIs e usuários com segurança.</p>
      </header>

      <form className="panel-form" onSubmit={authMode === 'password' ? onSubmit : submitLoginCode} noValidate>
        <div className="panel-field">
          <label htmlFor="panel-login-email">E-mail</label>
          <input
            id="panel-login-email"
            className="panel-input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => {
              const nextEmail = event.target.value;
              setForm((prev) => ({ ...prev, email: nextEmail }));
              setTokenCode('');
              setTokenMessage(null);
              setTokenError(null);
              setDebugCode(null);
              setDeliveryMode(null);
            }}
            required
          />
        </div>

        {authMode === 'password' ? (
          <div className="panel-field">
            <label htmlFor="panel-login-password">Senha</label>
            <input
              id="panel-login-password"
              className="panel-input"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </div>
        ) : (
          <div className="panel-field">
            <div className="panel-field-head">
              <label htmlFor="panel-login-code">Código</label>
              <span className="panel-field-hint">6 dígitos, válido por 10 minutos. Reenvio após 90 segundos.</span>
            </div>
            <input
              id="panel-login-code"
              className="panel-input panel-input-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={tokenCode}
              onChange={(event) => setTokenCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
            />
          </div>
        )}

        <div className="panel-auth-actions">
          <button
            className="panel-btn panel-btn-primary"
            type="submit"
            disabled={authMode === 'password' ? loading : tokenSubmitting || tokenCode.length !== 6}
          >
            {authMode === 'password'
              ? loading
                ? 'Entrando...'
                : 'Entrar'
              : tokenSubmitting
                ? 'Validando...'
                : 'Entrar com código'}
          </button>

          {authMode === 'password' ? (
            <button className="panel-link-button" type="button" onClick={() => toggleAuthMode('code')}>
              Entrar com código
            </button>
          ) : (
            <div className="panel-auth-code-tools">
              <button
                className="panel-btn panel-btn-secondary"
                type="button"
                disabled={tokenLoading || !form.email.trim()}
                onClick={requestLoginCode}
              >
                {tokenLoading ? 'Enviando...' : 'Enviar código'}
              </button>
              <button className="panel-link-button" type="button" onClick={() => toggleAuthMode('password')}>
                Voltar para senha
              </button>
            </div>
          )}
        </div>

        {tokenMessage ? (
          <p className="panel-feedback panel-feedback-success" role="status">
            {tokenMessage}
            {deliveryMode === 'email' ? ' Verifique a caixa de entrada do e-mail informado.' : ''}
          </p>
        ) : null}

        {debugCode ? (
          <p className="panel-feedback panel-feedback-success" role="status">
            Código local: <code>{debugCode}</code>
          </p>
        ) : null}

        {tokenError ? (
          <p className="panel-feedback panel-feedback-error" role="alert">
            {tokenError}
          </p>
        ) : null}
      </form>

      <div className="panel-links">
        <Link href="/ecommpanel/forgot-password" className="panel-link">
          Esqueci minha senha
        </Link>
        <Link href="/" className="panel-link">
          Voltar para galeria
        </Link>
      </div>

      {message ? (
        <p className={`panel-feedback ${isError ? 'panel-feedback-error' : 'panel-feedback-success'}`} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
