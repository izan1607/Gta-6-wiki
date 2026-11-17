# Validación del portal

Ejecutada el 17 de noviembre de 2026, con Node.js 24.11.1.

- Construcción correcta: 38 rutas, 16 artículos y 15 fuentes primarias.
- 17 pruebas Node aprobadas: integridad editorial, fuentes, búsqueda, guardados, escapado HTML, destinos y anclas, recursos locales, sincronización, paginación, retiradas y conservación de fechas de verificación.
- Todas las páginas generadas tienen título, descripción, un H1, idioma español y enlace para saltar al contenido. Las imágenes incluyen alternativa y los vídeos no se cargan al generar HTML.
- Respuestas HTTP comprobadas: portada 200, exportación MediaWiki 200, runtime conectado, página inexistente 404 y acceso a `.env` bloqueado con 403.
- Los módulos de aplicación y servidor pasan la comprobación de sintaxis de Node.

Comandos desde la raíz:

```powershell
npm.cmd run build
npm.cmd test
```

La revisión visual se intentó, pero la herramienta de control detuvo la sesión al no poder verificar la URL del navegador con suficiente confianza. No se sustituyó ese control por otro mecanismo. Por tanto, no se han certificado presentación visual, comportamiento interactivo en navegador, WCAG ni métricas de rendimiento reales. Los estilos incluyen adaptaciones para móvil, tema claro/oscuro, foco visible y movimiento reducido, pendientes de esa revisión visual.

Docker, MariaDB, correo y un dominio propio no se han ejecutado en este entorno. La publicación del portal lector, cuando finalice, no ejecuta el motor PHP de MediaWiki.

## Publicación privada confirmada

Sites confirmó el despliegue satisfactorio de la versión 1 en https://archivo-de-juego-vi.moltenoctet8.chatgpt.site el 17 de noviembre de 2026. La revisión de fuente publicada es `cd279578a580d3fb9a0f737ba502e1dd5f2d3fd6`. Se conserva acceso exclusivo del propietario. La confirmación procede del servicio de despliegue; no se realizó una visita automatizada al navegador ni una revisión visual de producción.
