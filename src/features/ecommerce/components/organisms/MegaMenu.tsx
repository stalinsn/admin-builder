"use client";
import React, { useState } from 'react';
import Link from 'next/link';

type MegaItem = { name: string; href?: string; isHighlighted?: boolean };
type MegaSection = { title?: string; items: MegaItem[] };
export type MegaCategory = {
  key: string;
  label: string;
  href?: string;
  sections: MegaSection[];
};

export function MegaMenu({ categories }: { categories: MegaCategory[] }) {
  const [activeKey, setActiveKey] = useState(categories[0]?.key ?? '');
  const active = categories.find((c) => c.key === activeKey) ?? categories[0];

  React.useEffect(() => {
    if (!categories.some((category) => category.key === activeKey)) {
      setActiveKey(categories[0]?.key ?? '');
    }
  }, [categories, activeKey]);

  // Auto-split a single long section into multiple balanced columns for nicer layout
  function computeColumns() {
    if (!active) return [] as MegaSection[];
    const secs = active.sections || [];
    if (secs.length !== 1) return secs;
    const only = secs[0];
    const items = only.items || [];
    const maxCols = 4; // desktop default columns
    const colCount = Math.min(maxCols, Math.max(1, Math.ceil(items.length / 6))); // 6 items per column target
    if (colCount <= 1) return secs;
    const size = Math.ceil(items.length / colCount);
    const chunks: MegaSection[] = [];
    for (let startIndex = 0; startIndex < items.length; startIndex += size) {
      chunks.push({ title: undefined, items: items.slice(startIndex, startIndex + size) });
    }
    return chunks;
  }
  const columns = computeColumns();
  return (
    <div className="mega-menu">
      <aside className="mega-menu__aside" role="tablist" aria-label="Categorias">
        {categories.map((cat) => (
          <Link
            key={cat.key}
            role="tab"
            aria-selected={cat.key === activeKey}
            className={`mega-menu__tab ${cat.key === activeKey ? 'is-active' : ''}`}
            href={cat.href || '#'}
            onMouseEnter={() => setActiveKey(cat.key)}
            onFocus={() => setActiveKey(cat.key)}
            onClick={() => setActiveKey(cat.key)}
          >
            {cat.label}
          </Link>
        ))}
      </aside>
      <div className="mega-menu__panel" role="tabpanel">
        <div className="mega-menu__panelTop">
          {active?.href ? (
            <h3 className="mega-menu__title">
              <Link className="mega-menu__title-link" href={active.href}>{active.label}</Link>
            </h3>
          ) : (
            <h3 className="mega-menu__title">{active?.label}</h3>
          )}
        </div>
        <div className="mega-menu__grid">
          {columns.map((section, index) => (
            <div key={index} className="mega-menu__section">
              {section.title ? (
                <div className="mega-menu__section-title">{section.title}</div>
              ) : null}
              <ul className="mega-menu__list">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Link className={`mega-menu__link ${item.isHighlighted ? 'is-highlight' : ''}`} href={item.href || '#'}>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
