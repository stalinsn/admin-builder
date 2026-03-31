import type { CSSProperties } from 'react';
import type { SiteBlock, SiteLayoutPreset, SitePageSlot, SitePageTheme } from '@/features/ecommpanel/types/siteBuilder';
import { sanitizeUrl } from '@/utils/inputSecurity';

type SitePagePreviewProps = {
  title: string;
  slug: string;
  description: string;
  layoutPreset: SiteLayoutPreset;
  slots: SitePageSlot[];
  theme?: SitePageTheme;
};

function renderBlock(block: SiteBlock) {
  const blockStyle: CSSProperties = {
    backgroundColor: block.style?.backgroundColor || undefined,
    color: block.style?.textColor || undefined,
  };

  if (block.type === 'hero') {
    return (
      <section key={block.id} className="panel-site-block panel-site-block--hero" style={blockStyle}>
        <h4>{block.data.title || 'Título do hero'}</h4>
        <p>{block.data.subtitle || 'Subtítulo do hero.'}</p>
      </section>
    );
  }

  if (block.type === 'rich_text') {
    return (
      <section key={block.id} className="panel-site-block panel-site-block--text" style={blockStyle}>
        <p>{block.data.content || 'Conteúdo de texto.'}</p>
      </section>
    );
  }

  if (block.type === 'cta') {
    const safeHref = sanitizeUrl(block.data.href, { fallback: '#', allowRelative: true, allowAnchor: true });
    return (
      <section key={block.id} className="panel-site-block panel-site-block--cta" style={blockStyle}>
        <a href={safeHref}>{block.data.label || 'Ação'}</a>
      </section>
    );
  }

  if (block.type === 'banner') {
    return (
      <section key={block.id} className="panel-site-block panel-site-block--banner" style={blockStyle}>
        <strong>{block.data.title || 'Banner'}</strong>
        <p>{block.data.imageUrl || 'Sem imagem'}</p>
      </section>
    );
  }

  if (block.type === 'product_card') {
    return (
      <section key={block.id} className="panel-site-block panel-site-block--product" style={blockStyle}>
        <strong>{block.data.title || 'Produto'}</strong>
        <p>SKU: {block.data.skuRef || '-'}</p>
        <p>R$ {Number(block.data.price || 0).toFixed(2)}</p>
      </section>
    );
  }

  return (
    <section key={block.id} className="panel-site-block panel-site-block--shelf" style={blockStyle}>
      <strong>{block.data.title || 'Vitrine'}</strong>
      <p>Coleção: {block.data.collection || '-'}</p>
    </section>
  );
}

export default function SitePagePreview({ title, slug, description, layoutPreset, slots, theme }: SitePagePreviewProps) {
  const enabledCount = slots.reduce((count, slot) => count + slot.blocks.filter((block) => block.enabled).length, 0);
  const rootStyle: CSSProperties = {
    backgroundColor: theme?.backgroundColor || undefined,
    color: theme?.textColor || undefined,
    borderColor: theme?.accentColor || undefined,
  };

  return (
    <section className="panel-site-preview" aria-label="Pré-visualização da página" style={rootStyle}>
      <header className="panel-site-preview__header">
        <p className="panel-kicker">Pré-visualização (rascunho)</p>
        <h3>{title || 'Página sem título'}</h3>
        <p className="panel-muted">
          /{slug || 'slug-da-pagina'} · {description || 'Sem descrição'}
        </p>
      </header>

      <div className={`panel-site-preview__canvas panel-site-preview__canvas--${layoutPreset}`}>
        {slots.map((slot) => (
          <div key={slot.id} className="panel-site-preview__slot">
            <p className="panel-site-preview__slot-label">{slot.label}</p>
            <div className="panel-site-preview__body">
              {slot.blocks.filter((block) => block.enabled).map((block) => renderBlock(block))}
              {slot.blocks.filter((block) => block.enabled).length === 0 ? (
                <p className="panel-muted">Área vazia</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {enabledCount === 0 ? <p className="panel-muted panel-site-preview__empty">Nenhum bloco habilitado para pré-visualização.</p> : null}
    </section>
  );
}
