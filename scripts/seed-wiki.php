<?php
/**
 * Import the reviewed, original portal catalogue into MediaWiki.
 * Run through: php maintenance/run.php /absolute/path/scripts/seed-wiki.php --catalog=...
 * Existing pages are deliberately preserved unless --refresh is explicit.
 */
declare( strict_types=1 );

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\MediaWikiServices;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Session\SessionManager;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

$installPath = getenv( 'MW_INSTALL_PATH' );
if ( !$installPath ) {
    $installPath = dirname( __DIR__ ) . '/.runtime/site/wiki';
}
require_once $installPath . '/maintenance/Maintenance.php';

class SeedArchivoWiki extends Maintenance {
    public function __construct() {
        parent::__construct();
        $this->addDescription( 'Importa el catálogo revisado de Archivo de Juego conservando por defecto las páginas existentes.' );
        $this->addOption( 'catalog', 'Ruta absoluta de catalog.json', false, true );
        $this->addOption( 'refresh', 'Actualizar también páginas existentes: crea una revisión y no borra el historial.', false, false );
        $this->addOption( 'reset-admin-password', 'Administrador existente al que asignar la contraseña leída de stdin.', false, true );
    }

    public function execute(): void {
        if ( $this->hasOption( 'reset-admin-password' ) ) {
            $this->resetAdminPassword();
            return;
        }
        $path = $this->getOption( 'catalog' );
        if ( !is_string( $path ) || !is_file( $path ) || !is_readable( $path ) ) {
            $this->fatalError( 'No se puede leer el catálogo indicado.' );
        }
        try {
            $catalog = json_decode( file_get_contents( $path ), true, 64, JSON_THROW_ON_ERROR );
        } catch ( JsonException $error ) {
            $this->fatalError( 'El catálogo no es JSON válido: ' . $error->getMessage() );
        }
        if ( !is_array( $catalog['articles'] ?? null ) || !is_array( $catalog['sources'] ?? null ) ) {
            $this->fatalError( 'El catálogo necesita articles y sources.' );
        }

        $sourceMap = [];
        foreach ( $catalog['sources'] as $source ) {
            if ( isset( $source['id'] ) ) {
                $sourceMap[(string)$source['id']] = $source;
            }
        }
        $services = MediaWikiServices::getInstance();
        $actor = User::newSystemUser( 'Archivo de Juego', [ 'steal' => false ] );
        if ( !$actor ) {
            $this->fatalError( 'No se pudo obtener la cuenta de importación del sistema.' );
        }
        $created = 0;
        $skipped = 0;
        foreach ( $catalog['articles'] as $article ) {
            $title = Title::newFromText( (string)( $article['title'] ?? '' ) );
            if ( !$title || $title->getNamespace() !== NS_MAIN ) {
                $this->fatalError( 'Un artículo tiene un título inválido o fuera del espacio principal.' );
            }
            $page = $services->getWikiPageFactory()->newFromTitle( $title );
            if ( $page->exists() && !$this->hasOption( 'refresh' ) ) {
                $skipped++;
                $this->output( 'Conservado: ' . $title->getPrefixedText() . "\n" );
                continue;
            }
            $text = $this->articleWikitext( $article, $sourceMap );
            $content = $services->getContentHandlerFactory()->getContentHandler( CONTENT_MODEL_WIKITEXT )->unserializeContent( $text );
            $updater = $page->newPageUpdater( $actor );
            $updater->setContent( SlotRecord::MAIN, $content );
            $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Catálogo editorial verificado: importación de contenido original.' ), EDIT_SUPPRESS_RC );
            if ( !$updater->wasSuccessful() ) {
                $this->fatalError( 'No se pudo guardar: ' . $title->getPrefixedText() );
            }
            $created++;
            $this->output( 'Importado: ' . $title->getPrefixedText() . "\n" );
        }
        $this->output( "Importación terminada. Guardados: $created; conservados: $skipped.\n" );
    }

    private function resetAdminPassword(): void {
        $user = User::newFromName( (string)$this->getOption( 'reset-admin-password' ) );
        $services = MediaWikiServices::getInstance();
        if ( !$user || !$user->isRegistered() || !in_array( 'sysop', $services->getUserGroupManager()->getUserGroups( $user ), true ) ) {
            $this->fatalError( 'No existe ese administrador local. Se conserva la cuenta.' );
        }
        $password = rtrim( (string)file_get_contents( 'php://stdin' ), "\r\n" );
        if ( mb_strlen( $password ) < 14 || str_contains( $password, "\n" ) || str_contains( $password, "\r" ) ) {
            $this->fatalError( 'La nueva contraseña debe tener al menos 14 caracteres y no contener saltos de línea.' );
        }
        $status = $user->changeAuthenticationData( [
            'username' => $user->getName(),
            'password' => $password,
            'retype' => $password,
        ] );
        $password = null;
        if ( !$status->isGood() ) {
            $this->fatalError( 'MediaWiki ha rechazado la nueva contraseña. No se imprime la información de autenticación.' );
        }
        SessionManager::singleton()->invalidateSessionsForUser( $user );
        $this->output( 'Contraseña del administrador actualizada; sesiones anteriores invalidadas.' . "\n" );
    }

