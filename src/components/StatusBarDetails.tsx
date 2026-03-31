import React from 'react';
import { statusbarFacts } from './statusbarFacts';

interface StatusBarDetailsProps {
  tokensUsed: number | null;
  elapsedTime: number | null;
  payloadSize: number | null;
  charCount: number | null;
  model: string;
  costUSD: number;
  costBRL: number;
  speed: string | null;
  requisicoesPorDolar: string;
}

function formatSeconds(sec: number) {
  if (sec > 600) sec = sec / 1000;
  if (sec < 60) return `${sec.toFixed(2)}s`;
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (min < 60) return `${min}min ${s}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min ${s}s`;
}

function randomFact(arr: string[], vars?: Record<string, string|number>) {
  const fact = arr[Math.floor(Math.random() * arr.length)];
  if (!vars) return fact;
  return fact.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function StatusBarDetails({
  tokensUsed,
  elapsedTime,
  payloadSize,
  charCount,
  model,
  costUSD,
  costBRL,
  speed,
  requisicoesPorDolar,
}: StatusBarDetailsProps) {
  return (
    <>
      <hr className="statusbar-divider" />
      {tokensUsed !== null && (
        <div className="statusbar-section">
          <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
            🧠 Tokens usados: {tokensUsed}
            <span className="statusbar-anecdote">{randomFact(statusbarFacts.tokens)}</span>
          </p>
          <div className="statusbar-section-detail">
            Tokens são blocos de texto. Exemplo: <span className="statusbar-section-monospace">[Olá] [!] [mundo] [!]</span> = 4 tokens
          </div>
        </div>
      )}
      {elapsedTime !== null && (
        <div className="statusbar-section">
          <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
            ⏱️ Tempo: {formatSeconds(elapsedTime)} <span className="statusbar-section-span">({Math.round(elapsedTime * 1000)} ms)</span>
            <span className="statusbar-anecdote">{randomFact(statusbarFacts.elapsed, { ms: Math.round(elapsedTime * 1000) })}</span>
          </p>
          <div className="statusbar-section-detail">
            Tempo total de processamento da tradução.
          </div>
        </div>
      )}
      {speed && (
        <div className="statusbar-section">
          <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
            ⚡ Velocidade: {speed} tokens/s
            <span className="statusbar-anecdote">{randomFact(statusbarFacts.speed)}</span>
          </p>
          <div className="statusbar-section-detail">
            Quanto maior, mais rápida a tradução.
          </div>
        </div>
      )}
      {payloadSize && (
        <div className="statusbar-section">
          <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
            📦 Payload: {payloadSize.toFixed(2)} KB
            <span className="statusbar-anecdote">{randomFact(statusbarFacts.payload)}</span>
          </p>
          <div className="statusbar-section-detail">
            Aproximadamente {Math.ceil(payloadSize/2)} páginas de texto puro.
          </div>
        </div>
      )}
      {charCount && (
        <div className="statusbar-section">
          <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
            📝 Caracteres: {charCount}
            <span className="statusbar-anecdote">{randomFact(statusbarFacts.charCount)}</span>
          </p>
          <div className="statusbar-section-detail">
            ≈ {Math.ceil(charCount/280)} tweets completos
          </div>
        </div>
      )}
      {costUSD > 0 && (
        <>
          <div className="statusbar-section">
            <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
              💰 Custo estimado: ${costUSD.toFixed(5)} (~R${costBRL.toFixed(5)})
              <span className="statusbar-anecdote">{randomFact(statusbarFacts.cost)}</span>
            </p>
            <div className="statusbar-section-detail">
              Base OpenAI, dólar = R$5,20
            </div>
          </div>
          <div className="statusbar-section">
            <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
              🧾 Com $1 você faz aprox. {requisicoesPorDolar} requisições desse tamanho
              <span className="statusbar-anecdote">{randomFact(statusbarFacts.reqs)}</span>
            </p>
            <div className="statusbar-section-detail">
              Quanto menor o custo, mais traduções por dólar!
            </div>
          </div>
        </>
      )}
      <div className="statusbar-section">
        <p className="statusbar-section-title statusbar-stat-hover" tabIndex={0}>
          🤖 Modelo: {model}
          <span className="statusbar-anecdote">{randomFact(statusbarFacts.model)}</span>
        </p>
        <div className="statusbar-section-detail">
          Exemplo: gpt-3.5-turbo
        </div>
      </div>
    </>
  );
}
