#!/bin/sh
# One-shot initialization. Existing databases must use maintenance/update instead.
set -eu
: "${MW_ADMIN_PASSWORD:?Set MW_ADMIN_PASSWORD in .env}"
: "${MW_DB_PASSWORD:?Set MW_DB_PASSWORD in .env}"
: "${MW_SECRET_KEY:?Set MW_SECRET_KEY in .env}"
: "${MW_UPGRADE_KEY:?Set MW_UPGRADE_KEY in .env}"
if [ -f /var/www/html/LocalSettings.php ]; then
    echo 'Configuration already exists. Use update --quick for upgrades.' >&2
    exit 1
fi
umask 077
admin_file=$(mktemp)
db_file=$(mktemp)
trap 'rm -f "$admin_file" "$db_file"' EXIT HUP INT TERM
printf '%s' "$MW_ADMIN_PASSWORD" > "$admin_file"
printf '%s' "$MW_DB_PASSWORD" > "$db_file"
php maintenance/run.php install \
    --dbtype mysql --dbserver "${MW_DB_HOST:-db}" \
    --dbname "${MW_DB_NAME:-archivo}" --dbuser "${MW_DB_USER:-archivo}" \
    --dbpassfile "$db_file" --passfile "$admin_file" \
    --server "${MW_SERVER:-http://localhost:8080}" --scriptpath /wiki \
    --lang es --confpath /var/www/html \
    "${MW_SITE_NAME:-Archivo de Juego}" "${MW_ADMIN_USER:-Admin}"
printf '\nrequire "/opt/archivo/LocalSettings.php";\n' >> /var/www/html/LocalSettings.php
php maintenance/run.php update --quick
echo 'Wiki initialized. Start the regular wiki and proxy services.'
