#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

AUTH_KIT_APP_DIR="${AUTH_KIT_APP_DIR:-${APP_DIR}}"
AUTH_KIT_NODE_MAJOR="${AUTH_KIT_NODE_MAJOR:-22}"
AUTH_KIT_DB_NAME="${AUTH_KIT_DB_NAME:-auth_kit}"
AUTH_KIT_DB_USER="${AUTH_KIT_DB_USER:-auth_kit}"
AUTH_KIT_DB_PASSWORD="${AUTH_KIT_DB_PASSWORD:-}"
AUTH_KIT_ADMIN_EMAIL="${AUTH_KIT_ADMIN_EMAIL:-admin@localhost}"
AUTH_KIT_ADMIN_NAME="${AUTH_KIT_ADMIN_NAME:-Administrador Inicial}"
AUTH_KIT_ADMIN_PASSWORD="${AUTH_KIT_ADMIN_PASSWORD:-}"
AUTH_KIT_PORT="${AUTH_KIT_PORT:-3000}"
AUTH_KIT_HOST="${AUTH_KIT_HOST:-0.0.0.0}"
AUTH_KIT_PUBLIC_URL="${AUTH_KIT_PUBLIC_URL:-http://127.0.0.1:${AUTH_KIT_PORT}}"
AUTH_KIT_SEED_DEFAULT_PANEL_USERS="${AUTH_KIT_SEED_DEFAULT_PANEL_USERS:-false}"
AUTH_KIT_INSTALL_PM2="${AUTH_KIT_INSTALL_PM2:-false}"
AUTH_KIT_INSTALL_NGINX="${AUTH_KIT_INSTALL_NGINX:-false}"
AUTH_KIT_CONFIGURE_FIREWALL="${AUTH_KIT_CONFIGURE_FIREWALL:-false}"
AUTH_KIT_ENABLE_UFW="${AUTH_KIT_ENABLE_UFW:-false}"
AUTH_KIT_INTERACTIVE="${AUTH_KIT_INTERACTIVE:-auto}"
AUTH_KIT_ENV_FILE="${AUTH_KIT_ENV_FILE:-${AUTH_KIT_APP_DIR}/.env.local}"
AUTH_KIT_DOMAIN="${AUTH_KIT_DOMAIN:-}"
AUTH_KIT_PM2_APP_NAME="${AUTH_KIT_PM2_APP_NAME:-}"
AUTH_KIT_NGINX_SITE_NAME="${AUTH_KIT_NGINX_SITE_NAME:-}"

log() {
  printf '[auth-kit] %s\n' "$1"
}

fail() {
  printf '[auth-kit] erro: %s\n' "$1" >&2
  exit 1
}

bool_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

supports_interactive() {
  [ -t 0 ] && [ -t 1 ]
}

is_interactive_mode() {
  if bool_true "${AUTH_KIT_INTERACTIVE}"; then
    return 0
  fi

  if [ "${AUTH_KIT_INTERACTIVE}" = "auto" ] && supports_interactive; then
    return 0
  fi

  return 1
}

derive_domain_from_public_url() {
  if [ -n "${AUTH_KIT_DOMAIN}" ]; then
    return 0
  fi

  AUTH_KIT_DOMAIN="$(printf '%s' "${AUTH_KIT_PUBLIC_URL}" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##; s#:[0-9]+$##')"
}

slugify_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's#[^a-z0-9]+#-#g; s#(^-+|-+$)##g'
}

prompt_text() {
  local label="$1"
  local current="$2"
  local allow_blank="${3:-false}"
  local secret="${4:-false}"
  local value=""

  while true; do
    if bool_true "${secret}"; then
      if [ -n "${current}" ]; then
        printf '%s [%s]: ' "${label}" 'preenchido'
      else
        printf '%s: ' "${label}"
      fi
      read -rs value
      printf '\n'
      if [ -z "${value}" ]; then
        value="${current}"
      fi
    else
      if [ -n "${current}" ]; then
        printf '%s [%s]: ' "${label}" "${current}"
      else
        printf '%s: ' "${label}"
      fi
      read -r value
      if [ -z "${value}" ]; then
        value="${current}"
      fi
    fi

    if [ -n "${value}" ] || bool_true "${allow_blank}"; then
      printf '%s' "${value}"
      return 0
    fi

    printf '[auth-kit] valor obrigatório.\n'
  done
}

