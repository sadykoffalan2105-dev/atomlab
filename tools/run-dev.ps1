param(
  [switch]$Install,
  [switch]$Electron
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ($Install) {
  npm.cmd install
}

if ($Electron) {
  npm.cmd run electron:dev
} else {
  npm.cmd run dev
}
