# Общие функции установщика сервера мозга ATOMLAB (install / update / uninstall / run-*).
# Windows PowerShell 5.1: без ?:, ??, &&; файл в UTF-8 с BOM (иначе кириллица ломается).
# Все пути сервера — ASCII (C:\ATOMLAB\...), чтобы cmd, планировщик и git не спотыкались о кодировку.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest с прогресс-баром в 5.1 качает в разы медленнее
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

$script:AtomDry = $false
$script:LogFile = $null

function Get-AtomPaths([string]$Root) {
  $p = @{
    Root    = $Root
    Repo    = Join-Path $Root 'atomlab'
    Data    = Join-Path $Root 'atomlab-brain-data'
    Logs    = Join-Path $Root 'logs'
    Bin     = Join-Path $Root 'bin'
    Run     = Join-Path $Root 'run'
    Runtime = Join-Path $Root 'runtime'
    Ollama  = Join-Path $Root 'ollama'
    Models  = Join-Path $Root 'ollama-models'
    Secrets = Join-Path $Root 'secrets'
    Cache   = Join-Path $Root 'cache'
    State   = Join-Path $Root 'state.json'
    # картинки: ComfyUI portable (архив распаковывается в comfy\ComfyUI_windows_portable), вывод и temp — отдельно.
    # Модели — рядом, в comfy\models (extra_model_paths.yaml): обновление ComfyUI = замена папки, 12 ГБ не трогаются.
    Comfy       = Join-Path $Root 'comfy'
    ComfyRoot   = Join-Path $Root 'comfy\ComfyUI_windows_portable'
    ComfyModels = Join-Path $Root 'comfy\models'
    ComfyOut    = Join-Path $Root 'comfy-out'
    ComfyTmp    = Join-Path $Root 'comfy-tmp'
  }
  return $p
}

function Write-Log([string]$text) {
  if ($script:LogFile) {
    try { Add-Content -LiteralPath $script:LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $text) -Encoding UTF8 } catch { }
  }
}

function Say([string]$text, [string]$color = 'Gray') {
  Write-Host $text -ForegroundColor $color
  Write-Log $text
}
function Step([string]$text) { Say ''; Say ("==> " + $text) 'Cyan' }
function Ok([string]$text) { Say ("    OK  " + $text) 'Green' }
function Warn([string]$text) { Say ("    !!  " + $text) 'Yellow' }
function Fail([string]$text) { Say ("    XX  " + $text) 'Red' }

# Действие с побочным эффектом: в -DryRun только печатается.
function Act([string]$desc, [scriptblock]$block) {
  if ($script:AtomDry) { Say ("    [DRY] " + $desc) 'DarkCyan'; return $null }
  Say ("    ... " + $desc) 'DarkGray'
  return (& $block)
}

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# PATH из реестра (после установки Git/Node в этом же окне их ещё не видно).
function Update-PathFromRegistry {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = ($m, $u | Where-Object { $_ }) -join ';'
}

function Find-Exe([string]$name, [string[]]$extra = @()) {
  $c = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source }
  foreach ($e in $extra) { if ($e -and (Test-Path -LiteralPath $e)) { return $e } }
  return $null
}

function Find-Git { return (Find-Exe 'git.exe' @("$env:ProgramFiles\Git\cmd\git.exe")) }
function Find-Node { return (Find-Exe 'node.exe' @("$env:ProgramFiles\nodejs\node.exe")) }
function Find-Npm { return (Find-Exe 'npm.cmd' @("$env:ProgramFiles\nodejs\npm.cmd")) }
function Find-Tailscale { return (Find-Exe 'tailscale.exe' @("$env:ProgramFiles\Tailscale\tailscale.exe")) }

