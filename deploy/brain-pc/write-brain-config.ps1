# config.json мозга на сервере (папка данных): профиль gpu, модели и настройки из server-config.json, токен администратора.
# Существующий файл не заменяется целиком: меняются только поля из server-config.json, ручные правки остаются.
param([string]$Root = 'C:\ATOMLAB', [switch]$DryRun)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
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

# картинки: блок image сливается вложенно — ключи владельца внутри image, которых здесь нет, остаются как были.
# Ключи учителя (свободный запрос картинки) — secrets\teacher-tokens.txt, по строке на ключ; недостающие догенерируются.
$teachFile = Join-Path $paths.Secrets 'teacher-tokens.txt'
$teachNew = $false
$imgDesc = 'картинки: нет блока image'
function Test-JsonObject($o) { return ($null -ne $o -and $o.GetType().FullName -eq 'System.Management.Automation.PSCustomObject') }
if ($cfg.image) {
  $ic = $cfg.image
  $img = $conf.image
  if (-not (Test-JsonObject $img)) { $img = New-Object PSObject }
  Set-StateValue $img 'enabled' ([bool]($ic.enabled -eq $true))
  Set-StateValue $img 'engine' ([string]$ic.engine)
  Set-StateValue $img 'variant' ([string]$ic.variant)
  Set-StateValue $img 'comfyUrl' ('http://127.0.0.1:' + (Get-ComfyPort $cfg))
  Set-StateValue $img 'comfyOutputDir' $paths.ComfyOut
  $st = $img.students
  if (-not (Test-JsonObject $st)) { $st = New-Object PSObject }
  Set-StateValue $st 'enabled' ([bool]($ic.students -eq $true))   # ученики — только по решению владельца (ЗРУ-444)
  Set-StateValue $st 'presetsOnly' $true   # ученикам — только готовые темы (мозг проверяет и сам, roles.ts)
  Set-StateValue $img 'students' $st
  $tokens = @()
  if (Test-Path -LiteralPath $teachFile) {
    $tokens = @(Get-Content -LiteralPath $teachFile -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') })
  } elseif ($img.teacherTokens) {
    $tokens = @($img.teacherTokens | Where-Object { $_ })   # файла нет, а в config.json ключи уже есть — не теряем их
    if ($tokens.Count) { $teachNew = $true }
  }
  $needKeys = 0
  if ($null -ne $ic.teacherKeys) { $needKeys = [int]$ic.teacherKeys }
  while ($tokens.Count -lt $needKeys) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $tokens += (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
    $teachNew = $true
  }
  Set-StateValue $img 'teacherTokens' ([object[]]$tokens)
  Set-StateValue $conf 'image' $img
  $imgDesc = "картинки: {0}, {1}/{2}, ученики {3}, ключей учителя {4}" -f $(if ($img.enabled) { 'вкл.' } else { 'выкл.' }), $img.engine, $img.variant, $(if ($st.enabled) { 'вкл.' } else { 'выкл.' }), $tokens.Count
}

Act "записать $file (профиль $($cfg.profile), модели $chat / $fast / $($conf.embedModel); $imgDesc)" {
  New-Item -ItemType Directory -Force -Path $paths.Data, $paths.Secrets | Out-Null
  if (-not (Test-Path -LiteralPath $tokFile)) {
    [IO.File]::WriteAllText($tokFile, $token, (New-Object System.Text.UTF8Encoding($false)))
    # только администраторы и SYSTEM (SID — не зависят от языка Windows); без прав админа (проверка code-data) — не трогаем,
    # иначе сам создатель потерял бы доступ к папке
    if (Test-Admin) { Invoke-Exe icacls.exe $paths.Secrets /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' | Out-Null }
  }
  if ($teachNew) {
    # тот же каталог secrets\ (права наследуются: администраторы и SYSTEM); по ключу на строку, владелец раздаёт их учителям сам
    [IO.File]::WriteAllText($teachFile, ((@($img.teacherTokens) -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  }
  Write-JsonNoBom $file $conf
}
