<?php
/** Read-only verification of production OATH group restrictions for an unenrolled admin. */
use MediaWiki\Context\RequestContext;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;

$archivoInstallPath = $IP ?? getenv( 'MW_INSTALL_PATH' ) ?: dirname( __DIR__, 4 ) . '/.runtime/site/wiki';
require_once $archivoInstallPath . '/maintenance/Maintenance.php';

class ArchivoOathPolicyCheck extends Maintenance {
    public function __construct() {
        parent::__construct();
        $this->addDescription( 'Comprueba sin escribir que las cuentas administrativas sin 2FA pierden sus permisos privilegiados.' );
        $this->addOption( 'user', 'Nombre de administrador existente sin 2FA', true, true );
    }
    public function execute(): void {
        $services = MediaWikiServices::getInstance();
        $config = $services->getMainConfig();
        $required = $config->get( 'OATHRequiredForGroups' );
        foreach ( [ 'sysop', 'bureaucrat', 'interface-admin' ] as $group ) {
            if ( !in_array( $group, $required, true ) ) {
                $this->fatalError( 'La política de producción debe requerir 2FA para ' . $group );
            }
        }
        $user = $services->getUserFactory()->newFromName( $this->getOption( 'user' ) );
        if ( !$user || !$user->isRegistered() ) { $this->fatalError( 'Usuario de prueba inexistente.' ); }
        RequestContext::getMain()->setUser( $user );
        $rawGroups = $services->getUserGroupManager()->getUserGroups( $user );
        if ( !in_array( 'sysop', $rawGroups, true ) ) { $this->fatalError( 'La cuenta debe ser sysop en la base de datos.' ); }
        $oathUser = $services->getService( 'OATHUserRepository' )->findByUser( $user );
        if ( $oathUser->isTwoFactorAuthEnabled() ) { $this->fatalError( 'Usa una cuenta de staging sin 2FA; esta ya lo tiene activado.' ); }
        foreach ( [ 'archivo-review', 'userrights', 'editinterface' ] as $right ) {
            if ( $user->isAllowed( $right ) ) { $this->fatalError( 'La cuenta sin 2FA conserva indebidamente: ' . $right ); }
        }
        if ( !$user->isAllowed( 'oathauth-enable' ) ) { $this->fatalError( 'La cuenta debe poder inscribir su segundo factor.' ); }
        $this->output( "PASS: admin sin 2FA no puede revisar, asignar grupos ni editar interfaz; puede inscribirse en OATHAuth. Sin cambios de datos.\n" );
    }
}
$maintClass = ArchivoOathPolicyCheck::class;
require_once RUN_MAINTENANCE_IF_MAIN;