prompt_bool() {
  local label="$1"
  local current="$2"
  local normalized="false"
  local suffix='y/N'
  local answer=""

  if bool_true "${current}"; then
    normalized="true"
    suffix='Y/n'
  fi

  while true; do
    printf '%s [%s]: ' "${label}" "${suffix}"
    read -r answer
    answer="${answer:-}"

    if [ -z "${answer}" ]; then
      printf '%s' "${normalized}"
      return 0
    fi

    case "${answer}" in
      y|Y|yes|YES|s|S|sim|SIM) printf 'true'; return 0 ;;
      n|N|no|NO|nao|NAO|não|NÃO) printf 'false'; return 0 ;;
    esac

    printf '[auth-kit] responda com y/n.\n'
  done
}

require_root() {
  if [ "${EUID}" -ne 0 ]; then
    fail "execute este script como root."
  fi
}

require_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    fail "este instalador foi preparado para Ubuntu/Debian com apt-get."
  fi
}

random_secret() {
  openssl rand -hex 32
}

ensure_system_packages() {
  log "Instalando dependências base do sistema"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release git build-essential postgresql postgresql-contrib
}

ensure_node() {
  local current_major=""
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
  fi

  if [ -n "${current_major}" ] && [ "${current_major}" -ge "${AUTH_KIT_NODE_MAJOR}" ]; then
    log "Node.js ${current_major} já atende ao mínimo configurado"
    return 0
  fi

  log "Instalando Node.js ${AUTH_KIT_NODE_MAJOR}"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' "${AUTH_KIT_NODE_MAJOR}" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
}

ensure_postgres_service() {
  log "Garantindo serviço do PostgreSQL"
  systemctl enable postgresql >/dev/null 2>&1 || true
  systemctl restart postgresql
}

postgres_exec() {
  runuser -u postgres -- psql "$@"
}

ensure_database() {
  if [ -z "${AUTH_KIT_DB_PASSWORD}" ]; then
    AUTH_KIT_DB_PASSWORD="$(random_secret)"
  fi

  log "Garantindo role ${AUTH_KIT_DB_USER}"
  if ! postgres_exec -tAc "SELECT 1 FROM pg_roles WHERE rolname='${AUTH_KIT_DB_USER}'" | grep -q 1; then
    postgres_exec -c "CREATE ROLE ${AUTH_KIT_DB_USER} WITH LOGIN PASSWORD '${AUTH_KIT_DB_PASSWORD}';"
  else
    postgres_exec -c "ALTER ROLE ${AUTH_KIT_DB_USER} WITH LOGIN PASSWORD '${AUTH_KIT_DB_PASSWORD}';"
  fi

  log "Garantindo database ${AUTH_KIT_DB_NAME}"
  if ! postgres_exec -tAc "SELECT 1 FROM pg_database WHERE datname='${AUTH_KIT_DB_NAME}'" | grep -q 1; then
    postgres_exec -c "CREATE DATABASE ${AUTH_KIT_DB_NAME} OWNER ${AUTH_KIT_DB_USER};"
  fi

  postgres_exec -d "${AUTH_KIT_DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${AUTH_KIT_DB_NAME} TO ${AUTH_KIT_DB_USER};" >/dev/null
  postgres_exec -d "${AUTH_KIT_DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${AUTH_KIT_DB_USER};" >/dev/null
}

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  touch "${file}"
  if grep -q "^${key}=" "${file}"; then
    sed -i "s#^${key}=.*#${key}=${value}#g" "${file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

