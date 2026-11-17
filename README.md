# Archivo de Juego

Wiki independiente de fans sobre Grand Theft Auto VI. Combina un portal de lectura en español con un motor editorial MediaWiki: **38 páginas generadas, 16 artículos iniciales y 15 fuentes oficiales**, comprobadas el **17 de noviembre de 2026**.

La presentación usa diseño e ilustraciones originales; no aloja imágenes, logos, vídeos, música ni otros recursos oficiales. Los datos incluyen su estado y sus fuentes. Los precios, PC y otros extremos sin comprobación suficiente permanecen pendientes.

## Arranque rápido del portal

Requiere **Node.js >= 22**; probado con **24.11.1**. Usa JavaScript sin framework y los módulos nativos de Node: no necesita instalar dependencias.

Desde la raíz del repositorio, en PowerShell:

```powershell
npm.cmd run dev
```

Abre [http://127.0.0.1:4173/es/](http://127.0.0.1:4173/es/). El servidor reconstruye al cambiar código o contenido; usa `Ctrl+C` para detenerlo. `npm.cmd` evita depender de la política de `npm.ps1` en Windows.

Para generar la salida estática y ejecutar las pruebas:

```powershell
npm.cmd run build
npm.cmd test
```

La salida queda en `portal/dist/`. Incluye artículos con índice, búsqueda y filtros, categorías, cronología, fuentes, guardados locales, tema claro/oscuro, metadatos y sitemap. El español es el idioma publicado; la estructura permite preparar inglés sin mostrar traducciones ficticias.

## Motor editorial local

MediaWiki proporciona cuentas y permisos reales. ArchivoEditorial añade propuestas privadas, versiones de borrador, envío a revisión, devolución con nota y publicación. Publicar crea revisiones nativas, conserva autoría y auditoría, y comprueba conflictos con el artículo vigente. El motor también ofrece discusión e historial.

Requiere **PHP 8.3** con las extensiones de la [guía de despliegue](docs/despliegue.md) y **MediaWiki 1.43 LTS** dentro de `.runtime/`. Esos paquetes y sus secretos no forman parte del repositorio. La instalación local usa SQLite; Docker prepara MariaDB para otro entorno.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

El setup solicita la contraseña inicial de administrador de forma oculta y la transmite por stdin. Para restablecerla en una instalación local existente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1 -ResetAdminPassword -SkipSeed
```

Mantén MediaWiki en una terminal y el portal en otra. El motor escucha en `127.0.0.1:8081`; accede a sus pantallas por el origen del portal para conservar cookies, redirecciones y protección CSRF:

- [Inicio de sesión](http://127.0.0.1:4173/wiki/index.php?title=Special:UserLogin).
- [Panel editorial](http://127.0.0.1:4173/wiki/index.php?title=Special:ArchivoEditorial), con acciones según el rol.
- [Cambios recientes](http://127.0.0.1:4173/wiki/index.php?title=Special:RecentChanges).

El portal estático funciona sin el motor. Las cuentas, propuestas, discusión y revisiones remotas necesitan MediaWiki conectado; publicar el portal estático no incluye PHP ni la base de datos.

## De la publicación editorial al portal

Tras aprobar una edición en MediaWiki, sincroniza el contenido público y reconstruye:

```powershell
npm.cmd run sync
npm.cmd run build
npm.cmd test
```

La sincronización consulta la API local y guarda una instantánea pública en `portal/content/wiki-pages.json`. No exporta borradores ni revisiones pendientes. El build incorpora los cuerpos públicos coincidentes. Si detecta artículos retirados o metadatos modificados, se detiene hasta revisar el catálogo y sincronizar de nuevo; limpia la salida generada en cada construcción válida.

**Publicar o sincronizar no verifica automáticamente los datos.** Las afirmaciones, etiquetas, fuentes y fechas de comprobación se revisan expresamente en `portal/content/catalog.json`. Las páginas nuevas necesitan metadatos editoriales antes de incorporarse al portal. Después de reconstruir, publica la nueva salida estática para actualizar un sitio alojado.

## Validación y límites

Las comprobaciones registradas incluyen **17 pruebas Node**, **23 comprobaciones de integración PHP** y **32 comprobaciones HTTP con sesiones reales**, aprobadas en el entorno local. Los informes detallan su alcance y los comandos para repetirlas.

La revisión visual quedó bloqueada porque la herramienta no pudo determinar la URL del navegador con suficiente confianza. No se certifican el resultado visual, WCAG ni métricas reales de rendimiento. Docker, MariaDB de producción, correo y dominio con HTTPS no se han probado en este entorno.

El [portal lector está publicado en modo privado](https://archivo-de-juego-vi.moltenoctet8.chatgpt.site), versión 1, con despliegue confirmado el 17 de noviembre de 2026. Esa publicación incluye la interfaz estática; MediaWiki continúa siendo un servicio separado. Antes de hacerlo público faltan los datos del titular, el contacto real, la decisión de licencia y la revisión jurídica y operativa del alojamiento. Los borradores legales no declaran conformidad completa.

## Estructura y documentación

- `portal/`: interfaz lectora, catálogo, sincronización, generador y pruebas Node.
- `wiki/`: configuración de MediaWiki y extensión ArchivoEditorial.
- `scripts/`: instalación, arranque local e importación editorial.
- `infra/` y `compose.yaml`: preparación de contenedores y proxy.
- `docs/`: arquitectura, fuentes, operación y borradores legales.

Consulta el [esbozo inicial](docs/ESBOZO.md), la [arquitectura implementada](docs/arquitectura.md), las [fuentes y sus límites](docs/fuentes.md), la [guía editorial](docs/estilo-editorial.md), la [seguridad](docs/seguridad.md), el [despliegue](docs/despliegue.md), el [mantenimiento](docs/mantenimiento.md) y los informes de [validación del portal](docs/validacion-portal.md) y [validación del motor](docs/validacion-runtime.md).

Las instrucciones originales se conservan íntegramente en [docs/REQUISITOS.md](docs/REQUISITOS.md). Los [borradores legales](docs/legal/aviso-legal.md) requieren completar datos reales y revisión especializada antes del lanzamiento público.

Este sitio de fans no está afiliado, respaldado ni patrocinado por Rockstar Games ni Take-Two Interactive. Las marcas pertenecen a sus respectivos titulares.
