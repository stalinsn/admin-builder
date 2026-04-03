'use client';

import { useMemo, useState } from 'react';

import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';
import type { GameDeliveryBundle, GameDeliveryChannel, GameDeliverySettings } from '@/features/ecommpanel/types/gameDelivery';

type Props = {
  initialSettings: GameDeliverySettings;
  initialBundle: GameDeliveryBundle;
  canManage: boolean;
};

type ApiResponse = {
  settings?: GameDeliverySettings;
  bundle?: GameDeliveryBundle;
  error?: string;
};

type FormState = {
  publicationEnabled: boolean;
  gatewayMode: 'direct-panel' | 'simulated';
  channel: GameDeliveryChannel;
  contentVersion: string;
  minSupportedVersion: string;
  currentPatchId: string;
  featuredEventIds: string;
  releaseNotes: string;
};

function buildFormState(settings: GameDeliverySettings): FormState {
  return {
    publicationEnabled: settings.publicationEnabled,
    gatewayMode: settings.gatewayMode,
    channel: settings.channel,
    contentVersion: settings.contentVersion,
    minSupportedVersion: settings.minSupportedVersion,
    currentPatchId: settings.currentPatchId,
    featuredEventIds: settings.featuredEventIds.join('\n'),
    releaseNotes: settings.releaseNotes,
  };
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function buildCurl(route: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return `curl '${origin}${route}'`;
}

const TOOLTIP_COPY = {
  save: 'Salva a configuração da camada de publicação sem marcar uma nova publicação como ativa.',
  publish: 'Publica uma nova versão do manifesto e atualiza o hash usado pelo cliente do jogo.',
  channel: 'Canal lógico da entrega. Use dev para testes, staging para homologação e production para a versão viva.',
  mode: 'Define se o jogo lê direto do painel ou da camada simulada consolidada por este módulo.',
  contentVersion: 'Versão lógica do pacote de conteúdo. O cliente pode comparar esse valor para decidir se baixa atualização.',
  minSupportedVersion: 'Versão mínima do cliente aceita por este conteúdo. Útil para bloquear builds antigas.',
  patch: 'Identificador do patch atualmente destacado no manifesto do jogo.',
  publicationEnabled: 'Liga ou pausa a publicação. Quando pausado, o manifesto continua existindo, mas sinaliza que a entrega está desativada.',
  featuredEvents: 'Lista de IDs de eventos destacados. Um por linha. Esses IDs entram no manifesto e no feed de eventos.',
  releaseNotes: 'Resumo administrativo do que foi alterado nessa publicação: balance, evento, boss, cards ou ajustes de runtime.',
  lastPublication: 'Mostra quando a última publicação foi gerada e o hash resumido do payload entregue ao cliente.',
  manifestStatus: 'Resumo do estado atual do manifesto: ativo ou pausado e a versão mínima suportada.',
  featuredEventsCard: 'Quantidade de eventos destacados atualmente publicados para o jogo.',
  manifestJson: 'Copia o JSON bruto do manifesto consolidado, útil para validar no Postman ou comparar versões.',
  feeds: 'Resumo da quantidade de registros que entram no bundle consolidado entregue ao jogo.',
  endpoints: 'Lista dos endpoints públicos da camada de publicação. O cliente do jogo pode ler esses caminhos sem navegar pelas entidades cruas.',
  curl: 'Copia um comando curl pronto para testar este endpoint manualmente.',
};

export default function GameDeliveryManager({ initialSettings, initialBundle, canManage }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [bundle, setBundle] = useState(initialBundle);
  const [form, setForm] = useState<FormState>(() => buildFormState(initialSettings));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const endpointItems = useMemo(
    () => [
      {
        id: 'manifest',
        label: 'Manifesto',
        route: '/api/game/v1/manifest',
        description: 'Versão publicada, hash, canal e status da entrega.',
      },
      {
        id: 'content',
        label: 'Conteúdo consolidado',
        route: '/api/game/v1/content',
        description: 'Payload completo de cartas, config, mundo e eventos.',
      },
      {
        id: 'cards',
        label: 'Cartas',
        route: '/api/game/v1/content/cards',
        description: 'Feed consolidado das entidades de cartas e habilidades.',
      },
      {
        id: 'config',
        label: 'Configuração',
        route: '/api/game/v1/content/config',
        description: 'Rulesets e parâmetros rasos para balance do jogo.',
      },
      {
        id: 'world',
        label: 'Mundo e runtime',
        route: '/api/game/v1/content/world',
        description: 'Ilhas, stages, encontros, bosses, patches e eventos ativos.',
      },
      {
        id: 'events',
        label: 'Eventos ativos',
        route: '/api/game/v1/events/active',
        description: 'Eventos, patches e IDs destacados para o cliente.',
      },
    ],
    [],
  );

  async function submit(action: 'save' | 'publish') {
    try {
      setError(null);
      setSuccess(null);
      if (action === 'save') setSaving(true);
      if (action === 'publish') setPublishing(true);

      const response = await fetch('/api/ecommpanel/game-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          settings: {
            publicationEnabled: form.publicationEnabled,
            gatewayMode: form.gatewayMode,
            channel: form.channel,
            contentVersion: form.contentVersion,
            minSupportedVersion: form.minSupportedVersion,
            currentPatchId: form.currentPatchId,
            featuredEventIds: form.featuredEventIds
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean),
            releaseNotes: form.releaseNotes,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!response.ok || !payload?.settings || !payload.bundle) {
        throw new Error(payload?.error || 'Falha ao atualizar a publicação do jogo.');
      }

      setSettings(payload.settings);
      setBundle(payload.bundle);
      setForm(buildFormState(payload.settings));
      setSuccess(action === 'publish' ? 'Publicação do jogo atualizada.' : 'Configuração da camada de publicação salva.');
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Falha inesperada.');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1600);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="panel-manager-page panel-game-delivery-page">
      <PanelPageHeader
        eyebrow="Game Runtime"
        title="Game Delivery"
        description="Camada de publicação do jogo para manifesto, payload consolidado e configuração viva sem depender do gateway definitivo."
        actions={
          canManage ? (
            <div className="panel-inline panel-inline-wrap">
              <button
                type="button"
                className="panel-btn panel-btn-secondary panel-btn-sm"
                onClick={() => void submit('save')}
                disabled={saving || publishing}
                title={TOOLTIP_COPY.save}
              >
                {saving ? 'Salvando...' : 'Salvar configuração'}
              </button>
              <button
                type="button"
                className="panel-btn panel-btn-primary panel-btn-sm"
                onClick={() => void submit('publish')}
                disabled={saving || publishing}
                title={TOOLTIP_COPY.publish}
              >
                {publishing ? 'Publicando...' : 'Publicar agora'}
              </button>
            </div>
          ) : null
        }
        meta={
          <div className="panel-inline panel-inline-wrap">
            <span className="panel-link-chip">{bundle.manifest.channel}</span>
            <span className="panel-link-chip">v{bundle.manifest.contentVersion}</span>
            <span className="panel-link-chip">{bundle.manifest.totalRecords} registros</span>
            <span className="panel-link-chip">{bundle.manifest.gatewayMode}</span>
          </div>
        }
      />

      {error ? <div className="panel-banner panel-banner-danger">{error}</div> : null}
      {success ? <div className="panel-banner panel-banner-success">{success}</div> : null}

      <div className="panel-game-delivery__hero">
        <article className="panel-card panel-game-delivery__hero-card" title={TOOLTIP_COPY.lastPublication}>
          <strong>Última publicação</strong>
          <span>{formatDateTime(settings.publishedAt)}</span>
          <small>Hash atual {bundle.manifest.payloadHash.slice(0, 16)}...</small>
        </article>
        <article className="panel-card panel-game-delivery__hero-card" title={TOOLTIP_COPY.manifestStatus}>
          <strong>Manifesto</strong>
          <span>{bundle.manifest.publicationEnabled ? 'Ativo' : 'Pausado'}</span>
          <small>Compatível a partir de {bundle.manifest.minSupportedVersion}</small>
        </article>
        <article className="panel-card panel-game-delivery__hero-card" title={TOOLTIP_COPY.featuredEventsCard}>
          <strong>Eventos destacados</strong>
          <span>{bundle.events.featuredEventIds.length}</span>
          <small>{bundle.events.featuredEventIds.join(', ') || 'Nenhum evento em destaque'}</small>
        </article>
      </div>

      <div className="panel-game-delivery__layout">
        <article className="panel-card panel-game-delivery__form">
          <div className="panel-card-header">
            <div className="panel-card-header__copy">
              <h2>Configuração de publicação</h2>
              <p className="panel-muted">Define a borda do jogo que o cliente vai consultar enquanto o gateway definitivo não existe.</p>
            </div>
          </div>

          <div className="panel-form-grid panel-form-grid--double">
            <label className="panel-field" title={TOOLTIP_COPY.channel}>
              <span>Canal</span>
              <select className="panel-select" value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as GameDeliveryChannel }))}>
                <option value="dev">dev</option>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
            </label>

            <label className="panel-field" title={TOOLTIP_COPY.mode}>
              <span>Modo</span>
              <select
                className="panel-select"
                value={form.gatewayMode}
                onChange={(event) => setForm((current) => ({ ...current, gatewayMode: event.target.value as 'direct-panel' | 'simulated' }))}
              >
                <option value="simulated">simulated</option>
                <option value="direct-panel">direct-panel</option>
              </select>
            </label>

            <label className="panel-field" title={TOOLTIP_COPY.contentVersion}>
              <span>Versão do conteúdo</span>
              <input className="panel-input" value={form.contentVersion} onChange={(event) => setForm((current) => ({ ...current, contentVersion: event.target.value }))} />
            </label>

            <label className="panel-field" title={TOOLTIP_COPY.minSupportedVersion}>
              <span>Versão mínima suportada</span>
              <input className="panel-input" value={form.minSupportedVersion} onChange={(event) => setForm((current) => ({ ...current, minSupportedVersion: event.target.value }))} />
            </label>

            <label className="panel-field" title={TOOLTIP_COPY.patch}>
              <span>Patch atual</span>
              <input className="panel-input" value={form.currentPatchId} onChange={(event) => setForm((current) => ({ ...current, currentPatchId: event.target.value }))} />
            </label>

            <label className="panel-field panel-field--checkbox" title={TOOLTIP_COPY.publicationEnabled}>
              <input
                type="checkbox"
                checked={form.publicationEnabled}
                onChange={(event) => setForm((current) => ({ ...current, publicationEnabled: event.target.checked }))}
              />
              <span>Publicação habilitada</span>
            </label>
          </div>

          <label className="panel-field" title={TOOLTIP_COPY.featuredEvents}>
            <span>Eventos destacados</span>
            <textarea
              className="panel-textarea"
              rows={4}
              value={form.featuredEventIds}
              onChange={(event) => setForm((current) => ({ ...current, featuredEventIds: event.target.value }))}
              placeholder="Um ID por linha"
            />
          </label>

          <label className="panel-field" title={TOOLTIP_COPY.releaseNotes}>
            <span>Notas da publicação</span>
            <textarea
              className="panel-textarea"
              rows={6}
              value={form.releaseNotes}
              onChange={(event) => setForm((current) => ({ ...current, releaseNotes: event.target.value }))}
              placeholder="Resumo do patch, evento ou balance aplicado"
            />
          </label>
        </article>

        <div className="panel-game-delivery__side">
          <article className="panel-card" title={TOOLTIP_COPY.manifestStatus}>
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Manifesto publicado</h2>
                <p className="panel-muted">Payload raso para o cliente decidir se baixa atualização.</p>
              </div>
              <button
                type="button"
                className="panel-btn panel-btn-secondary panel-btn-xs"
                onClick={() => void copyText('manifest-json', JSON.stringify(bundle.manifest, null, 2))}
                title={TOOLTIP_COPY.manifestJson}
              >
                {copiedId === 'manifest-json' ? 'Copiado' : 'Copiar JSON'}
              </button>
            </div>
            <pre className="panel-code-block">{JSON.stringify(bundle.manifest, null, 2)}</pre>
          </article>

          <article className="panel-card" title={TOOLTIP_COPY.feeds}>
            <div className="panel-card-header">
              <div className="panel-card-header__copy">
                <h2>Feeds publicados</h2>
                <p className="panel-muted">Resumo do que o cliente do jogo recebe hoje.</p>
              </div>
            </div>
            <div className="panel-game-delivery__feeds">
              <div>
                <strong>Cartas</strong>
                <small>{bundle.cards.reduce((sum, item) => sum + item.count, 0)} registros</small>
              </div>
              <div>
                <strong>Config</strong>
                <small>{bundle.config.reduce((sum, item) => sum + item.count, 0)} registros</small>
              </div>
              <div>
                <strong>Mundo</strong>
                <small>{bundle.world.reduce((sum, item) => sum + item.count, 0)} registros</small>
              </div>
            </div>
          </article>
        </div>
      </div>

      <article className="panel-card" title={TOOLTIP_COPY.endpoints}>
        <div className="panel-card-header">
          <div className="panel-card-header__copy">
            <h2>Endpoints da camada de publicação</h2>
            <p className="panel-muted">Use estes endpoints para o jogo ler manifesto, conteúdo consolidado e eventos sem depender das entidades cruas.</p>
          </div>
        </div>
        <div className="panel-api-reference-list">
          {endpointItems.map((item) => (
            <div key={item.id} className="panel-api-reference-list__item" title={item.description}>
              <div className="panel-api-reference-list__meta">
                <span className="panel-badge panel-badge-success">GET</span>
                <code>{item.route}</code>
                <button
                  type="button"
                  className="panel-api-reference-list__copy-btn"
                  onClick={() => void copyText(`${item.id}-curl`, buildCurl(item.route))}
                  title={TOOLTIP_COPY.curl}
                >
                  {copiedId === `${item.id}-curl` ? 'Copiado' : 'Copiar curl'}
                </button>
              </div>
              <div className="panel-api-reference-list__copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