ensure_env_file() {
  local customer_data_secret
  customer_data_secret="$(random_secret)"

  log "Escrevendo variáveis de ambiente em ${AUTH_KIT_ENV_FILE}"
  install -d -m 0755 "$(dirname "${AUTH_KIT_ENV_FILE}")"

  upsert_env "${AUTH_KIT_ENV_FILE}" "NODE_ENV" "production"
  upsert_env "${AUTH_KIT_ENV_FILE}" "PORT" "${AUTH_KIT_PORT}"
  upsert_env "${AUTH_KIT_ENV_FILE}" "HOSTNAME" "${AUTH_KIT_HOST}"
  upsert_env "${AUTH_KIT_ENV_FILE}" "ECOMMPANEL_DB_RUNTIME_MODE" "env"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_HOST" "127.0.0.1"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_PORT" "5432"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_NAME" "${AUTH_KIT_DB_NAME}"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_USER" "${AUTH_KIT_DB_USER}"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_PASSWORD" "${AUTH_KIT_DB_PASSWORD}"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_PASSWORD_REFERENCE" "APP_DB_PASSWORD"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_DB_SSL_MODE" "disable"
  upsert_env "${AUTH_KIT_ENV_FILE}" "APP_CUSTOMER_DATA_SECRET" "${customer_data_secret}"
  upsert_env "${AUTH_KIT_ENV_FILE}" "PANEL_AUTH_BASE_URL" "${AUTH_KIT_PUBLIC_URL}"
}

interactive_setup() {
  derive_domain_from_public_url

  if [ -z "${AUTH_KIT_PM2_APP_NAME}" ]; then
    AUTH_KIT_PM2_APP_NAME="$(slugify_name "$(basename "${AUTH_KIT_APP_DIR}")")"
  fi

  if [ -z "${AUTH_KIT_NGINX_SITE_NAME}" ]; then
    AUTH_KIT_NGINX_SITE_NAME="${AUTH_KIT_DOMAIN:-$(slugify_name "$(basename "${AUTH_KIT_APP_DIR}")")}"
  fi

  printf '\n[auth-kit] instalador interativo\n\n'

  AUTH_KIT_APP_DIR="$(prompt_text 'Diretório da aplicação' "${AUTH_KIT_APP_DIR}")"
  AUTH_KIT_DOMAIN="$(prompt_text 'Domínio ou subdomínio público' "${AUTH_KIT_DOMAIN}")"
  AUTH_KIT_PORT="$(prompt_text 'Porta local da aplicação' "${AUTH_KIT_PORT}")"
  AUTH_KIT_HOST="$(prompt_text 'Host local da aplicação' "${AUTH_KIT_HOST}")"
  AUTH_KIT_PUBLIC_URL="https://${AUTH_KIT_DOMAIN}"
  AUTH_KIT_DB_NAME="$(prompt_text 'Nome do banco PostgreSQL' "${AUTH_KIT_DB_NAME}")"
  AUTH_KIT_DB_USER="$(prompt_text 'Usuário PostgreSQL do projeto' "${AUTH_KIT_DB_USER}")"
  AUTH_KIT_DB_PASSWORD="$(prompt_text 'Senha do usuário PostgreSQL (vazio = gerar automática)' "${AUTH_KIT_DB_PASSWORD}" true true)"
  AUTH_KIT_ADMIN_EMAIL="$(prompt_text 'E-mail do admin inicial' "${AUTH_KIT_ADMIN_EMAIL}")"
  AUTH_KIT_ADMIN_NAME="$(prompt_text 'Nome do admin inicial' "${AUTH_KIT_ADMIN_NAME}")"
  AUTH_KIT_ADMIN_PASSWORD="$(prompt_text 'Senha do admin inicial (vazio = gerar automática)' "${AUTH_KIT_ADMIN_PASSWORD}" true true)"
  AUTH_KIT_SEED_DEFAULT_PANEL_USERS="$(prompt_bool 'Criar usuários padrão do painel?' "${AUTH_KIT_SEED_DEFAULT_PANEL_USERS}")"
  AUTH_KIT_INSTALL_PM2="$(prompt_bool 'Configurar PM2 automaticamente?' "${AUTH_KIT_INSTALL_PM2}")"

  if bool_true "${AUTH_KIT_INSTALL_PM2}"; then
    AUTH_KIT_PM2_APP_NAME="$(prompt_text 'Nome do processo no PM2' "${AUTH_KIT_PM2_APP_NAME}")"
  fi

  AUTH_KIT_INSTALL_NGINX="$(prompt_bool 'Criar server block do Nginx automaticamente?' "${AUTH_KIT_INSTALL_NGINX}")"

  if bool_true "${AUTH_KIT_INSTALL_NGINX}"; then
    AUTH_KIT_NGINX_SITE_NAME="$(prompt_text 'Nome do arquivo do site no Nginx' "${AUTH_KIT_NGINX_SITE_NAME}")"
  fi

  AUTH_KIT_CONFIGURE_FIREWALL="$(prompt_bool 'Configurar regras do firewall UFW automaticamente?' "${AUTH_KIT_CONFIGURE_FIREWALL}")"

  if bool_true "${AUTH_KIT_CONFIGURE_FIREWALL}"; then
    AUTH_KIT_ENABLE_UFW="$(prompt_bool 'Se o UFW estiver inativo, habilitar automaticamente?' "${AUTH_KIT_ENABLE_UFW}")"
  fi

  cat <<EOF

[auth-kit] revisão final

Aplicação:
  diretório: ${AUTH_KIT_APP_DIR}
  domínio: ${AUTH_KIT_DOMAIN}
  url pública: ${AUTH_KIT_PUBLIC_URL}
  host: ${AUTH_KIT_HOST}
  porta: ${AUTH_KIT_PORT}

Banco:
  database: ${AUTH_KIT_DB_NAME}
  user: ${AUTH_KIT_DB_USER}
  password: $( [ -n "${AUTH_KIT_DB_PASSWORD}" ] && printf 'definida' || printf 'gerar automática' )

Admin inicial:
  email: ${AUTH_KIT_ADMIN_EMAIL}
  nome: ${AUTH_KIT_ADMIN_NAME}
  senha: $( [ -n "${AUTH_KIT_ADMIN_PASSWORD}" ] && printf 'definida' || printf 'gerar automática' )

Automação:
  seed usuários padrão: ${AUTH_KIT_SEED_DEFAULT_PANEL_USERS}
  PM2: ${AUTH_KIT_INSTALL_PM2}$( bool_true "${AUTH_KIT_INSTALL_PM2}" && printf ' (%s)' "${AUTH_KIT_PM2_APP_NAME}" )
  Nginx: ${AUTH_KIT_INSTALL_NGINX}$( bool_true "${AUTH_KIT_INSTALL_NGINX}" && printf ' (%s)' "${AUTH_KIT_NGINX_SITE_NAME}" )
  Firewall UFW: ${AUTH_KIT_CONFIGURE_FIREWALL}$( bool_true "${AUTH_KIT_CONFIGURE_FIREWALL}" && printf ' (enable=%s)' "${AUTH_KIT_ENABLE_UFW}" )

EOF

  local confirmed
  confirmed="$(prompt_bool 'Confirmar e aplicar essa instalação?' true)"
  if ! bool_true "${confirmed}"; then
    fail "instalação cancelada antes de aplicar alterações."
  fi
}

