<?php
namespace ArchivoEditorial;

use MediaWiki\Installer\DatabaseUpdater;

final class Hooks {
    public static function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater ): void {
        $type = $updater->getDB()->getType();
        if ( !in_array( $type, [ 'mysql', 'sqlite' ], true ) ) {
            throw new \RuntimeException( 'ArchivoEditorial supports MySQL/MariaDB and SQLite only.' );
        }
        foreach ( [ 'archivo_draft', 'archivo_audit' ] as $table ) {
            $updater->addExtensionTable( $table, __DIR__ . '/../sql/' . $type . '/' . $table . '.sql' );
        }
    }
}
