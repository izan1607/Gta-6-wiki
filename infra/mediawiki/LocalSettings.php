<?php
/** Environment-driven configuration; may be included after the installer-generated settings. */
if ( !defined( 'MEDIAWIKI' ) ) { exit; }

$archivoEnv = static function ( string $name, $fallback = '' ) {
    $value = getenv( $name );
    return $value !== false && $value !== '' ? $value : $fallback;
};
$archivoProduction = $archivoEnv( 'MW_ENV', 'development' ) === 'production';
$wgSitename = $archivoEnv( 'MW_SITE_NAME', 'Archivo de Juego' );
$wgMetaNamespace = 'Archivo';
$wgLanguageCode = 'es';
$wgServer = $archivoEnv( 'MW_SERVER', 'http://127.0.0.1:4173' );
$wgCanonicalServer = $wgServer;
$wgScriptPath = $archivoEnv( 'MW_SCRIPT_PATH', '/wiki' );
$wgArticlePath = $wgScriptPath . '/index.php?title=$1';
$wgResourceBasePath = $wgScriptPath;
$wgEmergencyContact = $archivoEnv( 'MW_CONTACT_EMAIL', '' );
$wgPasswordSender = $wgEmergencyContact;
$wgEnableEmail = $wgEmergencyContact !== '';
$wgEnableUserEmail = false;

$wgDBtype = $archivoEnv( 'MW_DB_TYPE', $wgDBtype ?? 'mysql' );
$wgDBname = $archivoEnv( 'MW_DB_NAME', $wgDBname ?? 'archivo' );
$wgDBprefix = $archivoEnv( 'MW_DB_PREFIX', $wgDBprefix ?? '' );
if ( $wgDBtype === 'sqlite' ) {
    $wgSQLiteDataDir = $archivoEnv( 'MW_SQLITE_DATA_DIR',
        $archivoEnv( 'MW_DB_PATH', $wgSQLiteDataDir ?? '' ) );
    if ( $wgSQLiteDataDir === '' ) {
        throw new RuntimeException( 'Set MW_DB_PATH outside the public web directory.' );
    }
    $wgDBserver = false;
} else {
    $wgDBtype = 'mysql'; // MariaDB uses MediaWiki's mysql driver.
    $wgDBserver = $archivoEnv( 'MW_DB_HOST', 'db' );
    $wgDBuser = $archivoEnv( 'MW_DB_USER', 'archivo' );
    $wgDBpassword = $archivoEnv( 'MW_DB_PASSWORD' );
    $wgDBTableOptions = 'ENGINE=InnoDB, DEFAULT CHARSET=binary';
}
$wgSecretKey = $archivoEnv( 'MW_SECRET_KEY', $wgSecretKey ?? '' );
$wgUpgradeKey = $archivoEnv( 'MW_UPGRADE_KEY', $wgUpgradeKey ?? '' );
if ( strlen( $wgSecretKey ) < 32 || strlen( $wgUpgradeKey ) < 16 ||
    str_starts_with( $wgSecretKey, 'REPLACE_' ) || str_starts_with( $wgUpgradeKey, 'REPLACE_' ) ) {
    throw new RuntimeException( 'MediaWiki needs persistent random secret and upgrade keys.' );
}
if ( $archivoProduction && !str_starts_with( $wgServer, 'https://' ) ) {
    throw new RuntimeException( 'Production requires MW_SERVER=https://your-domain.' );
}
$wgForceHTTPS = $archivoProduction;
$wgCookieSecure = $archivoProduction;
$wgCookieHttpOnly = true;
$wgCookieSameSite = 'Lax';
$wgCookiePath = $wgScriptPath;
$wgPasswordDefault = 'argon2';
$wgRawHtml = false;
$wgEnableUploads = false;
$wgAllowExternalImages = false;
$wgAllowImageTag = false;
$wgAllowUserJs = false;
$wgAllowUserCss = false;
$wgAllowSiteJs = false;
$wgAllowSiteCSSOnRestrictedPages = false;
$wgShowExceptionDetails = !$archivoProduction;
$wgShowDBErrorBacktrace = !$archivoProduction;
$wgShowSQLErrors = false;
$wgCSPHeader = [ 'default-src' => true, 'includeCORS' => false, 'report-uri' => false ];
$wgCSPReportOnlyHeader = false;
$wgPingback = false;
$wgEnableRestAPI = true;
$wgWhitelistRead = [];
$wgRateLimits['edit']['user'] = [ 12, 60 ];
$wgRateLimits['edit']['ip'] = [ 12, 60 ];
$wgRateLimits['createaccount']['ip'] = [ 3, 86400 ];
$wgRateLimits['badcaptcha']['ip'] = [ 5, 300 ];

