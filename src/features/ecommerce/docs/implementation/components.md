# Componentes e Padrões

## Camadas
- Atoms: elementos básicos (ex.: Button). Evite acoplamento com dados de negócio.
- Molecules: composição de atoms (ex.: ProductCard, PriceBlock). Definem contrato de props claro.
- Organisms: seções completas (ex.: Showcase, Carousel).

## Convenções
- Nomes de classes CSS no padrão BEM simplificado (ex.: `product-card__title`).
- Evite utilitários Tailwind dentro do e-commerce; prefira classes declaradas em `src/styles/ecommerce/*`.
- Acessibilidade: `aria-label`, foco visível e equivalentes semânticos sempre que aplicável.

## Contratos mínimos (exemplo ProductCard)
- Inputs: `{ id, name, image?, price, listPrice?, unit?, packSize?, url? }`.
- Saídas/efeitos: dispara `add/inc/dec` do `CartContext`.
- Erros/margens: `image` opcional, `listPrice` pode ser <= `price` (sem badge), `url` pode cair no slug pelo `id`.
- Sucesso: CTA adiciona item e alterna para `QuantitySelector` após montagem.

## SSR/Hidratação
- Priorize markup estável entre SSR e cliente. Exemplo: no `ProductCard`, o container `product-card__cta` é constante; o conteúdo alterna após `mounted` para evitar hydration mismatch.

## Imagem e Link
- Use `next/image` com `sizes` e container com dimensões previsíveis (ver `product-card__img`).
- `Link` com `prefetch={false}` quando a navegação preditiva não for desejada.

## Exemplo: ProductCard
- Props: `id, name, image, price, listPrice, unit, packSize, url`.
- CTA: botão “Adicionar” ou `QuantitySelector`, controlado por `CartContext`.
- Preços: utilize `formatBRL` (não use `toFixed` diretamente).
 - Edge cases:
	 - `listPrice` ausente ou <= `price` não mostra preço riscado ou badge.
	 - `packSize` ausente não mostra linha de pacote.
	 - Falha na imagem remota não quebra layout (container fixo).
