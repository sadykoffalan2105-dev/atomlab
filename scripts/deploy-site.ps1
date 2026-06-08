# Локальный деплой на GitHub Pages (ветка gh-pages), если Netlify недоступен.
param(
  [string]$Repo = 'https://github.com/sadykoffalan2105-dev/atomlab.git'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$env:VITE_BASE = '/atomlab/'
npm run build

$deployDir = Join-Path $env:TEMP 'atomlab-ghp'
Remove-Item -Recurse -Force $deployDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
Copy-Item -Recurse "$root\dist\*" $deployDir

Set-Location $deployDir
git init -q
git checkout -b gh-pages 2>&1 | Out-Null
git add -A
git commit -m "Deploy site $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git remote add origin $Repo 2>$null
git push -f origin gh-pages

Write-Host ''
Write-Host 'Done. Site: https://sadykoffalan2105-dev.github.io/atomlab/' -ForegroundColor Green
