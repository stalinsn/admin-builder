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
AUTH_KIT_ENV_FILE="${AUTH_KIT_ENV_FILE:-${AUTH_KIT_APP_DIR}/.env.local}"

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

install_app_dependencies() {
  log "Instalando dependências npm do projeto"
  cd "${AUTH_KIT_APP_DIR}"
  npm install --no-fund
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
  npm install -g pm2
}

ensure_nginx() {
  if ! bool_true "${AUTH_KIT_INSTALL_NGINX}"; then
    return 0
  fi

  log "Instalando Nginx"
  apt-get install -y nginx
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl restart nginx
}

print_summary() {
  cat <<EOF

[auth-kit] provisionamento concluído

Aplicação:
  app dir: ${AUTH_KIT_APP_DIR}
  env file: ${AUTH_KIT_ENV_FILE}
  public url: ${AUTH_KIT_PUBLIC_URL}

Banco:
  database: ${AUTH_KIT_DB_NAME}
  user: ${AUTH_KIT_DB_USER}
  password: ${AUTH_KIT_DB_PASSWORD}

Admin inicial:
  email: ${AUTH_KIT_ADMIN_EMAIL}
  nome: ${AUTH_KIT_ADMIN_NAME}
  senha: ${AUTH_KIT_ADMIN_PASSWORD}

Próximos passos sugeridos:
  1. cd ${AUTH_KIT_APP_DIR}
  2. npm run build
  3. npm run start

EOF
}

main() {
  require_root
  require_apt

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
  ensure_pm2
  ensure_nginx
  print_summary
}

main "$@"
