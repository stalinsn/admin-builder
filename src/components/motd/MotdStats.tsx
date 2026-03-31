import React from 'react';

type StatsProps = {
  stats: {
    total: number;
    hoje: number;
    streak: number;
  };
};

export default function MotdStats({ stats }: StatsProps) {
  return (
    <div className="motd-stats">
      <div className="stat-item" title="Total de frases geradas desde o início">
        <span className="stat-number">{stats.total}</span>
        <span className="stat-label">Total Geral</span>
      </div>
      <div className="stat-item" title="Frases geradas hoje">
        <span className="stat-number">{stats.hoje}</span>
        <span className="stat-label">Hoje</span>
      </div>
      <div className="stat-item" title="Dias consecutivos usando o gerador">
        <span className="stat-number">{stats.streak}</span>
        <span className="stat-label">Sequência</span>
      </div>
    </div>
  );
}
