# Картинки ATOMLAB: ComfyUI portable + модели движка + классификатор безопасности + наш узел ATOMLABSafetyCheck.
# Идемпотентно: готовое не качается и не перехешируется (state.json → verified), недокачанное докачивается (curl -C -).
# Вызывают install.ps1 (шаг 11b) и update.ps1 (изменился ключ картинок). Журнал: C:\ATOMLAB\logs\image-install.log.
# Раскладка: comfy\ComfyUI_windows_portable (код, заменяется целиком при новом выпуске), comfy\models (модели,
# через extra_model_paths.yaml), comfy-out / comfy-tmp (вывод и temp ComfyUI). Пути — ASCII.
#
#   -DryRun          ничего не качает и не меняет: печатает URL, размеры и пути для engine/variant из server-config.json
#   -Force           заново сверить SHA-256 всех файлов (даже уже проверенных)
#   -Engine/-Variant вместо server-config.json (проверка манифеста: -DryRun -Engine flux2-klein-4b -Variant fp8)
#   -BudgetMinutes   сколько минут можно качать за запуск (Update: 50; 0 — без ограничения); не успели — код 3
#   -Quiet           без полосы прогресса curl (задача планировщика: окна нет, ошибки curl — в журнал)
#   -CheckManifest   только проверить manifest.json (у всех движков/вариантов есть url, size, sha256) и выйти
# Коды выхода: 0 — готово (или картинки выключены), 1 — ошибка, 2 — мало места, 3 — докачаю в следующий раз.
param(
  [string]$Root = 'C:\ATOMLAB',
  [switch]$DryRun,
  [switch]$Force,
  [string]$Engine = '',
  [string]$Variant = '',
  [int]$BudgetMinutes = 0,
  [switch]$Quiet,
  [switch]$CheckManifest
)
$Pkg = Split-Path -Parent $PSScriptRoot   # bin\ на сервере или распакованный архив — там же common.ps1 и server-config.json
. (Join-Path $Pkg 'common.ps1')
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
$manifest = Read-Json (Join-Path $PSScriptRoot 'manifest.json')
if (-not $manifest) { Fail 'нет comfy\manifest.json рядом со скриптом'; exit 1 }

# ---------------------------------------------------------------- проверка манифеста
# только https; file:// — лишь для офлайн-проверки установщика (ATOMLAB_IMAGE_TEST=1, поддельный манифест в temp)
$urlRx = '^https://'
if ($env:ATOMLAB_IMAGE_TEST -eq '1') { $urlRx = '^(https|file)://' }
function Test-Entry($e) {
  if (-not $e) { return 'нет записи' }
  if ([string]$e.url -notmatch $urlRx) { return 'нет url' }
  if (-not ([int64]$e.size -gt 0)) { return 'нет size' }
  if ([string]$e.sha256 -cnotmatch '^[0-9a-f]{64}$') { return 'нет sha256 (64 строчных hex)' }
  return ''
}
function Test-Manifest($m) {
  $bad = @()
  $r = Test-Entry $m.comfy; if ($r) { $bad += "comfy: $r" }
  foreach ($t in $m.tools.PSObject.Properties) { $r = Test-Entry $t.Value; if ($r) { $bad += "tools.$($t.Name): $r" } }
  foreach ($f in $m.files.PSObject.Properties) {
    $r = Test-Entry $f.Value; if ($r) { $bad += "files.$($f.Name): $r" }
    if ([string]$f.Value.dest -match '\.\.|^[\\/]|:') { $bad += "files.$($f.Name): плохой dest" }
    if (-not $f.Value.license) { $bad += "files.$($f.Name): нет license" }
  }
  foreach ($e in $m.engines.PSObject.Properties) {
    foreach ($v in $e.Value.variants.PSObject.Properties) {
      foreach ($role in 'unet', 'clip', 'vae') {
        $id = [string]$v.Value.$role
        if (-not $id -or -not $m.files.$id) { $bad += "engines.$($e.Name).$($v.Name).${role}: нет файла «$id»" }
      }
    }
  }
  foreach ($id in @($m.safety.files)) { if (-not $m.files.$id) { $bad += "safety: нет файла «$id»" } }
  return $bad
}
$bad = @(Test-Manifest $manifest)
if ($CheckManifest) {
  if ($bad.Count) { foreach ($b in $bad) { Fail $b }; exit 1 }
  foreach ($e in $manifest.engines.PSObject.Properties) {
    foreach ($v in $e.Value.variants.PSObject.Properties) {
      $sum = 0
      foreach ($role in 'unet', 'clip', 'vae') { $sum += [int64]$manifest.files.($v.Value.$role).size }
      Ok ("{0}/{1}: {2:N2} ГБ" -f $e.Name, $v.Name, ($sum / 1GB))
    }
  }
  Ok ("manifest.json v{0}: ComfyUI {1}, файлов {2}, все url/size/sha256 на месте" -f $manifest.version, $manifest.comfy.tag, @($manifest.files.PSObject.Properties).Count)
  exit 0
}
if ($bad.Count) { foreach ($b in $bad) { Fail ("manifest.json: " + $b) }; exit 1 }