install_app_dependencies() {
  log "Instalando dependências npm do projeto"
  cd "${AUTH_KIT_APP_DIR}"
  npm install --no-fund
}

build_app() {
  log "Gerando build de produção"
  cd "${AUTH_KIT_APP_DIR}"
  npm run build
}

run_auth_bootstrap() {
  log "Executando bootstrap do auth kit"
  cd "${AUTH_KIT_APP_DIR}"

  local args=(
    "run" "auth-kit:bootstrap" "--"
    "--admin-email=${AUTH_KIT_ADMIN_EMAIL}"
    "--admin-name=${AUTH_KIT_ADMIN_NAME}"
    "--admin-password=${AUTH_KIT_ADMIN_PASSWORD}"
  )

  if bool_true "${AUTH_KIT_SEED_DEFAULT_PANEL_USERS}"; then
    args+=("--seed-default-panel-users")
  fi

  npm "${args[@]}"
}

ensure_pm2() {
  if ! bool_true "${AUTH_KIT_INSTALL_PM2}"; then
    return 0
  fi

  log "Instalando PM2"
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi

  log "Registrando aplicação no PM2"
  cd "${AUTH_KIT_APP_DIR}"
  if pm2 describe "${AUTH_KIT_PM2_APP_NAME}" >/dev/null 2>&1; then
    pm2 restart "${AUTH_KIT_PM2_APP_NAME}" --update-env
  else
    pm2 start npm --name "${AUTH_KIT_PM2_APP_NAME}" --cwd "${AUTH_KIT_APP_DIR}" -- start
  fi
  pm2 save >/dev/null 2>&1 || true
}

