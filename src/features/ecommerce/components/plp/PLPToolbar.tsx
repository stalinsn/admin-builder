"use client";
import React from 'react';

export function PLPToolbar({
  total,
  sort,
  onSort,
}: {
  total: number;
  sort: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
  onSort: (s: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc') => void;
}) {
  const selectId = 'plp-sort-select';
  return (
    <div className="plp-toolbar">
      <div className="plp-toolbar__count" role="status" aria-live="polite">{total} resultados</div>
      <label className="plp-toolbar__sort" htmlFor={selectId}>
        <span>Ordenar por</span>
        <select
          id={selectId}
          value={sort}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onSort(e.target.value as 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc')
          }
        >
          <option value="relevance">Relevância</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
          <option value="name-asc">Nome (A-Z)</option>
          <option value="name-desc">Nome (Z-A)</option>
        </select>
      </label>
    </div>
  );
}
