# config.json мозга на сервере (папка данных): профиль gpu, модели и настройки из server-config.json, токен администратора.
# Существующий файл не заменяется целиком: меняются только поля из server-config.json, ручные правки остаются.
param([string]$Root = 'C:\ATOMLAB', [switch]$DryRun)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:DryRun = [bool]$DryRun
$paths = Get-AtomPaths $Root
$cfgPath = Join-Path $paths.Bin 'server-config.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { $cfgPath = Join-Path $PSScriptRoot 'server-config.json' }
$cfg = Get-ServerConfig $cfgPath
$file = Join-Path $paths.Data 'config.json'

$conf = Read-Json $file
if (-not $conf) { $conf = New-Object PSObject }
# configVersion — как у умолчаний мозга (brain/config.ts): иначе миграция старых умолчаний «вернула» бы numCtx 8192 → 4096
$ver = 3
$ct = Join-Path $paths.Repo 'brain\config.ts'
if (Test-Path -LiteralPath $ct) {
  $m = [regex]::Match((Get-Content -LiteralPath $ct -Raw -Encoding UTF8), 'DEFAULT_CONFIG[^=]*=\s*\{\s*configVersion:\s*(\d+)')
  if ($m.Success) { $ver = [int]$m.Groups[1].Value }
}
if (-not $conf.configVersion -or [int]$conf.configVersion -lt $ver) { Set-StateValue $conf 'configVersion' $ver }
$chat = Get-BrainModelName $cfg.models.chat
$fast = Get-BrainModelName $cfg.models.fast
Set-StateValue $conf 'profile' $cfg.profile
Set-StateValue $conf 'chatModels' @(@($chat, $fast) | Select-Object -Unique)
Set-StateValue $conf 'fastModels' @(@($fast, $chat) | Select-Object -Unique)
Set-StateValue $conf 'embedModel' (Get-BrainModelName $cfg.models.embed)
if ($cfg.brain.configOverrides) {
  foreach ($p in $cfg.brain.configOverrides.PSObject.Properties) { Set-StateValue $conf $p.Name $p.Value }
}

# токен администратора: один раз, хранится в secrets\ (доступ только у администраторов и SYSTEM) и в config.json
$tokFile = Join-Path $paths.Secrets 'admin-token.txt'
$token = $null
if (Test-Path -LiteralPath $tokFile) { $token = (Get-Content -LiteralPath $tokFile -Raw).Trim() }
if (-not $token -and $conf.adminToken) { $token = [string]$conf.adminToken }
if (-not $token) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
}
Set-StateValue $conf 'adminToken' $token

Act "записать $file (профиль $($cfg.profile), модели $chat / $fast / $($conf.embedModel))" {
  New-Item -ItemType Directory -Force -Path $paths.Data, $paths.Secrets | Out-Null
  if (-not (Test-Path -LiteralPath $tokFile)) {
    [IO.File]::WriteAllText($tokFile, $token, (New-Object System.Text.UTF8Encoding($false)))
    # только администраторы и SYSTEM (SID — не зависят от языка Windows)
    & icacls.exe $paths.Secrets /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' 2>&1 | Out-Null
  }
  Write-JsonNoBom $file $conf
}
