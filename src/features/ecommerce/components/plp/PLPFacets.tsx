"use client";
import React from 'react';
import type { Category } from '../../lib/plp';

export type FacetState = {
  price?: [number, number];
  brand?: string[];
  dept?: string[];
  collection?: string[];
};

export function PLPFacets({ facets, value, onChange }: { facets: Category['facets']; value: FacetState; onChange: (v: FacetState) => void }) {
  if (!facets || facets.length === 0) return null;
  return (
    <aside className="plp-facets" aria-label="Filtros">
      {facets.map((facet, idx) => {
        if (facet.type === 'range') {
          const rangeValue = value.price || [facet.min, facet.max];
          const titleId = `facet-${facet.key}-${idx}`;
          return (
            <div className="facet" key={idx}>
              <h4 id={titleId}>{facet.label}</h4>
              <div className="facet-range">
                <input
                  type="range"
                  min={facet.min}
                  max={facet.max}
                  step={facet.step || 1}
                  value={rangeValue[0]}
                  aria-labelledby={titleId}
                  onChange={(e) => {
                    const nextMin = Math.min(Number(e.target.value), rangeValue[1]);
                    onChange({ ...value, price: [nextMin, rangeValue[1]] });
                  }}
                />
                <input
                  type="range"
                  min={facet.min}
                  max={facet.max}
                  step={facet.step || 1}
                  value={rangeValue[1]}
                  aria-labelledby={titleId}
                  onChange={(e) => {
                    const nextMax = Math.max(Number(e.target.value), rangeValue[0]);
                    onChange({ ...value, price: [rangeValue[0], nextMax] });
                  }}
                />
                <div className="facet-range__values">
                  <span>R$ {rangeValue[0].toFixed(2)}</span>
                  <span>R$ {rangeValue[1].toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        }
        if (facet.type === 'multi') {
          const key = facet.key;
          const selected = new Set((value[key as keyof FacetState] as string[] | undefined) || []);
          const titleId = `facet-${key}-${idx}`;
          return (
            <div className="facet" key={idx}>
              <h4 id={titleId}>{facet.label}</h4>
              <ul>
                {facet.options.map((opt) => (
                  <li key={opt}>
                    <label className="facet-check">
            <input
                        type="checkbox"
                        aria-labelledby={titleId}
                        checked={selected.has(opt)}
                        onChange={(e) => {
              const nextSelected = new Set((value[key as keyof FacetState] as string[] | undefined) || []);
                          if (e.target.checked) nextSelected.add(opt); else nextSelected.delete(opt);
              onChange({ ...value, [key]: Array.from(nextSelected) } as FacetState);
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })}
    </aside>
  );
}
