'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import PanelPageHeader from '@/features/ecommpanel/components/PanelPageHeader';
import type { GameEndpointEdge, GameEndpointNode, GameEndpointsGroupId, GameEndpointsMapData } from '@/features/ecommpanel/server/gameEndpointsMap';

type Props = {
  data: GameEndpointsMapData;
};

type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
} | null;

type PositionMap = Record<string, { x: number; y: number }>;

const METHOD_TONES: Record<'GET' | 'POST' | 'PUT' | 'DELETE', string> = {
  GET: 'is-read',
  POST: 'is-write',
  PUT: 'is-update',
  DELETE: 'is-delete',
};

const GROUP_TONES: Record<GameEndpointsGroupId, string> = {
  content: 'is-content',
  players: 'is-players',
  world: 'is-world',
  competitive: 'is-competitive',
};

const BOARD_WIDTH = 1920;
const NODE_WIDTH = 280;
const NODE_CENTER_X = NODE_WIDTH / 2;
const NODE_CENTER_Y = 46;
const METHOD_ORDER: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];

function buildCurlCommand(method: 'GET' | 'POST' | 'PUT' | 'DELETE', route: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const lines = [`curl -X ${method} '${origin}${route}'`, "  -H 'Authorization: Bearer <TOKEN>'"];

  if (method !== 'GET') {
    lines.push("  -H 'Content-Type: application/json'");
  }

  if (method === 'POST' || method === 'PUT') {
    lines.push("  -d '{\"example\":\"value\"}'");
  }

  return lines.join(' \\\n');
}

type ExampleFieldShape = {
  name: string;
  label: string;
  type: string;
  defaultValue?: string;
};

function resolveExampleValue(field: ExampleFieldShape): unknown {
  switch (field.type) {
    case 'slug':
      return `example-${field.name}`;
    case 'email':
      return 'player@example.com';
    case 'url':
      return 'https://example.com/resource';
    case 'integer':
      return 1;
    case 'number':
    case 'currency':
      return 1.5;
    case 'boolean':
      return true;
    case 'date':
      return '2026-04-03';
    case 'datetime':
      return '2026-04-03T12:00:00.000Z';
    case 'json':
      return { example: true };
    case 'reference':
      return '<REFERENCE_ID>';
    case 'rich_text':
      return `Conteudo de ${field.label}`;
    case 'text':
    default:
      return `Exemplo de ${field.label}`;
  }
}

function buildExamplePayload(fields: ExampleFieldShape[]): string {
  const payload = Object.fromEntries(
    fields.map((field) => [field.name, field.defaultValue || resolveExampleValue(field)]),
  );
  return JSON.stringify(payload, null, 2);
}

function resolvePrimaryRoute(node: GameEndpointNode): { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; route: string } | null {
  const preferred = node.routes.find((route) => route.kind === 'collection' && route.method === 'GET');
  if (preferred) return { method: preferred.method, route: preferred.route };
  const fallback = node.routes[0];
  return fallback ? { method: fallback.method, route: fallback.route } : null;
}

function buildInitialPositions(nodes: GameEndpointNode[]): PositionMap {
  return Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
}

function buildBoardHeight(nodes: GameEndpointNode[], positions: PositionMap): number {
  const maxY = Math.max(...nodes.map((node) => positions[node.id]?.y ?? node.y), 0);
  return Math.max(1380, maxY + 280);
}

function resolveMethodSummary(node: GameEndpointNode): Array<'GET' | 'POST' | 'PUT' | 'DELETE'> {
  return ['GET', 'POST', 'PUT', 'DELETE'].filter((method) => node.methods.includes(method as typeof node.methods[number])) as Array<
    'GET' | 'POST' | 'PUT' | 'DELETE'
  >;
}

