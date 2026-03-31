# Auth Kit

Este pacote reúne a base de autenticação e identidade que hoje sustenta:

- `EcommPanel`: acesso administrativo, RBAC, sessão, CSRF, login por senha e código
- `E-commerce`: cadastro/login de cliente, validação por e-mail, sessões, endereços, pedidos e LGPD

## Objetivo

Servir como base reaproveitável para novos produtos que precisem de:

- login administrativo e/ou login de cliente
- perfis e permissões
- verificação por e-mail
- recuperação e endurecimento de senha
- trilha mínima de segurança e privacidade

Exemplo de reaproveitamento:

- portal escolar
- extranet de clientes
- portal interno com áreas por perfil

## Escopo do pacote

O export do `auth-kit` inclui:

- stores e tipos de conta do cliente
- autenticação do cliente
- criptografia de dados sensíveis do cliente
- política de senha do cliente
- autenticação administrativa do painel
- hashing de senha do painel
- RBAC administrativo
- tipos e configurações de auth/e-mail do painel
- rotas-base de API para cliente e admin

## Exportar

```bash
npm run export:auth-kit
```

Saída:

- `exports/auth-kit`

## Bootstrap inicial

Para provisionar a base de auth em um servidor com PostgreSQL configurado:

```bash
npm run auth-kit:bootstrap -- \
  --admin-email=admin@dominio.com \
  --admin-name="Administrador Inicial" \
  --admin-password='Senha@Forte123'
```

Se quiser semear os usuários padrão do painel junto com o bootstrap:

```bash
npm run auth-kit:bootstrap -- \
  --admin-email=admin@dominio.com \
  --admin-name="Administrador Inicial" \
  --admin-password='Senha@Forte123' \
  --seed-default-panel-users
```

O bootstrap atual:

- garante a base administrativa
- cria o primeiro admin quando não existir nenhum usuário
- garante a base de clientes e endereços
- garante as políticas iniciais de retenção LGPD

## Provisionamento de servidor novo

Também existe um shell script para preparar uma máquina Ubuntu/Debian nova:

```bash
sudo bash ./scripts/install-auth-kit-server.sh
```

O script:

- instala dependências base do sistema
- instala Node.js
- instala PostgreSQL
- cria usuário e base do auth kit
- grava `.env.local`
- roda `npm install`
- roda o bootstrap do auth kit

Variáveis opcionais para customização:

```bash
AUTH_KIT_DB_NAME=auth_kit
AUTH_KIT_DB_USER=auth_kit
AUTH_KIT_DB_PASSWORD=sua_senha
AUTH_KIT_ADMIN_EMAIL=admin@dominio.com
AUTH_KIT_ADMIN_NAME="Administrador Inicial"
AUTH_KIT_ADMIN_PASSWORD='Senha@Forte123'
AUTH_KIT_PUBLIC_URL=https://seu-dominio.com
AUTH_KIT_INSTALL_PM2=true
AUTH_KIT_INSTALL_NGINX=true
AUTH_KIT_SEED_DEFAULT_PANEL_USERS=false
```

Exemplo:

```bash
sudo AUTH_KIT_ADMIN_EMAIL=admin@escola.com.br \
AUTH_KIT_ADMIN_NAME="Admin Escola" \
AUTH_KIT_ADMIN_PASSWORD='Senha@Forte123' \
AUTH_KIT_PUBLIC_URL=https://portal.escola.com.br \
bash ./scripts/install-auth-kit-server.sh
```

## Observações

- O pacote é um recorte técnico, não um app final completo.
- Ele foi pensado para reaproveitamento de arquitetura e aceleração de novos produtos.
- Antes de publicar em outro projeto, revise:
  - variáveis de ambiente
  - persistência
  - políticas de retenção e LGPD
  - templates de e-mail
  - nomes de domínio e cookies