function Read-Json([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

# JSON без BOM (node и мозг читают его как utf8; BOM в начале JSON.parse не любит).
function Write-JsonNoBom([string]$path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText($path, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
}

function Read-State($paths) {
  $s = Read-Json $paths.State
  if (-not $s) { $s = New-Object PSObject }
  return $s
}
function Set-StateValue($state, [string]$key, $value) {
  if ($state.PSObject.Properties[$key]) { $state.$key = $value } else { $state | Add-Member -NotePropertyName $key -NotePropertyValue $value }
}

function Get-ServerConfig([string]$path) {
  $c = Read-Json $path
  if (-not $c) { throw "нет файла настроек сервера: $path" }
  return $c
}

# Имя модели для конфига мозга: «bge-m3:latest» → «bge-m3» (папка векторов derived\embeddings\bge-m3 та же).
function Get-BrainModelName([string]$m) {
  if ($m -like '*:latest') { return $m.Substring(0, $m.Length - 7) }
  return $m
}

# Отпечаток моделей: менялись ли они в server-config.json.
function Get-ModelsKey($cfg) {
  return ('{0}|{1}|{2}' -f $cfg.models.chat, $cfg.models.fast, $cfg.models.embed)
}

# ---------------------------------------------------------------- картинки (ComfyUI)
# Порт ComfyUI (только 127.0.0.1) и признак «картинки включены» из блока image в server-config.json.
function Get-ComfyPort($cfg) {
  if ($cfg.image -and $cfg.image.comfyPort) { return [int]$cfg.image.comfyPort }
  return 8188
}
function Test-ImageEnabled($cfg) { return [bool]($cfg.image -and $cfg.image.enabled -eq $true) }

# ComfyUI жив: GET /system_stats отвечает JSON.
function Test-ComfyUp($cfg, [int]$timeoutSec = 3) {
  return [bool](Invoke-Http ("http://127.0.0.1:{0}/system_stats" -f (Get-ComfyPort $cfg)) $timeoutSec)
}

# Отпечаток картинок: менялись ли движок/вариант/выпуск ComfyUI/манифест/вкл-выкл — тогда image-install и перезапуски.
# Хвост (ученики, число ключей учителя, порт, резерв видеопамяти) — чтобы и эти правки доходили до config.json и ComfyUI.
function Get-ImageKey($cfg, $manifest) {
  $i = $cfg.image
  if (-not $i) { return 'none' }
  $tag = ''
  $mv = ''
  if ($manifest) { $tag = $manifest.comfy.tag; $mv = $manifest.version }
  $rv = ([double]$i.reserveVramGB).ToString([Globalization.CultureInfo]::InvariantCulture)   # «1.5», а не «1,5» в русской Windows
  # f — свой текст картинки без ключа, tp — инструменты учителя без ключа: смена → update перепишет config.json мозга
  $tp = $false
  if ($cfg.teacher) { $tp = [bool]($cfg.teacher.public -eq $true) }
  return ('{0}|{1}|{2}|{3}|{4}|s={5}|t={6}|p={7}|r={8}|f={9}|tp={10}|u={11}' -f $i.engine, $i.variant, $tag, $mv, [bool]($i.enabled -eq $true),
    [bool]($i.students -eq $true), $i.teacherKeys, (Get-ComfyPort $cfg), $rv, [bool]($i.studentsFreeText -eq $true), $tp, [bool]($i.unlimited -eq $true))
}

# Аргументы запуска ComfyUI (run-comfy.ps1; копия для диагностики — run\comfy-args.txt).
# Только наш узел (--disable-all-custom-nodes + whitelist), только 127.0.0.1, без метаданных в PNG, без автозапуска браузера.
function Get-ComfyArgs($cfg, $paths) {
  $reserve = 1.5
  if ($cfg.image -and $cfg.image.reserveVramGB) { $reserve = [double]$cfg.image.reserveVramGB }
  return @(
    '-s', (Join-Path $paths.ComfyRoot 'ComfyUI\main.py'),
    '--windows-standalone-build', '--listen', '127.0.0.1', '--port', ("{0}" -f (Get-ComfyPort $cfg)),
    '--disable-auto-launch', '--disable-metadata',
    '--reserve-vram', $reserve.ToString([Globalization.CultureInfo]::InvariantCulture),
    '--disable-all-custom-nodes', '--whitelist-custom-nodes', 'atomlab_safety',
    '--extra-model-paths-config', (Join-Path $paths.Comfy 'extra_model_paths.yaml'),
    '--output-directory', $paths.ComfyOut, '--temp-directory', $paths.ComfyTmp,
    '--dont-print-server'
  )
}

# Аргумент командной строки в кавычках, если в нём пробел или кавычка (Start-Process склеивает массив через пробел).
function ConvertTo-CmdArg([string]$a) {
  if ($a -eq '' -or $a -match '[\s"]') { return ('"' + ($a -replace '"', '\"') + '"') }
  return $a
}

# Скрипты обслуживания → C:\ATOMLAB\bin: файлы верхнего уровня и подпапка comfy\ (рекурсивно, с узлом .py и README).
# Папку data\ (снимок базы в архиве) и прочее не берём — только перечисленные расширения.
function Copy-AtomScripts([string]$src, [string]$dst, [string[]]$topExt = @('.ps1', '.json', '.mts')) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -LiteralPath $src -File | Where-Object { $_.Extension -in $topExt } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $dst -Force
    Unblock-File -LiteralPath (Join-Path $dst $_.Name) -ErrorAction SilentlyContinue
  }
  $sub = Join-Path $src 'comfy'
  if (Test-Path -LiteralPath $sub) {
    Get-ChildItem -LiteralPath $sub -File -Recurse | Where-Object { $_.Extension -in '.ps1', '.json', '.py', '.md' } | ForEach-Object {
      $rel = $_.FullName.Substring($src.TrimEnd('\').Length).TrimStart('\')
      $to = Join-Path $dst $rel
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $to) | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $to -Force
      Unblock-File -LiteralPath $to -ErrorAction SilentlyContinue
    }
  }
}

# Задача планировщика от SYSTEM: при старте системы (с перезапуском) или каждые update.everyMinutes;
# -DailyAt 'ЧЧ:ММ' — раз в сутки (ночной прогон качества nightly-eval.ps1): без перезапусков и без «догоняющего»
# запуска днём, если ПК в это время был выключен (днём видеокарта — ученикам).
# $file — путь внутри bin (можно с подпапкой: 'comfy\run-comfy.ps1'). Берёт $paths, $Root, $cfg вызывающего скрипта.
function Register-AtomTask([string]$name, [string]$file, [switch]$Repeat, [string]$DailyAt = '') {
  $ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $arg = ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -Root "{1}"' -f (Join-Path $paths.Bin $file), $Root)
  $when = 'при старте системы'
  if ($Repeat) { $when = 'каждые 15 мин' }
  if ($DailyAt) { $when = "ежедневно в $DailyAt" }
  Act "задача планировщика «$name» ($file, $when, SYSTEM)" {
    $action = New-ScheduledTaskAction -Execute $ps -Argument $arg -WorkingDirectory $paths.Bin
    if ($DailyAt) {
      $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.Add([TimeSpan]::Parse($DailyAt)))
      $principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest
      $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
      Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'ATOMLAB: ночной живой прогон качества' -Force | Out-Null
      return
    }
    if ($Repeat) {
      $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3) -RepetitionInterval (New-TimeSpan -Minutes ([int]$cfg.update.everyMinutes))
      $limit = New-TimeSpan -Hours 2
    } else {
      $trigger = New-ScheduledTaskTrigger -AtStartup
      $limit = [TimeSpan]::Zero
    }
    $principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit $limit -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'ATOMLAB: сервер ИИ-учителя' -Force | Out-Null
  }
}

