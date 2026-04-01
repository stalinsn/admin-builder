"use client";
import React from 'react';
import { isOn } from '../../config/featureFlags';
import type { StorefrontServiceItem } from '@/features/site-runtime/storefrontTemplate';
import { DEFAULT_STOREFRONT_TEMPLATE } from '@/features/site-runtime/storefrontTemplate';

export default function ServicesBar({ items = DEFAULT_STOREFRONT_TEMPLATE.home.services }: { items?: StorefrontServiceItem[] }) {
  if (!isOn('ecom.servicesBar')) return null;
  return (
    <section className="ecom-services" aria-label="Serviços exclusivos">
      <div className="ecom-services__grid">
        {items.filter((item) => item.enabled).map((item) => (
          <div key={item.id} className="ecom-service">
            <span className="ecom-service__icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
