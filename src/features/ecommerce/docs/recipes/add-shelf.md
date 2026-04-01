# Como adicionar uma nova prateleira (shelf)

1) Defina a flag (se necessário) em `config/featureFlags.ts`.
2) Configure `shelfConfig.ts` com as opções (itens, largura, título, variações de tema).
3) Crie/edite um organism baseado em `Showcase` para consumir produtos do hook e renderizar `ProductCard`.
4) Na página `/e-commerce`, condicione a renderização com `isOn('ecom.suaFlag')`.
5) Estilize variantes usando classes da seção (ex.: `.shelf--brand`).
