'use client';

import { useState } from 'react';
import Link from 'next/link';

type ForgotResponse = {
  message?: string;
  error?: string;
  deliveryMode?: 'email' | 'debug';
  debugResetToken?: string;
  debugResetUrl?: string;
};

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ForgotResponse | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setResponse(null);

    try {
      const request = await fetch('/api/ecommpanel/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = (await request.json().catch(() => null)) as ForgotResponse | null;
      if (!request.ok) {
        setResponse({ error: payload?.error || 'Falha ao solicitar recuperação.' });
        return;
      }

      setResponse(payload || { message: 'Solicitação processada.' });
    } catch {
      setResponse({ error: 'Erro de rede ao solicitar recuperação.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel-auth" aria-labelledby="panel-forgot-title">
      <header className="panel-auth-header">
        <h2 id="panel-forgot-title">Recuperar senha</h2>
        <p>Informe seu e-mail para receber as instruções de recuperação. Em desenvolvimento, o token também pode aparecer na tela.</p>
      </header>

      <form className="panel-form" onSubmit={onSubmit} noValidate>
        <div className="panel-field">
          <label htmlFor="panel-forgot-email">E-mail</label>
          <input
            id="panel-forgot-email"
            className="panel-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <button className="panel-btn panel-btn-primary" type="submit" disabled={loading}>
          {loading ? 'Processando...' : 'Enviar instruções'}
        </button>
      </form>

      <div className="panel-links">
        <Link href="/ecommpanel/login" className="panel-link">
          Voltar ao login
        </Link>
      </div>

      {response?.error ? (
        <p className="panel-feedback panel-feedback-error" role="alert">
          {response.error}
        </p>
      ) : null}

      {response?.message ? (
        <div className="panel-feedback panel-feedback-success" role="status">
          <p>{response.message}</p>
          {response.deliveryMode === 'email' ? (
            <p>Se a infraestrutura de e-mail estiver ativa, o link de redefinição será enviado para a caixa do usuário.</p>
          ) : null}
          {response.debugResetToken ? (
            <p>
              Token local: <code>{response.debugResetToken}</code> ·{' '}
              <Link
                className="panel-link"
                href={response.debugResetUrl || `/ecommpanel/reset-password?token=${encodeURIComponent(response.debugResetToken)}`}
              >
                abrir tela de reset
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