ensure_nginx() {
  if ! bool_true "${AUTH_KIT_INSTALL_NGINX}"; then
    return 0
  fi

  log "Instalando Nginx"
  apt-get install -y nginx

  local site_available="/etc/nginx/sites-available/${AUTH_KIT_NGINX_SITE_NAME}"
  local site_enabled="/etc/nginx/sites-enabled/${AUTH_KIT_NGINX_SITE_NAME}"
  local backup_suffix
  backup_suffix="$(date +%Y%m%d%H%M%S)"

  if [ -f "${site_available}" ]; then
    cp "${site_available}" "${site_available}.bak.${backup_suffix}"
  fi

  cat > "${site_available}" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${AUTH_KIT_DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${AUTH_KIT_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF

  ln -sfn "${site_available}" "${site_enabled}"
  nginx -t
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl reload nginx || systemctl restart nginx
}

configure_firewall() {
  if ! bool_true "${AUTH_KIT_CONFIGURE_FIREWALL}"; then
    return 0
  fi

  log "Configurando regras do UFW"
  apt-get install -y ufw

  ufw allow OpenSSH >/dev/null 2>&1 || true
  if bool_true "${AUTH_KIT_INSTALL_NGINX}"; then
    ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  else
    ufw allow "${AUTH_KIT_PORT}/tcp" >/dev/null 2>&1 || true
  fi

  if ufw status | grep -qi "Status: active"; then
    ufw reload >/dev/null 2>&1 || true
    return 0
  fi

  if bool_true "${AUTH_KIT_ENABLE_UFW}"; then
    ufw --force enable >/dev/null 2>&1
  fi
}

print_summary() {
  cat <<EOF

[auth-kit] provisionamento concluído

Aplicação:
  app dir: ${AUTH_KIT_APP_DIR}
  env file: ${AUTH_KIT_ENV_FILE}
  public url: ${AUTH_KIT_PUBLIC_URL}
  porta: ${AUTH_KIT_PORT}

Banco:
  database: ${AUTH_KIT_DB_NAME}
  user: ${AUTH_KIT_DB_USER}
  password: ${AUTH_KIT_DB_PASSWORD}

Admin inicial:
  email: ${AUTH_KIT_ADMIN_EMAIL}
  nome: ${AUTH_KIT_ADMIN_NAME}
  senha: ${AUTH_KIT_ADMIN_PASSWORD}

Automação:
  pm2: ${AUTH_KIT_INSTALL_PM2}$( bool_true "${AUTH_KIT_INSTALL_PM2}" && printf ' (%s)' "${AUTH_KIT_PM2_APP_NAME}" )
  nginx: ${AUTH_KIT_INSTALL_NGINX}$( bool_true "${AUTH_KIT_INSTALL_NGINX}" && printf ' (%s)' "${AUTH_KIT_NGINX_SITE_NAME}" )
  firewall: ${AUTH_KIT_CONFIGURE_FIREWALL}

Próximos passos sugeridos:
  1. acessar ${AUTH_KIT_PUBLIC_URL}
  2. entrar com o admin inicial
  3. modelar o domínio no Data Studio

EOF
}

main() {
  require_root
  require_apt

  if is_interactive_mode; then
    interactive_setup
  else
    derive_domain_from_public_url
  fi

  if [ ! -f "${AUTH_KIT_APP_DIR}/package.json" ]; then
    fail "não encontrei package.json em ${AUTH_KIT_APP_DIR}. Clone ou copie o repositório antes de rodar o instalador."
  fi

  if [ -z "${AUTH_KIT_ADMIN_PASSWORD}" ]; then
    AUTH_KIT_ADMIN_PASSWORD="$(random_secret)"
  fi

  ensure_system_packages
  ensure_node
  ensure_postgres_service
  ensure_database
  ensure_env_file
  install_app_dependencies
  run_auth_bootstrap
  build_app
  ensure_pm2
  ensure_nginx
  configure_firewall
  print_summary
}

main "$@"
