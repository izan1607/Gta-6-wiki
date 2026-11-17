# Arquitectura implementada y límites

## Dos capas con responsabilidades distintas

El portal de `portal/` ofrece lectura, búsqueda, filtros y navegación con datos editoriales exportados. MediaWiki es la fuente de verdad para usuarios, roles, artículos, historial, comparación de versiones y discusión. La base de datos no se expone al navegador.

```text
Navegador
  └─ Caddy :8080 (local) / HTTPS :443 (producción)
      ├─ /              → portal/dist, archivos estáticos
      └─ /wiki/*        → MediaWiki 1.43.11 + PHP/Apache
                              └─ MariaDB, red interna sin puerto público

Windows, desarrollo:
  navegador → Node :4173 → /wiki/* → PHP :8081 → SQLite fuera de la raíz web
```

La rama 1.43 figura como LTS en las [descargas oficiales de MediaWiki](https://www.mediawiki.org/wiki/Download); el parche seleccionado es 1.43.11. MariaDB usa [11.4.14, versión estable de la rama LTS 11.4](https://mariadb.com/docs/release-notes/community-server/11.4/11.4.14), y Caddy [2.11.9](https://github.com/caddyserver/caddy/releases/tag/v2.11.9). Hay que actualizar cuando se publique un parche de seguridad, comprobar extensiones y reconstruir la imagen. La configuración de Docker fija etiquetas, no digests; para una entrega reproducible a nivel binario deben registrarse también los digests probados.

El alojamiento estático solo puede publicar el portal lector. No ejecuta PHP ni contiene una base de datos, autenticación o administración MediaWiki. Los enlaces a la wiki requieren alojarla por separado o ejecutar el conjunto local/Docker. La información publicada no se sincroniza automáticamente con un portal estático hasta exportar y reconstruir su catálogo.

## Extensión propia ArchivoEditorial

Ruta: `wiki/extensions/ArchivoEditorial/`. Se instala como extensión de MediaWiki; no es una simulación en localStorage.

`Special:ArchivoEditorial` implementa:

1. El colaborador crea o guarda un borrador privado en `archivo_draft`.
2. El autor lo envía a revisión. Desde ese momento no puede modificarlo mientras se decide.
3. Un editor puede devolverlo con una nota obligatoria o publicarlo.
4. La devolución permite al autor corregir y reenviar.
5. Publicar crea una revisión mediante `WikiPage::newPageUpdater()` y el usuario editor. El historial nativo conserva esa publicación.

Los borradores nunca se guardan en páginas wiki, espacios de nombres, revisiones, búsquedas ni cambios recientes. Solo pueden consultarse a través de la página especial, que exige sesión y verifica en servidor el propietario o permiso editorial. Se muestran como texto escapado, sin ejecutar el parser ni expandir plantillas privadas.

Las mutaciones usan POST y token CSRF de MediaWiki, un límite de peticiones de edición, comprobación de bloqueo del usuario, permisos, consultas parametrizadas por la capa de base de datos y comparación del número de versión. La publicación verifica la revisión base con `PageUpdater::hasEditConflict()` para impedir sobrescribir cambios concurrentes. Si el artículo ha cambiado desde que se creó la propuesta, el editor debe solicitar una propuesta nueva sobre la versión actual.

La auditoría `archivo_audit` registra autor de la operación, fecha, acción e indicación del editor. No es un registro inmutable ni almacena el contenido completo de cada guardado de borrador. El historial completo del texto empieza con su publicación en MediaWiki. Los listados muestran hasta 100 propuestas y 50 eventos por propuesta; una comunidad grande necesitará paginación y política de archivo.

No se instalan FlaggedRevs, Approved Revs ni Moderation. Se evita asumir que una revisión pendiente dentro de páginas normales sea privada.

## Roles

| Rol | Lectura | Propuestas privadas | Publicación | Administración |
| --- | --- | --- | --- | --- |
| Lector/anónimo | Artículos públicos | No | No | No |
| Usuario registrado sin grupo | Artículos públicos | No | No | No |
| `contributor` | Artículos públicos y propuestas propias | Crear, guardar y enviar las propias | No | No |
| `editor` | Artículos públicos y todas las propuestas | Crear y revisar | Aprobar/devolver y editar páginas públicas | No |
| `sysop` | Igual que editor | Igual que editor | Sí | Crear cuentas y asignar contributor/editor |

El registro público está cerrado. El administrador crea cuentas y asigna grupos. Los grupos y registros son los reales de MediaWiki. Las páginas de discusión e historial son nativas y públicas; la edición de discusiones sigue los permisos de editor. No se ofrecen comentarios públicos sin moderar. Los espacios MediaWiki, plantillas y categorías tienen protecciones adicionales.

Los editores pueden editar páginas públicas directamente con las herramientas nativas; ese rol es de confianza. El flujo de propuestas es obligatorio para colaboradores. Para exigir doble revisión también a editores habrá que eliminar la edición directa y añadir una regla de separación de funciones: esta versión permite que un editor publique su propia propuesta.

## API de exportación pública

```text
GET /wiki/api.php?action=archivoexport&format=json&limit=100&from=0
```

```json
{
  "archivoexport": {
    "articles": [
      {
        "pageid": 1,
        "title": "Artículo de ejemplo",
        "content": "Wikitext público con sus fuentes",
        "revision": 10,
        "timestamp": "2026-11-17T12:00:00Z",
        "url": "https://example.invalid/wiki/index.php?title=Art%C3%ADculo_de_ejemplo"
      }
    ],
    "generatedAt": "2026-11-17T12:00:00Z",
    "next": 1
  }
}
```

`next` solo aparece si hay otra página; se usa como `from` en la siguiente petición. `limit` acepta de 1 a 100. Se exportan únicamente revisiones actuales de páginas del espacio principal que un usuario anónimo pueda leer. Se omiten redirecciones, otros modelos de contenido y textos de revisiones ocultos o suprimidos. Ni la consulta ni la respuesta acceden a las tablas privadas de propuestas. El contenido es wikitext, no HTML: un consumidor debe tratarlo como datos y no introducirlo en `innerHTML`.

No se exportan usuarios, correos, credenciales, borradores, notas editoriales ni auditoría. Las páginas públicas del espacio principal son públicamente accesibles también por las APIs estándar de MediaWiki.

### Sincronización con el portal

Desde el repositorio se ejecuta:

```powershell
node portal/scripts/sync-wiki.mjs --endpoint http://127.0.0.1:8081/wiki/api.php
```

Para una wiki remota debe utilizarse su endpoint HTTPS. La herramienta consulta primero `siteinfo`, verifica la instalación y después recorre todas las páginas de `archivoexport` sin enviar cookies ni credenciales. Valida formato, tamaño, cursores crecientes, revisiones, fechas y URLs canónicas. Si falla una página, conserva el snapshot anterior: nunca guarda una exportación parcial.

`portal/content/wiki-pages.json` contiene un snapshot completo, hash del catálogo, revisiones públicas, hash del wikitext y secciones de texto plano. No evalúa plantillas, HTML, scripts, iframes ni tablas wiki. Los enlaces se convierten a texto. Los bloques de datos/evidencia y fuentes se omiten para que la web conserve la clasificación, fechas de verificación y fuentes del catálogo editorial. Publicar una edición no convierte por sí mismo sus afirmaciones en hechos oficialmente verificados.

Las páginas coincidentes se identifican por el título del catálogo, no por un ID proporcionado desde el texto editable. `missingArticleIds` identifica los artículos ya ausentes en una exportación completa, incluidos borrados o convertidos en redirecciones. `unmatched` registra páginas nuevas sin publicar automáticamente contenido que carezca de metadatos revisados en el catálogo. Renombrar una página exige actualizar el título del catálogo y volver a sincronizar. El build del portal debe consumir este snapshot, excluir los artículos ausentes y limpiar las rutas obsoletas antes de generar su salida. Solo después se publica la nueva compilación estática.

Los consumidores del snapshot deben escapar todos sus textos al producir HTML; el proyector conservador de wikitext no sustituye el escape de salida. Las pruebas de `portal/tests/sync-wiki.test.mjs` verifican plantillas/HTML/enlaces, paginación, borrados, páginas sin metadatos y rechazo de URLs y cursores maliciosos.

## Base de datos y configuración

`infra/mediawiki/LocalSettings.php` se configura mediante variables de entorno y puede incluirse al final del archivo generado por el instalador local. Nunca se introducen secretos reales en ese archivo versionado.

| Variable | Uso |
| --- | --- |
| `MW_ENV` | `development` local o `production` con HTTPS obligatorio |
| `MW_SERVER` | Origen externo completo; sin `/wiki` |
| `MW_SCRIPT_PATH` | `/wiki` |
| `MW_DB_TYPE` | `mysql` para MariaDB o `sqlite` local |
| `MW_DB_HOST`, `MW_DB_NAME`, `MW_DB_USER`, `MW_DB_PASSWORD` | Conexión MariaDB |
| `MW_DB_PATH` / `MW_SQLITE_DATA_DIR` | Directorio SQLite fuera de la raíz web |
| `MW_SECRET_KEY`, `MW_UPGRADE_KEY` | Claves persistentes; en desarrollo se conservan las generadas por el instalador |
| `MW_CONTACT_EMAIL` | Correo real del responsable; vacío mantiene correo desactivado |

Después de copiar la extensión y cargar la configuración se ejecuta `php maintenance/run.php update --quick`. El hook de esquema registra dos tablas independientes, con SQL específico de MariaDB/MySQL y SQLite. SQLite es el entorno local de baja concurrencia; producción usa MariaDB.

## Seguridad incluida

- HTML crudo, subidas, imágenes remotas y JavaScript/CSS personal están desactivados. MediaWiki sigue permitiendo el subconjunto seguro de etiquetas de su parser; no equivale a quitar todo el formato HTML seguro.
- Hash Argon2 para contraseñas nuevas o rehashes; MediaWiki conserva compatibilidad con las anteriores del instalador.
- Cookies HttpOnly y SameSite=Lax; Secure y redirección HTTPS en producción.
- OATHAuth de la misma distribución para 2FA obligatorio de los grupos administrativos `sysop`, `bureaucrat` e `interface-admin` en producción. Sin inscripción de 2FA se suspenden sus permisos privilegiados y se permite activar el segundo factor. El arranque de producción falla si falta esta extensión; desarrollo permite acceder sin 2FA para configurar la prueba local.
- Permisos y tokens nativos, límites de edición, registro público cerrado y revisión de propuestas en servidor.
- CSP de MediaWiki compatible con ResourceLoader y CSP separada para el portal. ResourceLoader conserva necesidades heredadas de scripts/evaluación y estilos; no se afirma una política de nonces estricta.
- Caddy añade X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy. La configuración pública añade HSTS y certificados TLS automáticos.
- MariaDB sin puerto publicado en una red interna, y proxy local ligado a `127.0.0.1`.
- Apache bloquea directorios de mantenimiento, código interno, instalador web, SQL y archivos sensibles.

`compose.yaml` sirve desarrollo local con HTTP en `http://localhost:8080`. La variante `infra/compose.production.yaml`, combinada con el archivo base, requiere `SITE_DOMAIN` real, DNS y puertos 80/443 disponibles. Deben sustituirse todos los ejemplos de contraseña y completar el responsable legal antes de hacer público el servicio.

En ambos modos Docker, Caddy responde `/runtime.json` con JSON `{"wikiAvailable":true}` y `Cache-Control: no-store`: este indicador declara que la ruta al backend está configurada; el cliente debe confirmar su respuesta real mediante `siteinfo` antes de mostrar las herramientas de edición. El artefacto estático mantiene su indicador desactivado. El portal usa CSP sin `unsafe-inline`, separada de la de MediaWiki. Las rutas inexistentes se sirven con `404.html` y estado HTTP 404 mediante [`handle_errors`](https://caddyserver.com/docs/caddyfile/directives/handle_errors), sin convertirlas en la portada con un estado 200.

El archivo de configuración no convierte el sistema en inmune a OWASP Top 10. WAF/CDN, protección DDoS del proveedor, copias externas programadas, monitorización, SMTP y pruebas de restauración necesitan configuración de infraestructura operativa. Tampoco están desplegados por estos archivos. Una revisión externa de seguridad e intelectual sigue siendo necesaria antes de abrir colaboración o monetización.

## Instalación y referencias

Consulta `docs/despliegue.md` para el arranque e importación del catálogo. La imagen usa un comando de instalación inicial separado, `docker compose run --rm wiki install-wiki`, que no se debe repetir contra una base ya instalada. Las actualizaciones usan el mantenedor de MediaWiki.

La integración se basa en la [API PageUpdater de REL1_43](https://doc.wikimedia.org/mediawiki-core/REL1_43/php/classMediaWiki_1_1Storage_1_1PageUpdater.html), el [hook de actualización de esquema](https://www.mediawiki.org/wiki/Manual:Hooks/LoadExtensionSchemaUpdates), el [control de permisos](https://www.mediawiki.org/wiki/Manual:User_rights) y [OATHAuth](https://www.mediawiki.org/wiki/Extension:OATHAuth). Las pruebas efectuadas y sus límites se registran en la entrega; la existencia de un Dockerfile no significa que se haya construido o probado el despliegue MariaDB.
