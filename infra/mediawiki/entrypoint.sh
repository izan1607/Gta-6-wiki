#!/bin/sh
set -eu
if [ "${1:-}" = "install-wiki" ]; then
    exec /opt/archivo/install-wiki.sh
fi
if [ ! -f /var/www/html/LocalSettings.php ]; then
    cp /opt/archivo/LocalSettings.php /var/www/html/LocalSettings.php
fi
exec docker-php-entrypoint "$@"