    private function escape( string $text ): string {
        // Entity escaping prevents catalogue strings from introducing wikitext directives or HTML.
        return str_replace(
            [ '&', '<', '>', '[', ']', '{', '}', '|', '=' ],
            [ '&amp;', '&lt;', '&gt;', '&#91;', '&#93;', '&#123;', '&#125;', '&#124;', '&#61;' ],
            $text
        );
    }

    private function sourceLink( array $source ): string {
        $url = (string)( $source['url'] ?? '' );
        if ( !filter_var( $url, FILTER_VALIDATE_URL ) || parse_url( $url, PHP_URL_SCHEME ) !== 'https' || preg_match( '/[\s\[\]<>]/', $url ) ) {
            return '[FUENTE PENDIENTE DE VERIFICAR]';
        }
        return '[' . $url . ' ' . $this->escape( (string)( $source['title'] ?? $url ) ) . ']';
    }

    private function articleWikitext( array $article, array $sources ): string {
        $labels = [
            'confirmed' => 'Confirmado oficialmente',
            'analysis' => 'Análisis o declaración de terceros',
            'pending' => '[PENDIENTE DE VERIFICAR]',
            'rumor' => 'Rumor: no confirmado',
        ];
        $lines = [
            "''Información sujeta a cambios. Wiki independiente creada por fans.''",
            '',
            $this->escape( (string)( $article['summary'] ?? '' ) ),
            '',
            'Última actualización editorial: ' . $this->escape( (string)( $article['updatedAt'] ?? '[PENDIENTE]' ) ) . '.',
            '',
            '== Datos y evidencia ==',
        ];
        $usedSources = [];
        foreach ( $article['facts'] ?? [] as $fact ) {
            $status = (string)( $fact['status'] ?? 'pending' );
            $line = '* ' . ( $labels[$status] ?? $labels['pending'] ) . ': ' . $this->escape( (string)( $fact['text'] ?? '' ) );
            $references = [];
            foreach ( $fact['sourceIds'] ?? [] as $sourceId ) {
                if ( isset( $sources[$sourceId] ) ) {
                    $references[] = $this->sourceLink( $sources[$sourceId] );
                    $usedSources[$sourceId] = $sources[$sourceId];
                }
            }
            if ( $references ) {
                $line .= ' Fuente: ' . implode( '; ', $references ) . '.';
            } else {
                $line .= ' Evidencia pendiente; consultar las fuentes oficiales indicadas.';
            }
            $line .= ' Verificación: ' . $this->escape( (string)( $fact['verifiedAt'] ?? '[PENDIENTE]' ) ) . '.';
            $lines[] = $line;
        }
        foreach ( $article['sections'] ?? [] as $section ) {
            $lines[] = '';
            $lines[] = '== ' . $this->escape( (string)( $section['title'] ?? 'Información' ) ) . ' ==';
            foreach ( $section['paragraphs'] ?? [] as $paragraph ) {
                $lines[] = $this->escape( (string)$paragraph );
                $lines[] = '';
            }
        }
        $lines[] = '== Fuentes ==';
        foreach ( $usedSources as $source ) {
            $lines[] = '* ' . $this->sourceLink( $source ) . ' — ' . $this->escape( (string)( $source['publisher'] ?? '' ) ) . '. Publicación: ' . $this->escape( (string)( $source['publishedAt'] ?? 'sin fecha indicada' ) ) . '; consulta: ' . $this->escape( (string)( $source['verifiedAt'] ?? '[PENDIENTE]' ) ) . '.';
        }
        $category = Title::makeTitleSafe( NS_CATEGORY, (string)( $article['categoryLabel'] ?? 'Archivo' ) );
        if ( $category ) {
            $lines[] = '';
            $lines[] = '[[Category:' . $category->getText() . ']]';
        }
        return implode( "\n", $lines ) . "\n";
    }
}

$maintClass = SeedArchivoWiki::class;
require_once RUN_MAINTENANCE_IF_MAIN;
