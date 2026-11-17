# Cómo colaborar

Archivo de Juego es una wiki independiente de fans. Las contribuciones deben ser originales, verificables, respetuosas y fáciles de revisar.

## Contenido

Consulta `docs/estilo-editorial.md` y `docs/fuentes.md`. Cada afirmación debe identificar su fiabilidad y evidencia, con fecha de consulta. Una escena de un tráiler no confirma por sí sola una mecánica jugable. No completes huecos con recuerdos, especulación o texto generado sin verificar.

No se admiten filtraciones, material robado, capturas o arte oficial, música, logos, datos personales ajenos ni archivos de terceros cuya licencia no permita su uso. No se permite incrustar imágenes oficiales desde servidores externos. Los enlaces a publicaciones oficiales están permitidos por la política editorial; incorporar un reproductor externo requiere además respetar la configuración de consentimiento.

## Flujo editorial

Un lector consulta lo publicado. Un colaborador autenticado prepara una propuesta privada en `Special:ArchivoEditorial`, la guarda como borrador y la envía a revisión. Un editor verifica las fuentes y publica o devuelve la propuesta. Los administradores gestionan permisos y configuración. No compartas cuentas ni introduzcas secretos en el texto del artículo o su discusión.

La discusión sirve para contrastar fuentes y proponer mejoras. Mantén el foco en el contenido; no publiques amenazas, acoso, spam, datos personales ni material que infrinja derechos.

## Cambios de código y catálogo

Trabaja en un cambio pequeño que explique el problema y el resultado esperado. Mantén las fuentes y etiquetas del catálogo; valida su estructura y los enlaces internos. Prueba navegación, búsqueda y las rutas que hayas cambiado. Los cambios de permisos o publicación deben probar los casos autorizados y los rechazos, incluida una petición sin token CSRF o con un usuario ajeno.

No añadas `.runtime`, bases de datos, copias, `.env`, contraseñas, tokens, registros ni datos privados al repositorio. Usa `.env.example` solo para nombres y ejemplos sin secretos. Una actualización de dependencia debe fijar la versión y describir cómo se comprobó.

Antes de proponer una nueva fuente, un servicio externo o un asset, documenta su procedencia y cómo afecta a privacidad, seguridad y propiedad intelectual. Una nueva integración no se habilita automáticamente para todos los visitantes.

Si detectas una vulnerabilidad, utiliza el canal privado del responsable cuando esté configurado. No publiques credenciales, datos personales ni instrucciones de explotación contra una instancia activa en una incidencia pública. Los datos definitivos de contacto y la política de contribuciones deben completarse antes de abrir la comunidad a terceros.
