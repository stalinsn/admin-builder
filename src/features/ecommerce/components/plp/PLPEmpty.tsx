"use client";
import React from 'react';
import Link from 'next/link';

export function PLPEmpty({ term }: { term?: string }) {
  return (
    <div className="plp-empty">
      <h2>Nenhum resultado {term ? `para "${term}"` : ''}</h2>
      <p>Tente ajustar os filtros ou revisar a ortografia do termo buscado.</p>
      <Link className="plp-empty__cta" href="/e-commerce">Voltar para a Home</Link>
    </div>
  );
}
