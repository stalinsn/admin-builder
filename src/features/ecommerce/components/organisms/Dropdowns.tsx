"use client";
import React from 'react';
import { Dropdown } from '../atoms/Dropdown';
import type { MegaCategory } from './MegaMenu';
import { useState } from 'react';
import { catalogCategories, catalogProducts, productCollectionsById, productDepartmentsById } from '../../lib/catalog';
import { isVtexLive } from '../../lib/runtimeConfig';
import { MegaMenu } from './MegaMenu';
import Link from 'next/link';
import type { StorefrontDepartmentCategory, StorefrontTemplate } from '@/features/site-runtime/storefrontTemplate';

type Category = (typeof catalogCategories)[number];
const allCats = catalogCategories as Category[];

function mapToMega(cats: Category[]): MegaCategory[] {
  const productById = new Map(catalogProducts.map((product) => [product.id, product]));
  return cats
    .filter((c) => (c.productIds?.length || 0) > 0 || (c.children?.length || 0) > 0)
    .map((category) => {
      const products = (category.productIds || [])
        .map((id) => productById.get(id))
        .filter((product): product is NonNullable<typeof product> => Boolean(product));

      const deptCounts = new Map<string, number>();
      for (const product of products) {
        const departments = productDepartmentsById[product.id] || [];
        departments.forEach((department) => {
          if (!department) return;
          deptCounts.set(department, (deptCounts.get(department) || 0) + 1);
        });
      }

      const childNamesRaw =
        category.children?.length
          ? category.children.map((child) => child.name)
          : Array.from(deptCounts.keys());
      const childNames = Array.from(
        childNamesRaw
          .map((name) => name.trim())
          .filter(Boolean)
          .reduce((accumulator, name) => {
            const normalized = name
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLocaleLowerCase();
            if (!accumulator.has(normalized)) accumulator.set(normalized, name);
            return accumulator;
          }, new Map<string, string>())
          .values()
      );

      const subcategoryItems = childNames
        .map((name) => ({ name, count: deptCounts.get(name) || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 12)
        .map(({ name, count }) => ({
          name: count ? `${name} (${count})` : name,
          href: `/e-commerce/plp?categoria=${encodeURIComponent(category.slug)}&dept=${encodeURIComponent(name)}`,
        }));

      const collectionCounts = new Map<string, number>();
      for (const product of products) {
        const collections = productCollectionsById[product.id] || [];
        for (const collection of collections) {
          collectionCounts.set(collection, (collectionCounts.get(collection) || 0) + 1);
        }
      }

      const collectionItems = Array.from(collectionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([collection, count]) => ({
          name: `${collection} (${count})`,
          href: `/e-commerce/plp?categoria=${encodeURIComponent(category.slug)}&collection=${encodeURIComponent(collection)}`,
          isHighlighted: collection === 'Ofertas' || collection === 'Black Friday',
        }));

      const featuredItems = products.slice(0, 8).map((product) => ({
        name: product.name,
        href: product.url ? `/e-commerce${product.url}` : `/e-commerce/${product.id}/p`,
        isHighlighted: (product.listPrice || product.price) > product.price,
      }));

      const sections = [];
      if (subcategoryItems.length) sections.push({ items: subcategoryItems });
      if (collectionItems.length) sections.push({ items: collectionItems });
      if (featuredItems.length) sections.push({ items: featuredItems });

      if (!sections.length) {
        sections.push({
          title: 'Navegacao',
          items: [{ name: 'Ver todos os produtos', href: `/e-commerce/plp?categoria=${encodeURIComponent(category.slug)}` }],
        });
      }

      return {
        key: category.slug,
        label: category.name,
        href: `/e-commerce/plp?categoria=${encodeURIComponent(category.slug)}`,
        sections,
      } satisfies MegaCategory;
    });
}

function mapTemplateDepartmentsToMega(categories: StorefrontDepartmentCategory[]): MegaCategory[] {
  return categories
    .filter((category) => category.enabled)
    .map((category) => ({
      key: category.id,
      label: category.label,
      href: category.href,
      sections: category.sections.map((section) => ({
        title: section.title,
        items: section.links
          .filter((link) => link.enabled)
          .map((link) => ({
            name: link.label,
            href: link.href,
          })),
      })),
    }))
    .filter((category) => category.sections.some((section) => section.items.length > 0));
}

export function DepartmentsDropdown({ trigger, template }: { trigger?: React.ReactNode; template?: StorefrontTemplate }) {
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const fallbackCategories = React.useMemo(() => mapToMega(allCats), []);
  const templateCategories = React.useMemo(
    () => mapTemplateDepartmentsToMega(template?.header.departmentsMenu || []),
    [template]
  );
  const hasTemplateCategories = templateCategories.length > 0;
  const [cats, setCats] = useState<MegaCategory[]>(hasTemplateCategories ? templateCategories : fallbackCategories);

  React.useEffect(() => {
    if (hasTemplateCategories) {
      setCats(templateCategories);
      return;
    }

    setCats(fallbackCategories);
    let cancelled = false;
    async function load() {
      if (!isVtexLive()) return;
      try {
        const res = await fetch('/api/vtex/categories', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        // Map VTEX category tree to our simplified Category shape
        type VNode = { id: number; name: string; url: string; children?: VNode[] };
        const top: Category[] = (data as VNode[]).map((n) => ({
          id: String(n.id),
          slug: (n.url || n.name).split('/').filter(Boolean).slice(-1)[0].toLowerCase(),
          name: n.name,
          parentId: null,
          productIds: [],
          children: (n.children || []).map((ch) => ({ id: String(ch.id), slug: (ch.url || ch.name).split('/').filter(Boolean).slice(-1)[0].toLowerCase(), name: ch.name })),
        }));
        if (!cancelled) setCats(mapToMega(top));
      } catch { /* ignore */ }
    }
    void load();
    return () => { cancelled = true; };
  }, [fallbackCategories, hasTemplateCategories, templateCategories]);

  const toggle = (key: string) => setOpenKeys((s) => ({ ...s, [key]: !s[key] }));
  const categories = cats;
  return (
    <Dropdown
      trigger={
        trigger ?? (
          <button className="ecom-nav__btn ecom-nav__btn--departments">☰ {template?.header.departmentsButtonLabel || 'Departamentos'}</button>
        )
      }
      className="dropdown--departments dropdown--departments-full"
    >
      {/* Desktop: mega menu */}
      <div className="hide-on-mobile">
        <MegaMenu categories={categories} />
      </div>
      {/* Mobile: full-height accordion */}
      <div className="show-on-mobile">
        <div className="departments-accordion" role="menu" aria-label="Departamentos">
          {categories.map((cat) => {
            const isOpen = !!openKeys[cat.key];
            return (
              <div key={cat.key} className={`dept-item ${isOpen ? 'is-open' : ''}`}>
                <div className="dept-item__header">
                  <Link href={cat.href || '#'} className="dept-item__categoryLink">{cat.label}</Link>
                  <button className="dept-item__toggle" onClick={() => toggle(cat.key)} aria-expanded={isOpen} aria-label={`Expandir ${cat.label}`}>
                    <span className="dept-item__chev" aria-hidden>›</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="dept-item__panel">
                    {cat.sections.map((sec, i) => (
                      <ul key={i} className="dept-item__list">
                        {sec.items.map((it, j) => (
                          <li key={j}><Link className="dept-item__link" href={it.href || '#'}>{it.name}</Link></li>
                        ))}
                      </ul>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dropdown>
  );
}
