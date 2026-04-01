"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isOn } from '../../config/featureFlags';
import type { ShelfConfig, ShelfVariant } from '../../config/shelfConfig';
import Image from 'next/image';

type Props = {
  children: React.ReactNode;
  title: string;
  config?: ShelfConfig;
};

export default function Carousel({ children, title, config }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState<number>(240);
  const [visible, setVisible] = useState<number>(5);
  const GAP = 12;
  const PEEK = 0.5;

  const childCount = useMemo(() => React.Children.count(children), [children]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const calc = () => {
      const containerWidth = el.clientWidth;
      let visibleCards = containerWidth >= 1280 ? 5 : containerWidth >= 1024 ? 4 : containerWidth >= 768 ? 3 : 2;
      const hasBanner = Boolean(config?.banner);
      if (containerWidth >= 1024 && hasBanner) visibleCards = 4;
      if (containerWidth >= 1280 && !hasBanner) visibleCards = 5;
      setVisible(visibleCards);
  const hasPeek = childCount > visibleCards;
  const gaps = hasPeek ? visibleCards * GAP : (visibleCards - 1) * GAP;
  const denom = hasPeek ? visibleCards + PEEK : visibleCards;
  const computedCardWidth = (containerWidth - gaps) / denom;
  const minCardWidth = containerWidth >= 1024 ? 220 : containerWidth >= 768 ? 200 : 180;
  setCardWidth(Math.max(minCardWidth, Math.floor(computedCardWidth)));
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [childCount, config]);

  if (!isOn('ecom.carousel')) return null;
  const scroll = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
  const step = (cardWidth + GAP) * visible;
    const max = el.scrollWidth - el.clientWidth;
    const target = Math.max(0, Math.min(el.scrollLeft + direction * step, max));
    el.scrollTo({ left: target, behavior: 'smooth' });
  };
  const variant: ShelfVariant = config?.variant ?? 'default';
  const hasBanner = Boolean(config?.banner?.image);
  const bannerPos = config?.banner?.position ?? 'left';
  const shouldShowArrows = childCount > visible;

  return (
    <section className={`ecom-section shelf shelf--${variant}`} aria-label={title}>
      <div className="shelf__header" style={{ justifyContent: config?.titleAlign === 'center' ? 'center' : 'space-between' }}>
        <div style={{ display: 'grid' }}>
          <span className="shelf__title">{title}</span>
          {config?.subtitle && <span className="text-light" style={{ fontSize: 12 }}>{config.subtitle}</span>}
        </div>
        <div className="shelf__actions">
          {config?.seeMoreHref && (
            <a className="shelf__see-more" href={config.seeMoreHref}>Ver mais</a>
          )}
          {shouldShowArrows && (
            <>
              <button aria-label="Anterior" className="carousel-arrow" onClick={() => scroll(-1)}>‹</button>
              <button aria-label="Próximo" className="carousel-arrow" onClick={() => scroll(1)}>›</button>
            </>
          )}
        </div>
      </div>
      <div className={`shelf__body ${hasBanner ? 'has-banner' : ''} banner-${bannerPos}`}>
        {hasBanner && (
          <a className="shelf__banner" href={config?.banner?.href ?? '#'} aria-label={config?.banner?.alt ?? 'Banner'}>
            <Image 
              src={config!.banner!.image} 
              alt={config!.banner!.alt ?? ''} 
              width={400} 
              height={300} 
              sizes="(max-width: 768px) 92vw, (max-width: 1200px) 420px, 480px"
              loading="lazy"
              style={{ width: '100%', height: 'auto', objectFit: 'cover' }} 
            />
          </a>
        )}
        <div
          ref={ref}
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: `${cardWidth}px`,
            gap: GAP,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            paddingBottom: 8,
            paddingLeft: 2,
            paddingRight: 2,
            justifyContent: 'start',
          }}
          className="ecom-carousel"
        >
          {React.Children.map(children, (child) => (
            <div data-snap style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>{child}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
