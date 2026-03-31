'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  PANEL_MEDIA_PRESET_KEYS,
  type PanelMediaFit,
  type PanelMediaFormat,
  type PanelMediaPresetKey,
  type PanelMediaSettings,
  type PanelMediaSettingsDiagnostics,
} from '@/features/ecommpanel/types/panelMediaSettings';

type MeResponse = {
  csrfToken?: string;
};

type SettingsResponse = {
  settings?: PanelMediaSettings;
  diagnostics?: PanelMediaSettingsDiagnostics;
  error?: string;
};

type SaveState = 'idle' | 'saving' | 'saved';

type PanelMediaSettingsManagerProps = {
  initialSettings: PanelMediaSettings;
  initialDiagnostics: PanelMediaSettingsDiagnostics;
  canManage: boolean;
};

const PRESET_LABELS: Record<PanelMediaPresetKey, { title: string; description: string }> = {
  productPdp: {
    title: 'Produto PDP',
    description: 'Imagem principal da página de produto. Serve como teto de peso e resolução entregue ao site.',
  },
  productThumb: {
    title: 'Produto thumb',
    description: 'Miniaturas de listagem, carrinho, busca e áreas compactas.',
  },
  productZoom: {
    title: 'Produto zoom',
    description: 'Versão maior para galeria, modal, hover ou zoom.',
  },
  contentCard: {
    title: 'Card de conteúdo',
    description: 'Cards de hub, blog, vitrines editoriais e banners menores.',
  },
  contentHero: {
    title: 'Hero / landing',
    description: 'Peças grandes de home, blog, campanhas e landing pages.',
  },
};

function mimeTypeEnabled(settings: PanelMediaSettings, mimeType: string): boolean {
  return settings.upload.allowedMimeTypes.includes(mimeType);
}

