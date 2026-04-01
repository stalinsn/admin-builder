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