# server-config.json: рядом с common.ps1 (та же версия, что и скрипт), иначе из bin
$cfgPath = Join-Path $Pkg 'server-config.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { $cfgPath = Join-Path $paths.Bin 'server-config.json' }
$cfg = Get-ServerConfig $cfgPath

if (-not $script:AtomDry) {
  New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
  $script:LogFile = Join-Path $paths.Logs 'image-install.log'
}

Step 'Картинки (ComfyUI): проверка'
if (-not $cfg.image) { Warn 'в server-config.json нет блока image — картинки не ставлю'; exit 0 }
if (-not $Engine -and -not (Test-ImageEnabled $cfg)) { Ok 'картинки выключены (image.enabled = false) — ничего не ставлю'; exit 0 }
if (-not $Engine) { $Engine = [string]$cfg.image.engine }
if (-not $Variant) { $Variant = [string]$cfg.image.variant }
$eng = $manifest.engines.$Engine
if (-not $eng) { Fail ("движка «{0}» нет в manifest.json (есть: {1})" -f $Engine, (@($manifest.engines.PSObject.Properties.Name) -join ', ')); exit 1 }
$var = $eng.variants.$Variant
if (-not $var) { Fail ("у движка {0} нет варианта «{1}» (есть: {2})" -f $Engine, $Variant, (@($eng.variants.PSObject.Properties.Name) -join ', ')); exit 1 }
if ($cfg.image.comfyRelease -and [string]$cfg.image.comfyRelease -ne [string]$manifest.comfy.tag) {
  Warn ("в server-config.json comfyRelease = {0}, а хеш в manifest.json есть только для {1} — ставлю {1}" -f $cfg.image.comfyRelease, $manifest.comfy.tag)
}
Say ("    движок {0} ({1}), вариант {2}; ComfyUI {3}; manifest v{4}" -f $Engine, $eng.title, $Variant, $manifest.comfy.tag, $manifest.version)

$state = Read-State $paths
$deadline = $null
if ($BudgetMinutes -gt 0) { $deadline = (Get-Date).AddMinutes($BudgetMinutes) }
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
if (-not (Test-Path -LiteralPath $curl)) { $curl = Find-Exe 'curl.exe' }

function Format-GB([int64]$b) {
  if ($b -ge 1GB) { return ("{0:N2} ГБ" -f ($b / 1GB)) }
  if ($b -ge 1MB) { return ("{0:N0} МБ" -f ($b / 1MB)) }
  return ("{0:N1} КБ" -f ($b / 1KB))
}

