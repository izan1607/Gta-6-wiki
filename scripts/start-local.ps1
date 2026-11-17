[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$WikiPort = 8081,
    [string]$PublicOrigin = 'http://127.0.0.1:4173'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = Join-Path $workspace '.runtime'
$php = Join-Path $runtime 'php\php.exe'
$site = Join-Path $runtime 'site'
$wiki = Join-Path $site 'wiki'
if (-not (Test-Path -LiteralPath $php -PathType Leaf) -or -not (Test-Path -LiteralPath (Join-Path $wiki 'LocalSettings.php') -PathType Leaf)) {
    throw 'Falta la instalación local. Ejecuta scripts\setup-local.ps1 primero.'
}
if ($PublicOrigin -notmatch '^http://(127\.0\.0\.1|localhost):\d{2,5}$') { throw 'PublicOrigin debe ser un origen HTTP local con puerto.' }

$env:MW_ENV = 'development'
$env:MW_DB_TYPE = 'sqlite'
$env:MW_DB_NAME = 'archivo'
$env:MW_SQLITE_DATA_DIR = Join-Path $runtime 'data'
$env:MW_SERVER = $PublicOrigin
$env:MW_SCRIPT_PATH = '/wiki'
$env:MW_INSTALL_PATH = $wiki

Write-Output "MediaWiki: http://127.0.0.1:$WikiPort/wiki/index.php"
Write-Output "Origen de navegación a través del portal: $PublicOrigin/wiki/index.php"
Write-Output 'Este servidor PHP de desarrollo solo escucha en loopback. Deténlo con Ctrl+C.'
Write-Output 'Arranca el portal Node en otra terminal según docs/despliegue.md.'
& $php '-S' "127.0.0.1:$WikiPort" '-t' $site
exit $LASTEXITCODE
