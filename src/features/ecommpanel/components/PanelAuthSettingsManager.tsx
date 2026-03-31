'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { PanelAuthSettings, PanelAuthSettingsDiagnostics } from '@/features/ecommpanel/types/panelAuthSettings';

type MeResponse = {
  csrfToken?: string;
};

type SettingsResponse = {
  settings?: PanelAuthSettings;
  diagnostics?: PanelAuthSettingsDiagnostics;
  error?: string;
};

type SaveState = 'idle' | 'saving' | 'saved';

type PanelAuthSettingsManagerProps = {
  initialSettings: PanelAuthSettings;
  initialDiagnostics: PanelAuthSettingsDiagnostics;
  canManage: boolean;
};

export default function PanelAuthSettingsManager({
  initialSettings,
  initialDiagnostics,
  canManage,
}: PanelAuthSettingsManagerProps) {
  const [csrfToken, setCsrfToken] = useState('');
  const [settings, setSettings] = useState<PanelAuthSettings>(initialSettings);
  const [diagnostics, setDiagnostics] = useState<PanelAuthSettingsDiagnostics>(initialDiagnostics);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ecommpanel/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar contexto de autenticação.');
        return response.json() as Promise<MeResponse>;
      })
      .then((payload) => {
        if (payload.csrfToken) setCsrfToken(payload.csrfToken);
      })
      .catch(() => undefined);
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !csrfToken || saveState === 'saving') return;

    setSaveState('saving');
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/settings/auth', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ settings }),
      });

      const payload = (await response.json().catch(() => null)) as SettingsResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível salvar a configuração.');
      }

      if (payload?.settings) setSettings(payload.settings);
      if (payload?.diagnostics) setDiagnostics(payload.diagnostics);
      setSuccess('Configuração salva. Os próximos envios de autenticação passam a usar esta identidade.');
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch (saveError) {
      setSaveState('idle');
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar a configuração.');
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="panel-auth-settings-title">
      <article className="panel-card panel-card-hero panel-dashboard-hero">
        <div className="panel-dashboard-hero__header">
          <div>
            <p className="panel-kicker">Configurações do painel</p>
            <h1 id="panel-auth-settings-title">Auth e e-mail transacional</h1>
            <p className="panel-muted">Centralize o remetente, o SMTP e a política de cadastro do cliente em um único ponto de controle.</p>
          </div>
          <div className="panel-dashboard-hero__badges">
            <span className={`panel-badge ${diagnostics.mailEnabled ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
              SMTP {diagnostics.mailEnabled ? 'pronto' : 'incompleto'}
            </span>
            <span
              className={`panel-badge ${diagnostics.smtpPasswordReferenceResolved ? 'panel-badge-success' : 'panel-badge-neutral'}`}
            >
              senha {diagnostics.smtpPasswordReferenceResolved ? 'resolvida' : 'pendente'}
            </span>
          </div>
        </div>

        <div className="panel-dashboard-hero__meta">
          <div>
            <span className="panel-muted">Remetente efetivo</span>
            <strong>{diagnostics.effectiveFromEmail || 'não definido'}</strong>
            <span>Endereço exibido nas mensagens do painel.</span>
          </div>
          <div>
            <span className="panel-muted">Usuário SMTP efetivo</span>
            <strong>{diagnostics.effectiveSmtpUser || 'não definido'}</strong>
            <span>Conta autenticada para envio.</span>
          </div>
          <div>
            <span className="panel-muted">Política atual</span>
            <strong>Código único por 10 min</strong>
            <span>Não reenvia um novo código enquanto existir um ativo.</span>
          </div>
          <div>
            <span className="panel-muted">Cadastro do cliente</span>
            <strong>
              {settings.customerRegistration.requireEmailVerification ? 'verificação por e-mail' : 'cadastro direto'}
            </strong>
            <span>
              {settings.customerRegistration.blockDisposableEmailDomains
                ? 'Bloqueio de e-mails temporários ativo.'
                : 'E-mails temporários liberados por configuração.'}
            </span>
          </div>
        </div>
      </article>

      <article className="panel-card">
        <form className="panel-form" onSubmit={handleSave}>
          <details className="panel-layer-item panel-form-panel" open>
            <summary className="panel-form-panel__summary">
              <span className="panel-form-panel__copy">
                <strong>Identidade de envio</strong>
                <small>Escolha como o remetente aparece nas mensagens e nos fluxos críticos do sistema.</small>
              </span>
              <span className="panel-accordion-chevron" aria-hidden="true" />
            </summary>
            <div className="panel-form-panel__body">
              <div className="panel-form-grid panel-form-grid--two">
                <div className="panel-field">
                  <label htmlFor="panel-auth-mail-from-name">Nome do remetente</label>
                  <input
                    id="panel-auth-mail-from-name"
                    className="panel-input"
                    value={settings.identity.fromName}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        identity: { ...prev.identity, fromName: event.target.value },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="panel-auth-mail-from-email">E-mail exibido</label>
                  <input
                    id="panel-auth-mail-from-email"
                    className="panel-input"
                    type="email"
                    value={settings.identity.fromEmail}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        identity: { ...prev.identity, fromEmail: event.target.value.toLowerCase() },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
              </div>
            </div>
          </details>

          <details className="panel-layer-item panel-form-panel" open>
            <summary className="panel-form-panel__summary">
              <span className="panel-form-panel__copy">
                <strong>Cadastro do cliente</strong>
                <small>Defina validação, bloqueio de e-mails temporários e a janela do cadastro pendente.</small>
              </span>
              <span className="panel-accordion-chevron" aria-hidden="true" />
            </summary>
            <div className="panel-form-panel__body">
              <div className="panel-form-grid panel-form-grid--three">
                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.customerRegistration.requireEmailVerification}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        customerRegistration: {
                          ...prev.customerRegistration,
                          requireEmailVerification: event.target.checked,
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                  <span>Exigir validação por código no cadastro do cliente</span>
                </label>

                <label className="panel-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.customerRegistration.blockDisposableEmailDomains}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        customerRegistration: {
                          ...prev.customerRegistration,
                          blockDisposableEmailDomains: event.target.checked,
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                  <span>Bloquear domínios de e-mail temporário</span>
                </label>

                <div className="panel-field">
                  <label htmlFor="panel-customer-registration-ttl">Prazo do cadastro pendente</label>
                  <input
                    id="panel-customer-registration-ttl"
                    className="panel-input"
                    type="number"
                    min={5}
                    max={180}
                    value={settings.customerRegistration.pendingRegistrationTtlMinutes}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        customerRegistration: {
                          ...prev.customerRegistration,
                          pendingRegistrationTtlMinutes: Number(event.target.value || 30),
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="panel-field">
                <label htmlFor="panel-customer-registration-blocklist">Domínios bloqueados manualmente</label>
                <textarea
                  id="panel-customer-registration-blocklist"
                  className="panel-textarea"
                  rows={5}
                  value={settings.customerRegistration.extraBlockedDomains}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      customerRegistration: {
                        ...prev.customerRegistration,
                        extraBlockedDomains: event.target.value,
                      },
                    }))
                  }
                  disabled={!canManage}
                  placeholder="temp-mail.org&#10;mailinator.com&#10;dominio-interno-de-teste.local"
                />
                <span className="panel-field-help">
                  Use uma linha por domínio ou separe por vírgula. A lista padrão de descartáveis continua ativa quando o bloqueio estiver habilitado.
                </span>
              </div>
            </div>
          </details>

          <details className="panel-layer-item panel-form-panel" open>
            <summary className="panel-form-panel__summary">
              <span className="panel-form-panel__copy">
                <strong>Transporte SMTP</strong>
                <small>Controle envio, segurança da conexão e a referência usada para resolver a senha do SMTP.</small>
              </span>
              <span className="panel-accordion-chevron" aria-hidden="true" />
            </summary>
            <div className="panel-form-panel__body">
              <div className="panel-form-grid panel-form-grid--three">
              <div className="panel-field">
                <label htmlFor="panel-auth-mail-host">Host</label>
                <input
                  id="panel-auth-mail-host"
                  className="panel-input"
                  value={settings.transport.host}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, host: event.target.value },
                    }))
                  }
                  disabled={!canManage}
                />
              </div>
              <div className="panel-field">
                <label htmlFor="panel-auth-mail-port">Porta</label>
                <input
                  id="panel-auth-mail-port"
                  className="panel-input"
                  type="number"
                  value={settings.transport.port}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, port: Number(event.target.value || 587) },
                    }))
                  }
                  disabled={!canManage}
                />
              </div>
              <div className="panel-field">
                <label htmlFor="panel-auth-mail-user">Usuário SMTP</label>
                <input
                  id="panel-auth-mail-user"
                  className="panel-input"
                  type="email"
                  value={settings.transport.smtpUser}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, smtpUser: event.target.value.toLowerCase() },
                    }))
                  }
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="panel-form-grid panel-form-grid--three">
              <label className="panel-checkbox">
                <input
                  type="checkbox"
                  checked={settings.transport.enabled}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, enabled: event.target.checked },
                    }))
                  }
                  disabled={!canManage}
                />
                <span>Ativar envio por e-mail</span>
              </label>

              <label className="panel-checkbox">
                <input
                  type="checkbox"
                  checked={settings.transport.secure}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, secure: event.target.checked },
                    }))
                  }
                  disabled={!canManage}
                />
                <span>Conexão segura imediata (SMTPS)</span>
              </label>

              <label className="panel-checkbox">
                <input
                  type="checkbox"
                  checked={settings.transport.tlsInsecure}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, tlsInsecure: event.target.checked },
                    }))
                  }
                  disabled={!canManage}
                />
                <span>Ignorar validação TLS</span>
              </label>
            </div>

            <div className="panel-form-grid panel-form-grid--two">
              <div className="panel-field">
                <label htmlFor="panel-auth-mail-password-ref">Variável da senha SMTP</label>
                <input
                  id="panel-auth-mail-password-ref"
                  className="panel-input"
                  value={settings.transport.smtpPasswordReference}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      transport: { ...prev.transport, smtpPasswordReference: event.target.value.toUpperCase() },
                    }))
                  }
                  disabled={!canManage}
                />
              </div>

              <div className="panel-field">
                <label htmlFor="panel-auth-base-url">Base pública do auth</label>
                <input
                  id="panel-auth-base-url"
                  className="panel-input"
                  placeholder="https://artmeta.com.br"
                  value={settings.links.baseUrl}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      links: { ...prev.links, baseUrl: event.target.value },
                    }))
                  }
                  disabled={!canManage}
                />
              </div>
            </div>

              <p className="panel-muted">
                A senha SMTP continua vindo do ambiente. Aqui você define apenas qual referência o painel deve usar para resolver o segredo.
              </p>
            </div>
          </details>

          <div className="panel-actions">
            <button className="panel-btn panel-btn-primary" type="submit" disabled={!canManage || !csrfToken || saveState === 'saving'}>
              {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? 'Salvo' : 'Salvar configuração'}
            </button>
          </div>
        </form>

        {error ? (
          <p className="panel-feedback panel-feedback-error" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="panel-feedback panel-feedback-success" role="status">
            {success}
          </p>
        ) : null}
      </article>
    </section>
  );
}