# ---------------------------------------------------------------- state.verified: size|mtime|sha уже проверенных файлов
function Get-Verified([string]$key) {
  if ($state.verified -and $state.verified.PSObject.Properties[$key]) { return [string]$state.verified.$key }
  return ''
}
function Set-Verified([string]$key, [string]$value) {
  if (-not $state.verified) { Set-StateValue $state 'verified' (New-Object PSObject) }
  if ($value) { Set-StateValue $state.verified $key $value } else { $state.verified.PSObject.Properties.Remove($key) }
  if (-not $script:AtomDry) { Write-JsonNoBom $paths.State $state }   # сразу: задачу могут прервать посреди 12 ГБ
}
function Get-Stamp([string]$file, [string]$sha) {
  $fi = Get-Item -LiteralPath $file
  return ('{0}|{1}|{2}' -f $fi.Length, $fi.LastWriteTimeUtc.Ticks, $sha)
}

# ---------------------------------------------------------------- скачивание с докачкой (curl.exe есть в Windows 10 1803+)
# Возвращает 'ok' | 'budget' (кончилось время запуска — докачаем в следующий раз) | 'fail'.
function Get-FileResumable([string[]]$urls, [string]$part) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $part) | Out-Null
  foreach ($u in $urls) {
    for ($try = 1; $try -le 2; $try++) {
      $a = @('-L', '--fail', '--retry', '5', '--retry-delay', '10', '--connect-timeout', '30', '--speed-limit', '10240', '--speed-time', '120', '-C', '-', '-o', $part)
      if ($deadline) {
        $left = [int]($deadline - (Get-Date)).TotalSeconds
        if ($left -lt 60) { return 'budget' }
        $a += @('--max-time', "$left")
      }
      if ($Quiet) { $a += '-sS' } else { $a += '--progress-bar' }
      $a += $u
      $line = (@($a | ForEach-Object { ConvertTo-CmdArg $_ }) -join ' ')
      if ($Quiet) {
        $errFile = Join-Path $env:TEMP ("atomlab-curl-{0}.txt" -f (Get-Random))
        $p = Start-Process -FilePath $curl -ArgumentList $line -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile
        $err = (Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue)
        Remove-Item -LiteralPath $errFile -ErrorAction SilentlyContinue
      } else {
        $p = Start-Process -FilePath $curl -ArgumentList $line -NoNewWindow -Wait -PassThru
        $err = ''
      }
      $code = $p.ExitCode
      if ($code -eq 0) { return 'ok' }
      if ($code -eq 28 -and $deadline -and (Get-Date) -ge $deadline.AddSeconds(-5)) { return 'budget' }
      Warn ("curl: код {0} ({1}) {2}" -f $code, ($u -replace '\?.*$', ''), ([string]$err -replace '\s+', ' ').Trim())
      # 33/36 — сервер не принял докачку с середины: начинаем файл заново
      if ($code -eq 33 -or $code -eq 36) { Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue }
      Start-Sleep -Seconds (5 * $try)
    }
  }
  return 'fail'
}

