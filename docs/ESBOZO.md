# Esbozo inicial de la wiki

Fecha del esbozo: 17 de noviembre de 2026. Estado: propuesta pendiente de aprobación.

Este documento responde a los cuatro primeros entregables del README. No inicia la recopilación completa de contenido, la redacción legal definitiva ni la implementación. El alcance de «todo lo publicado oficialmente» se concretará como un inventario documentado hasta una fecha de corte, que se podrá ampliar con nuevos anuncios.

## 1. Arquitectura y dos opciones de stack

| Opción | Componentes | Ventaja principal | Trabajo adicional y limitaciones |
| --- | --- | --- | --- |
| A. MediaWiki | MediaWiki, PHP, MariaDB y un proxy HTTPS; configuración y extensiones versionadas | Aprovecha historial, comparación de revisiones, discusión, categorías, plantillas y permisos de una plataforma de wiki | Requiere adaptar diseño, fichas, filtros, traducciones y flujo editorial; hay que comprobar compatibilidad y mantenimiento de extensiones |
| B. Aplicación con CMS | Next.js, TypeScript, Payload CMS y PostgreSQL | Permite diseñar fichas estructuradas, interfaz y administración a medida; Payload ofrece control de acceso, localización, versiones y borradores | Discusiones, enlaces de wiki, comparación pública de revisiones, cambios recientes y moderación necesitan integración o desarrollo; mayor carga de mantenimiento propio |

**Recomendación inicial: opción A, MediaWiki**, porque las funciones colaborativas son centrales en este proyecto. Es una valoración de encaje y esfuerzo, no un presupuesto de alojamiento. La opción B sería preferible si se prioriza una experiencia muy personalizada y se acepta mantener más código.