// Readers cannot edit public pages. Contributors use the private extension table.
$wgGroupPermissions['*']['read'] = true;
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['*']['createaccount'] = false;
$wgGroupPermissions['*']['writeapi'] = false;
$wgGroupPermissions['user']['edit'] = false;
$wgGroupPermissions['user']['createpage'] = false;
$wgGroupPermissions['user']['createtalk'] = false;
$wgGroupPermissions['user']['move'] = false;
$wgGroupPermissions['user']['upload'] = false;
$wgGroupPermissions['user']['writeapi'] = false;
$wgGroupPermissions['contributor']['edit'] = false;
$wgGroupPermissions['editor']['edit'] = true;
$wgGroupPermissions['editor']['createpage'] = true;
$wgGroupPermissions['editor']['createtalk'] = true;
$wgGroupPermissions['editor']['writeapi'] = true;
$wgGroupPermissions['editor']['move'] = true;
$wgGroupPermissions['editor']['editcontentmodel'] = false;
$wgGroupPermissions['sysop']['edit'] = true;
$wgGroupPermissions['sysop']['createpage'] = true;
$wgGroupPermissions['sysop']['createtalk'] = true;
$wgGroupPermissions['sysop']['writeapi'] = true;
$wgNamespaceProtection[NS_TEMPLATE] = [ 'archivo-review' ];
$wgNamespaceProtection[NS_MEDIAWIKI] = [ 'editinterface' ];
$wgNamespaceProtection[NS_CATEGORY] = [ 'archivo-review' ];
$wgAddGroups['sysop'] = [ 'contributor', 'editor' ];
$wgRemoveGroups['sysop'] = [ 'contributor', 'editor' ];

// Installer settings may already have loaded the skin.
if ( !isset( $wgValidSkinNames['vector'] ) ) {
    wfLoadSkin( 'Vector' );
}
$wgDefaultSkin = 'vector-2022';
$wgDefaultUserOptions['skin-theme'] = 'os';
wfLoadExtension( 'ArchivoEditorial' );
if ( is_file( $IP . '/extensions/OATHAuth/extension.json' ) ) {
    wfLoadExtension( 'OATHAuth' );
    $wgGroupPermissions['sysop']['oathauth-enable'] = true;
    $wgGroupPermissions['editor']['oathauth-enable'] = true;
    // REL1_43 setting; does not use the 1.46-only RestrictedGroups API.
    $wgOATHRequiredForGroups = $archivoProduction ? [ 'sysop' ] : [];
} elseif ( $archivoProduction ) {
    throw new RuntimeException( 'Production requires the compatible OATHAuth extension.' );
}

$wgFooterIcons['poweredby'] = [];
$wgRightsText = 'Textos originales de la comunidad; las marcas pertenecen a sus titulares.';
$wgRightsPage = 'Archivo:Licencia editorial';
$wgSiteNotice = 'Wiki de fans independiente, sin afiliación con Rockstar Games ni Take-Two Interactive. Información sujeta a cambios; comprueba las fuentes y fechas.';
