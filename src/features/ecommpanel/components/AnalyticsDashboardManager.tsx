'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { AnalyticsConfig, AnalyticsDashboard } from '@/features/analytics/types';

type MeResponse = {
  csrfToken?: string;
};

type AnalyticsConfigResponse = {
  config?: AnalyticsConfig;
  error?: string;
};

type SaveState = 'idle' | 'saving' | 'saved';
type ChartMetricKey = 'revenue' | 'sessions' | 'pageViews' | 'purchases';

type AnalyticsDashboardManagerProps = {
  initialConfig: AnalyticsConfig;
  dashboard: AnalyticsDashboard;
  canManage: boolean;
  runtimeGeneratedAt?: string;
};

type TimelineRow = AnalyticsDashboard['timeline'][number];

function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')} mil`;
  return formatCurrency(value);
}

function formatDayLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

const CHART_METRICS: Record<
  ChartMetricKey,
  {
    label: string;
    description: string;
    getValue: (row: TimelineRow) => number;
    formatValue: (value: number) => string;
    formatAxis: (value: number) => string;
  }
> = {
  revenue: {
    label: 'Receita',
    description: 'Valor bruto gerado por dia',
    getValue: (row) => row.revenue,
    formatValue: formatCurrency,
    formatAxis: formatCompactCurrency,
  },
  sessions: {
    label: 'Sessões',
    description: 'Volume diário de acessos',
    getValue: (row) => row.sessions,
    formatValue: formatInteger,
    formatAxis: formatInteger,
  },
  pageViews: {
    label: 'Páginas vistas',
    description: 'Navegação diária da loja',
    getValue: (row) => row.pageViews,
    formatValue: formatInteger,
    formatAxis: formatInteger,
  },
  purchases: {
    label: 'Compras',
    description: 'Pedidos concluídos por dia',
    getValue: (row) => row.purchases,
    formatValue: formatInteger,
    formatAxis: formatInteger,
  },
};

