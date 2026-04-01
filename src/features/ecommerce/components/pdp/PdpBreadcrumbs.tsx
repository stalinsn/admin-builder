"use client";
import React from 'react';
import { Breadcrumbs, Crumb } from '../common/Breadcrumbs';
import { catalogCategories } from '../../lib/catalog';

type Cat = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  children?: { id: string; slug: string; name: string }[];
};

export function PdpBreadcrumbs({
  name,
  categoryPath,
}: {
  name: string;
  categoryPath?: { id: string; name: string }[];
}) {
  const all = catalogCategories as unknown as Cat[];
  const topById = new Map(all.map((c) => [c.id, c]));
  const childById = new Map(
    all.flatMap((parent) => (parent.children || []).map((ch) => [ch.id, { child: ch, parent }]))
  );

  const mappedRaw = (categoryPath || []).map((node) => {
    const top = topById.get(node.id);
    if (top) {
      return { href: `/e-commerce/plp?categoria=${encodeURIComponent(top.slug)}`, label: top.name };
    }
    const child = childById.get(node.id);
    if (child) {
      return {
        href: `/e-commerce/plp?categoria=${encodeURIComponent(child.parent.slug)}&dept=${encodeURIComponent(child.child.name)}`,
        label: child.child.name,
      };
    }
    return { href: '', label: node.name, nolink: true as const };
  });

  const mapped: typeof mappedRaw = [];
  for (const crumb of mappedRaw) {
    const prev = mapped[mapped.length - 1];
    if (!prev || prev.label.toLowerCase() !== crumb.label.toLowerCase()) {
      mapped.push(crumb);
    }
  }

  const crumbs: Crumb[] = [
    ...mapped,
    { href: '#', label: name, current: true },
  ];
  return <Breadcrumbs items={crumbs} includeHome homeLabel="Início" variant="pdp" />;
}
