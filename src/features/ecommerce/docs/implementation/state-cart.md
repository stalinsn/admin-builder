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
