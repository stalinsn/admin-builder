"use client";
import React from 'react';
import { isOn } from '../../config/featureFlags';
import { DEFAULT_STOREFRONT_TEMPLATE } from '@/features/site-runtime/storefrontTemplate';

export default function HeroBanner({ message }: { message?: string }) {
  if (!isOn('ecom.heroBanner')) return null;
  return (
    <section className="ecom-hero">
      <div className="banner">{message || DEFAULT_STOREFRONT_TEMPLATE.home.heroMessage}</div>
    </section>
  );
}
