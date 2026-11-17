<?php
namespace ArchivoEditorial;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use Wikimedia\Rdbms\IDatabase;

/** Draft text lives only in extension tables, never in searchable wiki revisions. */
final class DraftStore {
    public static function db() {
        return MediaWikiServices::getInstance()->getDBLoadBalancer()->getConnection( DB_PRIMARY );
    }

    public static function title( string $text ): Title {
        $title = Title::newFromText( trim( $text ), NS_MAIN );
        if ( !$title || $title->getNamespace() !== NS_MAIN || $title->isExternal() ||
            $title->getDBkey() === '' ) {
            throw new \InvalidArgumentException( 'Usa un título válido del espacio principal, sin prefijos.' );
        }
        return $title;
    }

    public static function get( int $id, User $user ) {
        $row = self::db()->selectRow( 'archivo_draft', '*', [ 'aed_id' => $id ], __METHOD__ );
        if ( !$row || ( (int)$row->aed_user !== $user->getId() && !$user->isAllowed( 'archivo-review' ) ) ) {
            throw new \RuntimeException( 'La propuesta no existe o no tienes acceso.' );
        }
        return $row;
    }

    public static function listing( User $user ) {
        $conditions = $user->isAllowed( 'archivo-review' ) ? [] : [ 'aed_user' => $user->getId() ];
        return self::db()->select( 'archivo_draft', '*', $conditions, __METHOD__,
            [ 'ORDER BY' => 'aed_updated DESC', 'LIMIT' => 100 ] );
    }

    private static function audit( int $id, User $user, string $action, string $note = '' ): void {
        $db = self::db();
        $db->insert( 'archivo_audit', [
            'aea_draft' => $id, 'aea_actor' => $user->getId(),
            'aea_timestamp' => $db->timestamp(), 'aea_action' => $action, 'aea_note' => $note
        ], __METHOD__ );
    }

    public static function events( int $id, User $user ) {
        self::get( $id, $user );
        return self::db()->select( 'archivo_audit', '*', [ 'aea_draft' => $id ], __METHOD__,
            [ 'ORDER BY' => 'aea_id DESC', 'LIMIT' => 50 ] );
    }

    /** POST token is checked by SpecialArchivoEditorial before this method. */
    public static function save( User $user, int $id, int $version, string $titleText,
        string $content, bool $submit ): int {
        if ( !$user->isRegistered() || !$user->isAllowed( 'archivo-propose' ) || $user->getBlock() ) {
            throw new \RuntimeException( 'No tienes permiso para enviar propuestas.' );
        }
        $title = self::title( $titleText );
        if ( trim( $content ) === '' || strlen( $content ) > 200000 ) {
            throw new \InvalidArgumentException( 'El contenido debe tener entre 1 y 200.000 bytes.' );
        }
        $db = self::db();
        $db->startAtomic( __METHOD__, IDatabase::ATOMIC_CANCELABLE );
        try {
            $now = $db->timestamp();
            if ( $id ) {
                $old = self::get( $id, $user );
                if ( (int)$old->aed_user !== $user->getId() ||
                    !in_array( $old->aed_status, [ 'draft', 'rejected' ], true ) ) {
                    throw new \RuntimeException( 'Solo el autor puede editar borradores o propuestas devueltas.' );
                }
                $base = $old->aed_title === $title->getDBkey() ? (int)$old->aed_base_rev : $title->getLatestRevID();
                $db->update( 'archivo_draft', [
                    'aed_title' => $title->getDBkey(), 'aed_content' => $content,
                    'aed_status' => $submit ? 'review' : 'draft', 'aed_updated' => $now,
                    'aed_base_rev' => $base, 'aed_version' => $version + 1
                ], [ 'aed_id' => $id, 'aed_version' => $version,
                    'aed_status' => [ 'draft', 'rejected' ] ], __METHOD__ );
                if ( !$db->affectedRows() ) {
                    throw new \RuntimeException( 'La propuesta cambió en otra sesión. Recarga antes de editar.' );
                }
            } else {
                $db->insert( 'archivo_draft', [
                    'aed_title' => $title->getDBkey(), 'aed_content' => $content,
                    'aed_status' => $submit ? 'review' : 'draft', 'aed_user' => $user->getId(),
                    'aed_created' => $now, 'aed_updated' => $now, 'aed_reviewer' => 0,
                    'aed_note' => '', 'aed_base_rev' => $title->getLatestRevID(),
                    'aed_published_rev' => 0, 'aed_version' => 1
                ], __METHOD__ );
                $id = (int)$db->insertId();
            }
            self::audit( $id, $user, $submit ? 'submit' : 'save' );
            $db->endAtomic( __METHOD__ );
        } catch ( \Throwable $e ) {
            $db->cancelAtomic( __METHOD__ );
            throw $e;
        }
        return $id;
    }

