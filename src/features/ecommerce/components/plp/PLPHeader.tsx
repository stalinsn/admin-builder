"use client";
import React from 'react';
import { Breadcrumbs, Crumb } from '../common/Breadcrumbs';

export function PLPHeader({ title, breadcrumbs }: { title: string; breadcrumbs: { href: string; label: string }[] }) {
  return (
    <div className="plp-header">
  <Breadcrumbs items={breadcrumbs as Crumb[]} includeHome homeLabel="Início" variant="plp" />
      <h1 className="plp-title">{title}</h1>
    </div>
  );
}
