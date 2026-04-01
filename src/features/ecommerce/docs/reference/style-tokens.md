# Styleguide e Tokens

## Fonte única de estilo
- Arquivo central: `src/styles/ecommerce/styleguide.css`
- Objetivo: concentrar tokens semânticos e presets de tema/campanha em um único lugar.
- Os componentes devem priorizar variáveis semânticas (`--ecom-*`) em vez de hex direto.

## Atributos de tema
- Aplicação no `main.ecom`:
  - `data-theme="default|light|classic|fresh"`
  - `data-campaign="none|mothers-day|easter|black-friday"`
- Esses atributos já são aplicados automaticamente em `src/app/e-commerce/layout-client.tsx`.
- Também existe persistência em `localStorage` para manter a escolha entre navegações.

## Query params (debug/manual)
- Você pode testar visual sem mexer em código:
  - `/e-commerce?theme=classic`
  - `/e-commerce?campaign=black-friday`
  - `/e-commerce?theme=fresh&campaign=mothers-day`

## Tokens principais
- Base: `--ecom-color-bg`, `--ecom-color-surface`, `--ecom-color-text`, `--ecom-color-border`
- Marca: `--ecom-color-brand`, `--ecom-color-brand-hover`, `--ecom-color-brand-contrast`
- Feedback: `--ecom-color-success|warning|danger|info` + `*-soft`
- Componentes:
  - Header: `--ecom-header-*`
  - Cards: `--ecom-card-*`
  - Drawer: `--ecom-drawer-*`
  - Footer: `--ecom-footer-bg`

## Integração futura com painel administrativo
- O painel poderá alterar apenas:
  1. `data-theme` e `data-campaign` do `main.ecom`, ou
  2. variáveis CSS (`--ecom-*`) diretamente.
- Assim, não será necessário alterar CSS de componentes para personalização visual.
