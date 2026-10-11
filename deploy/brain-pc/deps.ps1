# Зависимости мозга. Мозгу из npm нужен только tsx (замер 11.10: внешних пакетов у brain/** и scripts/brain/** нет),
# поэтому по умолчанию — лёгкий режим: C:\ATOMLAB\runtime с одним tsx той же версии, что в package-lock.json (≈ 11 МБ),
# вместо полного npm ci (≈ 1,1 ГБ: electron, vite, playwright…). Проверка probe-deps.mts: если мозгу понадобился
# новый пакет — сам переключаюсь на полный `npm ci --ignore-scripts` в репозитории.
param([string]$Root = 'C:\ATOMLAB', [switch]$Full, [switch]$DryRun)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
if (-not $script:LogFile) { $script:LogFile = Join-Path $paths.Logs 'deps.log' }
Update-PathFromRegistry
$node = Find-Node
$npm = Find-Npm
if (-not $node -or -not $npm) { throw 'нет Node.js/npm' }
$env:npm_config_cache = $paths.Cache
$env:npm_config_update_notifier = 'false'
$env:npm_config_fund = 'false'
$env:npm_config_audit = 'false'

function Get-LockTsxVersion {
  $lock = Join-Path $paths.Repo 'package-lock.json'
  if (-not (Test-Path -LiteralPath $lock)) { return $null }
  $m = [regex]::Match((Get-Content -LiteralPath $lock -Raw -Encoding UTF8), '"node_modules/tsx":\s*\{\s*"version":\s*"([^"]+)"')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

function Test-BrainDeps {
  $loader = Get-TsxLoader $paths
  if (-not $loader) { return $false }
  $probe = Join-Path $paths.Repo 'deploy\brain-pc\probe-deps.mts'
  if (-not (Test-Path -LiteralPath $probe)) { $probe = Join-Path $paths.Bin 'probe-deps.mts' }
  Push-Location $paths.Repo
  try {
    $out = (& $node --import $loader $probe 2>&1 | Out-String)
  } finally { Pop-Location }
  if ($out -match 'deps-ok') { Ok 'мозг загружается (probe-deps)'; return $true }
  Warn ('probe-deps: ' + ($out.Trim() -replace '\s+', ' ').Substring(0, [Math]::Min(400, $out.Trim().Length)))
  return $false
}

$state = Read-State $paths
$mode = 'minimal'
if ($Full -or $state.deps -eq 'full') { $mode = 'full' }

if ($mode -eq 'minimal') {
  $ver = Get-LockTsxVersion
  if (-not $ver) { $ver = '4.21.0' }
  $have = $null
  $pj = Join-Path $paths.Runtime 'node_modules\tsx\package.json'
  if (Test-Path -LiteralPath $pj) { $have = (Read-Json $pj).version }
  if ($have -ne $ver) {
    Act "runtime: npm install tsx@$ver (лёгкий режим)" {
      New-Item -ItemType Directory -Force -Path $paths.Runtime | Out-Null
      Write-JsonNoBom (Join-Path $paths.Runtime 'package.json') ([ordered]@{ name = 'atomlab-brain-runtime'; private = $true; dependencies = [ordered]@{ tsx = $ver } })
      Push-Location $paths.Runtime
      try { & $npm install --no-audit --no-fund --loglevel=error 2>&1 | Out-Host } finally { Pop-Location }
      if ($LASTEXITCODE -ne 0) { throw "npm install tsx@$ver не удался" }
    }
  } else { Ok "runtime: tsx $ver уже стоит" }
  if ($script:AtomDry) { return }
  if (Test-BrainDeps) { return }
  Warn 'мозгу нужны пакеты сверх tsx — перехожу на полный npm ci'
  $mode = 'full'
}

Act 'npm ci --ignore-scripts в репозитории (полный режим)' {
  Push-Location $paths.Repo
  try { & $npm ci --ignore-scripts --no-audit --no-fund --loglevel=error 2>&1 | Out-Host } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw 'npm ci не удался' }
}
if ($script:AtomDry) { return }
if (-not (Test-BrainDeps)) { throw 'мозг не загружается даже после npm ci — см. логи' }
$state = Read-State $paths
Set-StateValue $state 'deps' 'full'
Write-JsonNoBom $paths.State $state
