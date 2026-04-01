"use client";
import React from 'react';
import Link from 'next/link';
import { isOn } from '../../config/featureFlags';
import type { StorefrontTemplate, StorefrontTemplateLink } from '@/features/site-runtime/storefrontTemplate';
import { DEFAULT_STOREFRONT_TEMPLATE } from '@/features/site-runtime/storefrontTemplate';
import { sanitizeUrl } from '@/utils/inputSecurity';

function renderFooterLink(link: StorefrontTemplateLink, ariaLabel?: string) {
  if (!link.enabled) return null;
  const safeHref = sanitizeUrl(link.href, { fallback: '#', allowRelative: true, allowAnchor: true });
  if (/^https?:\/\//.test(safeHref)) {
    return (
      <a key={link.id} href={safeHref} aria-label={ariaLabel || link.label}>
        {link.label}
      </a>
    );
  }

  return (
    <Link key={link.id} href={safeHref} aria-label={ariaLabel || link.label}>
      {link.label}
    </Link>
  );
}

export default function Footer({ template = DEFAULT_STOREFRONT_TEMPLATE }: { template?: StorefrontTemplate }) {
  const enabled = isOn('ecom.footer') && template.footer.modules.enabled;
  const [isMobile, setIsMobile] = React.useState(false);
  const showFooterColumns = template.footer.modules.columns;
  const showFooterApps = template.footer.modules.apps;
  const showFooterNewsletter = template.footer.modules.newsletter;
  const showFooterSocial = template.footer.modules.social;
  const sections = showFooterColumns ? template.footer.sections.filter((section) => section.enabled) : [];
  const showAppsNewsletterColumn = showFooterApps || showFooterNewsletter;
  const accordionSize = sections.length + (showAppsNewsletterColumn ? 1 : 0);
  const [open, setOpen] = React.useState<boolean[]>(Array.from({ length: accordionSize }, () => true));

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = (m: MediaQueryList | MediaQueryListEvent) => {
      const mql = 'matches' in m ? m.matches : (m as MediaQueryList).matches;
      setIsMobile(mql);
    };
    apply(mq);
    const handler = (e: MediaQueryListEvent) => apply(e);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  React.useEffect(() => {
    setOpen(Array.from({ length: accordionSize }, () => !isMobile));
  }, [accordionSize, isMobile]);

  const toggle = (i: number) => {
    if (!isMobile) return;
    setOpen((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  if (!enabled) return null;

  return (
    <footer className="ecom-footer">
      <div className="ecom-footer__grid">
        {sections.map((section, index) => (
          <div key={section.id} className="ecom-footer__col">
            <button className="ecom-footer__toggle" aria-expanded={open[index]} aria-controls={`footer-sec-${index}`} onClick={() => toggle(index)}>
              <span>{section.title}</span>
              <span className="ecom-footer__chevron" aria-hidden>▾</span>
            </button>
            <div id={`footer-sec-${index}`} className="ecom-footer__content" data-open={open[index] ? 'true' : 'false'}>
              <ul>
                {section.links.filter((link) => link.enabled).map((link) => (
                  <li key={link.id}>{renderFooterLink(link)}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
        {showAppsNewsletterColumn ? (
          <div className="ecom-footer__col">
            <button
              className="ecom-footer__toggle"
              aria-expanded={open[sections.length]}
              aria-controls={`footer-sec-${sections.length}`}
              onClick={() => toggle(sections.length)}
            >
              <span>Apps e Newsletter</span>
              <span className="ecom-footer__chevron" aria-hidden>▾</span>
            </button>
            <div
              id={`footer-sec-${sections.length}`}
              className="ecom-footer__content"
              data-open={open[sections.length] ? 'true' : 'false'}
            >
              {showFooterApps ? (
                <>
                  <h4>{template.footer.appTitle}</h4>
                  <div className="ecom-footer__apps">
                    {template.footer.appLinks.filter((link) => link.enabled).map((link) => renderFooterLink(link, link.label))}
                  </div>
                </>
              ) : null}

              {showFooterNewsletter ? (
                <>
                  <h4>{template.footer.newsletterTitle}</h4>
                  <form className="ecom-footer__newsletter" onSubmit={(e) => e.preventDefault()}>
                    <input type="email" placeholder={template.footer.newsletterPlaceholder} aria-label="E-mail" />
                    <button type="submit">{template.footer.newsletterButtonLabel}</button>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="ecom-footer__bar">
          <small>© {new Date().getFullYear()} {template.footer.copyrightText}</small>
          <div className="ecom-footer__social">
            {showFooterSocial ? template.footer.socialLinks.filter((link) => link.enabled).map((link) => renderFooterLink(link, link.id)) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