    public static function review( User $user, int $id, int $version, bool $publish, string $note ): void {
        if ( !$user->isRegistered() || !$user->isAllowed( 'archivo-review' ) || $user->getBlock() ) {
            throw new \RuntimeException( 'La revisión requiere el rol editor o administrador.' );
        }
        $note = trim( $note );
        if ( strlen( $note ) > 2000 || ( !$publish && $note === '' ) ) {
            throw new \InvalidArgumentException( 'Al devolver una propuesta, explica los cambios (máximo 2.000 bytes).' );
        }
        $db = self::db();
        $db->startAtomic( __METHOD__, IDatabase::ATOMIC_CANCELABLE );
        try {
            $draft = self::get( $id, $user );
            if ( $draft->aed_status !== 'review' || (int)$draft->aed_version !== $version ) {
                throw new \RuntimeException( 'La propuesta ya no está pendiente o cambió. Recarga la página.' );
            }
            // Claim the exact version before publishing; rollback restores review on any failure.
            $db->update( 'archivo_draft', [ 'aed_version' => $version + 1 ],
                [ 'aed_id' => $id, 'aed_version' => $version, 'aed_status' => 'review' ], __METHOD__ );
            if ( !$db->affectedRows() ) {
                throw new \RuntimeException( 'Otra sesión ha revisado esta propuesta.' );
            }
            $revisionId = 0;
            if ( $publish ) {
                $title = self::title( str_replace( '_', ' ', $draft->aed_title ) );
                $services = MediaWikiServices::getInstance();
                $permissionManager = $services->getPermissionManager();
                if ( !$permissionManager->userCan( 'edit', $user, $title ) ||
                    ( !$title->exists() && !$permissionManager->userCan( 'createpage', $user, $title ) ) ) {
                    throw new \RuntimeException( 'No tienes permiso para publicar en esta página.' );
                }
                $page = $services->getWikiPageFactory()->newFromTitle( $title );
                $updater = $page->newPageUpdater( $user );
                if ( $updater->hasEditConflict( (int)$draft->aed_base_rev ) ) {
                    throw new \RuntimeException( 'El artículo cambió desde que se creó la propuesta. Crea una nueva propuesta sobre la versión actual.' );
                }
                $updater->setContent( 'main', new WikitextContent( $draft->aed_content ) );
                $updater->saveRevision( CommentStoreComment::newUnsavedComment(
                    'Publicación editorial de propuesta #' . $id . ( $note !== '' ? ': ' . $note : '' )
                ) );
                if ( !$updater->wasSuccessful() ) {
                    throw new \RuntimeException( 'MediaWiki no pudo guardar la revisión. El borrador sigue pendiente.' );
                }
                $revision = $updater->getNewRevision();
                $revisionId = $revision ? $revision->getId() : $page->getLatest();
            }
            $db->update( 'archivo_draft', [
                'aed_status' => $publish ? 'published' : 'rejected',
                'aed_reviewer' => $user->getId(), 'aed_note' => $note,
                'aed_published_rev' => $revisionId, 'aed_updated' => $db->timestamp()
            ], [ 'aed_id' => $id ], __METHOD__ );
            self::audit( $id, $user, $publish ? 'publish' : 'reject', $note );
            $db->endAtomic( __METHOD__ );
        } catch ( \Throwable $e ) {
            $db->cancelAtomic( __METHOD__ );
            throw $e;
        }
    }
}
