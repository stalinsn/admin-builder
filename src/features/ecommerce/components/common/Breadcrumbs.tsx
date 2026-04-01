"use client";
import React from 'react';
import Link from 'next/link';

export type Crumb = {
  href?: string; // if missing or '#', rendered as plain text
  label: string;
  current?: boolean; // force current page styling
};

export function Breadcrumbs({
  items,
  includeHome = true,
  homeHref = '/e-commerce',
  homeLabel = 'Início',
  variant = 'plp',
}: {
  items: Crumb[];
  includeHome?: boolean;
  homeHref?: string;
  homeLabel?: string;
  variant?: 'plp' | 'pdp';
}) {
  // Build final list ensuring consistent Home label
  const normalized: Crumb[] = [];
  if (includeHome) normalized.push({ href: homeHref, label: homeLabel });
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    normalized.push(it);
  }

  const className = variant === 'pdp' ? 'pdp-breadcrumbs' : 'plp-breadcrumbs';

  return (
    <nav aria-label="breadcrumb" className={className}>
      <ol>
        {normalized.map((b, i) => {
          const isLast = i === normalized.length - 1;
          const isCurrent = b.current || isLast;
          const href = b.href && b.href !== '#'
            ? b.href
            : undefined;
          return (
            <li key={`${b.label}-${i}`} aria-current={isCurrent ? 'page' : undefined}>
              {isCurrent || !href ? (
                <span>{b.label}</span>
              ) : (
                <Link href={href}>{b.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
