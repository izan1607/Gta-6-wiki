# Seguridad y límites de la entrega

El portal lector no necesita cuentas ni secretos. MediaWiki mantiene autenticación, permisos y contenido editorial. La aplicación local escucha solo en loopback; no debe utilizarse su servidor PHP de desarrollo como alojamiento público.

| Riesgo | Control implementado |
| --- | --- |
| Publicar un borrador | Tabla privada, comprobación de autor y permisos, publicación explícita del editor; API pública sin acceso a propuestas |
| XSS en el portal | Escapado de texto, proyección conservadora de wikitext a texto plano, fuentes HTTPS permitidas, CSP sin scripts remotos |
| Acciones sin autorización | Roles en servidor, registro cerrado, comprobación de bloqueo, tokens CSRF y límites de edición |
| Pérdida de cambios | Versión del borrador y conflicto contra la revisión pública vigente antes de publicar |
| Contraseñas y sesiones | Hash Argon2, cookies HttpOnly/SameSite y Secure en producción; OATHAuth obligatorio para grupos administrativos en producción |
| Acceso a datos internos | SQLite fuera de la raíz web; MariaDB sin puerto público; reglas Apache para código y archivos sensibles |
| Seguimiento externo | Sin analítica ni publicidad; iframe bloqueado hasta elección afirmativa y reproducción solicitada; retirada elimina el iframe |
| Publicar metadatos obsoletos | Sincronización completa, hash del catálogo y fallo de construcción si faltan páginas o cambian metadatos |
| Residuos de páginas retiradas | Se limpia exclusivamente la carpeta generada `portal/dist` tras validar los datos, antes de construir |

El portal configura CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy y Permissions-Policy. HSTS corresponde al despliegue HTTPS. Caddy tiene una política separada para MediaWiki, que utiliza ResourceLoader. No se debe imponer la política del portal a las herramientas editoriales sin comprobar su funcionamiento.

Los secretos viven en variables de entorno y en los archivos locales generados de `.runtime`, excluidos del repositorio. Una copia de la configuración local contiene claves y debe tratarse como secreto. No se publican contraseñas de administrador ni credenciales de ensayo. El administrador elige su propia contraseña mediante el restablecimiento local documentado.

Dependabot propone actualizaciones de acciones y de la imagen base Docker. La imagen de MediaWiki, MariaDB, Caddy y sus extensiones deben revisarse y probarse antes de actualizar. El portal no tiene dependencias npm de terceros. El workflow incluido ejecuta construcción, pruebas Node y sintaxis PHP; no sustituye la integración contra una base real.

En producción quedan por configurar y comprobar: correo, copias externas programadas con restauración probada, WAF/CDN y límites de red del proveedor, observabilidad y retención de registros. No se afirma que esos servicios estén activos por existir archivos de configuración. La revisión visual, de accesibilidad y del comportamiento del navegador permanece pendiente porque la herramienta de control no pudo verificar la URL con seguridad. No se certifica WCAG ni Core Web Vitals.

Los resultados del motor local están en [validacion-runtime.md](validacion-runtime.md). La arquitectura y su política de roles se detallan en [arquitectura.md](arquitectura.md).
