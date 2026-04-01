# Integrar um serviço de catálogo

1) Crie um módulo em `services/catalog.ts` com funções para listar produtos, detalhar por slug/sku e buscar imagens.
2) Adapte `useProducts.ts` para receber a fonte de dados (mock/API), lendo `NEXT_PUBLIC_DATA_SOURCE`.
3) Se usar `next/image` com novo host, inclua em `next.config.ts`.
4) Considere cache leve (ex.: SWR) e tratativas de erro amigáveis.
5) Mantenha os componentes puros; a lógica de dados deve ficar no serviço/hook.
