"use client";
import React from 'react';
import Link from 'next/link';
import { isOn } from '../../config/featureFlags';
import type { StorefrontTemplateLink } from '@/features/site-runtime/storefrontTemplate';
import { DEFAULT_STOREFRONT_TEMPLATE } from '@/features/site-runtime/storefrontTemplate';

export function HeroBannerLarge({ text }: { text?: string }) {
  return (
    <section className="ecom-banner">
      <div className="ecom-banner__hero">{text || DEFAULT_STOREFRONT_TEMPLATE.home.largeBannerText}</div>
    </section>
  );
}

export function StripsBelow({ strips = DEFAULT_STOREFRONT_TEMPLATE.home.strips }: { strips?: StorefrontTemplateLink[] }) {
  const show1 = isOn('ecom.home.banner.strip.1');
  const show2 = isOn('ecom.home.banner.strip.2');
  const show3 = isOn('ecom.home.banner.strip.3');
  const visibleStrips = strips.filter((strip, index) => {
    if (!strip.enabled) return false;
    if (index === 0) return show1;
    if (index === 1) return show2;
    if (index === 2) return show3;
    return true;
  });

  if (visibleStrips.length === 0) return null;

  return (
    <section className="ecom-strips">
      {visibleStrips.map((strip) => (
        <Link key={strip.id} href={strip.href} className="ecom-strip">
          {strip.label}
        </Link>
      ))}
    </section>
  );
}