export default function PanelMediaSettingsManager({
  initialSettings,
  initialDiagnostics,
  canManage,
}: PanelMediaSettingsManagerProps) {
  const [csrfToken, setCsrfToken] = useState('');
  const [settings, setSettings] = useState<PanelMediaSettings>(initialSettings);
  const [diagnostics, setDiagnostics] = useState<PanelMediaSettingsDiagnostics>(initialDiagnostics);
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

  const enabledPresetsCount = useMemo(
    () => PANEL_MEDIA_PRESET_KEYS.filter((key) => settings.presets[key].enabled).length,
    [settings],
  );

  function updatePreset<K extends keyof PanelMediaSettings['presets'][PanelMediaPresetKey]>(
    presetKey: PanelMediaPresetKey,
    field: K,
    value: PanelMediaSettings['presets'][PanelMediaPresetKey][K],
  ) {
    setSettings((prev) => ({
      ...prev,
      presets: {
        ...prev.presets,
        [presetKey]: {
          ...prev.presets[presetKey],
          [field]: value,
        },
      },
    }));
  }

  function toggleMimeType(mimeType: string, checked: boolean) {
    setSettings((prev) => {
      const nextMimeTypes = checked
        ? Array.from(new Set([...prev.upload.allowedMimeTypes, mimeType]))
        : prev.upload.allowedMimeTypes.filter((item) => item !== mimeType);

      return {
        ...prev,
        upload: {
          ...prev.upload,
          allowedMimeTypes: nextMimeTypes,
        },
      };
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !csrfToken || saveState === 'saving') return;

    setSaveState('saving');
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ecommpanel/settings/media', {
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
      setSuccess('Configuração de mídia salva. Novos uploads passam a seguir estes presets.');
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch (saveError) {
      setSaveState('idle');
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar a configuração.');
    }
  }

  return (
    <section className="panel-grid" aria-labelledby="panel-media-settings-title">
      <article className="panel-card panel-card-hero panel-dashboard-hero">
        <div className="panel-dashboard-hero__header">
          <div>
            <p className="panel-kicker">Configurações do painel</p>
            <h1 id="panel-media-settings-title">Mídia e processamento de imagens</h1>
            <p className="panel-muted">
              Centralize upload, compressão e tamanhos máximos por contexto. O CSS continua controlando layout, mas o payload já sai otimizado do servidor.
            </p>
          </div>
          <div className="panel-dashboard-hero__badges">
            <span className={`panel-badge ${diagnostics.uploadEnabled ? 'panel-badge-success' : 'panel-badge-neutral'}`}>
              upload {diagnostics.uploadEnabled ? 'ativo' : 'limitado'}
            </span>
            <span className="panel-badge panel-badge-neutral">{enabledPresetsCount} presets</span>
          </div>
        </div>

        <div className="panel-dashboard-hero__meta">
          <div>
            <span className="panel-muted">Limite por arquivo</span>
            <strong>{diagnostics.maxFileSizeMb} MB</strong>
            <span>Arquivos acima deste teto são recusados antes do processamento.</span>
          </div>
          <div>
            <span className="panel-muted">Formatos aceitos</span>
            <strong>{diagnostics.allowedMimeTypes.join(', ')}</strong>
            <span>Use JPG, PNG ou WebP de entrada conforme a operação precisar.</span>
          </div>
          <div>
            <span className="panel-muted">Destino público</span>
            <strong>{diagnostics.publicBasePath}</strong>
            <span>Prefixo usado para servir os arquivos otimizados ao site e ao painel.</span>
          </div>
        </div>
      </article>

      <article className="panel-card">
        <form className="panel-form" onSubmit={handleSave}>
          <div className="panel-form-section">
            <h3>Política de upload</h3>
            <div className="panel-form-grid panel-form-grid--three">
              <div className="panel-field">
                <label htmlFor="panel-media-max-file-size">Tamanho máximo por arquivo (MB)</label>
                <input
                  id="panel-media-max-file-size"
                  className="panel-input"
                  type="number"
                  min={1}
                  max={128}
                  value={settings.upload.maxFileSizeMb}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      upload: {
                        ...prev.upload,
                        maxFileSizeMb: Number(event.target.value || 1),
                      },
                    }))
                  }
                  disabled={!canManage}
                />
              </div>

              <div className="panel-field panel-field--span-2">
                <label htmlFor="panel-media-public-base-path">Pasta pública base</label>
                <input
                  id="panel-media-public-base-path"
                  className="panel-input"
                  value={settings.storage.publicBasePath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      storage: {
                        ...prev.storage,
                        publicBasePath: event.target.value,
                      },
                    }))
                  }
                  disabled={!canManage}
                />
                <small className="panel-field-help">Exemplo: <code>/ecommpanel-media</code>. No futuro, este módulo pode apontar para storage externo mantendo a mesma interface.</small>
              </div>
            </div>

            <div className="panel-media-mime-grid">
              {[
                { value: 'image/jpeg', label: 'JPG / JPEG' },
                { value: 'image/png', label: 'PNG' },
                { value: 'image/webp', label: 'WebP' },
              ].map((mimeType) => (
                <label key={mimeType.value} className="panel-checkbox panel-media-toggle">
                  <input
                    type="checkbox"
                    checked={mimeTypeEnabled(settings, mimeType.value)}
                    onChange={(event) => toggleMimeType(mimeType.value, event.target.checked)}
                    disabled={!canManage}
                  />
                  <span>{mimeType.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="panel-form-section">
            <h3>Presets operacionais</h3>
            <p className="panel-muted">Cada preset define o teto de resolução e o formato gerado pelo servidor para um uso específico do site.</p>

            <div className="panel-media-presets">
              {PANEL_MEDIA_PRESET_KEYS.map((presetKey) => {
                const preset = settings.presets[presetKey];
                const label = PRESET_LABELS[presetKey];

                return (
                  <section key={presetKey} className="panel-media-preset">
                    <div className="panel-media-preset__header">
                      <div>
                        <strong>{label.title}</strong>
                        <p>{label.description}</p>
                      </div>
                      <label className="panel-checkbox">
                        <input
                          type="checkbox"
                          checked={preset.enabled}
                          onChange={(event) => updatePreset(presetKey, 'enabled', event.target.checked)}
                          disabled={!canManage}
                        />
                        <span>Gerar</span>
                      </label>
                    </div>

                    <div className="panel-form-grid panel-form-grid--three">
                      <div className="panel-field">
                        <label htmlFor={`media-preset-width-${presetKey}`}>Largura máxima</label>
                        <input
                          id={`media-preset-width-${presetKey}`}
                          className="panel-input"
                          type="number"
                          min={64}
                          max={4096}
                          value={preset.maxWidth}
                          onChange={(event) => updatePreset(presetKey, 'maxWidth', Number(event.target.value || 64))}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="panel-field">
                        <label htmlFor={`media-preset-height-${presetKey}`}>Altura máxima</label>
                        <input
                          id={`media-preset-height-${presetKey}`}
                          className="panel-input"
                          type="number"
                          min={64}
                          max={4096}
                          value={preset.maxHeight}
                          onChange={(event) => updatePreset(presetKey, 'maxHeight', Number(event.target.value || 64))}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="panel-field">
                        <label htmlFor={`media-preset-quality-${presetKey}`}>Qualidade</label>
                        <input
                          id={`media-preset-quality-${presetKey}`}
                          className="panel-input"
                          type="number"
                          min={40}
                          max={95}
                          value={preset.quality}
                          onChange={(event) => updatePreset(presetKey, 'quality', Number(event.target.value || 80))}
                          disabled={!canManage}
                        />
                      </div>
                    </div>

                    <div className="panel-form-grid panel-form-grid--three">
                      <div className="panel-field">
                        <label htmlFor={`media-preset-format-${presetKey}`}>Formato de saída</label>
                        <select
                          id={`media-preset-format-${presetKey}`}
                          className="panel-input"
                          value={preset.format}
                          onChange={(event) => updatePreset(presetKey, 'format', event.target.value as PanelMediaFormat)}
                          disabled={!canManage}
                        >
                          <option value="webp">WebP</option>
                          <option value="jpeg">JPEG</option>
                          <option value="png">PNG</option>
                        </select>
                      </div>
                      <div className="panel-field">
                        <label htmlFor={`media-preset-fit-${presetKey}`}>Modo de corte</label>
                        <select
                          id={`media-preset-fit-${presetKey}`}
                          className="panel-input"
                          value={preset.fit}
                          onChange={(event) => updatePreset(presetKey, 'fit', event.target.value as PanelMediaFit)}
                          disabled={!canManage}
                        >
                          <option value="inside">Conter sem cortar</option>
                          <option value="cover">Preencher e cortar</option>
                        </select>
                      </div>
                      <div className="panel-field">
                        <label htmlFor={`media-preset-bg-${presetKey}`}>Cor de fundo</label>
                        <input
                          id={`media-preset-bg-${presetKey}`}
                          className="panel-input"
                          value={preset.background}
                          onChange={(event) => updatePreset(presetKey, 'background', event.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {error ? <p className="panel-feedback panel-feedback-error">{error}</p> : null}
          {success ? <p className="panel-feedback panel-feedback-success">{success}</p> : null}

          <div className="panel-form-actions">
            <button className="panel-btn panel-btn-primary" type="submit" disabled={!canManage || saveState === 'saving'}>
              {saveState === 'saving' ? 'Salvando...' : 'Salvar configuração'}
            </button>
            <span className="panel-muted">
              Recomendação prática: mantenha o teto físico de upload aqui e use CSS apenas para o layout exibido na interface.
            </span>
          </div>
        </form>
      </article>
    </section>
  );
}
