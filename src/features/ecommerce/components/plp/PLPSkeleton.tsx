import React from 'react';

type Props = {
  cards?: number;
};

export function PLPSkeleton({ cards = 12 }: Props) {
  return (
    <div className="plp-skeleton" aria-hidden="true">
      <div className="plp-skeleton__header">
        <div className="skeleton" style={{ height: 18, width: 160 }} />
        <div className="skeleton" style={{ height: 32, width: '48%' }} />
      </div>
      <div className="plp-skeleton__layout">
        <div className="plp-skeleton__facets">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`facet-${index}`} className="skeleton" style={{ height: 18, width: `${90 - index * 7}%` }} />
          ))}
        </div>
        <div className="plp-skeleton__grid">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={`card-${index}`} className="plp-skeleton__card">
              <div className="skeleton" style={{ height: 170, width: '100%' }} />
              <div className="skeleton" style={{ height: 14, width: '82%' }} />
              <div className="skeleton" style={{ height: 22, width: '44%' }} />
              <div className="skeleton" style={{ height: 38, width: '100%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
