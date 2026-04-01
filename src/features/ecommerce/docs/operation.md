# Operação (como usar/rodar)

## Executar localmente
- Requisitos: Node 18+.
- Desenvolvimento: `npm run dev` (App Router com HMR).
- Teste de build: `npm run build` + `npm run start` (produção local).

Dicas Windows:
- Se ocorrer EPERM em `.next/trace`, finalize servidores dev abertos e limpe `.next/` antes de buildar novamente.

## Variáveis de ambiente
- `NEXT_PUBLIC_IS_DEMO` — ativa elementos 100% demo (banners/shelves de demonstração). Padrão: desativado em produção. Ative localmente em `.env.local`:
  - `NEXT_PUBLIC_IS_DEMO=true`
  - Valores aceitos: `1,true,yes,on` (case-insensitive). Para desativar: `0,false,no,off`.

## Feature Flags
As flags continuam acessíveis por `config/featureFlags.ts`, mas agora a estrutura interna está dedicada em `config/featureFlags/*`, o que facilita remover, agrupar ou evoluir uma flag sem misturar tudo num único arquivo.

Consulta via `isOn(key)`:
- `ecom.header`, `ecom.footer`, `ecom.heroBanner`, `ecom.servicesBar`, `ecom.carousel`
- `ecom.showcaseDaily`, `ecom.showcaseGrocery`
- `ecom.demoBanners`, `ecom.demoShelves` (afetadas por `NEXT_PUBLIC_IS_DEMO`)
- `ecom.cart`

Exemplo de uso em página:
```tsx
import { isOn } from '@/features/ecommerce/config/featureFlags';

export default function HomeEcom() {
  return (
    <>
      {isOn('ecom.heroBanner') && <HeroBanner />}
      {isOn('ecom.showcaseDaily') && <Showcase title="Ofertas do Dia" flag="ecom.showcaseDaily" />}
    </>
  );
}
```

## Imagens remotas
- Hosts liberados em `next.config.ts` (ex.: `picsum.photos`). Adicione o host da plataforma quando integrar ao ambiente real.
