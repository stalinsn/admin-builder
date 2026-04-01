'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import type { AnalyticsConfig } from '@/features/analytics/types';
import {
  flushAnalyticsQueue,
  getAnalyticsHeartbeatIntervalMs,
  initStorefrontAnalytics,
  isInternalAnalyticsEnabled,
  trackStorefrontEvent,
} from '@/features/analytics/client/runtime';

type StorefrontAnalyticsClientProps = {
  config: AnalyticsConfig;
};

function extractElementLabel(element: HTMLElement): string {
  const datasetLabel = element.dataset.trackLabel?.trim();
  if (datasetLabel) return datasetLabel.slice(0, 160);

  const ariaLabel = element.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 160);

  const text = element.textContent?.replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 160);

  const name = element.getAttribute('name')?.trim();
  if (name) return name.slice(0, 160);

  return element.tagName.toLowerCase();
}

function extractInteractiveElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest('button,a,[role="button"],[data-track-id],input[type="submit"],input[type="button"]');
}

export default function StorefrontAnalyticsClient({ config }: StorefrontAnalyticsClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();

  useEffect(() => {
    initStorefrontAnalytics(config);
  }, [config]);

  useEffect(() => {
    if (!isInternalAnalyticsEnabled()) return undefined;

    const onClick = (event: MouseEvent) => {
      const element = extractInteractiveElement(event.target);
      if (!element) return;

      const href = element instanceof HTMLAnchorElement ? element.href : undefined;
      trackStorefrontEvent({
        type: 'interaction_click',
        pathname: window.location.pathname,
        search: window.location.search,
        trackId: element.dataset.trackId || undefined,
        label: extractElementLabel(element),
        element: element.tagName.toLowerCase(),
        targetHref: href,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushAnalyticsQueue('hidden');
      }
    };

    const onPageHide = () => {
      void flushAnalyticsQueue('pagehide');
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    if (!isInternalAnalyticsEnabled()) return;

    trackStorefrontEvent({
      type: 'page_view',
      pathname,
      search: searchString ? `?${searchString}` : '',
      title: typeof document !== 'undefined' ? document.title : '',
    });
  }, [pathname, searchString]);

  useEffect(() => {
    if (!isInternalAnalyticsEnabled()) return undefined;

    const heartbeatMs = Math.max(getAnalyticsHeartbeatIntervalMs(), 10_000);
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      trackStorefrontEvent({
        type: 'heartbeat',
        pathname: window.location.pathname,
        search: window.location.search,
      });
    }, heartbeatMs);

    return () => window.clearInterval(interval);
  }, []);

  return null;
}
