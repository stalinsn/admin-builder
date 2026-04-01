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
