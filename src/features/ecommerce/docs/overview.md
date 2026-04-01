# Visão Geral do E-commerce

Este módulo de E-commerce foi construído usando Next.js (App Router) e React, priorizando:
- Arquitetura modular (atoms → molecules → organisms) com estilos dedicados.
- Flags de funcionalidade para ligar/desligar seções sem alterar código de página.
- Modo demonstração controlado por ambiente, mantendo mocks separados de produção.
- Estado de carrinho leve, persistente e com hidratação segura (sem hydration mismatch).

Principais fluxos cobertos:
- Home (prateleiras, banners, carrosséis) — condicionais via feature flags e modo demo.
- PLP (Lista de Produtos) — navegação e catálogo simplificado.
- PDP (Detalhe do Produto) — detalhes do item e CTA de compra.
- Carrinho — drawer e página dedicada com resumo/itens.
- Checkout — fluxo simplificado e tela de confirmação.

Responsabilidades por camada:
- Server Components: layout/base, dados estáticos e metadados quando aplicável.
- Client Components: interação, estado local/global (ex.: carrinho) e efeitos.

Padrões de engenharia adotados:
- CSS modular no diretório `src/styles/ecommerce` (BEM simplificado, tokens e media queries locais).
- Imagens com `next/image` e `remotePatterns` restritos.
- Formatação monetária centralizada (BRL) em util compartilhado.
- Hydration-safe: containers estáveis e alternância de conteúdo após `mounted` quando necessário.

Integração futura (alto nível):
- Trocar mocks por serviços (ex.: VTEX) mantendo o contrato `UIProduct`.
- Adicionar cache leve (SWR/fetch + revalidação) e tratamento de falhas (fallbacks).
