# Estrutura de Pastas (E-commerce)

Base: `src/features/ecommerce`

- `components/`
  - `atoms/` — Botões e elementos básicos reutilizáveis (ex.: Button).
  - `molecules/` — Blocos compositivos (ex.: ProductCard, PriceBlock, QuantitySelector, DiscountBadge).
  - `organisms/` — Seções completas (ex.: Carousel, Showcase, CartMini, CheckoutView).
  Observações:
  - Atoms não conhecem negócio (somente aparência/comportamento genérico).
  - Molecules tipam contratos de dados UI (props claras, sem acoplamento a fetch).
  - Organisms orquestram hooks/estado e compõem molecules.
- `config/`
  - `featureFlags.ts` — Chaves e helpers para ativar/desativar seções.
  - `shelfConfig.ts` — Configuração de shelves/carrosséis (layout, quantidade, etc.).
  - Convenção: objetos imutáveis (`Object.freeze`) e funções auxiliares tipadas.
- `data/` — Dados mockados (ex.: products.json).
- `hooks/` ou `lib/`
  - `useProducts.ts` — Mapeia dados mockados em UIProduct.
- `state/`
  - `CartContext.tsx` — Estado global do carrinho (provider + hook).
  - Convenção: reducer + actions discriminadas; persistência segura.
- `utils/`
  - `currency.ts` — Formatador BRL compartilhado.

Roteamento (App Router): `src/app/e-commerce/*`
- `page.tsx` (home do e-commerce)
- `[slug]/p` (PDP)
- `plp` (lista)
- `cart` (carrinho)
- `checkout` e `checkout/confirmation`

Estilos: `src/styles/ecommerce/*` (grid-cards.css, sections.css, buttons.css, modal.css, etc.)
  - Nomes de classe BEM simplificado: `.bloco`, `.bloco__elemento`, `.bloco--variante`.
  - Evitar utilitários fora deste escopo dentro da UI de e-commerce.