Referencias técnicas: [funciones de MediaWiki](https://www.mediawiki.org/wiki/Manual:MediaWiki_features), [permisos de MediaWiki](https://www.mediawiki.org/wiki/Manual:User_rights), [versiones y borradores de Payload](https://payloadcms.com/docs/versions/overview) y [adaptadores de base de datos de Payload](https://payloadcms.com/docs/database/overview).

Arquitectura propuesta para A:

```text
Visitantes y colaboradores
          |
Proxy HTTPS / CDN y límites de peticiones
          |
MediaWiki + diseño propio + extensiones validadas
          |
MariaDB privada

Tareas programadas -> mantenimiento y copias externas
Entorno de pruebas -> validación -> producción
```

El repositorio contendrá configuración, extensiones propias, diseño, plantillas exportables y documentación. Los artículos y revisiones vivirán en la base de datos, con exportaciones y copias de seguridad; no se confundirán con archivos de código.

Antes de fijar versiones y extensiones se validarán tres puntos: publicación moderada, búsqueda filtrable y fichas con evidencia por dato. La publicación propuesta es `borrador -> revisión -> publicado`; una edición pendiente no debe sustituir al artículo aprobado ni aparecer en resultados públicos o API. Las vistas previas de borradores serán accesibles solo a los roles autorizados. [Approved Revs](https://www.mediawiki.org/wiki/Extension:Approved_Revs) es un candidato a evaluar, no una elección cerrada ni un flujo completo por sí solo.

La búsqueda inicial combinará texto y categorías. Los filtros por tipo de artículo, fiabilidad y fecha requerirán metadatos estructurados y una solución específica. [Cargo](https://www.mediawiki.org/wiki/Extension:Cargo) y [Page Forms](https://www.mediawiki.org/wiki/Extension:Page_Forms) son candidatos para fichas y consultas; deberán validarse junto al flujo editorial. Si esa combinación exige demasiado desarrollo, se reconsiderará la opción B antes de implementar.

Se diseñará para español, con traducciones al inglés vinculadas y navegación por idioma. El prefijo `/es/` del mapa es conceptual: las rutas definitivas dependerán de la configuración multilingüe. Diseño responsive, modo oscuro, navegación por teclado, índice automático, metadatos, sitemap y datos estructurados formarán parte de los criterios de aceptación; WCAG 2.1 AA y rendimiento se comprobarán en la implementación.

La seguridad prevista incluye HTTPS, HSTS, CSP y demás cabeceras del README; contenido editable restringido y sanitizado; controles de acceso, CSRF e inyección; autenticación con hash seguro y 2FA obligatorio para administradores, evaluando [OATHAuth](https://www.mediawiki.org/wiki/Extension:OATHAuth). Se completará con límites de intentos y peticiones, medidas contra bots, copias con pruebas de restauración, auditoría, actualizaciones automatizadas y moderación. Son requisitos a implementar y comprobar, no protecciones ya existentes.

## 2. Fuentes y criterio editorial

Se utilizarán estas fuentes primarias antes de redactar afirmaciones sobre el juego:

| Fuente | Uso previsto |
| --- | --- |
| [Web oficial de Grand Theft Auto VI](https://www.rockstargames.com/VI) | Información y material publicado por Rockstar; registrar la página o sección concreta |
| [Rockstar Newswire](https://www.rockstargames.com/newswire) | Anuncios, cambios y cronología, enlazando cada publicación individual |
| [Relaciones con inversores de Take-Two](https://www.take2games.com/ir) | Comunicados, informes, presentaciones y conferencias oficiales; citar el documento y su fecha |
| [Canal oficial de Rockstar en YouTube](https://www.youtube.com/@RockstarGames) | Tráilers y vídeos oficiales, con enlace y minuto de evidencia cuando corresponda |
| Redes oficiales enlazadas desde Rockstar | Publicaciones concretas contrastadas con su emisor; nunca cuentas de fans como confirmación oficial |

Las capturas oficiales podrán consultarse como evidencia, pero no se copiarán ni mostrarán en la wiki. Los medios reputados servirán para localizar o contrastar información y deberán remitir a la fuente primaria; una noticia de terceros no se convertirá por sí sola en confirmación oficial.

Cada afirmación tendrá texto original, una o varias fuentes, emisor, URL, localizador de evidencia, fecha de publicación, fecha del acontecimiento si difiere, fecha de verificación y responsable de la revisión. Se conservará qué afirmación sustituye a otra cuando cambie un anuncio.

- **Confirmado oficialmente:** evidencia primaria que respalda exactamente la afirmación, con enlace y fecha.
- **Análisis o declaración de terceros:** interpretación o información atribuida, diferenciada de la confirmación oficial.
- **Rumor:** únicamente en su sección separada, sin filtraciones ni material robado. Se propone dejarla vacía inicialmente.
- **[PENDIENTE DE VERIFICAR]:** indicar qué falta y qué fuente oficial consultar; no completar el dato mediante suposiciones.

La fiabilidad es independiente del estado editorial: un borrador también puede contener datos confirmados. Que un vehículo, arma o acción aparezca en un tráiler no basta para confirmar su disponibilidad o funcionamiento como mecánica jugable. Esta distinción se aplicará a cada afirmación.

Fecha de lanzamiento vigente, precio, plataformas y catálogo de tráilers se documentarán en la recopilación posterior; este esbozo no los da por verificados.

## 3. Nombres e identidad

Propuestas de marca editorial independiente:

- **Archivo de Juego** — primera opción de trabajo.
- **Bitácora de Mundos**.
- **Cuaderno de Mundos**.

Subtítulo propuesto: «Wiki independiente de fans sobre Grand Theft Auto VI». Se usará diseño e identidad propios, sin logos, tipografías imitativas ni apariencia de portal oficial.

Son candidatos, no nombres con seguridad jurídica garantizada. Antes de elegir nombre y dominio habrá que comprobar coincidencias y similitudes en [OEPM](https://www.oepm.es/es/herramientas/buscador-base-de-datos/buscador-marcas-y-nombres-comerciales/) y [EUIPO](https://www.euipo.europa.eu/es/help-centre/tm/faq-search-availability), disponibilidad del dominio y posible confusión. No se ha realizado esa búsqueda individual.

Texto inicial para el pie y el aviso legal:

> Sitio independiente creado por fans. No está afiliado, respaldado ni patrocinado por Rockstar Games ni Take-Two Interactive. Las marcas mencionadas pertenecen a sus respectivos titulares.

Se prevén texto propio, recursos propios o con licencia libre comprobada y enlaces oficiales. No se alojarán ni enlazarán como imágenes remotas capturas, miniaturas, logos, vídeos o música oficiales; tampoco se usarán en Open Graph. Los vídeos oficiales se ofrecerán inicialmente como enlaces, con reproductor opcional bloqueado hasta la decisión de consentimiento aplicable. La referencia será la [guía de cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf).

La fase legal deberá adaptar aviso, privacidad, cookies, términos de colaboración y retirada de contenido al responsable y a los servicios reales. Sus referencias incluirán [LSSI-CE](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758), [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/spa) y [LOPDGDD](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673). El canal de retirada atenderá reclamaciones de propiedad intelectual; su alcance no se limitará a denominarlo «DMCA». No se inventarán datos del titular ni direcciones de contacto. Si se añaden anuncios o afiliados, se revisarán su identificación y los tratamientos de datos asociados. Esta es orientación general y se prevé revisión final por un abogado especializado en propiedad intelectual.

## 4. Carpetas y mapa del sitio

Estructura propuesta para MediaWiki. Salvo este esbozo y el README existente, los archivos y carpetas siguientes aún no se han creado:

```text
Gta-6-wiki/
  README.md
  CONTRIBUTING.md
  .env.example                 # Solo nombres y valores de ejemplo
  .gitignore
  compose.yaml                 # Entorno local reproducible
  docs/
    ESBOZO.md
    arquitectura.md
    fuentes.md
    estilo-editorial.md
    seguridad.md
    despliegue.md
    mantenimiento.md
    legal/                     # Borradores y decisiones legales
  infra/
    proxy/                     # HTTPS y cabeceras
    mediawiki/                 # Configuración sin secretos
    backups/                   # Scripts; las copias reales irán fuera del repo
  wiki/
    extensions/                # Extensiones propias, si se necesitan
    skins/                     # Diseño propio
    templates/                 # Fichas y bloques de evidencia exportables
    seeds/                     # Importación inicial tras revisión
  scripts/                     # Importar, exportar y mantener
  tests/                       # Publicación, permisos y otras rutas críticas
  .github/workflows/           # CI/CD si se elige GitHub
```

Las dependencias se fijarán por versión; no se copiará todo el núcleo de MediaWiki al repositorio. Secretos, base de datos, registros, copias y datos personales permanecerán fuera del control de versiones.

Mapa conceptual de navegación:

```text
/es/
  juego/                       Resumen, desarrollo, lanzamiento y plataformas
  personajes/
  mundo/                       Ambientación, regiones, lugares y mapa
  jugabilidad/
  modos/                       Solo información oficial disponible
  trailers/                    Cronología y análisis identificados
  musica/                      Canciones con evidencia, sin audio ni letras
  vehiculos/
  armas-y-objetos/
  noticias/
  cronologia/                  Anuncios y cambios con sus fechas
  saga/                        Contexto histórico
  preguntas-frecuentes/
  rumores/                     Sección separada; inicialmente vacía
  fuentes/
  buscar/
  cambios-recientes/
  comunidad/                   Normas, ayuda y colaboración
  legal/                       Aviso, privacidad, cookies, términos y retirada
  contacto/

/en/                           Reservado para traducciones revisadas
```

Cada artículo tendrá ficha, índice, fuentes, última actualización, verificación por dato y acceso a historial, comparación y discusión. Se mostrará «Información sujeta a cambios». No se publicarán traducciones vacías ni un mapa reconstruido mediante especulaciones; si falta evidencia, se indicará expresamente.

Roles previstos: lector consulta lo publicado; colaborador propone borradores; editor revisa y publica; administrador gestiona permisos y configuración. La moderación de discusiones, el antispam y la trazabilidad también se incluirán en el diseño.

## Continuación, sujeta a confirmación

Tras aprobar este esbozo, se continuará con la fase 1: inventario de fuentes y afirmaciones verificadas. Después se presentará la fase 2 legal; la fase 3 entregará código; la fase 4 implementará y validará seguridad; la fase 5 documentará operación y mantenimiento. La seguridad y la privacidad condicionarán el diseño desde el principio. Cada cambio de fase requerirá la confirmación prevista en el README.
