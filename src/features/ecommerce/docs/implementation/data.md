# Dados e Integração

## Mock de produtos
- Arquivo: `data/products.json`
- Hook: `lib/useProducts.ts` — converte dados mockados em `UIProduct` por meio de `mapToUIProduct`.

Contrato `UIProduct` (alto nível):
- `{ id: string, name: string, price: number, listPrice?: number, image?: string, unit?: string, packSize?: number, url?: string }`
	- Compatível com `ProductCard` e `PriceBlock`.

## Formatação de moeda
- Utilizar `utils/currency.ts` com `formatBRL(value)`.

## Próximos passos (integração)
- Configurar fonte de dados (`NEXT_PUBLIC_DATA_SOURCE`) caso adote API externa.
- Adicionar host de imagens reais em `next.config.ts`.
- Criar serviços dedicados (ex.: `services/catalog.ts`) e substituir o hook por chamadas remotas com cache leve.
 - Tratar erros com fallback (ex.: lista vazia mostra estado amistoso; PDP mostra mensagem e CTA para voltar).
