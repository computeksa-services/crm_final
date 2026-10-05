#!/bin/sh
set -eu

# Genera config.js a partir de las variables de entorno del contenedor.
# Permite que una misma imagen sirva para varios entornos: el build de Vite
# ya quedo horneado, pero estos valores se resuelven en cada arranque.
CONFIG_FILE="${CONFIG_FILE:-/usr/share/nginx/html/config.js}"

env_or_empty() {
  eval "printf '%s' \"\${$1:-}\""
}

write_config() {
  cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = {
  VITE_WEBHOOK_URL: "$(env_or_empty VITE_WEBHOOK_URL)",
  VITE_GOOGLE_CLIENT_ID: "$(env_or_empty VITE_GOOGLE_CLIENT_ID)",
  VITE_MICROSOFT_CLIENT_ID: "$(env_or_empty VITE_MICROSOFT_CLIENT_ID)",
  VITE_REDIRECT_URI: "$(env_or_empty VITE_REDIRECT_URI)",
  VITE_GOOGLE_MAPS_API_KEY: "$(env_or_empty VITE_GOOGLE_MAPS_API_KEY)",
  VITE_MICROSOFT_TENANT_ID: "$(env_or_empty VITE_MICROSOFT_TENANT_ID)",
  VITE_MICROSOFT_CRM_CLIENT_ID: "$(env_or_empty VITE_MICROSOFT_CRM_CLIENT_ID)"
};
EOF
}

if [ -z "${VITE_WEBHOOK_URL:-}" ]; then
  echo "aviso: VITE_WEBHOOK_URL no esta definida en el contenedor; revisa las variables de entorno del servicio"
fi

write_config
echo "config: config.js generado con las variables del contenedor"

exec nginx -g "daemon off;"