"use client";

import React from 'react';

import type { LogisticsStorefrontSettings } from '../types/logistics';

const DEFAULT_SETTINGS: LogisticsStorefrontSettings = {
  operation: {
    assortmentMode: 'single_assortment',
    deliverySelectionMode: 'optional',
    fulfillmentModel: 'single_origin',
  },
};

let cachedSettings: LogisticsStorefrontSettings | null = null;
let inflightRequest: Promise<LogisticsStorefrontSettings> | null = null;

async function loadSettings(): Promise<LogisticsStorefrontSettings> {
  if (cachedSettings) return cachedSettings;
  if (!inflightRequest) {
    inflightRequest = fetch('/api/ecommerce/logistics/settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar a configuração logística.');
        const payload = (await response.json()) as LogisticsStorefrontSettings;
        cachedSettings = payload;
        return payload;
      })
      .catch(() => DEFAULT_SETTINGS)
      .finally(() => {
        inflightRequest = null;
      });
  }
  return inflightRequest;
}

export function useLogisticsStorefrontSettings() {
  const [settings, setSettings] = React.useState<LogisticsStorefrontSettings>(cachedSettings || DEFAULT_SETTINGS);

  React.useEffect(() => {
    let active = true;
    void loadSettings().then((payload) => {
      if (!active) return;
      setSettings(payload);
    });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
