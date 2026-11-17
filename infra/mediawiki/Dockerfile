ARG MEDIAWIKI_VERSION=1.43.11
FROM mediawiki:${MEDIAWIKI_VERSION}
USER root
COPY infra/mediawiki/LocalSettings.php /opt/archivo/LocalSettings.php
COPY infra/mediawiki/apache-archivo.conf /etc/apache2/conf-available/archivo.conf
COPY infra/mediawiki/entrypoint.sh /opt/archivo/entrypoint.sh
COPY infra/mediawiki/install-wiki.sh /opt/archivo/install-wiki.sh
COPY wiki/extensions/ArchivoEditorial /var/www/html/extensions/ArchivoEditorial
COPY scripts/seed-wiki.php /opt/archivo/scripts/seed-wiki.php
COPY portal/content/catalog.json /opt/archivo/catalog.json
RUN sed -i 's/\r$//' /opt/archivo/*.sh \
    && chmod 755 /opt/archivo/*.sh \
    && a2enconf archivo
ENTRYPOINT ["/opt/archivo/entrypoint.sh"]
CMD ["apache2-foreground"]
