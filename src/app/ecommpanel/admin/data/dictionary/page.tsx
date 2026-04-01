import { redirect } from 'next/navigation';

import { getPanelUserFromCookies } from '@/features/ecommpanel/server/auth';
import { getInternalDataDictionary } from '@/features/ecommpanel/server/dataDictionary';

function hasDataPermission(permissions: string[], permission: string): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes(permission);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function describeColumnRules(input: {
  primaryKey?: boolean;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
}): string[] {
  return [
    input.primaryKey ? 'chave primária' : null,
    input.required ? 'obrigatório' : null,
    input.unique ? 'único' : null,
    input.indexed ? 'indexado' : null,
  ].filter((value): value is string => Boolean(value));
}

export default async function DataDictionaryAdminPage() {
  const user = await getPanelUserFromCookies();

  if (!user) {
    redirect('/ecommpanel/login');
  }

  if (!hasDataPermission(user.permissions, 'data.read')) {
    return (
      <section className="panel-grid">
        <article className="panel-card">
          <h1>Acesso restrito</h1>
          <p className="panel-muted">Seu perfil atual não possui a permissão `data.read`.</p>
        </article>
      </section>
    );
  }

  const dictionary = getInternalDataDictionary();

  return (
    <section className="panel-grid panel-data-dictionary" aria-labelledby="data-dictionary-title">
      <article className="panel-card panel-card-hero panel-card-hero--compact">
        <p className="panel-kicker">Configurações do painel</p>
        <h1 id="data-dictionary-title">Dicionário interno do banco</h1>
        <p className="panel-muted">
          Esta área resume a estrutura atual do banco administrativo. Ela fica só no painel para apoiar operação,
          manutenção e evolução da modelagem sem expor o desenho sensível no minisite público.
        </p>
      </article>

      <div className="panel-stats">
        <article className="panel-stat">
          <span className="panel-muted">Tabelas operacionais</span>
          <strong>{dictionary.systemTables.length}</strong>
          <span>Estrutura mantida pelo sistema</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Entidades do Data Studio</span>
          <strong>{dictionary.modeledEntities.length}</strong>
          <span>Modelos gerados pelo painel</span>
        </article>
        <article className="panel-stat">
          <span className="panel-muted">Atualizado em</span>
          <strong>{formatDateTime(dictionary.generatedAt)}</strong>
          <span>Baseado no código e no snapshot atual</span>
        </article>
      </div>

      <article className="panel-card">
        <h2>Fonte de verdade por domínio</h2>
        <div className="panel-data-dictionary-modes">
          <span className="panel-chip">Usuários/admin: {dictionary.persistence.panelUsers}</span>
          <span className="panel-chip">Configurações do painel: {dictionary.persistence.panelSettings}</span>
          <span className="panel-chip">Eventos analíticos: {dictionary.persistence.analyticsEvents}</span>
          <span className="panel-chip">Snapshot do Data Studio: {dictionary.persistence.dataStudio}</span>
          <span className="panel-chip">Workspace de contas: {dictionary.persistence.accountWorkspace}</span>
          <span className="panel-chip">Integrações autenticadas: {dictionary.persistence.integrationApi}</span>
        </div>
        <p className="panel-muted">
          O Artmeta Panel separa o que vive no PostgreSQL, o que ainda está em snapshot local e como a camada de contas
          está operando no momento.
        </p>
        <p className="panel-muted">
          Leitura das linhas do dicionário: <strong>campo</strong> = nome físico na base, <strong>tipo</strong> = tipo do
          dado armazenado e <strong>regras</strong> = chave primária, obrigatoriedade, unicidade ou índice.
        </p>
      </article>

      <article className="panel-card">
        <h2>Entidades modeladas no Data Studio</h2>
        <div className="panel-data-dictionary-grid">
          {dictionary.modeledEntities.map((entity, index) => (
            <details key={entity.id} className="panel-data-dictionary-card panel-data-dictionary-card--accordion" open={index === 0}>
              <summary className="panel-data-dictionary-summary">
                <div className="panel-data-dictionary-summary__main">
                  <div className="panel-inline-between panel-inline-wrap">
                    <h3>{entity.label}</h3>
                    <span className={`panel-badge ${entity.status === 'ready' ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
                      {entity.status === 'ready' ? 'pronta' : 'rascunho'}
                    </span>
                  </div>
                  <p className="panel-muted">{entity.description || 'Sem descrição operacional.'}</p>
                  <div className="panel-data-dictionary-meta">
                    <span className="panel-chip">slug {entity.slug}</span>
                    <span className="panel-chip">tabela {entity.tableName}</span>
                    <span className="panel-chip">{entity.fields.length} campos</span>
                  </div>
                </div>
                <span className="panel-accordion-chevron" aria-hidden="true" />
              </summary>

              <div className="panel-data-dictionary-columns panel-data-dictionary-columns--rows">
                {entity.fields.map((field) => (
                  <div key={field.id} className="panel-data-dictionary-column panel-data-dictionary-column--row">
                    <div className="panel-data-dictionary-column__identity">
                      <strong>{field.name}</strong>
                      <span className="panel-chip">{field.type}</span>
                    </div>
                    <div className="panel-data-dictionary-column__content">
                      <p>{field.label}</p>
                      <small>{field.description || 'Sem descrição detalhada para este campo.'}</small>
                    </div>
                    <div className="panel-data-dictionary-column__rules">
                      {describeColumnRules(field).length ? (
                        describeColumnRules(field).map((rule) => (
                          <span key={`${field.id}-${rule}`} className="panel-chip">
                            {rule}
                          </span>
                        ))
                      ) : (
                        <span className="panel-chip">opcional</span>
                      )}
                      {field.listVisible ? <span className="panel-chip">visível em lista</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </article>

      <article className="panel-card">
        <h2>Tabelas operacionais do sistema</h2>
        <div className="panel-data-dictionary-grid">
          {dictionary.systemTables.map((table, index) => (
            <details key={table.id} className="panel-data-dictionary-card panel-data-dictionary-card--accordion" open={index < 2}>
              <summary className="panel-data-dictionary-summary">
                <div className="panel-data-dictionary-summary__main">
                  <div className="panel-inline-between panel-inline-wrap">
                    <p className="panel-kicker">{table.domain}</p>
                    <span className="panel-chip">{table.tableName}</span>
                  </div>
                  <h3>{table.label}</h3>
                  <p className="panel-muted">{table.description}</p>
                  <div className="panel-data-dictionary-meta">
                    <span className="panel-chip">{table.columns.length} campos</span>
                  </div>
                </div>
                <span className="panel-accordion-chevron" aria-hidden="true" />
              </summary>

              <div className="panel-data-dictionary-columns panel-data-dictionary-columns--rows">
                {table.columns.map((column) => (
                  <div key={`${table.id}-${column.name}`} className="panel-data-dictionary-column panel-data-dictionary-column--row">
                    <div className="panel-data-dictionary-column__identity">
                      <strong>{column.name}</strong>
                      <span className="panel-chip">{column.type}</span>
                    </div>
                    <div className="panel-data-dictionary-column__content">
                      <p>{column.description}</p>
                    </div>
                    <div className="panel-data-dictionary-column__rules">
                      {describeColumnRules(column).length ? (
                        describeColumnRules(column).map((rule) => (
                          <span key={`${table.id}-${column.name}-${rule}`} className="panel-chip">
                            {rule}
                          </span>
                        ))
                      ) : (
                        <span className="panel-chip">sem regra extra</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {table.notes?.length ? (
                <div className="panel-data-dictionary-notes">
                  {table.notes.map((note, noteIndex) => (
                    <p key={`${table.id}-note-${noteIndex}`} className="panel-muted">
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}
            </details>
          ))}
        </div>
      </article>
    </section>
  );
}