function resolveEdgeGeometry(
  edge: GameEndpointEdge,
  positions: PositionMap,
): { path: string; labelX: number; labelY: number; labelSide: 'left' | 'right' } | null {
  const from = positions[edge.from];
  const to = positions[edge.to];
  if (!from || !to) return null;

  const startX = from.x + NODE_CENTER_X;
  const startY = from.y + NODE_CENTER_Y;
  const endX = to.x + NODE_CENTER_X;
  const endY = to.y + NODE_CENTER_Y;
  const direction = endX >= startX ? 1 : -1;
  const distanceX = Math.abs(endX - startX);
  const deltaX = Math.max(140, distanceX * 0.36);
  const verticalLift = Math.max(54, Math.min(126, Math.abs(endY - startY) * 0.22 + 42));
  const control1X = startX + deltaX * direction;
  const control1Y = startY - verticalLift;
  const control2X = endX - deltaX * direction;
  const control2Y = endY + verticalLift;
  const path = `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;

  return {
    path,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - verticalLift * 0.4,
    labelSide: direction === 1 ? 'right' : 'left',
  };
}

export default function GameEndpointsCanvas({ data }: Props) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<PositionMap>(() => buildInitialPositions(data.nodes));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(data.nodes[0]?.id || null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [zoom, setZoom] = useState(1);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [copiedRouteId, setCopiedRouteId] = useState<string | null>(null);
  const [copiedPayloadId, setCopiedPayloadId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => data.nodes.find((node) => node.id === selectedNodeId) || data.nodes[0] || null,
    [data.nodes, selectedNodeId],
  );

  const boardHeight = useMemo(() => buildBoardHeight(data.nodes, positions), [data.nodes, positions]);
  const relatedEdgeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    return new Set(
      data.edges
        .filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId)
        .map((edge) => edge.id),
    );
  }, [data.edges, selectedNodeId]);

  useEffect(() => {
    if (!isInspectorOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsInspectorOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspectorOpen]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>, nodeId: string) {
    const boardRect = boardRef.current?.getBoundingClientRect();
    const currentPosition = positions[nodeId];
    if (!boardRect || !currentPosition) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(nodeId);
    setDragState({
      nodeId,
      offsetX: (event.clientX - boardRect.left) / zoom - currentPosition.x,
      offsetY: (event.clientY - boardRect.top) / zoom - currentPosition.y,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState || !boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const nextX = Math.max(18, (event.clientX - boardRect.left) / zoom - dragState.offsetX);
    const nextY = Math.max(18, (event.clientY - boardRect.top) / zoom - dragState.offsetY);

    setPositions((current) => ({
      ...current,
      [dragState.nodeId]: {
        x: nextX,
        y: nextY,
      },
    }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  }

  function resetLayout() {
    setPositions(buildInitialPositions(data.nodes));
  }

  function updateZoom(nextZoom: number) {
    setZoom(Math.min(1.5, Math.max(0.6, Number(nextZoom.toFixed(2)))));
  }

  function zoomIn() {
    updateZoom(zoom + 0.1);
  }

  function zoomOut() {
    updateZoom(zoom - 0.1);
  }

  async function copyCurl(routeId: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', route: string) {
    try {
      await navigator.clipboard.writeText(buildCurlCommand(method, route));
      setCopiedRouteId(routeId);
      window.setTimeout(() => {
        setCopiedRouteId((current) => (current === routeId ? null : current));
      }, 1600);
    } catch {
      setCopiedRouteId(null);
    }
  }

  async function copyPayload(routeId: string, fields: ExampleFieldShape[]) {
    try {
      await navigator.clipboard.writeText(buildExamplePayload(fields));
      setCopiedPayloadId(routeId);
      window.setTimeout(() => {
        setCopiedPayloadId((current) => (current === routeId ? null : current));
      }, 1600);
    } catch {
      setCopiedPayloadId(null);
    }
  }

  return (
    <section className="panel-manager-page panel-game-endpoints-page">
      <PanelPageHeader
        eyebrow="API & Integracoes"
        title="Game Endpoints"
        description="Mapa navegavel dos endpoints do jogo, organizado por dominio, rotas de leitura e escrita, campos de schema e ligacoes entre entidades."
        actions={
          <div className="panel-inline panel-inline-wrap">
            <button
              type="button"
              className="panel-btn panel-btn-secondary panel-btn-sm"
              onClick={() => setIsInspectorOpen((current) => !current)}
            >
              {isInspectorOpen ? 'Fechar detalhes' : 'Abrir detalhes'}
            </button>
            <button type="button" className="panel-btn panel-btn-secondary panel-btn-sm" onClick={resetLayout}>
              Resetar mapa
            </button>
          </div>
        }
        meta={
          <div className="panel-inline panel-inline-wrap">
            <span className="panel-link-chip">{data.stats.totalNodes} entidades</span>
            <span className="panel-link-chip">{data.stats.totalEdges} relacoes</span>
            <span className="panel-link-chip">{data.stats.readableRoutes} rotas GET</span>
            <span className="panel-link-chip">{data.stats.writableRoutes} rotas write</span>
          </div>
        }
      />

      <div className="panel-game-endpoints__stats">
        {data.groups.map((group) => (
          <article key={group.id} className={`panel-game-endpoints__stat ${GROUP_TONES[group.id]}`}>
            <strong>{group.label}</strong>
            <small>{group.description}</small>
          </article>
        ))}
      </div>

      <div className="panel-game-endpoints__layout">
        <article className="panel-card panel-game-endpoints__board-shell">
          <div className="panel-section-heading">
            <div>
              <h3>Mapa fisico dos endpoints</h3>
              <p className="panel-muted">Arraste os blocos para testar leituras de fluxo entre catalogo, jogador, runtime e competitivo.</p>
            </div>
            <div className="panel-inline panel-inline-wrap panel-game-endpoints__legend">
              <span className="panel-link-chip">Clique no cartao para focar relacoes</span>
              <span className="panel-link-chip">Use Detalhes para abrir o schema</span>
            </div>
          </div>

          <div className="panel-game-endpoints__toolbar">
            <div className="panel-inline panel-inline-wrap">
              <button type="button" className="panel-btn panel-btn-ghost panel-btn-sm" onClick={zoomOut}>
                Zoom -
              </button>
              <span className="panel-link-chip">{Math.round(zoom * 100)}%</span>
              <button type="button" className="panel-btn panel-btn-ghost panel-btn-sm" onClick={zoomIn}>
                Zoom +
              </button>
            </div>

            <div className="panel-inline panel-inline-wrap">
              <span className="panel-game-endpoints__legend-item is-read">GET</span>
              <span className="panel-game-endpoints__legend-item is-write">POST</span>
              <span className="panel-game-endpoints__legend-item is-update">PUT</span>
              <span className="panel-game-endpoints__legend-item is-delete">DELETE</span>
            </div>
          </div>

          <div
            ref={boardRef}
            className="panel-game-endpoints__board"
            style={{ minHeight: `${boardHeight}px` }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="panel-game-endpoints__scene"
              style={{ width: `${BOARD_WIDTH}px`, minHeight: `${boardHeight}px`, transform: `scale(${zoom})` }}
            >
              <svg className="panel-game-endpoints__wires" viewBox={`0 0 ${BOARD_WIDTH} ${boardHeight}`} preserveAspectRatio="none">
                {data.edges.map((edge) => {
                  const geometry = resolveEdgeGeometry(edge, positions);
                  if (!geometry) return null;
                  const dominantMethod = edge.methods[0] ?? 'GET';
                  return (
                    <path
                      key={edge.id}
                      d={geometry.path}
                      className={`panel-game-endpoints__wire ${METHOD_TONES[dominantMethod]} ${relatedEdgeIds.has(edge.id) ? 'is-highlighted' : ''}`}
                      markerEnd="url(#panel-game-endpoints-arrow)"
                    />
                  );
                })}
                <defs>
                  <marker id="panel-game-endpoints-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(214, 174, 64, 0.82)" />
                  </marker>
                </defs>
              </svg>

              {data.edges.map((edge) => {
                if (!relatedEdgeIds.has(edge.id)) return null;
                const geometry = resolveEdgeGeometry(edge, positions);
                if (!geometry) return null;
                return (
                  <span
                    key={`${edge.id}-label`}
                    className={`panel-game-endpoints__wire-label is-${geometry.labelSide}`}
                    style={{ left: `${geometry.labelX}px`, top: `${geometry.labelY}px` }}
                  >
                    <span>{edge.label}</span>
                  </span>
                );
              })}

              {data.nodes.map((node) => {
                const active = selectedNodeId === node.id;
                return (
                  <article
                    key={node.id}
                    className={`panel-game-endpoints__node ${GROUP_TONES[node.group]} ${active ? 'is-active' : ''}`}
                    style={{ left: `${positions[node.id]?.x ?? node.x}px`, top: `${positions[node.id]?.y ?? node.y}px` }}
                  >
                    <div className="panel-game-endpoints__node-main" onClick={() => setSelectedNodeId(node.id)} onPointerDown={(event) => handlePointerDown(event, node.id)}>
                      <span className="panel-game-endpoints__node-group">{data.groups.find((group) => group.id === node.group)?.label}</span>
                      <strong>{node.label}</strong>
                    </div>

                    <div className="panel-game-endpoints__node-body">
                      <div className="panel-game-endpoints__methods">
                        {resolveMethodSummary(node).map((method) => (
                          <span key={`${node.id}-${method}`} className={`panel-game-endpoints__method ${METHOD_TONES[method]}`}>
                            {method}
                          </span>
                        ))}
                      </div>

                      <div className="panel-game-endpoints__node-actions">
                        {resolvePrimaryRoute(node) ? (
                          <button
                            type="button"
                            className="panel-game-endpoints__node-link"
                            onClick={() => {
                              const primaryRoute = resolvePrimaryRoute(node);
                              if (!primaryRoute) return;
                              void copyCurl(`${node.id}-primary`, primaryRoute.method, primaryRoute.route);
                            }}
                          >
                            {copiedRouteId === `${node.id}-primary` ? 'Copiado' : 'Curl GET'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="panel-game-endpoints__node-link"
                          onClick={() => {
                            setSelectedNodeId(node.id);
                            setIsInspectorOpen(true);
                          }}
                        >
                          Detalhes
                        </button>
                        <Link className="panel-game-endpoints__node-link" href="/ecommpanel/admin/data?module=modeling">
                          Modelagem
                        </Link>
                        <Link className="panel-game-endpoints__node-link" href="/ecommpanel/admin/data?module=records">
                          Registros
                        </Link>
                        <Link className="panel-game-endpoints__node-link" href="/ecommpanel/admin/integrations?view=scopes">
                          Escopos
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </article>

        {isInspectorOpen ? (
          <div className="panel-game-endpoints__modal" role="presentation" onClick={() => setIsInspectorOpen(false)}>
            <aside className="panel-card panel-game-endpoints__inspector" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              {selectedNode ? (
                <>
                  <div className="panel-game-endpoints__inspector-head">
                    <div className="panel-game-endpoints__inspector-headline">
                      <span className={`panel-game-endpoints__inspector-tag ${GROUP_TONES[selectedNode.group]}`}>
                        {data.groups.find((group) => group.id === selectedNode.group)?.label}
                      </span>
                      <button type="button" className="panel-game-endpoints__inspector-close" onClick={() => setIsInspectorOpen(false)} aria-label="Fechar detalhes">
                        ×
                      </button>
                    </div>
                    <h3>{selectedNode.label}</h3>
                    <p className="panel-muted">{selectedNode.description}</p>
                  </div>

                  <div className="panel-game-endpoints__inspector-meta">
                    <span className="panel-link-chip">{selectedNode.tableName}</span>
                    <span className="panel-link-chip">{selectedNode.status === 'ready' ? 'pronta' : 'rascunho'}</span>
                    <span className="panel-link-chip">{selectedNode.fields.length} campos</span>
                  </div>

                  <div className="panel-game-endpoints__inspector-actions">
                    <Link className="panel-game-endpoints__node-link" href="/ecommpanel/admin/data?module=modeling">
                      Abrir modelagem
                    </Link>
                    <Link className="panel-game-endpoints__node-link" href="/ecommpanel/admin/data?module=records">
                      Abrir registros
                    </Link>
                    <Link className="panel-game-endpoints__node-link" href="/ecommpanel/admin/integrations?view=reference">
                      Ver referencia
                    </Link>
                  </div>

                  <div className="panel-game-endpoints__route-list">
                    {selectedNode.routes.map((route) => (
                      <article key={route.id} className="panel-game-endpoints__route-card">
                        <div className="panel-game-endpoints__route-line">
                          <span className={`panel-game-endpoints__method ${METHOD_TONES[route.method]}`}>{route.method}</span>
                          <code>{route.route}</code>
                          <button
                            type="button"
                            className="panel-game-endpoints__route-copy"
                            onClick={() => void copyCurl(route.id, route.method, route.route)}
                          >
                            {copiedRouteId === route.id ? 'Copiado' : 'Copiar curl'}
                          </button>
                          {route.method !== 'GET' ? (
                            <button
                              type="button"
                              className="panel-game-endpoints__route-copy"
                              onClick={() => void copyPayload(route.id, selectedNode.fields)}
                            >
                              {copiedPayloadId === route.id ? 'JSON copiado' : 'Copiar JSON'}
                            </button>
                          ) : null}
                        </div>
                        <small>{route.scope}</small>
                      </article>
                    ))}
                  </div>

                  <details className="panel-game-endpoints__schema" open>
                    <summary>Schema da entidade</summary>
                    <div className="panel-game-endpoints__schema-list">
                      {selectedNode.fields.map((field) => (
                        <article key={field.id} className="panel-game-endpoints__schema-row">
                          <div>
                            <strong>{field.label}</strong>
                            <small>
                              {field.name} · {field.type}
                            </small>
                          </div>
                          <div className="panel-game-endpoints__schema-meta">
                            <span className="panel-link-chip">{field.required ? 'obrigatorio' : 'opcional'}</span>
                            {field.referenceTargetSlug ? <span className="panel-link-chip">ref {field.referenceTargetSlug}</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                </>
              ) : (
                <div className="panel-data-empty-state">
                  <strong>Nenhuma entidade selecionada</strong>
                  <small>Escolha um bloco no mapa para ver rotas, scopes e campos.</small>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
}
