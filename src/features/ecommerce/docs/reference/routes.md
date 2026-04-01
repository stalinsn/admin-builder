# Rotas do E-commerce

Base: `/e-commerce`

- `/e-commerce` — Home do e-commerce (prateleiras, banners, etc.).
- `/e-commerce/plp` — Lista de produtos.
- `/e-commerce/[slug]/p` — Detalhe do produto (PDP).
- `/e-commerce/cart` — Carrinho.
- `/e-commerce/checkout` — Checkout.
- `/e-commerce/checkout/confirmation` — Confirmação.

Observações:
- PDP deriva `slug` de `url` quando disponível, senão usa `id`.
- Home condiciona seções por flags e modo demo.
