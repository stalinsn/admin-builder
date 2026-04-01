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
