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

O instalador funciona em modo interativo. Em um servidor Ubuntu/Debian, o fluxo recomendado é:

```bash
sudo bash ./scripts/install-auth-kit-server.sh
```

O script pergunta passo a passo:

- domínio/subdomínio público;
- porta local da aplicação;
- nome e credenciais do banco PostgreSQL;
- admin inicial;
- se deve configurar PM2 automaticamente;
- se deve criar o server block do Nginx;
- se deve ajustar o firewall UFW.

Antes de aplicar, ele mostra um resumo final e pede confirmação.


## Fluxo recomendado em VPS existente

1. Aponte o subdomínio para a VPS.
   Exemplo: `e-game.admin.artmeta.com.br`
2. Clone o repositório:

```bash
git clone git@github.com:stalinsn/admin-builder.git
cd admin-builder
```

3. Rode o instalador:

```bash
sudo bash ./scripts/install-auth-kit-server.sh
```

4. Responda o passo a passo no terminal.
5. Ao final, o script:
   - prepara o PostgreSQL;
   - grava `.env.local`;
   - roda `npm install`;
   - executa o bootstrap do auth;
   - gera o build;
   - opcionalmente configura PM2, Nginx e UFW.

## O que o instalador não remove

O instalador **não apaga**:

- bancos PostgreSQL já existentes;
- usuários PostgreSQL já existentes fora do nome configurado;
- sites já existentes em `sites-available` e `sites-enabled` do Nginx;
- processos já existentes no PM2;
- regras atuais do firewall.

## O que ele pode alterar

- instala pacotes novos no sistema;
- reinicia o PostgreSQL;
- pode criar/atualizar o banco e o usuário PostgreSQL informados;
- pode criar ou sobrescrever **somente** o server block configurado para este projeto;
- pode registrar **somente** o processo PM2 configurado para este projeto;
- pode ajustar regras do UFW para SSH, Nginx ou porta do app.

## Recomendação de segurança para VPS com outras aplicações

- use nomes exclusivos de banco e usuário PostgreSQL;
- use um nome exclusivo para o processo PM2;
- use um nome exclusivo para o arquivo/site do Nginx;
- só habilite a automação de firewall se quiser que o script trate isso também.
