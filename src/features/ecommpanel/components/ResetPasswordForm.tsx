'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type ResetResponse = {
  ok?: boolean;
  error?: string;
  details?: {
    reasons?: string[];
  };
};

export default function ResetPasswordForm() {
  const params = useSearchParams();
  const queryToken = params.get('token') || '';
  const [token, setToken] = useState(queryToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResetResponse | null>(null);

  const passwordsMatch = useMemo(() => password.length > 0 && confirmPassword.length > 0 && password === confirmPassword, [password, confirmPassword]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!passwordsMatch) {
      setResponse({ error: 'As senhas não conferem.' });
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const request = await fetch('/api/ecommpanel/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const payload = (await request.json().catch(() => null)) as ResetResponse | null;
      if (!request.ok) {
        setResponse(payload || { error: 'Falha ao redefinir senha.' });
        return;
      }

      setResponse({ ok: true });
      setPassword('');
      setConfirmPassword('');
    } catch {
      setResponse({ error: 'Erro de rede ao redefinir senha.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel-auth" aria-labelledby="panel-reset-title">
      <header className="panel-auth-header">
        <h2 id="panel-reset-title">Redefinir senha</h2>
        <p>Use o token recebido para criar uma senha nova seguindo a política de segurança.</p>
      </header>

      <form className="panel-form" onSubmit={onSubmit} noValidate>
        <div className="panel-field">
          <label htmlFor="panel-reset-token">Token</label>
          <input
            id="panel-reset-token"
            className="panel-input"
            type="text"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>

        <div className="panel-field">
          <label htmlFor="panel-reset-password">Nova senha</label>
          <input
            id="panel-reset-password"
            className="panel-input"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="panel-field">
          <label htmlFor="panel-reset-confirm">Confirmar senha</label>
          <input
            id="panel-reset-confirm"
            className="panel-input"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        <button className="panel-btn panel-btn-primary" type="submit" disabled={loading}>
          {loading ? 'Aplicando...' : 'Atualizar senha'}
        </button>
      </form>

      <p className="panel-muted">Requisitos: mínimo 12 caracteres, maiúscula, minúscula, número e símbolo.</p>

      <div className="panel-links">
        <Link href="/ecommpanel/login" className="panel-link">
          Voltar ao login
        </Link>
      </div>

      {response?.error ? (
        <div className="panel-feedback panel-feedback-error" role="alert">
          <p>{response.error}</p>
          {response.details?.reasons?.length ? (
            <ul>
              {response.details.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {response?.ok ? (
        <p className="panel-feedback panel-feedback-success" role="status">
          Senha atualizada com sucesso. Faça login novamente.
        </p>
      ) : null}
    </section>
  );
}
