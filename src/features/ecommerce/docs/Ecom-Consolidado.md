# E-commerce — Documentação Consolidada

Gerado em 2025-08-17T21:27:49.200Z

> Origem: src/features/ecommerce/docs (estrutura modular mantida).
> Links relativos podem apontar para os arquivos originais.



---

<!-- Begin: README.md -->

# E-commerce — Documentação Funcional (pt-BR)

Este diretório concentra a documentação funcional e técnica do módulo de E-commerce deste projeto.

Navegação rápida:
- Visão geral: ./overview.md
- Estrutura do projeto: ./structure.md
- Operação (como rodar e configurar): ./operation.md
- Implementação (guias práticos): ./implementation/README.md
- Referências (rotas, env, etc.): ./reference/README.md
- Receitas (passo a passo): ./recipes/README.md
- Troubleshooting: ./troubleshooting.md
- Roadmap: ./roadmap.md
- Checklists de qualidade: ./checklists.md

Escopo: a documentação aqui é específica do E-commerce e fica separada dos componentes para facilitar manutenção e consulta durante o desenvolvimento.

<!-- End: README.md -->



---

<!-- Begin: overview.md -->

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

<!-- End: overview.md -->



---

<!-- Begin: structure.md -->

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

<!-- End: structure.md -->



---

<!-- Begin: operation.md -->

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
As flags moram em `config/featureFlags.ts` e são consultadas via `isOn(key)`:
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

<!-- End: operation.md -->



---

<!-- Begin: implementation/README.md -->

# Implementação — Guias

Guias práticos para evoluir o E-commerce:
- Componentes e padrões: ./components.md
- Estilos (CSS do e-commerce): ./styles.md
- Estado do carrinho: ./state-cart.md
- Flags de funcionalidade: ./feature-flags.md
- Dados e integração: ./data.md

<!-- End: implementation/README.md -->



---

<!-- Begin: implementation/components.md -->

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

<!-- End: implementation/components.md -->



---

<!-- Begin: implementation/styles.md -->

# Estilos (CSS do E-commerce)

- Localização: `src/styles/ecommerce/*`.
- Organização: arquivos por tema (grid-cards, sections, buttons, modal, etc.).
- Abordagem: CSS moderno com aninhamento e variáveis; layout consistente por seções.
- Convenção: BEM simplificado (`.product-card`, `.product-card__img`, etc.).
- Não usar utilitários Tailwind para UI do e-commerce — mantenha consistência via classes próprias.

## Dicas
- Use containers estáveis para imagens (evita layout shift).
- Centralize tokens (cores, espaçamentos) em variáveis CSS.
- Ajustes responsivos com media queries locais às seções.

## Tokens e variáveis
- Cores: `--accent`, `--text`, `--text-inverse`, `--border`, `--card-bg`.
- Espaçamentos: `--container`, `--container-padding`, etc.
- Raio/transição: `--radius`, `--radius-lg`, `--transition-fast`.

## Variantes de seção
- Ex.: `.shelf--brand`, `.shelf--dark` aplicando alterações pontuais em botões e setas do carrossel.

## Exemplo de BEM
```
.product-card { /* bloco */ }
.product-card__img { /* elemento */ }
.product-card__cta { /* elemento */ }
.product-card--compact { /* variante opcional */ }
```

<!-- End: implementation/styles.md -->



---

<!-- Begin: implementation/state-cart.md -->

# Estado do Carrinho (CartContext)

Arquivo: `state/CartContext.tsx`

## Contratos
- Item do carrinho: `{ id, name, price, image?, qty, listPrice?, unit?, packSize? }`.
- Ações: `ADD`, `INC`, `DEC`, `REMOVE`, `CLEAR`, `HYDRATE`.
- API do hook: `useCart()` retorna `{ state, add, inc, dec, remove, clear, totalItems, subtotal }`.

## Persistência e Hidratação
- Persistência via `localStorage` usando utilitários seguros (`safeJsonGet/Set`).
- Hidratado na montagem; cálculo de totais via `useMemo`.
- Padrão: não renderizar markup que mude no SSR vs cliente (ex.: usar um container estável e alternar conteúdo só após montar).

