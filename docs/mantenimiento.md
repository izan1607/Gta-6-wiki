# Mantenimiento y actualización

## Publicar una novedad oficial

1. Localiza la publicación original de Rockstar o Take-Two y verifica emisor, URL y fecha. No tomes un titular de terceros como confirmación.
2. Separa las afirmaciones concretas. Guarda fuente, sección o minuto de evidencia, fecha del acontecimiento, fecha de publicación y fecha de consulta. Si falta respaldo, usa `[PENDIENTE DE VERIFICAR]` y explica qué consultar.
3. Revisa si el nuevo anuncio sustituye a un dato anterior. Conserva la cronología; no sobrescribas la fecha de un anuncio pasado como si nunca hubiera existido.
4. Redacta texto propio. No subas capturas, logos, música, miniaturas oficiales ni filtraciones. Comprueba la licencia y procedencia de cualquier ilustración incorporada.
5. Propón el cambio en ArchivoEditorial, conserva el borrador y envíalo a revisión. Un editor debe contrastar evidencia, etiquetas y diferencias antes de publicar. Comprueba que una propuesta pendiente no se vea en páginas, búsqueda o exportación pública.
6. Actualiza el catálogo del portal a partir de lo publicado, ejecuta su validación y revisa enlaces internos, filtros y fecha de verificación. Construye y publica el portal; comprueba el resultado de la publicación.

## Operación periódica

- Revisa intentos de autenticación fallidos, peticiones limitadas, errores del motor y eventos de moderación. Evita copiar IP, correo o textos privados a herramientas de seguimiento públicas.
- Examina avisos de seguridad del runtime, MediaWiki, MariaDB y extensiones. Actualiza las versiones fijadas mediante un cambio revisable; no descargues automáticamente «latest» en producción.
- Programa los trabajos de MediaWiki con un ejecutor del servidor y supervisa su resultado. Ajusta frecuencia y límite según la carga, en lugar de ejecutar indefinidamente desde una petición web.
- Comprueba el canal de contacto y retirada, las cuentas de administradores y el acceso a las copias. Retira permisos que ya no se necesiten.

## Copias y recuperación

El código del repositorio no contiene la información editorial completa: MediaWiki conserva contenido, historial, usuarios y propuestas en la base de datos. Una exportación XML de artículos tampoco sustituye a la copia completa de la base. La guía de [copias de MediaWiki](https://www.mediawiki.org/wiki/Manual:Backing_up_a_wiki) distingue base de datos y archivos de configuración.

Para desarrollo SQLite, detén el servidor PHP antes de copiar `.runtime/data` y el `LocalSettings.php` generado a un destino privado fuera del directorio servido. No copies una base activa como si fuera un archivo estático; podrían existir archivos WAL y cambios pendientes. Prueba la restauración en otro directorio y con el origen local adecuado.

En MariaDB, utiliza un volcado consistente adecuado al motor y una cuenta dedicada; copia también configuración y secretos cifrados mediante un canal separado. Como política inicial a adaptar al volumen: copia diaria, siete copias diarias y cuatro semanales, al menos una copia cifrada fuera del host, y ensayo mensual de restauración. Es una propuesta operativa que debe configurarse en el alojamiento; escribirla no activa ninguna tarea programada. Objetivos iniciales: pérdida máxima tolerada de 24 horas y recuperación en cuatro horas, pendientes de comprobar en un ensayo.

Restauración:

1. Aísla la instancia afectada y conserva registros útiles de forma privada.
2. Arranca una instancia limpia con las mismas versiones del último respaldo conocido.
3. Restaura base y configuración compatibles, ajustando origen y secretos de entorno.
4. Verifica artículos, historial, usuarios, propuestas privadas y permisos; prueba autenticación y revisión editorial.
5. Habilita escrituras y tráfico cuando las verificaciones hayan pasado. Registra qué copia se usó y qué contenido posterior necesita recuperación.

## Actualizaciones y cambios de alcance

Antes de migrar, revisa las notas oficiales, compatibilidad PHP y extensión, realiza copia y prueba en staging. Después ejecuta la actualización del esquema y revisa los registros. La [guía de actualización de MediaWiki](https://www.mediawiki.org/wiki/Manual:Upgrading) describe la secuencia; deshacer el código no siempre revierte una migración de base de datos.

Documenta decisiones nuevas en `docs/arquitectura.md`. Mantén el esquema del catálogo compatible o migra sus consumidores juntos. Las nuevas plantillas deben conservar el vínculo entre cada afirmación y su evidencia. Actualiza las políticas si cambian responsables, servicios, anuncios, afiliados o tratamientos de datos. Revisa el inventario de fuentes y las comprobaciones legales antes de cambiar nombre o dominio.
