export type CepAddress = {
  cep: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
};

function onlyDigits(s: string) { return s.replace(/\D/g, ''); }

export function inRange(cep: string, start: string, end: string) {
  const cepNumber = Number(onlyDigits(cep));
  const startNumber = Number(onlyDigits(start));
  const endNumber = Number(onlyDigits(end));
  return Number.isFinite(cepNumber) && cepNumber >= startNumber && cepNumber <= endNumber;
}

export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const raw = onlyDigits(cep);
  if (raw.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    if (resp.ok) {
      const data = await resp.json();
      if (!data.erro) {
        return {
          cep: raw,
          street: data.logradouro || undefined,
          neighborhood: data.bairro || undefined,
          city: data.localidade || undefined,
          state: data.uf || undefined,
          country: 'BR',
        };
      }
    }
  } catch {}
  return { cep: raw };
}

export function estimateShipping(cep: string): { option: { id: string; name: string; price: number; estimate?: string } } {
  const raw = onlyDigits(cep);
  const prefix = Number(raw.slice(0, 2));
  let price = 9.9;
  if (prefix < 10) price = 14.9;
  else if (prefix < 20) price = 19.9;
  else if (prefix < 30) price = 24.9;
  else price = 29.9;
  return { option: { id: `standard-${prefix}`, name: 'Entrega Padrão', price, estimate: '2-5 dias úteis' } };
}