Fluxo de vida:
- SSR: markup básico sem depender de `localStorage`.
- Montagem: lê estado persistido e dispara `HYDRATE` se existir.
- Pós-hidratação: qualquer alteração persiste novamente no storage.

Performance:
- Reducer simples e planos (apenas objetos/valores primitivos).
- Evite recriar funções em cascata fora do `useMemo` do provider.

## Uso
- Em um organism/molecule, importe `useCart()` e invoque as ações conforme necessário.
- Evite manipular o estado diretamente fora do provider.
 - Exemplo: `add({ id, name, price, image })` ou `inc(id)/dec(id)`.

<!-- End: implementation/state-cart.md -->



---

<!-- Begin: implementation/feature-flags.md -->

# Flags de Funcionalidade

Arquivo: `config/featureFlags.ts`

## Chaves disponíveis
- `ecom.header`, `ecom.footer`, `ecom.heroBanner`, `ecom.servicesBar`, `ecom.carousel`
- `ecom.showcaseDaily`, `ecom.showcaseGrocery`
- `ecom.demoBanners`, `ecom.demoShelves`
- `ecom.cart`

## API
- `isOn(key: FlagKey): boolean`
- `isOff(key: FlagKey): boolean`

## Ambiente
- `NEXT_PUBLIC_IS_DEMO` habilita features puramente de demonstração em desenvolvimento.
- Em produção, as demos permanecem desativadas por padrão.

Decisões de projeto:
- `featureFlags` é imutável (`Object.freeze`) e tipado com `satisfies` para evitar drift.
- `isOn/isOff` expõem uma API mínima e legível.
- Parser de booleano de env aceita `1,true,yes,on` (case-insensitive) para DX.

## Adicionando uma nova flag
1) Adicione a chave ao tipo `FlagKey`.
2) Inclua o valor padrão no objeto `featureFlags` (mantido imutável com `Object.freeze`).
3) Opcional: controle por env var seguindo o padrão existente.

Exemplo de uso:
```ts
import { isOn } from '@/features/ecommerce/config/featureFlags';
if (isOn('ecom.carousel')) {
	// renderiza carrossel
}
```

<!-- End: implementation/feature-flags.md -->



---

<!-- Begin: implementation/data.md -->

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

<!-- End: implementation/data.md -->



---

<!-- Begin: reference/README.md -->

# Referências

- Rotas (App Router): ./routes.md
- Variáveis de ambiente: ./env.md
- Estilo e tokens: ./style-tokens.md

<!-- End: reference/README.md -->



---

<!-- Begin: reference/routes.md -->

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

<!-- End: reference/routes.md -->



---

<!-- Begin: reference/env.md -->

# Variáveis de Ambiente

- `NEXT_PUBLIC_IS_DEMO` — liga/desliga itens estritamente demo. Padrão: desligado em produção.
- `NEXT_PUBLIC_DATA_SOURCE` — seleciona fonte de dados (mock/API futura). (Opcional; ainda não utilizado).

Exemplos (`.env.local`):
```
NEXT_PUBLIC_IS_DEMO=true
NEXT_PUBLIC_DATA_SOURCE=mock
```

Notas:
- Em produção, o modo demo permanece desligado mesmo se a env for definida.

<!-- End: reference/env.md -->



---

<!-- Begin: reference/style-tokens.md -->

# Estilo e Tokens

- Variáveis CSS: definem cores, espaçamentos, raios e transições.
- Convenção: BEM simplificado com classes específicas do e-commerce.
- Arquivos relevantes: `src/styles/ecommerce/`.

<!-- End: reference/style-tokens.md -->



---

<!-- Begin: recipes/README.md -->

# Receitas (Passo a Passo)

Coleção de guias rápidos para tarefas comuns.

- Adicionar uma nova prateleira (shelf): ./add-shelf.md
- Criar um novo card de produto: ./new-product-card.md
- Integrar um serviço de catálogo: ./integrate-catalog-service.md

<!-- End: recipes/README.md -->



---

<!-- Begin: recipes/add-shelf.md -->

# Como adicionar uma nova prateleira (shelf)