# Файл по записи манифеста: есть и проверен → ничего; есть, но не проверен → SHA-256; нет → докачать, сверить, переименовать.
# Возвращает 'ok' | 'dry' | 'budget'; ошибки — исключением.
function Get-FileVerified($e, [string]$dest, [string]$name) {
  $size = [int64]$e.size
  $sha = ([string]$e.sha256).ToLower()
  $urls = @([string]$e.url) + @($e.mirrors | Where-Object { $_ })
  if (Test-Path -LiteralPath $dest) {
    $len = (Get-Item -LiteralPath $dest).Length
    if ($len -eq $size) {
      if (-not $Force -and (Get-Verified $dest) -eq (Get-Stamp $dest $sha)) { Ok ("{0}: уже проверен ({1})" -f $name, (Format-GB $size)); return 'ok' }
      if ($script:AtomDry) { Say ("    [DRY] сверить SHA-256 {0} ({1})" -f $dest, (Format-GB $size)) 'DarkCyan'; return 'dry' }
      Say ("    сверяю SHA-256 {0} ({1})…" -f $name, (Format-GB $size))
      $h = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLower()
      if ($h -eq $sha) { Set-Verified $dest (Get-Stamp $dest $sha); Ok "${name}: SHA-256 совпал"; return 'ok' }
      Warn ("{0}: SHA-256 не совпал ({1}…) — качаю заново" -f $name, $h.Substring(0, 12))
    } else {
      Warn ("{0}: размер {1} вместо {2} — качаю заново" -f $name, $len, $size)
    }
    if ($script:AtomDry) { Say "    [DRY] удалить $dest" 'DarkCyan' } else { Remove-Item -LiteralPath $dest -Force; Set-Verified $dest '' }
  }
  $part = $dest + '.part'
  $have = 0
  if (Test-Path -LiteralPath $part) { $have = (Get-Item -LiteralPath $part).Length }
  if ($have -gt $size) { if (-not $script:AtomDry) { Remove-Item -LiteralPath $part -Force }; $have = 0 }
  if ($script:AtomDry) {
    $from = ''
    if ($have -gt 0) { $from = " (докачка с {0})" -f (Format-GB $have) }
    Say ("    [DRY] скачать {0}{1}`n          {2}`n          → {3}  sha256 {4}" -f (Format-GB $size), $from, $urls[0], $dest, $sha) 'DarkCyan'
    return 'dry'
  }
  if ($have -lt $size) {
    Say ("    качаю {0}: {1}{2}" -f $name, (Format-GB $size), $(if ($have -gt 0) { " (уже есть {0})" -f (Format-GB $have) } else { '' }))
    $r = Get-FileResumable $urls $part
    if ($r -eq 'budget') { Warn "${name}: время этого запуска вышло — докачаю в следующий раз"; return 'budget' }
    if ($r -ne 'ok') { throw "не удалось скачать $name ($($urls[0]))" }
  }
  $len = (Get-Item -LiteralPath $part).Length
  if ($len -ne $size) { throw "${name}: после скачивания $len байт вместо $size (докачаю в следующий раз)" }
  $h = (Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash.ToLower()
  if ($h -ne $sha) {
    Remove-Item -LiteralPath $part -Force
    throw ("{0}: SHA-256 не совпал (ждали {1}, получили {2}) — файл удалён" -f $name, $sha, $h)
  }
  Move-Item -LiteralPath $part -Destination $dest -Force
  Set-Verified $dest (Get-Stamp $dest $sha)
  Ok ("{0}: скачан, SHA-256 совпал ({1})" -f $name, (Format-GB $size))
  return 'ok'
}

# ---------------------------------------------------------------- что нужно
$models = $paths.ComfyModels
$want = New-Object System.Collections.ArrayList
$seen = @{}
foreach ($id in @($var.unet, $var.clip, $var.vae) + @($manifest.safety.files)) {
  $f = $manifest.files.$id
  $dest = Join-Path $models ([string]$f.dest -replace '/', '\')
  if ($seen[$dest]) { continue }   # один и тот же файл у разных ролей/движков — один раз
  $seen[$dest] = $true
  [void]$want.Add([pscustomobject]@{ id = $id; entry = $f; dest = $dest })
}
$py = Join-Path $paths.ComfyRoot 'python_embeded\python.exe'
$mainPy = Join-Path $paths.ComfyRoot 'ComfyUI\main.py'
$tagFile = Join-Path $paths.ComfyRoot 'atomlab-tag.txt'
$curTag = ''
if (Test-Path -LiteralPath $tagFile) { $curTag = (Get-Content -LiteralPath $tagFile -Raw).Trim() } elseif ($state.comfyTag) { $curTag = [string]$state.comfyTag }
$haveComfy = (Test-Path -LiteralPath $py) -and (Test-Path -LiteralPath $mainPy)
$needComfy = (-not $haveComfy) -or ($curTag -ne [string]$manifest.comfy.tag)

# ---------------------------------------------------------------- (b) место на диске
$needBytes = [int64]0
foreach ($w in $want) {
  $s = [int64]$w.entry.size
  if ((Test-Path -LiteralPath $w.dest) -and (Get-Item -LiteralPath $w.dest).Length -eq $s) { continue }
  $p = $w.dest + '.part'
  if (Test-Path -LiteralPath $p) { $s -= [Math]::Min($s, (Get-Item -LiteralPath $p).Length) }
  $needBytes += $s
}
if ($needComfy) { $needBytes += [int64]$manifest.comfy.size * 4 }   # архив + распаковка (~3,5× архива)
$drive = Split-Path -Qualifier $paths.Root
$freeBytes = [int64](Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='{0}'" -f $drive)).FreeSpace
$minBytes = $needBytes + 3GB
if ($needComfy -and $minBytes -lt 25GB) { $minBytes = 25GB }
if ($needBytes -eq 0) { Ok ("всё на месте, качать нечего (свободно {0} на {1})" -f (Format-GB $freeBytes), $drive) }
elseif ($freeBytes -lt $minBytes) {
  Warn ("на {0} свободно {1}, а для картинок нужно {2} — освободите место; мозг работает и без картинок" -f $drive, (Format-GB $freeBytes), (Format-GB $minBytes))
  if (-not $script:AtomDry) { exit 2 }
} else { Ok ("скачать примерно {0}; свободно {1} на {2}" -f (Format-GB $needBytes), (Format-GB $freeBytes), $drive) }

$partial = $false
$holdFlag = Join-Path $paths.Run 'comfy-hold'
try {
  # ---------------------------------------------------------------- (c) ComfyUI portable
  Step ("ComfyUI {0} (portable, NVIDIA)" -f $manifest.comfy.tag)
  if (-not $needComfy) {
    Ok ("ComfyUI {0} уже стоит: {1}" -f $curTag, $paths.ComfyRoot)
  } else {
    if ($haveComfy) { Say ("    обновление ComfyUI: {0} → {1}" -f $curTag, $manifest.comfy.tag) }
    $arch = Join-Path $paths.Cache ([string]$manifest.comfy.file)
    $r = Get-FileVerified $manifest.comfy $arch ([string]$manifest.comfy.file)
    if ($r -eq 'budget') { $partial = $true }
    elseif ($script:AtomDry) {
      Say ("    [DRY] распаковать: tar.exe -xf {0} -C {1}\_unpack (запасной путь — 7zr.exe {2})" -f $arch, $paths.Comfy, $manifest.tools.'7zr'.url) 'DarkCyan'
      Say ("    [DRY] {0}\_unpack\{1} → {2}{3}" -f $paths.Comfy, $manifest.comfy.folder, $paths.ComfyRoot, $(if ($haveComfy) { ' (старая папка → .old, удаляется после успешного старта)' } else { '' })) 'DarkCyan'
    } else {
      $unpack = Join-Path $paths.Comfy '_unpack'
      if (Test-Path -LiteralPath $unpack) { Remove-Item -LiteralPath $unpack -Recurse -Force }
      New-Item -ItemType Directory -Force -Path $unpack | Out-Null
      $newRoot = Join-Path $unpack ([string]$manifest.comfy.folder)
      $okTar = $false
      $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
      if (Test-Path -LiteralPath $tar) {
        Say '    распаковываю встроенным tar.exe (2 ГБ → ~7 ГБ, несколько минут)…'
        $out = @(Invoke-Exe $tar -xf $arch -C $unpack)
        $okTar = ($LASTEXITCODE -eq 0) -and (Test-Path -LiteralPath (Join-Path $newRoot 'ComfyUI\main.py')) -and (Test-Path -LiteralPath (Join-Path $newRoot 'python_embeded\python.exe'))
        if (-not $okTar) { Warn ("tar.exe не справился (код {0}): {1}" -f $LASTEXITCODE, (($out | Select-Object -Last 3) -join ' ')) }
      }
      if (-not $okTar) {
        $z = Join-Path $paths.Cache '7zr.exe'
        $r7 = Get-FileVerified $manifest.tools.'7zr' $z '7zr.exe'
        if ($r7 -ne 'ok') { throw 'не удалось получить 7zr.exe' }
        Remove-Item -LiteralPath $unpack -Recurse -Force
        New-Item -ItemType Directory -Force -Path $unpack | Out-Null
        Say '    распаковываю 7zr.exe…'
        $out = @(Invoke-Exe $z x -y ('-o' + $unpack) $arch)
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $newRoot 'ComfyUI\main.py'))) { throw ("7zr.exe не распаковал архив: " + (($out | Select-Object -Last 3) -join ' ')) }
      }
      Ok 'архив распакован'
      $old = $paths.ComfyRoot + '.old'
      if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Recurse -Force }   # остаток прошлого обновления (моделей там нет)
      if (Test-Path -LiteralPath $paths.ComfyRoot) {
        # ComfyUI держит файлы открытыми: просим run-comfy.ps1 подождать (comfy-hold) и останавливаем процесс
        Set-Content -LiteralPath $holdFlag -Value (Get-Date).ToString('s')
        $pf = Join-Path $paths.Run 'comfy.pid'
        if (Test-Path -LiteralPath $pf) { Stop-ProcessTree ([int](Get-Content -LiteralPath $pf -Raw)) }
        Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($paths.ComfyRoot, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-ProcessTree $_.Id }
        for ($i = 0; $i -lt 30 -and (Test-PortListening (Get-ComfyPort $cfg)); $i++) { Start-Sleep -Seconds 2 }
        Rename-Item -LiteralPath $paths.ComfyRoot -NewName ((Split-Path -Leaf $paths.ComfyRoot) + '.old')
      }
      Move-Item -LiteralPath $newRoot -Destination $paths.ComfyRoot
      Remove-Item -LiteralPath $unpack -Recurse -Force -ErrorAction SilentlyContinue
      [IO.File]::WriteAllText($tagFile, [string]$manifest.comfy.tag, (New-Object System.Text.UTF8Encoding($false)))
      Set-StateValue $state 'comfyTag' ([string]$manifest.comfy.tag)
      Write-JsonNoBom $paths.State $state
      Remove-Item -LiteralPath $arch -Force -ErrorAction SilentlyContinue   # 2 ГБ кеша больше не нужны
      Set-Verified $arch ''
      Ok ("ComfyUI {0} → {1}" -f $manifest.comfy.tag, $paths.ComfyRoot)
    }
  }

  # ---------------------------------------------------------------- (d)+(e) модели движка и классификатор
  Step ("Модели: {0} / {1} + классификатор безопасности → {2}" -f $Engine, $Variant, $models)
  foreach ($w in $want) {
    if ($partial) { Say ("    {0}: в следующий раз" -f $w.id); continue }
    $r = Get-FileVerified $w.entry $w.dest ([string](Split-Path -Leaf $w.dest))
    if ($r -eq 'budget') { $partial = $true }
  }

  # ---------------------------------------------------------------- (f) наш узел, extra_model_paths.yaml, папки
  Step 'Узел ATOMLABSafetyCheck и настройки ComfyUI'
  $nodeSrc = Join-Path $PSScriptRoot 'custom_nodes\atomlab_safety\__init__.py'
  $nodeDst = Join-Path $paths.ComfyRoot 'ComfyUI\custom_nodes\atomlab_safety\__init__.py'
  $yaml = Join-Path $paths.Comfy 'extra_model_paths.yaml'
  $mfw = ($models -replace '\\', '/')
  # только ASCII: ComfyUI может читать yaml в кодировке системы (cp1251), кириллица в комментарии его уронила бы
  $yamlText = "# ATOMLAB (image-install.ps1): models live outside the ComfyUI folder, so ComfyUI upgrades keep them`n" +
    "atomlab:`n    base_path: `"$mfw`"`n    is_default: true`n    diffusion_models: diffusion_models`n    text_encoders: text_encoders`n    vae: vae`n    atomlab_safety: atomlab_safety`n"
  $argsTxt = (@((ConvertTo-CmdArg $py)) + @(Get-ComfyArgs $cfg $paths | ForEach-Object { ConvertTo-CmdArg $_ })) -join ' '
  if ($script:AtomDry) {
    Say ("    [DRY] узел {0} → {1}" -f $nodeSrc, $nodeDst) 'DarkCyan'
    Say ("    [DRY] {0}: base_path {1}" -f $yaml, $mfw) 'DarkCyan'
    Say ("    [DRY] папки {0}, {1}; {2}\comfy-args.txt:" -f $paths.ComfyOut, $paths.ComfyTmp, $paths.Run) 'DarkCyan'
    Say ("          " + $argsTxt) 'DarkCyan'
  } elseif (Test-Path -LiteralPath $paths.ComfyRoot) {
    $same = (Test-Path -LiteralPath $nodeDst) -and ((Get-FileHash -LiteralPath $nodeDst).Hash -eq (Get-FileHash -LiteralPath $nodeSrc).Hash)
    if ($same) { Ok 'узел atomlab_safety не менялся' } else {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $nodeDst) | Out-Null
      Copy-Item -LiteralPath $nodeSrc -Destination $nodeDst -Force
      Ok 'узел atomlab_safety обновлён (ComfyUI подхватит после перезапуска)'
    }
    New-Item -ItemType Directory -Force -Path $paths.ComfyOut, $paths.ComfyTmp, $models | Out-Null
    [IO.File]::WriteAllText($yaml, $yamlText, (New-Object System.Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText((Join-Path $paths.Run 'comfy-args.txt'), $argsTxt + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    Ok 'extra_model_paths.yaml и run\comfy-args.txt записаны'
  } else {
    Warn 'ComfyUI ещё не распакован — узел положу в следующий раз'
    $partial = $true
  }
} catch {
  Fail ("картинки: " + $_.Exception.Message)
  exit 1
} finally {
  if (-not $script:AtomDry -and (Test-Path -LiteralPath $holdFlag)) { Remove-Item -LiteralPath $holdFlag -Force -ErrorAction SilentlyContinue }
}

# старая папка ComfyUI после обновления: удаляем, когда новый ComfyUI поднялся (задача ATOMLAB Comfy стартует его сама)
$old = $paths.ComfyRoot + '.old'
if (-not $script:AtomDry -and (Test-Path -LiteralPath $old)) {
  $upTask = Get-ScheduledTask -TaskName 'ATOMLAB Comfy' -ErrorAction SilentlyContinue
  if ($upTask) { Start-ScheduledTask -TaskName 'ATOMLAB Comfy' -ErrorAction SilentlyContinue }
  # без задачи (первая установка: её регистрирует install.ps1 позже) ждать некого — .old удалит следующий запуск
  $upUntil = (Get-Date).AddSeconds($(if ($upTask) { 180 } else { 0 }))
  while ((Get-Date) -lt $upUntil -and -not (Test-ComfyUp $cfg 2)) { Start-Sleep -Seconds 3 }
  if (Test-ComfyUp $cfg 2) {
    Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
    Ok 'новый ComfyUI отвечает — старая папка удалена'
  } else { Warn ("новый ComfyUI пока не ответил — старая папка оставлена: {0} (см. logs\comfy-*.log)" -f $old) }
}

Step 'Картинки: итог'
if ($script:AtomDry) { Say '    [DRY] пробный прогон — ничего не скачано и не изменено' 'DarkCyan'; exit 0 }
if ($partial) { Warn 'скачано не всё — Update докачает в следующий запуск (каждые 15 мин)'; exit 3 }
Ok ("готово: ComfyUI {0}, {1}/{2}, классификатор Falconsai NSFW ViT, узел ATOMLABSafetyCheck" -f $manifest.comfy.tag, $Engine, $Variant)
exit 0
