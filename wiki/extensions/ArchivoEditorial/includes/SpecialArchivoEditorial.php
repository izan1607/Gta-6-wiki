<?php
namespace ArchivoEditorial;

use MediaWiki\Html\Html;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;

final class SpecialArchivoEditorial extends SpecialPage {
    public function __construct() {
        parent::__construct( 'ArchivoEditorial' );
    }

    public function execute( $subPage ): void {
        $this->setHeaders();
        $out = $this->getOutput();
        $out->enableClientCache( false );
        $out->setRobotPolicy( 'noindex,nofollow' );
        $out->addVaryHeader( 'Cookie' );
        $user = $this->getUser();
        if ( !$user->isRegistered() ||
            ( !$user->isAllowed( 'archivo-propose' ) && !$user->isAllowed( 'archivo-review' ) ) ) {
            $this->displayRestrictionError();
            return;
        }
        $request = $this->getRequest();
        $id = $request->getInt( 'draft' );
        if ( $request->wasPosted() ) {
            if ( !$user->matchEditToken( $request->getText( 'token' ), 'archivo-editorial' ) ) {
                $out->addHTML( Html::errorBox( 'La sesión caducó o el token no es válido. Recarga e inténtalo de nuevo.' ) );
                return;
            }
            if ( $user->pingLimiter( 'edit' ) ) {
                $out->addHTML( Html::errorBox( 'Has enviado demasiados cambios. Espera un minuto.' ) );
                return;
            }
            try {
                $intent = $request->getText( 'intent' );
                $version = $request->getInt( 'version' );
                if ( $intent === 'save' || $intent === 'submit' ) {
                    $id = DraftStore::save( $user, $id, $version, $request->getText( 'title' ),
                        $request->getText( 'content' ), $intent === 'submit' );
                } elseif ( $intent === 'publish' || $intent === 'reject' ) {
                    DraftStore::review( $user, $id, $version, $intent === 'publish', $request->getText( 'note' ) );
                } else {
                    throw new \InvalidArgumentException( 'Acción no válida.' );
                }
                $out->redirect( $this->getPageTitle()->getLocalURL( [ 'draft' => $id, 'saved' => 1 ] ) );
                return;
            } catch ( \InvalidArgumentException | \RuntimeException $e ) {
                $out->addHTML( Html::errorBox( htmlspecialchars( $e->getMessage(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ) ) );
            }
        }
        $out->addHTML( Html::element( 'p', [],
            'Los borradores son privados: solo los ve su autor y los editores. Prohibidos materiales filtrados, imágenes ajenas y datos personales. Cita fuentes oficiales y fecha cada dato.' ) );
        $out->addHTML( Html::element( 'p', [],
            'Flujo: borrador → revisión → publicado. Una devolución permite corregir y reenviar. La publicación crea una revisión pública en MediaWiki.' ) );
        if ( $request->getBool( 'saved' ) ) {
            $out->addHTML( Html::successBox( 'Cambio guardado.' ) );
        }
        $out->addHTML( Html::element( 'a', [ 'href' => $this->getPageTitle()->getLocalURL() ], 'Nueva propuesta y listado' ) );
        if ( $id ) {
            try {
                $row = DraftStore::get( $id, $user );
                $this->renderDraft( $row );
            } catch ( \RuntimeException $e ) {
                $out->addHTML( Html::errorBox( htmlspecialchars( $e->getMessage(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ) ) );
            }
        } else {
            $this->renderEditForm( null );
        }
        $out->addHTML( Html::element( 'h2', [], $user->isAllowed( 'archivo-review' ) ? 'Propuestas recientes' : 'Mis propuestas' ) );
        $out->addHTML( '<ul>' );
        foreach ( DraftStore::listing( $user ) as $row ) {
            $out->addHTML( Html::rawElement( 'li', [],
                Html::element( 'a', [ 'href' => $this->getPageTitle()->getLocalURL( [ 'draft' => $row->aed_id ] ) ],
                    '#' . $row->aed_id . ' · ' . str_replace( '_', ' ', $row->aed_title ) ) .
                Html::element( 'span', [], ' — ' . self::label( $row->aed_status ) . ' · ' . $row->aed_updated ) ) );
        }
        $out->addHTML( '</ul>' );
    }

    private static function label( string $status ): string {
        return [ 'draft' => 'Borrador', 'review' => 'En revisión',
            'rejected' => 'Devuelto para cambios', 'published' => 'Publicado' ][$status] ?? $status;
    }

    private function hidden( string $name, $value ): string {
        return Html::hidden( $name, (string)$value );
    }

    private function renderEditForm( $row ): void {
        if ( !$this->getUser()->isAllowed( 'archivo-propose' ) ) {
            return;
        }
        $out = $this->getOutput();
        $out->addHTML( Html::openElement( 'form', [ 'method' => 'post', 'action' => $this->getPageTitle()->getLocalURL() ] ) .
            $this->hidden( 'token', $this->getUser()->getEditToken( 'archivo-editorial' ) ) .
            $this->hidden( 'draft', $row ? $row->aed_id : 0 ) .
            $this->hidden( 'version', $row ? $row->aed_version : 0 ) .
            Html::element( 'p', [], 'Redacta texto original en wikitext. No incluyas HTML, vídeos incrustados ni material protegido.' ) .
            Html::element( 'label', [ 'for' => 'archivo-title' ], 'Título del artículo' ) .
            Html::input( 'title', $row ? str_replace( '_', ' ', $row->aed_title ) : '', 'text',
                [ 'id' => 'archivo-title', 'required' => true, 'maxlength' => 255, 'size' => 60 ] ) .
            Html::element( 'p' ) .
            Html::element( 'label', [ 'for' => 'archivo-content' ], 'Contenido y fuentes' ) .
            Html::element( 'textarea', [ 'name' => 'content', 'id' => 'archivo-content',
                'required' => true, 'rows' => 20, 'cols' => 90, 'maxlength' => 200000 ], $row ? $row->aed_content : '' ) .
            Html::element( 'p' ) .
            Html::element( 'button', [ 'type' => 'submit', 'name' => 'intent', 'value' => 'save' ], 'Guardar borrador privado' ) . ' ' .
            Html::element( 'button', [ 'type' => 'submit', 'name' => 'intent', 'value' => 'submit' ], 'Enviar a revisión' ) .
            Html::closeElement( 'form' ) );
    }

    private function renderDraft( $row ): void {
        $out = $this->getOutput();
        $out->addHTML( Html::element( 'h2', [], '#' . $row->aed_id . ' · ' . str_replace( '_', ' ', $row->aed_title ) ) .
            Html::element( 'p', [], 'Estado: ' . self::label( $row->aed_status ) .
                ' · Autor (ID): ' . $row->aed_user . ' · Versión: ' . $row->aed_version ) );
        if ( $row->aed_note !== '' ) {
            $out->addHTML( Html::element( 'p', [], 'Nota de revisión: ' . $row->aed_note ) );
        }
        if ( (int)$row->aed_user === $this->getUser()->getId() &&
            in_array( $row->aed_status, [ 'draft', 'rejected' ], true ) ) {
            $this->renderEditForm( $row );
        } else {
            // Never parse private proposals: template expansion could expose private text.
            $out->addHTML( Html::element( 'pre', [ 'style' => 'white-space:pre-wrap;overflow-wrap:anywhere' ], $row->aed_content ) );
        }
        if ( $row->aed_status === 'review' && $this->getUser()->isAllowed( 'archivo-review' ) ) {
            $out->addHTML( Html::openElement( 'form', [ 'method' => 'post', 'action' => $this->getPageTitle()->getLocalURL() ] ) .
                $this->hidden( 'token', $this->getUser()->getEditToken( 'archivo-editorial' ) ) .
                $this->hidden( 'draft', $row->aed_id ) . $this->hidden( 'version', $row->aed_version ) .
                Html::element( 'label', [ 'for' => 'archivo-note' ], 'Nota de revisión (obligatoria al devolver)' ) .
                Html::element( 'textarea', [ 'id' => 'archivo-note', 'name' => 'note', 'rows' => 3, 'cols' => 70, 'maxlength' => 2000 ], '' ) .
                Html::element( 'p' ) .
                Html::element( 'button', [ 'name' => 'intent', 'value' => 'publish', 'type' => 'submit' ], 'Aprobar y publicar' ) . ' ' .
                Html::element( 'button', [ 'name' => 'intent', 'value' => 'reject', 'type' => 'submit' ], 'Devolver para cambios' ) .
                Html::closeElement( 'form' ) );
        }
        if ( $row->aed_published_rev ) {
            $title = Title::newFromText( $row->aed_title );
            $out->addHTML( Html::element( 'a', [ 'href' => $title->getLocalURL( [ 'oldid' => $row->aed_published_rev ] ) ],
                'Ver revisión publicada #' . $row->aed_published_rev ) );
        }
        $out->addHTML( Html::element( 'h3', [], 'Auditoría de la propuesta' ) . '<ul>' );
        foreach ( DraftStore::events( (int)$row->aed_id, $this->getUser() ) as $event ) {
            $out->addHTML( Html::element( 'li', [], $event->aea_timestamp . ' · usuario #' . $event->aea_actor .
                ' · ' . $event->aea_action . ( $event->aea_note !== '' ? ' · ' . $event->aea_note : '' ) ) );
        }
        $out->addHTML( '</ul>' );
    }
}