function buildAnalyticsChart(timeline: TimelineRow[], metricKey: ChartMetricKey) {
  const metric = CHART_METRICS[metricKey];
  const width = 760;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 42, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const values = timeline.map((row) => metric.getValue(row));
  const maxValue = Math.max(...values, 1);
  const ticks = 4;
  const stepX = timeline.length > 1 ? innerWidth / (timeline.length - 1) : 0;

  const points = timeline.map((row, index) => {
    const value = metric.getValue(row);
    const ratio = maxValue === 0 ? 0 : value / maxValue;
    const x = padding.left + stepX * index;
    const y = padding.top + innerHeight - innerHeight * ratio;
    return { row, value, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = points.length
    ? [
        `M ${points[0].x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)}`,
        ...points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
        `L ${points[points.length - 1].x.toFixed(2)} ${(padding.top + innerHeight).toFixed(2)}`,
        'Z',
      ].join(' ')
    : '';

  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = (maxValue / ticks) * index;
    const ratio = maxValue === 0 ? 0 : value / maxValue;
    const y = padding.top + innerHeight - innerHeight * ratio;
    return { value, y };
  }).reverse();

  const latestPoint = points[points.length - 1] || null;
  const previousPoint = points[points.length - 2] || null;
  const peakPoint = points.reduce<typeof points[number] | null>((highest, point) => {
    if (!highest || point.value > highest.value) return point;
    return highest;
  }, null);

  const delta = latestPoint && previousPoint ? latestPoint.value - previousPoint.value : 0;
  const deltaLabel =
    latestPoint && previousPoint
      ? delta === 0
        ? 'estável em relação ao dia anterior'
        : `${delta > 0 ? '+' : ''}${metric.formatValue(delta).replace('R$', '').trim()} vs. dia anterior`
      : 'sem comparação anterior';

  return {
    metric,
    width,
    height,
    padding,
    points,
    linePath,
    areaPath,
    yTicks,
    latestPoint,
    peakPoint,
    deltaLabel,
  };
}

function formatDateTime(value?: string): string {
  if (!value) return 'Ainda não gerado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function AnalyticsDashboardManager({
  initialConfig,
  dashboard,
  canManage,
  runtimeGeneratedAt,
}: AnalyticsDashboardManagerProps) {
  const [csrfToken, setCsrfToken] = useState('');
  const [config, setConfig] = useState<AnalyticsConfig>(initialConfig);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>(() => (dashboard.overview.revenue > 0 ? 'revenue' : 'sessions'));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    internal: true,
    retention: false,
    google: true,
  });
  const chart = buildAnalyticsChart(dashboard.timeline, chartMetric);

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
      const response = await fetch('/api/ecommpanel/analytics/config', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ config }),
      });

      const payload = (await response.json().catch(() => null)) as AnalyticsConfigResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível salvar a configuração.');
      }

      if (payload?.config) {
        setConfig(payload.config);
      }
      setSuccess('Configuração salva. A loja já passa a usar o novo comportamento de medição.');
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch (saveError) {
      setSaveState('idle');
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar a configuração.');
    }
  }

  function setSectionExpanded(sectionId: string, open: boolean) {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: open }));
  }

  return (
    <section className="panel-grid panel-analytics" aria-labelledby="panel-analytics-title">
      <article className="panel-card panel-card-hero panel-dashboard-hero">
        <div className="panel-dashboard-hero__header">
          <div>
            <p className="panel-kicker">Analytics operacional</p>
            <h1 id="panel-analytics-title">Sessões, comportamento e resultado comercial da loja</h1>
            <p className="panel-muted">
              Este painel acompanha acessos ativos, buscas, cliques, carrinho, checkout e compras concluídas sem depender só de ferramentas externas.
            </p>
          </div>
          <div className="panel-dashboard-hero__badges">
            <span className={`panel-badge ${config.internal.enabled ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
              coleta interna {config.internal.enabled ? 'ativa' : 'desligada'}
            </span>
            <span className={`panel-badge ${config.google.enabled ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
              google {config.google.enabled ? 'habilitado' : 'desligado'}
            </span>
          </div>
        </div>

        <div className="panel-dashboard-hero__meta">
          <div>
            <span className="panel-muted">Janela analisada</span>
            <strong>Últimos {dashboard.rangeDays} dias</strong>
            <span>Troque a visão rápida abaixo.</span>
          </div>
          <div>
            <span className="panel-muted">Configuração publicada</span>
            <strong>{formatDateTime(runtimeGeneratedAt)}</strong>
            <span>Última leitura da loja para scripts e coleta.</span>
          </div>
          <div>
            <span className="panel-muted">Geração deste relatório</span>
            <strong>{formatDateTime(dashboard.generatedAt)}</strong>
            <span>Os números abaixo são recalculados a partir dos eventos armazenados.</span>
          </div>
        </div>

        <div className="panel-segmented-links">
          <Link href="/ecommpanel/admin/analytics?range=1" className={`panel-link-chip ${dashboard.rangeDays === 1 ? 'is-active' : ''}`}>Hoje</Link>
          <Link href="/ecommpanel/admin/analytics?range=7" className={`panel-link-chip ${dashboard.rangeDays === 7 ? 'is-active' : ''}`}>7 dias</Link>
          <Link href="/ecommpanel/admin/analytics?range=30" className={`panel-link-chip ${dashboard.rangeDays === 30 ? 'is-active' : ''}`}>30 dias</Link>
        </div>
      </article>

      <div className="panel-stats panel-analytics-metrics">
        <article className="panel-stat">
          <span className="panel-muted">Usuários ativos agora</span>
          <strong>{formatInteger(dashboard.overview.activeSessions)}</strong>
          <span>{formatInteger(dashboard.overview.totalSessions)} sessões no período</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Tempo médio por sessão</span>
          <strong>{dashboard.overview.averageSessionMinutes.toFixed(1).replace('.', ',')} min</strong>
          <span>{formatInteger(dashboard.overview.uniqueVisitors)} visitantes únicos</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Visualizações de página</span>
          <strong>{formatInteger(dashboard.overview.pageViews)}</strong>
          <span>{formatInteger(dashboard.overview.searches)} buscas enviadas</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Cliques em elementos</span>
          <strong>{formatInteger(dashboard.overview.clicks)}</strong>
          <span>{formatInteger(dashboard.overview.cartUpdates)} mudanças no carrinho</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Compras concluídas</span>
          <strong>{formatInteger(dashboard.overview.purchases)}</strong>
          <span>Conversão de {formatPercent(dashboard.overview.conversionRate)}</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Receita capturada</span>
          <strong>{formatCurrency(dashboard.overview.revenue)}</strong>
          <span>Ticket médio de {formatCurrency(dashboard.overview.averageTicket)}</span>
        </article>
      </div>

      <div className="panel-dashboard-layout panel-dashboard-layout--analytics">
        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Comércio</p>
              <h2>Fechamento comercial do período</h2>
            </div>
          </div>

          <div className="panel-dashboard-list">
            <div className="panel-dashboard-row">
              <strong>Checkout exercitado</strong>
              <span>{formatInteger(dashboard.overview.checkoutSessions)} sessões chegaram ao checkout</span>
              <small>{formatPercent(dashboard.overview.cartAbandonmentRate)} das sessões com carrinho terminaram sem compra.</small>
            </div>
            <div className="panel-dashboard-row">
              <strong>Formas de pagamento mais usadas</strong>
              <span>
                {dashboard.paymentMethods.length
                  ? `${dashboard.paymentMethods[0].label} (${formatInteger(dashboard.paymentMethods[0].value)})`
                  : 'Ainda não há pagamentos concluídos'}
              </span>
              <small>Os métodos abaixo são consolidados diretamente das compras finalizadas.</small>
            </div>
          </div>

          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Uso</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.paymentMethods.length ? (
                  dashboard.paymentMethods.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{formatInteger(item.value)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="panel-table-empty">Nenhuma compra concluída na janela atual.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Valor</th>
                  <th>Pagamento</th>
                  <th>Local</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentPurchases.length ? (
                  dashboard.recentPurchases.map((purchase) => (
                    <tr key={`${purchase.orderId}-${purchase.occurredAt}`}>
                      <td>
                        <strong>{purchase.orderId}</strong>
                        <br />
                        <small>{formatDateTime(purchase.occurredAt)}</small>
                      </td>
                      <td>{formatCurrency(purchase.value)}</td>
                      <td>{purchase.paymentMethod}</td>
                      <td>{purchase.locationLabel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="panel-table-empty">Nenhuma compra recente disponível.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Comportamento</p>
              <h2>O que as pessoas estão acessando e acionando</h2>
            </div>
          </div>

          <div className="panel-analytics-columns">
            <div>
              <h3>Páginas mais vistas</h3>
              <div className="panel-layer-list">
                {dashboard.topPages.length ? (
                  dashboard.topPages.map((item) => (
                    <div key={item.label} className="panel-dashboard-row">
                      <strong>{item.label}</strong>
                      <span>{formatInteger(item.value)} visualizações</span>
                      {item.secondary ? <small>{item.secondary}</small> : null}
                    </div>
                  ))
                ) : (
                  <div className="panel-dashboard-row">
                    <strong>Sem dados ainda</strong>
                    <small>Quando a loja receber navegação, as páginas mais acessadas aparecem aqui.</small>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3>Buscas mais frequentes</h3>
              <div className="panel-layer-list">
                {dashboard.topSearches.length ? (
                  dashboard.topSearches.map((item) => (
                    <div key={item.label} className="panel-dashboard-row">
                      <strong>{item.label}</strong>
                      <span>{formatInteger(item.value)} buscas</span>
                    </div>
                  ))
                ) : (
                  <div className="panel-dashboard-row">
                    <strong>Sem buscas registradas</strong>
                    <small>As consultas do header entram automaticamente nesta lista.</small>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3>Cliques mais acionados</h3>
              <div className="panel-layer-list">
                {dashboard.topClicks.length ? (
                  dashboard.topClicks.map((item) => (
                    <div key={`${item.label}-${item.secondary || ''}`} className="panel-dashboard-row">
                      <strong>{item.label}</strong>
                      <span>{formatInteger(item.value)} cliques</span>
                      {item.secondary ? <small>{item.secondary}</small> : null}
                    </div>
                  ))
                ) : (
                  <div className="panel-dashboard-row">
                    <strong>Sem interações ainda</strong>
                    <small>Botões, links e CTAs clicáveis passam a alimentar esta área.</small>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3>Origem de acesso</h3>
              <div className="panel-layer-list">
                {dashboard.locations.length ? (
                  dashboard.locations.map((item) => (
                    <div key={item.label} className="panel-dashboard-row">
                      <strong>{item.label}</strong>
                      <span>{formatInteger(item.value)} sessões</span>
                    </div>
                  ))
                ) : (
                  <div className="panel-dashboard-row">
                    <strong>Sem localização útil ainda</strong>
                    <small>Quando houver cabeçalhos de borda ou compras com endereço, a origem aparece aqui.</small>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3>Dispositivos</h3>
              <div className="panel-layer-list">
                {dashboard.devices.length ? (
                  dashboard.devices.map((item) => (
                    <div key={item.label} className="panel-dashboard-row">
                      <strong>{item.label}</strong>
                      <span>{formatInteger(item.value)} sessões</span>
                    </div>
                  ))
                ) : (
                  <div className="panel-dashboard-row">
                    <strong>Sem distribuição disponível</strong>
                    <small>Quando houver navegação suficiente, os dispositivos aparecem aqui.</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="panel-dashboard-layout panel-dashboard-layout--analytics">
        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Linha do tempo</p>
              <h2>Ritmo diário de navegação e venda</h2>
            </div>
          </div>

          <div className="panel-analytics-chart-toolbar">
            {Object.entries(CHART_METRICS).map(([key, metric]) => (
              <button
                key={key}
                type="button"
                className={`panel-link-chip ${chartMetric === key ? 'is-active' : ''}`}
                onClick={() => setChartMetric(key as ChartMetricKey)}
              >
                {metric.label}
              </button>
            ))}
          </div>

          <div className="panel-analytics-chart-card">
            <div className="panel-analytics-chart-summary">
              <div>
                <span className="panel-muted">Métrica atual</span>
                <strong>{chart.metric.label}</strong>
                <small>{chart.metric.description}</small>
              </div>
              <div>
                <span className="panel-muted">Último dia</span>
                <strong>{chart.latestPoint ? chart.metric.formatValue(chart.latestPoint.value) : 'Sem dados'}</strong>
                <small>{chart.latestPoint ? `${formatDayLabel(chart.latestPoint.row.day)} • ${chart.deltaLabel}` : 'A linha do tempo ainda não recebeu eventos.'}</small>
              </div>
              <div>
                <span className="panel-muted">Pico do período</span>
                <strong>{chart.peakPoint ? chart.metric.formatValue(chart.peakPoint.value) : 'Sem dados'}</strong>
                <small>{chart.peakPoint ? formatDayLabel(chart.peakPoint.row.day) : 'Sem pico registrado'}</small>
              </div>
            </div>

            <div className="panel-analytics-chart">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`Gráfico de ${chart.metric.label.toLowerCase()} por dia`}>
                <defs>
                  <linearGradient id="analytics-area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(11, 122, 90, 0.42)" />
                    <stop offset="100%" stopColor="rgba(31, 71, 56, 0.04)" />
                  </linearGradient>
                </defs>

                {chart.yTicks.map((tick) => (
                  <g key={`tick-${tick.y}`}>
                    <line
                      x1={chart.padding.left}
                      x2={chart.width - chart.padding.right}
                      y1={tick.y}
                      y2={tick.y}
                      className="panel-analytics-chart__grid"
                    />
                    <text x={chart.padding.left - 12} y={tick.y + 4} textAnchor="end" className="panel-analytics-chart__axis">
                      {chart.metric.formatAxis(tick.value)}
                    </text>
                  </g>
                ))}

                {chart.areaPath ? <path d={chart.areaPath} fill="url(#analytics-area-fill)" className="panel-analytics-chart__area" /> : null}
                {chart.linePath ? <path d={chart.linePath} fill="none" className="panel-analytics-chart__line" /> : null}

                {chart.points.map((point) => (
                  <g key={point.row.day}>
                    <circle cx={point.x} cy={point.y} r="4.5" className="panel-analytics-chart__dot" />
                    <text x={point.x} y={chart.height - 16} textAnchor="middle" className="panel-analytics-chart__axis panel-analytics-chart__axis--x">
                      {formatDayLabel(point.row.day)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Sessões</th>
                  <th>Páginas</th>
                  <th>Buscas</th>
                  <th>Compras</th>
                  <th>Receita</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.timeline.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td>{formatInteger(row.sessions)}</td>
                    <td>{formatInteger(row.pageViews)}</td>
                    <td>{formatInteger(row.searches)}</td>
                    <td>{formatInteger(row.purchases)}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card panel-dashboard-card">
          <div className="panel-dashboard-card__header">
            <div>
              <p className="panel-kicker">Eventos recentes</p>
              <h2>Leitura rápida do que está acontecendo agora</h2>
            </div>
          </div>

          <div className="panel-layer-list">
            {dashboard.recentEvents.length ? (
              dashboard.recentEvents.map((item) => (
                <div key={item.id} className="panel-dashboard-row">
                  <strong>{item.label}</strong>
                  <span>{item.pathname}</span>
                  <small>
                    {formatDateTime(item.occurredAt)}
                    {item.secondary ? ` • ${item.secondary}` : ''}
                  </small>
                </div>
              ))
            ) : (
              <div className="panel-dashboard-row">
                <strong>Sem eventos recentes</strong>
                <small>Assim que a loja for usada, os últimos eventos aparecem aqui.</small>
              </div>
            )}
          </div>

          <div className="panel-layer-list">
            {dashboard.alerts.map((alert) => (
              <div key={alert} className="panel-dashboard-alert panel-dashboard-alert--info">
                <strong>Atenção operacional</strong>
                <p>{alert}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel-card panel-dashboard-card">
        <div className="panel-dashboard-card__header">
          <div>
            <p className="panel-kicker">Configuração</p>
            <h2>Coleta interna e tags externas</h2>
          </div>
          <span className="panel-badge panel-badge-neutral">{canManage ? 'edição liberada' : 'somente leitura'}</span>
        </div>

        <form className="panel-form" onSubmit={handleSave}>
          <details className="panel-layer-item" open={expandedSections.internal} onToggle={(event) => setSectionExpanded('internal', event.currentTarget.open)}>
            <summary>
              <span>
                <span className="panel-layer-title">Coleta interna</span>
                <span className="panel-layer-hint">Controles que definem se a loja mede navegação, cliques, carrinho e checkout.</span>
              </span>
              <span className="panel-accordion-chevron" aria-hidden="true" />
            </summary>
            <div className="panel-layer-content">
              <div className="panel-form-grid panel-form-grid--three">
                <div className="panel-field">
                  <label htmlFor="analytics-internal-enabled">Coleta interna</label>
                  <select
                    id="analytics-internal-enabled"
                    className="panel-select"
                    value={config.internal.enabled ? 'true' : 'false'}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        internal: { ...prev.internal, enabled: event.target.value === 'true' },
                      }))
                    }
                  >
                    <option value="true">Ativa</option>
                    <option value="false">Desligada</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-heartbeat">Pulso da sessão (segundos)</label>
                  <input
                    id="analytics-heartbeat"
                    type="number"
                    min={10}
                    max={300}
                    className="panel-input"
                    value={config.internal.heartbeatIntervalSeconds}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        internal: { ...prev.internal, heartbeatIntervalSeconds: Number(event.target.value) || prev.internal.heartbeatIntervalSeconds },
                      }))
                    }
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-active-window">Janela de usuários ativos (min)</label>
                  <input
                    id="analytics-active-window"
                    type="number"
                    min={1}
                    max={30}
                    className="panel-input"
                    value={config.internal.activeWindowMinutes}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        internal: { ...prev.internal, activeWindowMinutes: Number(event.target.value) || prev.internal.activeWindowMinutes },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </details>

          <details className="panel-layer-item" open={expandedSections.retention} onToggle={(event) => setSectionExpanded('retention', event.currentTarget.open)}>
            <summary>
              <span>
                <span className="panel-layer-title">Sessão e retenção</span>
                <span className="panel-layer-hint">Tempo de expiração, retenção dos eventos e tamanho dos lotes enviados pela loja.</span>
              </span>
              <span className="panel-accordion-chevron" aria-hidden="true" />
            </summary>
            <div className="panel-layer-content">
              <div className="panel-form-grid panel-form-grid--three">
                <div className="panel-field">
                  <label htmlFor="analytics-session-timeout">Tempo de sessão ociosa (min)</label>
                  <input
                    id="analytics-session-timeout"
                    type="number"
                    min={5}
                    max={120}
                    className="panel-input"
                    value={config.internal.sessionTimeoutMinutes}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        internal: { ...prev.internal, sessionTimeoutMinutes: Number(event.target.value) || prev.internal.sessionTimeoutMinutes },
                      }))
                    }
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-retain-days">Retenção dos eventos (dias)</label>
                  <input
                    id="analytics-retain-days"
                    type="number"
                    min={7}
                    max={365}
                    className="panel-input"
                    value={config.internal.retainDays}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        internal: { ...prev.internal, retainDays: Number(event.target.value) || prev.internal.retainDays },
                      }))
                    }
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-max-batch">Eventos por lote</label>
                  <input
                    id="analytics-max-batch"
                    type="number"
                    min={1}
                    max={100}
                    className="panel-input"
                    value={config.internal.maxBatchSize}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        internal: { ...prev.internal, maxBatchSize: Number(event.target.value) || prev.internal.maxBatchSize },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </details>

          <details className="panel-layer-item" open={expandedSections.google} onToggle={(event) => setSectionExpanded('google', event.currentTarget.open)}>
            <summary>
              <span>
                <span className="panel-layer-title">Integrações Google</span>
                <span className="panel-layer-hint">Habilite GTM e GA4 por input, sem precisar editar o código da loja.</span>
              </span>
              <span className="panel-accordion-chevron" aria-hidden="true" />
            </summary>
            <div className="panel-layer-content">
              <div className="panel-form-grid panel-form-grid--three">
                <div className="panel-field">
                  <label htmlFor="analytics-google-enabled">Integrações Google</label>
                  <select
                    id="analytics-google-enabled"
                    className="panel-select"
                    value={config.google.enabled ? 'true' : 'false'}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, enabled: event.target.value === 'true' },
                      }))
                    }
                  >
                    <option value="false">Desligadas</option>
                    <option value="true">Ligadas</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-gtm-enabled">Google Tag Manager</label>
                  <select
                    id="analytics-gtm-enabled"
                    className="panel-select"
                    value={config.google.gtmEnabled ? 'true' : 'false'}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, gtmEnabled: event.target.value === 'true' },
                      }))
                    }
                  >
                    <option value="false">Desligado</option>
                    <option value="true">Ligado</option>
                  </select>
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-ga-enabled">Google Analytics 4</label>
                  <select
                    id="analytics-ga-enabled"
                    className="panel-select"
                    value={config.google.gaEnabled ? 'true' : 'false'}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, gaEnabled: event.target.value === 'true' },
                      }))
                    }
                  >
                    <option value="false">Desligado</option>
                    <option value="true">Ligado</option>
                  </select>
                </div>
              </div>

              <div className="panel-form-grid panel-form-grid--three">
                <div className="panel-field">
                  <label htmlFor="analytics-gtm-id">Container GTM</label>
                  <input
                    id="analytics-gtm-id"
                    type="text"
                    className="panel-input"
                    placeholder="GTM-XXXXXXX"
                    value={config.google.gtmContainerId}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, gtmContainerId: event.target.value.toUpperCase() },
                      }))
                    }
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-ga-id">Measurement ID GA4</label>
                  <input
                    id="analytics-ga-id"
                    type="text"
                    className="panel-input"
                    placeholder="G-XXXXXXXXXX"
                    value={config.google.gaMeasurementId}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, gaMeasurementId: event.target.value.toUpperCase() },
                      }))
                    }
                  />
                </div>
                <div className="panel-field">
                  <label htmlFor="analytics-data-layer">Nome da data layer</label>
                  <input
                    id="analytics-data-layer"
                    type="text"
                    className="panel-input"
                    value={config.google.dataLayerName}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, dataLayerName: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="panel-form-grid panel-form-grid--three">
                <div className="panel-field">
                  <label htmlFor="analytics-send-pageview">Enviar page view para GA4</label>
                  <select
                    id="analytics-send-pageview"
                    className="panel-select"
                    value={config.google.sendPageView ? 'true' : 'false'}
                    disabled={!canManage}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        google: { ...prev.google, sendPageView: event.target.value === 'true' },
                      }))
                    }
                  >
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
              </div>
            </div>
          </details>

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

          <div className="panel-actions">
            <button type="submit" className="panel-btn panel-btn-primary" disabled={!canManage || !csrfToken || saveState === 'saving'}>
              {saveState === 'saving' ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