1) Defina a flag (se necessário) em `config/featureFlags.ts`.
2) Configure `shelfConfig.ts` com as opções (itens, largura, título, variações de tema).
3) Crie/edite um organism baseado em `Showcase` para consumir produtos do hook e renderizar `ProductCard`.
4) Na página `/e-commerce`, condicione a renderização com `isOn('ecom.suaFlag')`.
5) Estilize variantes usando classes da seção (ex.: `.shelf--brand`).

<!-- End: recipes/add-shelf.md -->



---

<!-- Begin: recipes/new-product-card.md -->

# Criar/alterar um card de produto

- Baseie-se em `components/molecules/ProductCard.tsx`.
- Garanta container de CTA estável (`product-card__cta`) para evitar hydration mismatch.
- Use `PriceBlock` + `formatBRL`.
- Para controles de quantidade, use `QuantitySelector` e o `CartContext`.
- Estilize via `grid-cards.css` sem utilitários externos.

<!-- End: recipes/new-product-card.md -->



---

<!-- Begin: recipes/integrate-catalog-service.md -->

# Integrar um serviço de catálogo

1) Crie um módulo em `services/catalog.ts` com funções para listar produtos, detalhar por slug/sku e buscar imagens.
2) Adapte `useProducts.ts` para receber a fonte de dados (mock/API), lendo `NEXT_PUBLIC_DATA_SOURCE`.
3) Se usar `next/image` com novo host, inclua em `next.config.ts`.
4) Considere cache leve (ex.: SWR) e tratativas de erro amigáveis.
5) Mantenha os componentes puros; a lógica de dados deve ficar no serviço/hook.

<!-- End: recipes/integrate-catalog-service.md -->



---

<!-- Begin: troubleshooting.md -->

# Troubleshooting (E-commerce)

## Hydration mismatch em cards
- Garanta container estável e só altere o conteúdo após `mounted`.
- Evite condicional que troque a tag raiz do CTA entre SSR e cliente.

## Build em Windows dá EPERM
- Finalize qualquer dev server aberto e limpe `.next//` antes do build.
 - Dica: feche janelas do navegador que estejam utilizando o servidor anterior.
 - Em último caso, reinicie o terminal/VS Code.

## Imagem remota 503
- Verifique disponibilidade do host de imagens demo (`picsum.photos`). Em produção, use o host real.
 - Adicione o host em `next.config.ts` em `images.remotePatterns`.

<!-- End: troubleshooting.md -->



---

<!-- Begin: roadmap.md -->

# Roadmap (Próximas fases)

## Fase 1 — Consolidação
- Revisar SEO (metadados em PLP/PDP, breadcrumbs estruturados).
- Ajustar hosts de imagem reais e otimizações.
- Melhorar acessibilidade (foco, aria, contrastes).

## Fase 2 — Integração
- Conectar catálogo e search à API real (ex.: VTEX).
- Adicionar serviço de preços/promoções.
- Autenticação e área do cliente (mínimo viável).

## Fase 3 — Experiência
- Lista de desejos, avaliações, recomendações.
- Telemetria/analytics detalhados por evento.
- Testes A/B em prateleiras e banners.

<!-- End: roadmap.md -->



---

<!-- Begin: checklists.md -->

# Checklists de Qualidade

## Revisão de componente (UI)
- [ ] Props tipadas e documentadas.
- [ ] Acessibilidade mínima (aria, foco, semântica).
- [ ] Estilos em `src/styles/ecommerce/*` (sem utilitários externos).
- [ ] SSR estável (sem hydration mismatch conhecido).
- [ ] Teste visual responsivo (mobile/desktop).
 - [ ] Interações suaves e sem warnings no console.

## Preparação para produção
- [ ] Flags corretas para seções (desligar demos em prod).
- [ ] Hosts de imagem autorizados.
- [ ] Build e lint limpos.
- [ ] Logs/erros tratados (sem ruídos em console).
 - [ ] Metadados/SEO mínimos em PLP/PDP (título/descrição).
 - [ ] Fallbacks para indisponibilidade de dados/imagens.

<!-- End: checklists.md -->
