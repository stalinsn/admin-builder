"use client";
import React from 'react';

export function PLPPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pages: (number | string)[] = [];
  const push = (v: number | string) => pages.push(v);
  const addRange = (start: number, end: number) => {
    for (let pageNumber = start; pageNumber <= end; pageNumber++) push(pageNumber);
  };
  push(1);
  if (page > 3) push('…');
  addRange(Math.max(2, page - 1), Math.min(totalPages - 1, page + 1));
  if (page < totalPages - 2) push('…');
  if (totalPages > 1) push(totalPages);

  return (
    <nav className="plp-pagination" aria-label="Paginação de resultados">
      <button className="pg-btn" disabled={!canPrev} onClick={() => canPrev && onPageChange(page - 1)} aria-label="Página anterior">
        ‹
      </button>
      <ul className="pg-list">
        {pages.map((entry, index) => (
          <li key={`${entry}-${index}`}>
            {typeof entry === 'number' ? (
              <button
                className={`pg-item ${entry === page ? 'is-active' : ''}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </button>
            ) : (
              <span className="pg-ellipsis" aria-hidden>
                {entry}
              </span>
            )}
          </li>
        ))}
      </ul>
      <button className="pg-btn" disabled={!canNext} onClick={() => canNext && onPageChange(page + 1)} aria-label="Próxima página">
        ›
      </button>
    </nav>
  );
}
