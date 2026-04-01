"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { DiscountBadge } from '../molecules/DiscountBadge';

export function PdpGallery({ image, name, price, listPrice }: { image?: string; name: string; price: number; listPrice?: number }) {
  const fallback = '/file.svg';
  const thumbs = [image || fallback, image || fallback, image || fallback, image || fallback];
  const [active, setActive] = useState<number>(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const imageWrapperRef = useRef<HTMLDivElement | null>(null);

  const [isZooming, setIsZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchDelta = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const prev = useCallback(() => setActive((s) => (s - 1 + thumbs.length) % thumbs.length), [thumbs.length]);
  const next = useCallback(() => setActive((s) => (s + 1) % thumbs.length), [thumbs.length]);

  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [prev, next]);


  return (
    <div className="pdp__gallery" data-active={active} ref={galleryRef} tabIndex={0} aria-roledescription="Galeria de imagens" data-active-index={active}>
  <div className="pdp__thumbs-vert" role="tablist" aria-label="Miniaturas do produto">
        {thumbs.map((t, i) => (
          <button
            key={i}
            type="button"
            className={`thumb ${i === active ? 'is-active' : ''}`}
            onClick={() => setActive(i)}
            aria-label={`Ver imagem ${i + 1}`}
            aria-selected={i === active}
            role="tab"
          >
            <Image src={t} alt={`${name} - ${i + 1}`} width={80} height={80} sizes="80px" loading="lazy" />
          </button>
        ))}
      </div>

      <div
        className="pdp__image"
        ref={imageWrapperRef}
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={(e) => {
          if (!imageWrapperRef.current) return;
          const rect = imageWrapperRef.current.getBoundingClientRect();
          const percentX = ((e.clientX - rect.left) / rect.width) * 100;
          const percentY = ((e.clientY - rect.top) / rect.height) * 100;
          setZoomOrigin({ x: Math.max(0, Math.min(100, percentX)), y: Math.max(0, Math.min(100, percentY)) });
        }}
        onTouchStart={(e) => {
          const firstTouch = e.touches[0];
          touchStart.current = { x: firstTouch.clientX, y: firstTouch.clientY };
          touchDelta.current = { x: 0, y: 0 };
        }}
        onTouchMove={(e) => {
          if (!touchStart.current) return;
          const currentTouch = e.touches[0];
          touchDelta.current = { x: currentTouch.clientX - touchStart.current.x, y: currentTouch.clientY - touchStart.current.y };
        }}
        onTouchEnd={() => {
          const dx = touchDelta.current.x;
          const dy = touchDelta.current.y;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);
          const threshold = 40;
          if (absX > absY && absX > threshold) {
            if (dx > 0) prev(); else next();
          }
          touchStart.current = null;
          touchDelta.current = { x: 0, y: 0 };
        }}
      >
        <button className="gallery-nav prev" aria-label="Imagem anterior" onClick={prev}>‹</button>
        <div className={"pdp__image-inner"}>
          <Image
            src={thumbs[active]}
            alt={name}
            width={900}
            height={900}
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 600px"
            draggable={false}
            style={{
              transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
              transform: isZooming ? 'scale(1.8)' : 'scale(1)',
              transition: isZooming ? 'transform 60ms linear' : 'transform 180ms ease',
              willChange: 'transform',
              cursor: isZooming ? 'zoom-out' : 'zoom-in',
            }}
          />
        </div>
        <button className="gallery-nav next" aria-label="Próxima imagem" onClick={next}>›</button>

        <div className="pdp__badges">
          <DiscountBadge price={price} listPrice={listPrice} />
        </div>
      </div>
    </div>
  );
}
