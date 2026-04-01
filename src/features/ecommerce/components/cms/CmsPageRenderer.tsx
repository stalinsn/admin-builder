import type { CSSProperties } from 'react';
import type { RuntimeResolvedPage } from '@/features/site-runtime/contracts';
import type { SiteBlock } from '@/features/ecommpanel/types/siteBuilder';
import { sanitizeUrl } from '@/utils/inputSecurity';

type CmsPageRendererProps = {
  page: RuntimeResolvedPage;
};

function blockStyle(block: SiteBlock): CSSProperties {
  return {
    backgroundColor: block.style?.backgroundColor || '#ffffff',
    color: block.style?.textColor || '#0f172a',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '1rem',
  };
}

function renderBlock(block: SiteBlock) {
  if (!block.enabled) return null;

  if (block.type === 'hero') {
    return (
      <section key={block.id} style={blockStyle(block)}>
        <h2>{block.data.title}</h2>
        <p>{block.data.subtitle}</p>
      </section>
    );
  }

  if (block.type === 'rich_text') {
    return (
      <section key={block.id} style={blockStyle(block)}>
        <p>{block.data.content}</p>
      </section>
    );
  }

  if (block.type === 'cta') {
    const safeHref = sanitizeUrl(block.data.href, { fallback: '#', allowRelative: true, allowAnchor: true });
    return (
      <section key={block.id} style={blockStyle(block)}>
        <a href={safeHref}>{block.data.label}</a>
      </section>
    );
  }

  if (block.type === 'banner') {
    return (
      <section key={block.id} style={blockStyle(block)}>
        <h3>{block.data.title}</h3>
        <p>{block.data.imageUrl}</p>
      </section>
    );
  }

  if (block.type === 'product_card') {
    return (
      <section key={block.id} style={blockStyle(block)}>
        <strong>{block.data.title}</strong>
        <p>SKU: {block.data.skuRef}</p>
        <p>R$ {Number(block.data.price || 0).toFixed(2)}</p>
      </section>
    );
  }

  return (
    <section key={block.id} style={blockStyle(block)}>
      <strong>{block.data.title}</strong>
      <p>Coleção: {block.data.collection}</p>
    </section>
  );
}

export default function CmsPageRenderer({ page }: CmsPageRendererProps) {
  const pageStyle: CSSProperties = {
    backgroundColor: page.theme?.backgroundColor || '#ffffff',
    color: page.theme?.textColor || '#0f172a',
    minHeight: '100dvh',
    padding: '2rem 1rem',
  };

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: '1rem' }}>
        {page.slots.map((slot) => (
          <section key={slot.id} style={{ display: 'grid', gap: '0.75rem' }}>
            {slot.blocks.map((block) => renderBlock(block))}
          </section>
        ))}
      </div>
    </main>
  );
}
