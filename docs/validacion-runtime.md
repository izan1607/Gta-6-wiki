# Validación del motor editorial

Pruebas ejecutadas el 17 de noviembre de 2026 en Windows, con PHP 8.3.36, MediaWiki 1.43.11 y SQLite. El servidor PHP se ha arrancado en loopback, puerto 8081; el origen público configurado para el proxy del portal es `http://127.0.0.1:4173`.

## Resultados

- Instalación mediante `scripts/setup-local.ps1`: esquema del núcleo, ArchivoEditorial y OATHAuth creados correctamente. Se importaron los 16 artículos del catálogo.
- Segunda ejecución del setup: conservó los 16 artículos existentes. El restablecimiento de contraseña por stdin funcionó e invalidó las sesiones previas.
- Integración PHP: **23 comprobaciones aprobadas**, incluyendo roles, autoría y privacidad de propuestas, espacios de nombres restringidos, versiones de borrador, devolución con nota, publicación de una revisión real, atribución al editor, secuencia de auditoría y conflicto con una revisión pública concurrente. La precarga de artículos se verificó contra una revisión pública y se comprobó que rechaza namespaces sensibles, contenido oculto y texto de propuestas privadas. Los fixtures de esta prueba se revirtieron mediante transacción.
- Ensayo HTTP con sesiones y cookies reales: **32 comprobaciones aprobadas**. Incluyó autenticación, creación de usuarios y asignación de contributor, acceso al formulario, rechazo de CSRF inválido, guardado privado, aislamiento frente a otro colaborador y un lector anónimo, exclusión de borradores y revisiones pendientes de la API pública, envío a revisión, denegación de publicación al colaborador, aprobación por un revisor, exportación del artículo aprobado y revisión nativa de MediaWiki. También se verificó que el enlace del portal precarga título y contenido exactos de la revisión pública, rechaza namespaces sensibles, no precarga borradores y conserva la entrada válida de un POST rechazado por conflicto sin modificar el borrador guardado. El artículo temporal se retiró al acabar y se verificó de nuevo su ausencia de la exportación.
- Limpieza de fixtures HTTP: las cuentas generadas por los ensayos se redujeron a lector, sus contraseñas se rotaron en memoria y sus sesiones se invalidaron; se retiró la propuesta temporal. No se guardaron ni imprimieron contraseñas.
- Sintaxis PHP: `SpecialArchivoEditorial.php`, `tests/integration.php` y `scripts/seed-wiki.php` pasan `php -l`.

## Correcciones encontradas durante la ejecución

El formulario de propuestas utilizaba un campo POST llamado `title`. MediaWiki también utiliza ese parámetro para enrutar la petición, por lo que el envío podía salir de la página especial antes de evaluar el token. El campo se ha cambiado a `article_title` en el formulario y en el controlador; el ensayo HTTP posterior confirmó el guardado y el rechazo de un token inválido.

El enlace «Proponer una edición» ahora precarga el artículo público indicado por `article`. La lectura usa permisos de un lector anónimo, revisión actual desde la base primaria y audiencia pública, con bloqueo explícito del texto oculto. Un GET no crea propuestas ni consulta contenido privado. Ante un conflicto de guardado se conserva el texto aportado y la versión enviada, para que volver a enviar el formulario no eluda la detección de conflictos.

El test de auditoría utilizaba `iterator_count` sobre `IResultWrapper`. Se ha sustituido por iteración real y una comparación exacta del orden de las cinco acciones; no se encontró pérdida de eventos en la base de datos.

En Windows, el ejecutor de mantenimiento de esta versión interpreta el prefijo de unidad de una ruta absoluta como un nombre de extensión. Los scripts del proyecto usan una ruta explícitamente relativa con `./` para invocar su mantenimiento personalizado.

## Repetir la integración PHP

Con la instalación local configurada, desde la raíz:

```powershell
.runtime/php/php.exe .runtime/site/wiki/maintenance/run.php ./wiki/extensions/ArchivoEditorial/tests/integration.php
```

La prueba comprueba el flujo contra una base real, conserva los datos previos y revierte sus fixtures. Solo debe ejecutarse en desarrollo o staging. El ensayo HTTP se ejecutó mediante un harness temporal en `.runtime`, con credenciales aleatorias mantenidas únicamente en memoria; no se distribuyen esas credenciales ni se incorporan al repositorio.

Esta validación cubre el motor local. No certifica un despliegue MariaDB/Docker, un dominio con HTTPS, un proveedor de correo, la configuración efectiva de 2FA en producción ni las tareas de copia del alojamiento. Esas verificaciones se deben realizar sobre el entorno que vaya a publicarse.
