<?php
/** Local integration checks against an installed wiki. All fixture DB writes are rolled back. */
use ArchivoEditorial\DraftStore;
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IDatabase;

$archivoInstallPath = $IP ?? getenv( 'MW_INSTALL_PATH' ) ?: dirname( __DIR__, 4 ) . '/.runtime/site/wiki';
require_once $archivoInstallPath . '/maintenance/Maintenance.php';

class ArchivoEditorialIntegration extends Maintenance {
    private int $checks = 0;

    public function __construct() {
        parent::__construct();
        $this->addDescription( 'Verifica permisos, aislamiento y publicación; revierte todos los datos de prueba.' );
    }

    private function check( bool $condition, string $message ): void {
        if ( !$condition ) {
            throw new RuntimeException( 'FAIL: ' . $message );
        }
        $this->checks++;
        $this->output( 'PASS: ' . $message . "\n" );
    }

    private function denied( callable $fn, string $message ): void {
        try {
            $fn();
        } catch ( RuntimeException | InvalidArgumentException $e ) {
            $this->check( true, $message );
            return;
        }
        throw new RuntimeException( 'FAIL: ' . $message );
    }

    public function execute(): void {
        if ( getenv( 'MW_ENV' ) === 'production' ) {
            $this->fatalError( 'Run integration fixtures on a development/staging database only.' );
        }
        $db = DraftStore::db();
        $services = MediaWikiServices::getInstance();
        $suffix = bin2hex( random_bytes( 4 ) );
        $db->startAtomic( __METHOD__, IDatabase::ATOMIC_CANCELABLE );
        try {
            $author = User::newSystemUser( 'Prueba autor ' . $suffix, [ 'steal' => false ] );
            $other = User::newSystemUser( 'Prueba otro ' . $suffix, [ 'steal' => false ] );
            $editor = User::newSystemUser( 'Prueba editor ' . $suffix, [ 'steal' => false ] );
            $groups = $services->getUserGroupManager();
            $groups->addUserToGroup( $author, 'contributor' );
            $groups->addUserToGroup( $other, 'contributor' );
            $groups->addUserToGroup( $editor, 'editor' );
            $this->check( $author->isAllowed( 'archivo-propose' ) && !$author->isAllowed( 'edit' ), 'contributor proposes but cannot edit public pages' );
            $this->check( $editor->isAllowed( 'archivo-review' ) && $editor->isAllowed( 'edit' ), 'editor has review and page-edit rights' );
            $this->denied( fn() => DraftStore::save( User::newFromId( 0 ), 0, 0, 'Prueba', 'Texto', false ), 'anonymous cannot create drafts' );
            $this->denied( fn() => DraftStore::title( 'MediaWiki:Common.js' ), 'sensitive namespaces rejected' );
            $this->denied( fn() => DraftStore::publicArticlePrefill( 'MediaWiki:Common.js' ), 'article prefill rejects sensitive namespaces' );
            $titleText = 'Prueba editorial ' . $suffix;
            $id = DraftStore::save( $author, 0, 0, $titleText, 'Texto privado ' . $suffix, false );
            $draft = DraftStore::get( $id, $author );
            $this->check( $draft->aed_status === 'draft', 'new proposal is private draft' );
            $this->check( !Title::newFromText( $titleText )->exists(), 'private draft creates no public wiki page' );
            $this->check( DraftStore::publicArticlePrefill( $titleText ) === [ 'title' => $titleText, 'content' => '' ],
                'article prefill never reads private draft content' );
            $this->denied( fn() => DraftStore::get( $id, $other ), 'another contributor cannot read the draft' );
            $this->denied( fn() => DraftStore::save( $author, $id, 999, $titleText, 'Conflicto', false ), 'stale draft version cannot overwrite content' );
            DraftStore::save( $author, $id, 1, $titleText, 'Texto original con [https://www.rockstargames.com/ fuente oficial].', true );
            $this->check( DraftStore::get( $id, $author )->aed_status === 'review', 'submit transitions to review' );
            $this->denied( fn() => DraftStore::save( $author, $id, 2, $titleText, 'Cambio', false ), 'author cannot alter a pending review' );
            $this->denied( fn() => DraftStore::review( $author, $id, 2, true, '' ), 'contributor cannot publish' );
            $this->denied( fn() => DraftStore::review( $editor, $id, 2, false, '' ), 'return requires an explanatory note' );
            DraftStore::review( $editor, $id, 2, false, 'Añade la fecha de verificación.' );
            $this->check( DraftStore::get( $id, $author )->aed_status === 'rejected', 'editor returns for changes' );
            DraftStore::save( $author, $id, 3, $titleText, 'Texto revisado; fuente y fecha incorporadas.', true );
            DraftStore::review( $editor, $id, 4, true, 'Fuente revisada.' );
            $published = DraftStore::get( $id, $author );
            $this->check( $published->aed_status === 'published' && (int)$published->aed_published_rev > 0, 'publication records a real MediaWiki revision' );
            $rev = $services->getRevisionLookup()->getRevisionById( (int)$published->aed_published_rev );
            $this->check( $rev && $rev->getUser()->getId() === $editor->getId(), 'published revision attributes the editor' );
            $this->check( DraftStore::publicArticlePrefill( $titleText ) === [ 'title' => $titleText,
                'content' => 'Texto revisado; fuente y fecha incorporadas.' ], 'article prefill contains the actual public revision' );
            $db->update( 'revision', [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ],
                [ 'rev_id' => (int)$published->aed_published_rev ], __METHOD__ );
            $this->denied( fn() => DraftStore::publicArticlePrefill( $titleText ), 'article prefill excludes suppressed revision content' );
            $db->update( 'revision', [ 'rev_deleted' => 0 ],
                [ 'rev_id' => (int)$published->aed_published_rev ], __METHOD__ );
            $auditActions = [];
            foreach ( DraftStore::events( $id, $author ) as $event ) {
                $auditActions[] = $event->aea_action;
            }
            $this->check( $auditActions === [ 'publish', 'submit', 'reject', 'submit', 'save' ],
                'audit records save, submit, return, resubmit and publish in order' );

            $conflictTitle = 'Prueba conflicto ' . $suffix;
            $conflictId = DraftStore::save( $author, 0, 0, $conflictTitle, 'Propuesta anterior', true );
            $page = $services->getWikiPageFactory()->newFromTitle( Title::newFromText( $conflictTitle ) );
            $updater = $page->newPageUpdater( $editor );
            $updater->setContent( 'main', new WikitextContent( 'Edición concurrente' ) );
            $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Prueba de conflicto' ) );
            $this->check( $updater->wasSuccessful(), 'concurrent page revision exists' );
            $this->denied( fn() => DraftStore::review( $editor, $conflictId, 1, true, '' ), 'publication refuses overwriting a newer article' );
            $this->check( DraftStore::get( $conflictId, $author )->aed_status === 'review', 'failed publication keeps draft pending' );
        } finally {
            $db->cancelAtomic( __METHOD__ );
        }
        $this->output( $this->checks . " integration checks passed; database fixtures rolled back.\n" );
    }
}

$maintClass = ArchivoEditorialIntegration::class;
require_once RUN_MAINTENANCE_IF_MAIN;