# Загрузчик tsx: сначала полный node_modules репозитория, потом лёгкий runtime (только tsx).
function Get-TsxLoader($paths) {
  foreach ($base in @((Join-Path $paths.Repo 'node_modules'), (Join-Path $paths.Runtime 'node_modules'))) {
    $f = Join-Path $base 'tsx\dist\loader.mjs'
    if (Test-Path -LiteralPath $f) { return ([Uri]$f).AbsoluteUri }
  }
  return $null
}

function Invoke-Http([string]$url, [int]$timeoutSec = 5) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec $timeoutSec -Uri $url
    return ($r.Content | ConvertFrom-Json)
  } catch { return $null }
}

function Get-BrainHealth([int]$port) { return (Invoke-Http ("http://127.0.0.1:{0}/health" -f $port) 5) }

# Переменные среды мозга (задача планировщика работает от SYSTEM — профиль пользователя ей не нужен).
function Set-BrainEnv($paths, [int]$port) {
  $env:BRAIN_PORT = "$port"
  $env:BRAIN_DATA_DIR = $paths.Data
  $env:OLLAMA_URL = 'http://127.0.0.1:11434'
  $env:npm_config_cache = $paths.Cache
  $env:npm_config_update_notifier = 'false'
}

# Переменные Ollama из server-config.json.
function Get-OllamaEnv($cfg, $paths) {
  $o = $cfg.ollama
  $e = [ordered]@{
    OLLAMA_HOST              = $o.host
    OLLAMA_MODELS            = $paths.Models
    OLLAMA_NUM_PARALLEL      = "$($o.numParallel)"
    OLLAMA_KEEP_ALIVE        = $o.keepAlive
    OLLAMA_MAX_LOADED_MODELS = "$($o.maxLoadedModels)"
    OLLAMA_MAX_QUEUE         = "$($o.maxQueue)"
  }
  if ($o.flashAttention) { $e['OLLAMA_FLASH_ATTENTION'] = '1' }
  if ($o.kvCacheType) { $e['OLLAMA_KV_CACHE_TYPE'] = $o.kvCacheType }
  return $e
}

# Скачать файл (с повтором).
function Get-File([string]$url, [string]$out) {
  $dir = Split-Path -Parent $out
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  for ($i = 1; $i -le 3; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $out -TimeoutSec 3600
      return
    } catch {
      if ($i -eq 3) { throw }
      Warn "скачивание не удалось ($($_.Exception.Message)), повтор $i/3…"
      Start-Sleep -Seconds (5 * $i)
    }
  }
}

