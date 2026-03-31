# EcommPanel (Standalone)

Esta pasta contém uma extração do app `EcommPanel` como projeto Next.js independente.

## Rodar

1) Instale dependências antes de iniciar:

```bash
npm install
```

2) Suba o dev server:

```bash
npm run dev
```

> Observação: sempre rode `npm install` antes de subir o projeto exportado, para garantir que os plugins do PostCSS e dependências do Next estejam completos.

Rota principal: /.
Rota original (ainda disponível): /ecommpanel

## Bootstrap do auth

Este export já inclui:

- `scripts/install-auth-kit-server.sh`
- `scripts/bootstrap-auth-kit.ts`
- `npm run auth-kit:bootstrap`

Em um servidor novo Ubuntu/Debian, o fluxo recomendado é:

```bash
sudo bash ./scripts/install-auth-kit-server.sh
```

## Instalação em VPS existente

Este projeto já pode ser usado como base de um novo admin independente, por exemplo:

- `e-game.admin.artmeta.com.br`

Fluxo recomendado:

1. clone o repositório na VPS;
2. entre na pasta do projeto;
3. rode o instalador com as variáveis do domínio e do admin inicial;
4. faça o build;
5. suba a aplicação;
6. depois conecte o domínio no Nginx.

Exemplo:

```bash
sudo AUTH_KIT_ADMIN_EMAIL=stalin@artmeta.com.br \
AUTH_KIT_ADMIN_NAME="Main Admin" \
AUTH_KIT_ADMIN_PASSWORD='DefinaUmaSenhaForteAqui' \
AUTH_KIT_PUBLIC_URL=https://e-game.admin.artmeta.com.br \
AUTH_KIT_INSTALL_PM2=false \
AUTH_KIT_INSTALL_NGINX=false \
bash ./scripts/install-auth-kit-server.sh
```

Depois:

```bash
npm run build
npm run start
```

## O que o instalador faz

- instala dependências de sistema via `apt`;
- garante `Node.js`;
- garante `PostgreSQL`;
- cria/atualiza um banco dedicado e um usuário dedicado;
- grava `.env.local` do projeto;
- roda `npm install`;
- roda o bootstrap da base de auth.

## O que ele não remove

O instalador **não apaga**:

- bancos PostgreSQL já existentes;
- usuários PostgreSQL já existentes fora do nome configurado;
- configurações existentes de `sites-available` do Nginx;
- processos já rodando no PM2;
- regras de firewall.

## O que ele pode alterar

- instala pacotes novos no sistema;
- reinicia o serviço do PostgreSQL;
- se `AUTH_KIT_INSTALL_NGINX=true`, instala e reinicia o Nginx;
- se `AUTH_KIT_INSTALL_PM2=true`, instala o PM2 globalmente;
- atualiza a senha do usuário PostgreSQL informado em `AUTH_KIT_DB_USER` se ele já existir.

## Wizard

Hoje a primeira instalação ainda é orientada por script, não por wizard visual no navegador.

O fluxo atual é:

- script de provisionamento;
- bootstrap do auth;
- painel disponível para login;
- modelagem do domínio via Data Studio e APIs internas do painel.
