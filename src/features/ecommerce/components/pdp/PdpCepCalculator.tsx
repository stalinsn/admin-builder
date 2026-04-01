"use client";
import React from 'react';

import { Button } from '../atoms/Button';
import { simulateLogisticsClient } from '../../lib/logisticsClient';

type Quote = { id: string; name: string; sla: string; price: number; mode?: string };

function normalizeCep(input: string) {
  return (input || '').replace(/\D/g, '').slice(0, 8);
}

function formatCep(onlyDigits: string) {
  if (!onlyDigits) return '';
  const digits = onlyDigits.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function isValidCep(onlyDigits: string) {
  return /^\d{8}$/.test(onlyDigits);
}

export function PdpCepCalculator({ productId }: { productId: string }) {
  const [raw, setRaw] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quotes, setQuotes] = React.useState<Quote[] | null>(null);

  React.useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('ecom_cep') : null;
    if (saved) setRaw(saved);
  }, []);

  const onlyDigits = normalizeCep(raw);
  const masked = formatCep(onlyDigits);
  const valid = isValidCep(onlyDigits);

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const nextValue = normalizeCep(e.target.value);
    setRaw(nextValue);
    setError(null);
  };

  const onCalc = async () => {
    setError(null);
    setQuotes(null);
    if (!valid) {
      setError('Informe um CEP válido (ex: 01001-000)');
      return;
    }
    try {
      setLoading(true);
      const result = await simulateLogisticsClient({
        postalCode: onlyDigits,
        items: [{ id: productId, quantity: 1 }],
      });

      const nextQuotes = result.options.map((option) => ({
        id: option.id,
        name: option.name,
        sla: option.estimate || 'Prazo indisponível',
        price: option.price,
        mode: option.mode,
      }));

      if (!nextQuotes.length) {
        setError('No momento este produto não possui cobertura para o CEP informado.');
        return;
      }

      setQuotes(nextQuotes);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('ecom_cep', onlyDigits);
        } catch {}
      }
    } catch {
      setError('Não foi possível calcular o frete agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdp__cep">
      <label htmlFor="cep" className="cep-label">Calcular frete e prazo</label>
      <div className="cep-form">
        <input
          id="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Digite seu CEP"
          value={masked}
          onChange={onChange}
          className={`cep-input ${valid ? '' : raw ? 'is-invalid' : ''}`}
          aria-invalid={!valid && !!raw}
        />
        <Button onClick={onCalc} disabled={loading}>
          {loading ? 'Calculando...' : 'Calcular'}
        </Button>
      </div>
      {error ? <div className="cep-error" role="alert">{error}</div> : null}
      {quotes ? (
        <ul className="cep-result" aria-live="polite">
          {quotes.map((quote) => (
            <li key={quote.id} className="cep-result__item">
              <div className="left">
                <strong>{quote.name}</strong>
                <small>{quote.sla}</small>
              </div>
              <div className="right">
                {quote.price === 0 ? <strong className="free">Grátis</strong> : <strong>R$ {quote.price.toFixed(2)}</strong>}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