# Проверка подписи Authenticode: файл подписан и подписант тот, кого ждём.
function Assert-Signed([string]$file, [string]$signerLike) {
  $s = Get-AuthenticodeSignature -LiteralPath $file
  $subj = ''
  if ($s.SignerCertificate) { $subj = $s.SignerCertificate.Subject }
  if ($s.Status -ne 'Valid' -or $subj -notlike "*$signerLike*") {
    throw ("подпись файла {0} не прошла проверку: {1}, подписант «{2}» (ждали «{3}»)" -f (Split-Path -Leaf $file), $s.Status, $subj, $signerLike)
  }
  Ok ("подпись {0}: {1}" -f (Split-Path -Leaf $file), $signerLike)
}

# Внешняя программа без «NativeCommandError»: в PowerShell 5.1 при ErrorActionPreference=Stop любая строка в stderr
# (git пишет туда даже предупреждения и прогресс) стала бы исключением. Возвращает строки stdout+stderr; код — $LASTEXITCODE.
function Invoke-Exe {
  $exe = $args[0]
  $rest = @()
  if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $exe @rest 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $old }
}

function Test-Winget { return [bool](Get-Command winget.exe -ErrorAction SilentlyContinue) }

function Invoke-Winget([string]$id) {
  if (-not (Test-Winget)) { return $false }
  $args2 = @('install', '--id', $id, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
  & winget.exe @args2 | Out-Host
  # 0 — установлено; -1978335189 (0x8A15002B) — уже стоит, обновлений нет
  return ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189)
}

# Порт занят кем-то (TCP LISTEN)?
function Test-PortListening([int]$port) {
  try { return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop) } catch { return $false }
}

# Сколько открытых соединений с мозгом (идёт ответ — соединение живо; простаивающие node закрывает через 5 с).
function Get-ActiveConnections([int]$port) {
  try { return @(Get-NetTCPConnection -LocalPort $port -State Established -ErrorAction Stop).Count } catch { return 0 }
}

# Публичный адрес узла: https://<имя>.<tailnet>.ts.net (из tailscale status --json → Self.DNSName).
# tailscale status --json: только stdout — предупреждения tailscale в stderr (Invoke-Exe склеивает 2>&1) ломали разбор JSON
function Get-TsStatus([string]$ts) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $raw = (& $ts status --json 2>$null | Out-String)
    $i = $raw.IndexOf('{')
    if ($i -lt 0) { return $null }
    return ($raw.Substring($i) | ConvertFrom-Json)
  } catch { return $null } finally { $ErrorActionPreference = $old }
}

function Get-FunnelUrl([string]$ts) {
  try {
    $j = Get-TsStatus $ts
    $dns = [string]$j.Self.DNSName
    if ($dns) { return ('https://' + $dns.TrimEnd('.')) }
  } catch { }
  return $null
}

# tailscale funnel --bg <порт>. Если Funnel в tailnet ещё не разрешён, tailscale печатает ссылку
# login.tailscale.com/… и ждёт, пока администратор (владелец) её откроет, — показываем ссылку и ждём до $waitSec.
function Enable-Funnel([string]$ts, [int]$port, [int]$waitSec = 900) {
  $out = Join-Path $env:TEMP ("atomlab-funnel-{0}.txt" -f (Get-Random))
  $tryArgs = @(@('funnel', '--bg', '--yes', "$port"), @('funnel', '--bg', "$port"))
  foreach ($a in $tryArgs) {
    Remove-Item -LiteralPath $out, ($out + '.err') -ErrorAction SilentlyContinue
    $p = Start-Process -FilePath $ts -ArgumentList $a -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError ($out + '.err')
    $shown = $false
    $t0 = Get-Date
    while (-not $p.HasExited -and ((Get-Date) - $t0).TotalSeconds -lt $waitSec) {
      Start-Sleep -Seconds 2
      $txt = ((Get-Content -LiteralPath $out, ($out + '.err') -Raw -ErrorAction SilentlyContinue) -join "`n")
      $m = [regex]::Match([string]$txt, 'https://login\.tailscale\.com/\S+')
      if ($m.Success -and -not $shown) {
        $shown = $true
        Warn 'Funnel ещё не разрешён в сети Tailscale владельца.'
        Warn ('Отправьте владельцу эту ссылку (он должен открыть её и нажать «Enable»): ' + $m.Value)
        Warn 'Жду, пока владелец разрешит (окно не закрывайте)…'
      }
    }
    if (-not $p.HasExited) { Stop-ProcessTree $p.Id; return $false }
    $txt = ((Get-Content -LiteralPath $out, ($out + '.err') -Raw -ErrorAction SilentlyContinue) -join "`n")
    if ($p.ExitCode -eq 0) { return $true }
    if ($txt -notmatch 'flag provided but not defined') { Warn ("tailscale funnel: " + ($txt -replace '\s+', ' ')); return $false }
  }
  return $false
}

function Stop-ProcessTree([int]$procId) {
  if ($procId -le 0) { return }
  Invoke-Exe taskkill.exe /PID $procId /T /F | Out-Null
}
