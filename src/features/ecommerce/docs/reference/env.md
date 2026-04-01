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
