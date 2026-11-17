[CmdletBinding()]
param(
    [string]$AdminUser = 'Administrador',
    [SecureString]$AdminPassword,
    [string]$PublicOrigin = 'http://127.0.0.1:4173',
    [switch]$SkipSeed,
    [switch]$ResetAdminPassword
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = Join-Path $workspace '.runtime'
$php = Join-Path $runtime 'php\php.exe'
$site = Join-Path $runtime 'site'
$wiki = Join-Path $site 'wiki'
$database = Join-Path $runtime 'data'
$logs = Join-Path $runtime 'logs'
$settings = Join-Path $wiki 'LocalSettings.php'
$projectSettings = Join-Path $workspace 'infra\mediawiki\LocalSettings.php'
$catalog = Join-Path $workspace 'portal\content\catalog.json'

if (-not (Test-Path -LiteralPath $php -PathType Leaf)) {
    throw 'Falta .runtime\php\php.exe. Descarga y verifica PHP 8.3 x64 portable desde windows.php.net; este script no instala software ni descarga archivos.'
}
if (-not (Test-Path -LiteralPath (Join-Path $wiki 'maintenance\run.php') -PathType Leaf)) {
    throw 'Falta MediaWiki en .runtime\site\wiki. Extrae la versión 1.43 LTS verificada desde releases.wikimedia.org sin incluir otra carpeta superior.'
}
if (-not (Test-Path -LiteralPath $projectSettings -PathType Leaf)) { throw 'Falta infra\mediawiki\LocalSettings.php.' }
if ($PublicOrigin -notmatch '^http://(127\.0\.0\.1|localhost):\d{2,5}$') {
    throw 'Este script es solo para desarrollo local: PublicOrigin debe ser http://127.0.0.1:puerto o http://localhost:puerto.'
}
if ($AdminUser.Length -lt 3 -or $AdminUser -match '[\x00-\x1f]') { throw 'El nombre del administrador debe tener al menos tres caracteres y no contener caracteres de control.' }

foreach ($directory in @($database, $logs)) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
$phpExtensionDirectory = (Join-Path $runtime 'php\ext').Replace('\', '/')
$phpErrorLog = (Join-Path $logs 'php-error.log').Replace('\', '/')
$phpIni = @"
extension_dir="$phpExtensionDirectory"
extension=mbstring
extension=intl
extension=pdo_sqlite
extension=sqlite3
extension=fileinfo
extension=openssl
memory_limit=256M
max_execution_time=60
date.timezone=UTC
default_charset=UTF-8
expose_php=Off
display_errors=Off
log_errors=On
error_log="$phpErrorLog"
file_uploads=Off
allow_url_fopen=Off
session.cookie_httponly=1
session.cookie_samesite=Lax
"@
[IO.File]::WriteAllText((Join-Path $runtime 'php\php.ini'), $phpIni, [Text.UTF8Encoding]::new($false))

$env:MW_ENV = 'development'
$env:MW_DB_TYPE = 'sqlite'
$env:MW_DB_NAME = 'archivo'
$env:MW_SQLITE_DATA_DIR = $database
$env:MW_SERVER = $PublicOrigin
$env:MW_SCRIPT_PATH = '/wiki'
$env:MW_INSTALL_PATH = $wiki

$availableExtensions = @(& $php '-m')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PHP. Consulta .runtime\logs\php-error.log.' }
$missingExtensions = @('mbstring', 'intl', 'pdo_sqlite', 'sqlite3', 'fileinfo', 'openssl', 'dom', 'xml') | Where-Object { $availableExtensions -notcontains $_ }
if ($missingExtensions) { throw ('Faltan extensiones PHP: ' + ($missingExtensions -join ', ') + '. Consulta .runtime\logs\php-error.log.') }
Write-Output 'Extensiones PHP disponibles.'

$installedNow = $false
if (-not (Test-Path -LiteralPath $settings -PathType Leaf)) {
    if (-not $AdminPassword) { $AdminPassword = Read-Host 'Elige la contraseña del administrador local (mínimo 14 caracteres)' -AsSecureString }
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
    try {
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        if ($plainPassword.Length -lt 14 -or $plainPassword -match '[\r\n]') { throw 'La contraseña debe tener al menos 14 caracteres y no contener saltos de línea.' }
        # php://stdin avoids putting the administrator password in command-line arguments or a temporary file.
        $installerArguments = @(
            (Join-Path $wiki 'maintenance\run.php'), 'install',
            '--dbtype=sqlite', '--dbname=archivo', "--dbpath=$database",
            "--server=$PublicOrigin", '--scriptpath=/wiki', '--lang=es',
            '--skins=Vector', '--passfile=php://stdin', 'Archivo de Juego', $AdminUser
        )
        $previousEncoding = $OutputEncoding
        try {
            $OutputEncoding = [Text.UTF8Encoding]::new($false)
            $plainPassword | & $php @installerArguments
        } finally { $OutputEncoding = $previousEncoding }
        if ($LASTEXITCODE -ne 0) { throw 'La instalación de MediaWiki no se completó. No vuelvas a instalar sobre la base de datos sin revisar el error.' }
        $installedNow = $true
    } finally {
        $plainPassword = $null
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        $AdminPassword = $null
    }
} else {
    Write-Output 'Se conserva la instalación existente y su cuenta de administrador.'
}

$settingsText = [IO.File]::ReadAllText($settings)
$includeMarker = '// Archivo de Juego: project configuration'
if (-not $settingsText.Contains($includeMarker)) {
    $includePath = $projectSettings.Replace('\', '/').Replace("'", "\'")
    $addition = "`r`n$includeMarker`r`nrequire_once '$includePath';`r`n"
    [IO.File]::AppendAllText($settings, $addition, [Text.UTF8Encoding]::new($false))
}

$extensionSource = Join-Path $workspace 'wiki\extensions\ArchivoEditorial'
$extensionTarget = Join-Path $wiki 'extensions\ArchivoEditorial'
if (-not (Test-Path -LiteralPath (Join-Path $extensionSource 'extension.json'))) { throw 'Falta la extensión ArchivoEditorial del proyecto.' }
[IO.Directory]::CreateDirectory($extensionTarget) | Out-Null
Get-ChildItem -LiteralPath $extensionSource -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $extensionTarget -Recurse -Force
}

& $php (Join-Path $wiki 'maintenance\run.php') 'update' '--quick'
if ($LASTEXITCODE -ne 0) { throw 'No se ha completado la actualización del esquema de MediaWiki y ArchivoEditorial.' }

if ($ResetAdminPassword -and -not $installedNow) {
    if (-not $AdminPassword) { $AdminPassword = Read-Host 'Elige la nueva contraseña del administrador local (mínimo 14 caracteres)' -AsSecureString }
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
    try {
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        if ($plainPassword.Length -lt 14 -or $plainPassword -match '[\r\n]') { throw 'La contraseña debe tener al menos 14 caracteres y no contener saltos de línea.' }
        $previousEncoding = $OutputEncoding
        try {
            $OutputEncoding = [Text.UTF8Encoding]::new($false)
            Push-Location -LiteralPath $workspace
            try {
                $plainPassword | & $php (Join-Path $wiki 'maintenance\run.php') './scripts/seed-wiki.php' "--reset-admin-password=$AdminUser"
            } finally { Pop-Location }
        } finally { $OutputEncoding = $previousEncoding }
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar la contraseña del administrador existente.' }
    } finally {
        $plainPassword = $null
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        $AdminPassword = $null
    }
}

if (-not $SkipSeed) {
    if (-not (Test-Path -LiteralPath $catalog -PathType Leaf)) { throw 'Falta portal\content\catalog.json. Puedes ejecutar con -SkipSeed mientras se prepara el catálogo.' }
    Push-Location -LiteralPath $workspace
    try {
        & $php (Join-Path $wiki 'maintenance\run.php') './scripts/seed-wiki.php' "--catalog=$catalog"
    } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'No se ha completado la importación inicial. Las páginas existentes se conservan.' }
}

Write-Output 'MediaWiki local configurado. Ejecuta scripts\start-local.ps1 en otra terminal.'
Write-Output 'Las claves y la base de datos están en .runtime; no las publiques ni las añadas al control de versiones.'
