# Arranque y despliegue

El proyecto separa el portal lector (`portal/`) del motor editorial MediaWiki. El portal puede publicarse como sitio estático con su catálogo revisado. Para cuentas, propuestas, revisión, publicación, discusión e historial reales también debe arrancarse MediaWiki. Publicar solo el portal no proporciona esos servicios.

## Desarrollo local en Windows

Requisitos: Node.js 24 o versión compatible con el portal; PHP 8.3 x64 portable con `mbstring`, `intl`, `sqlite3`, `pdo_sqlite`, `fileinfo`, `openssl`, DOM y XML; MediaWiki 1.43 LTS. PHP y MediaWiki no se incorporan al repositorio. Usa paquetes oficiales y verifica el checksum publicado antes de extraerlos: [PHP para Windows](https://windows.php.net/download/) y [MediaWiki](https://www.mediawiki.org/wiki/Download).

Estructura esperada:

```text
.runtime/
  php/php.exe
  php/ext/
  site/wiki/index.php
  site/wiki/maintenance/run.php
```

Desde la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

La opción de política afecta únicamente a ese proceso y permite ejecutar el script revisado sin modificar la política global. El script no descarga software. Solicita la contraseña inicial del administrador de forma oculta, crea SQLite en `.runtime/data`, configura PHP, añade la configuración del proyecto, copia ArchivoEditorial, actualiza el esquema e importa los artículos revisados del catálogo. La contraseña se transmite a PHP por stdin; no se añade a los argumentos ni se guarda en un archivo temporal. Las claves de MediaWiki quedan en el `LocalSettings.php` local generado y no deben salir de `.runtime`.

Si el motor ya está instalado, se conserva la cuenta y no se solicita de nuevo su contraseña. La importación inicial conserva todas las páginas existentes. `-SkipSeed` omite la importación si el catálogo todavía no está preparado. Una instalación o migración que falle requiere revisar el error antes de repetir operaciones sobre la misma base de datos; no borres datos para ocultar un error.

Para elegir una contraseña propia después de una instalación de prueba, o recuperar el acceso local sin correo, utiliza:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1 -ResetAdminPassword -SkipSeed
```

Solicita la contraseña de forma oculta, comprueba que la cuenta indicada sea administradora e invalida sus sesiones anteriores. Si cambiaste el nombre inicial, añade `-AdminUser NombreElegido`. No modifica los artículos ni crea una cuenta nueva al restablecer una cuenta inexistente.

Arranca MediaWiki en una terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Escucha en `127.0.0.1:8081`; no expone PHP en la red local. En otra terminal arranca el portal:

```powershell
npm.cmd --prefix portal run dev
```

El uso de `npm.cmd` evita depender de la política de ejecución del wrapper `npm.ps1`. El portal debe servir en `http://127.0.0.1:4173` y reenviar `/wiki/` al puerto 8081. Usa siempre el origen del portal para navegar, iniciar sesión y gestionar las propuestas; así coinciden cookies, redirecciones y protección CSRF. Si se cambia el puerto del portal, pasa el mismo `-PublicOrigin` a setup y start. Un cambio del puerto de PHP también requiere actualizar el destino del proxy del portal.

Rutas del motor:

- `/wiki/index.php?title=Special:UserLogin`: autenticación.
- `/wiki/index.php?title=Special:ArchivoEditorial`: propuestas y cola editorial según permisos.
- `/wiki/index.php?title=Special:RecentChanges`: cambios de páginas publicadas.
- `/wiki/api.php?action=archivoexport&format=json`: exportación de artículos publicados; no de borradores.

Para detener los servidores, utiliza `Ctrl+C` en sus respectivas terminales. El servidor integrado de PHP se usa exclusivamente en desarrollo; la producción debe utilizar un servidor web preparado para ese entorno.

## Importación de contenido y datos persistentes

El catálogo de origen está en `portal/content/catalog.json`. Una importación no significa que la wiki y el JSON se sincronicen automáticamente en ambos sentidos. Después de una publicación editorial se debe revisar y actualizar el catálogo del portal, validarlo y volver a construir/publicar el portal. La API de exportación ayuda a consultar el contenido publicado; no publica automáticamente la interfaz estática.

Importación manual de páginas nuevas, con la configuración de entorno de `start-local.ps1` aplicada en la sesión correspondiente:

```powershell
.runtime/php/php.exe .runtime/site/wiki/maintenance/run.php ./scripts/seed-wiki.php --catalog=portal/content/catalog.json
```

La opción `--refresh` permite actualizar páginas ya existentes creando una revisión adicional. Úsala solo tras revisar la diferencia entre el catálogo y la versión editorial. No elimina el historial; sí puede sustituir el texto vigente por el del catálogo.

## Producción con contenedores

`compose.yaml` prepara el portal, el proxy, MediaWiki y MariaDB. Crea un `.env` local a partir de `.env.example` y sustituye todos los ejemplos de claves y contraseñas por valores aleatorios distintos. Configura `MW_SERVER` con el origen real. No publiques ese archivo. Para una primera instalación con Docker disponible:

```powershell
docker compose up -d db
docker compose run --rm wiki install-wiki
docker compose up -d
```

La orden `install-wiki` es el bootstrap de la imagen del proyecto: usa el instalador oficial sin una configuración previa, incorpora después los ajustes del proyecto y actualiza el esquema. Ejecuta esa orden solo al inicializar una base nueva; no es un procedimiento de actualización ni de restauración. En actualizaciones se conserva la base y se ejecuta el mantenimiento correspondiente en una instancia de pruebas primero.

Para importar las páginas del catálogo dentro del motor del contenedor:

```powershell
docker compose exec wiki php maintenance/run.php /opt/archivo/scripts/seed-wiki.php --catalog=/opt/archivo/catalog.json
```

Comprueba las rutas de montaje de `compose.yaml` si has cambiado el diseño de la imagen. Los volúmenes de MariaDB contienen artículos, revisiones, usuarios y propuestas; no los elimines con comandos como `docker compose down -v` para actualizar el código.

Antes de exponer una instancia: configura un dominio y HTTPS reales; genera claves diferentes a las locales; guarda secretos mediante el mecanismo seguro del host; restringe los puertos internos; configura correo para recuperación de cuentas; crea los roles y exige 2FA a administradores; completa los datos del responsable y el canal de reclamaciones; revisa las políticas legales y el uso efectivo de servicios externos. No reutilices la base SQLite o contraseñas de desarrollo en producción.

El HSTS solo debe activarse cuando el dominio y HTTPS funcionen de manera estable. La configuración de proxy y CSP debe probarse también en páginas de inicio de sesión, recuperación, discusión y edición; una cabecera presente no demuestra por sí sola que la aplicación esté protegida.

## Entornos y entrega

Mantén una instancia de pruebas con datos anonimizados y secretos distintos. Ejecuta allí las migraciones y las pruebas de permisos antes de producción. Una entrega debe registrar la revisión de código, versiones de runtime y motor, fecha del catálogo y resultado de las comprobaciones. Las migraciones se ejecutan una sola vez por despliegue, con copia recuperable previa.

Una vista previa privada del portal sirve para revisar diseño y contenido. No equivale a un lanzamiento público de la wiki editorial. Los pasos reales ejecutados y sus limitaciones se deben registrar en la entrega, sin dar por validados servicios que no se hayan arrancado.

Referencias: [instalador CLI de MediaWiki](https://www.mediawiki.org/wiki/Manual:Install.php), [scripts de mantenimiento](https://www.mediawiki.org/wiki/Manual:Maintenance_scripts) y [actualización del esquema](https://www.mediawiki.org/wiki/Manual:Update.php).
