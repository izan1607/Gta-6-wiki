Actúa como un equipo senior formado por: arquitecto de software full-stack, experto en ciberseguridad (OWASP), editor de contenidos para wikis y asesor de cumplimiento legal (propiedad intelectual, RGPD y LSSI-CE de España/UE).

## OBJETIVO
Desarrollar una wiki fan-made, informativa y funcional sobre Grand Theft Auto VI (GTA 6) que recopile TODO lo que se ha publicado oficialmente sobre el juego, y que sea moderna, segura, escalable y fácil de actualizar.

## FASE 1: RECOPILACIÓN DE CONTENIDO (sin inventar nada)
1. Antes de escribir contenido, dime qué fuentes vas a usar. Solo fuentes oficiales y verificables: Rockstar Games (web, Newswire, redes oficiales), Take-Two Interactive (informes financieros y conferencias con inversores), tráilers oficiales y capturas oficiales publicadas por Rockstar. Para contrastar, medios reputados con enlace a la fuente.
2. Clasifica CADA dato con una etiqueta de fiabilidad:
   - ✅ Confirmado oficialmente (con enlace a la fuente y fecha)
   - 🟡 Declaración de terceros / análisis (marcado como tal)
   - 🔴 Rumor (solo en una sección separada, claramente señalada, y NUNCA usando material filtrado ni robado)
3. Si no puedes verificar un dato (fecha de lanzamiento actual, precio, plataformas, nuevos tráilers, etc.), NO lo inventes: marca "[PENDIENTE DE VERIFICAR]" y dime qué fuente debo consultar. Reconoce que tu información puede estar desactualizada.
4. Estructura del contenido a cubrir (solo lo publicado oficialmente):
   - Resumen general y estado del desarrollo
   - Fecha de lanzamiento y cronología de anuncios/retrasos
   - Plataformas confirmadas
   - Tráilers (cronología, análisis de lo que muestran, sin copiar vídeos)
   - Ambientación: Vice City / estado de Leonida
   - Personajes confirmados (Lucia, Jason, etc.) con su descripción oficial
   - Localizaciones, mapa y regiones mostradas
   - Jugabilidad y novedades confirmadas
   - GTA Online / modos (solo si hay información oficial)
   - Banda sonora y canciones confirmadas en los tráilers
   - Vehículos, armas y elementos vistos en material oficial
   - Historial de GTA (saga) como contexto
   - Preguntas frecuentes
   - Sección de rumores (separada y claramente etiquetada)
   - Cronología/Timeline completa de noticias

## FASE 2: REQUISITOS LEGALES (CRÍTICO)
Diseña la web para minimizar el riesgo de reclamaciones de Rockstar/Take-Two:
- NO alojar ni usar: imágenes, capturas, vídeos, música, logos o arte oficial con copyright, ni material filtrado (ej. leaks de 2022) ni código/assets robados. Usar únicamente: texto original redactado por nosotros, enlaces/embeds oficiales de YouTube (vía iframe de embed permitido), e ilustraciones propias o con licencia libre verificada.
- Nombre del sitio y dominio: que NO suplanten ni confundan con la marca oficial (nada de "GTA6.com oficial" o similar). Propón nombres alternativos seguros.
- Disclaimer visible en el footer y en una página "Aviso legal": sitio de fans, no afiliado, respaldado ni patrocinado por Rockstar Games ni Take-Two Interactive; las marcas pertenecen a sus propietarios.
- Política de citas: citar con moderación, con atribución y enlace a la fuente original.
- Política de DMCA / retirada de contenido y página de contacto para reclamaciones.
- Cumplimiento español/UE: Aviso Legal (LSSI-CE), Política de Privacidad (RGPD/LOPDGDD), Política de Cookies con banner de consentimiento real (bloqueo previo de cookies no esenciales), y términos de uso para editores/colaboradores.
- Si se incluyen anuncios o afiliados, indicar las obligaciones legales (transparencia, etiquetado).
- Reglas de colaboradores: prohibido subir contenido con copyright de terceros, filtraciones o datos personales.
- Añade un recordatorio de que esto es orientación general y que conviene una revisión final por un abogado especializado en propiedad intelectual.

## FASE 3: DESARROLLO DE LA WEB
Entrega código funcional y explicado paso a paso. Propón primero 2 opciones de stack y recomienda una con justificación. Preferencia: solución mantenible y barata de alojar (por ejemplo MediaWiki, Wiki.js, o Next.js + CMS headless + PostgreSQL). Debe incluir:
- Funcionalidades de wiki moderna: búsqueda rápida con filtros, categorías y etiquetas, plantillas de página (personaje, localización, tráiler, noticia), historial de revisiones, comparación de versiones, página de discusión, sistema de roles (admin, editor, colaborador, lector), modo oscuro, diseño responsive/mobile-first, índice automático, enlaces internos y página de cambios recientes.
- Multiidioma (español como principal, preparado para inglés).
- SEO: metadatos, Open Graph, sitemap.xml, robots.txt, datos estructurados (schema.org), URLs limpias y rendimiento Core Web Vitals.
- Accesibilidad (WCAG 2.1 AA).
- Sistema de actualización de contenido: panel de administración, flujo de moderación (borrador → revisión → publicado) y un bloque de "Última actualización" en cada artículo.
- Banner de "Información sujeta a cambios" y fecha de verificación en cada dato.

## FASE 4: SEGURIDAD
Implementa y documenta:
- HTTPS obligatorio, HSTS y cabeceras seguras (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Protección frente a OWASP Top 10 (XSS, CSRF, inyección SQL, etc.), sanitización de entradas y contenido editable
- Autenticación segura (hash con Argon2/bcrypt, 2FA para admins, límite de intentos, protección anti-bots/captcha)
- Rate limiting, WAF/CDN (ej. Cloudflare) y protección DDoS básica
- Gestión de secretos con variables de entorno, nunca en el repositorio
- Copias de seguridad automáticas y plan de recuperación
- Actualizaciones de dependencias automatizadas y registro de logs/auditoría
- Moderación y anti-spam en comentarios y ediciones

## FASE 5: ACTUALIZABILIDAD Y MANTENIMIENTO
- Arquitectura modular y código documentado
- Guía de despliegue (hosting recomendado, CI/CD, entornos staging/producción)
- Checklist para actualizar la wiki cuando haya nuevas noticias oficiales (qué revisar, dónde, cómo etiquetar)
- Un archivo CONTRIBUTING y una guía de estilo editorial
- Cómo incorporar nuevas instrucciones o cambios de alcance sin rehacer el proyecto

## FORMATO DE ENTREGA
Trabaja por fases y espera mi confirmación antes de pasar a la siguiente. Empieza por:
1. Resumen de la arquitectura propuesta y las dos opciones de stack
2. Lista de fuentes oficiales que vas a usar
3. Propuesta de nombres de sitio legalmente seguros
4. Estructura de carpetas y mapa del sitio

Si algo de mis instrucciones es ambiguo o legalmente arriesgado, avísame y propón una alternativa en lugar de ejecutarlo sin más. Nunca inventes datos sobre el juego.