# Установка сервера мозга ИИ-учителя ATOMLAB на ПК с NVIDIA (Windows 10/11 x64). Запуск — УСТАНОВИТЬ.bat.
# Повторный запуск безопасен: готовые шаги пропускаются, данные (журнал) никогда не перезаписываются.
#
#   -DryRun        ничего не ставит и не меняет: печатает каждый шаг ([DRY] …)
#   -Only code-data   только код + зависимости + данные + config.json + запуск мозга и один вопрос (проверка без админа)
#   -RepoSource    откуда клонировать (по умолчанию GitHub; для проверки — путь к локальному репозиторию)
#   -AuthKey       ключ Tailscale (иначе ключ.txt рядом с УСТАНОВИТЬ.bat или вопрос)
#   -Ssh yes|no    удалённое управление (иначе вопрос)
param(
  [switch]$DryRun,
  [string]$Root = 'C:\ATOMLAB',
  [string]$RepoSource = 'https://github.com/sadykoffalan2105-dev/atomlab',
  [string]$Branch = '',
  [string]$AuthKey = '',
  [int]$BrainPort = 0,
  [ValidateSet('all', 'code-data')][string]$Only = 'all',
  [string]$Ssh = '',
  [string]$ChatModel = '',
  [switch]$KeepTestServer,
  [switch]$NoPause
)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
$Pkg = $PSScriptRoot
$paths = Get-AtomPaths $Root
$cfg = Get-ServerConfig (Join-Path $Pkg 'server-config.json')
if ($BrainPort -le 0) { $BrainPort = [int]$cfg.brain.port }
if (-not $Branch) { $Branch = $cfg.update.branch }
if (-not $Branch) { $Branch = 'main' }
$full = ($Only -eq 'all')
if ($Ssh -and $Ssh -notin 'yes', 'no') { throw '-Ssh: yes или no' }
$report = [ordered]@{}
$t0 = Get-Date

if (-not $script:AtomDry) {
  New-Item -ItemType Directory -Force -Path $paths.Root, $paths.Logs, $paths.Run, $paths.Bin | Out-Null
  $script:LogFile = Join-Path $paths.Logs ("install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
}

Say ''
Say '  ATOMLAB — установка сервера ИИ-учителя' 'White'
Say ("  папка: {0} · режим: {1}{2}" -f $paths.Root, $Only, $(if ($script:AtomDry) { ' · ПРОБНЫЙ ПРОГОН (ничего не меняется)' } else { '' })) 'White'

# ---------------------------------------------------------------- 1. проверки
Step '1. Проверка компьютера'
$is64 = [Environment]::Is64BitOperatingSystem -and ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'AMD64')
$os = (Get-CimInstance Win32_OperatingSystem)
Say ("    Windows: {0} ({1}), процессор: {2}" -f $os.Caption, $os.Version, $env:PROCESSOR_ARCHITECTURE)
$report['Windows'] = "$($os.Caption) $($os.Version)"
if ($full) {
  if (-not $is64) {
    if ($script:AtomDry) { Warn 'нужна Windows x64 (это не x64 — в пробном прогоне продолжаю)' } else { Fail 'нужна 64-битная Windows на процессоре Intel/AMD (x64)'; exit 2 }
  } else { Ok 'Windows x64' }
  if (-not (Test-Admin)) {
    if ($script:AtomDry) { Warn 'нет прав администратора (в пробном прогоне продолжаю)' } else { Fail 'нужны права администратора — запустите УСТАНОВИТЬ.bat двойным щелчком и нажмите «Да»'; exit 2 }
  } else { Ok 'права администратора' }
}
$drive = (Split-Path -Qualifier $paths.Root)
$freeGB = [Math]::Round((Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='{0}'" -f $drive)).FreeSpace / 1GB, 1)
$needGB = [int]$cfg.minDiskGB
if (-not $full) { $needGB = 2 }
if ($freeGB -lt $needGB) {
  if ($script:AtomDry) { Warn "свободно $freeGB ГБ на $drive, нужно ≥ $needGB ГБ" } else { Fail "на диске $drive свободно $freeGB ГБ, нужно не меньше $needGB ГБ"; exit 2 }
} else { Ok "свободно $freeGB ГБ на $drive (нужно ≥ $needGB)" }

$gpu = $null
if ($full) {
  $smi = Find-Exe 'nvidia-smi.exe' @("$env:SystemRoot\System32\nvidia-smi.exe", "$env:ProgramFiles\NVIDIA Corporation\NVSMI\nvidia-smi.exe")
  if ($smi) {
    # аргументы в кавычках: без них PowerShell режет «name,memory.total,…» по запятым на отдельные аргументы
    $line = (Invoke-Exe $smi '--query-gpu=name,memory.total,driver_version' '--format=csv,noheader,nounits' | Select-Object -First 1)
    if ($line -and $line -notmatch '^(ERROR|Failed|NVIDIA-SMI has failed)') {
      $f = $line -split ',\s*'
      $gpu = [ordered]@{ name = $f[0]; vramMB = [int]$f[1]; driver = $f[2] }
      Ok ("видеокарта: {0}, {1:N1} ГБ, драйвер {2}" -f $gpu.name, ($gpu.vramMB / 1024), $gpu.driver)
      $drv = 0.0
      [void][double]::TryParse(($gpu.driver -replace ',', '.'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$drv)
      if ($drv -lt [double]$cfg.minDriver) {
        Warn ("драйвер NVIDIA {0} старый для RTX 50 (нужен ≥ {1}). Обновите: GeForce Experience / NVIDIA App или nvidia.com/drivers, затем запустите установку снова." -f $gpu.driver, $cfg.minDriver)
      }
    }
  }
  if (-not $gpu) {
    Warn 'видеокарта NVIDIA не найдена (нет nvidia-smi). Без неё ответы будут ОЧЕНЬ медленными.'
    if (-not $script:AtomDry -and -not $NoPause) {
      $a = Read-Host 'Продолжить без видеокарты? (д/н)'
      if ($a -notmatch '^(д|да|y|yes)$') { exit 2 }
    }
  }
}
$report['GPU'] = $(if ($gpu) { "{0}, {1:N1} ГБ, драйвер {2}" -f $gpu.name, ($gpu.vramMB / 1024), $gpu.driver } else { 'нет NVIDIA' })

# ---------------------------------------------------------------- 2–5. программы
function Install-Git {
  Update-PathFromRegistry
  if (Find-Git) { Ok ("Git: " + (& (Find-Git) --version)); return }
  if ($script:AtomDry) { Say '    [DRY] winget install Git.Git (запасной путь: github.com/git-for-windows, проверка подписи «Johannes Schindelin»)' 'DarkCyan'; return }
  if (-not (Invoke-Winget 'Git.Git')) {
    Warn 'winget не справился — качаю Git с github.com/git-for-windows'
    $rel = Invoke-RestMethod -UseBasicParsing 'https://api.github.com/repos/git-for-windows/git/releases/latest'
    $asset = $rel.assets | Where-Object { $_.name -match '^Git-[\d.]+-64-bit\.exe$' } | Select-Object -First 1
    $exe = Join-Path $paths.Cache $asset.name
    Get-File $asset.browser_download_url $exe
    Assert-Signed $exe 'Johannes Schindelin'
    $p = Start-Process -FilePath $exe -ArgumentList '/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-', '/SUPPRESSMSGBOXES' -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "установщик Git вернул $($p.ExitCode)" }
  }
  Update-PathFromRegistry
  if (-not (Find-Git)) { throw 'Git не установился' }
  Ok ("Git: " + (& (Find-Git) --version))
}

function Install-Node {
  Update-PathFromRegistry
  $n = Find-Node
  if ($n) {
    $v = (& $n --version).Trim()
    if ([int]($v.TrimStart('v').Split('.')[0]) -ge 20) { Ok "Node.js $v"; return }
    Warn "Node.js $v старый — ставлю LTS"
  }
  if ($script:AtomDry) { Say '    [DRY] winget install OpenJS.NodeJS.LTS (запасной путь: nodejs.org MSI, подпись «OpenJS Foundation»)' 'DarkCyan'; return }
  if (-not (Invoke-Winget 'OpenJS.NodeJS.LTS')) {
    Warn 'winget не справился — качаю Node.js LTS с nodejs.org'
    $idx = Invoke-RestMethod -UseBasicParsing 'https://nodejs.org/dist/index.json'
    $lts = $idx | Where-Object { $_.lts } | Select-Object -First 1
    $msi = Join-Path $paths.Cache ("node-{0}-x64.msi" -f $lts.version)
    Get-File ("https://nodejs.org/dist/{0}/node-{0}-x64.msi" -f $lts.version) $msi
    Assert-Signed $msi 'OpenJS Foundation'
    $p = Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/qn', '/norestart' -Wait -PassThru
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "установщик Node.js вернул $($p.ExitCode)" }
  }
  Update-PathFromRegistry
  if (-not (Find-Node)) { throw 'Node.js не установился' }
  Ok ("Node.js " + (& (Find-Node) --version))
}

# Ollama — архив с GitHub в C:\ATOMLAB\ollama: работает службой (задача от SYSTEM) без значка в трее.
# Проверки: SHA-256 из sha256sum.txt того же выпуска + подпись ollama.exe «Ollama Inc.».
function Install-Ollama {
  $exe = Join-Path $paths.Ollama 'ollama.exe'
  if (Test-Path -LiteralPath $exe) { Ok ("Ollama: " + ((Invoke-Exe $exe --version | Out-String).Trim() -replace '\s+', ' ')); return }
  if ($script:AtomDry) { Say "    [DRY] скачать github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip (~1,5 ГБ) → $($paths.Ollama), SHA-256 + подпись «Ollama Inc.»" 'DarkCyan'; return }
  $zip = Join-Path $paths.Cache 'ollama-windows-amd64.zip'
  try {
    Say '    качаю Ollama (~1,5 ГБ, несколько минут)…'
    Get-File 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip' $zip
    $sums = (Invoke-WebRequest -UseBasicParsing 'https://github.com/ollama/ollama/releases/latest/download/sha256sum.txt').Content
    if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
    $want = ([regex]::Match($sums, '([0-9a-f]{64})\s+\*?\.?/?ollama-windows-amd64\.zip')).Groups[1].Value
    $have = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLower()
    if (-not $want -or $want -ne $have) { throw "SHA-256 не совпал (ждали $want, получили $have)" }
    Ok 'SHA-256 архива Ollama совпал'
    if (Test-Path -LiteralPath $paths.Ollama) { Remove-Item -LiteralPath $paths.Ollama -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $paths.Ollama)
    Assert-Signed $exe 'Ollama Inc.'
    Remove-Item -LiteralPath $zip -Force
  } catch {
    Warn ("архив Ollama: " + $_.Exception.Message + " — пробую winget Ollama.Ollama")
    if (-not (Invoke-Winget 'Ollama.Ollama')) { throw 'Ollama не установилась' }
    $src = "$env:LOCALAPPDATA\Programs\Ollama"
    if (-not (Test-Path -LiteralPath (Join-Path $src 'ollama.exe'))) { throw 'Ollama не установилась' }
    Copy-Item -LiteralPath $src -Destination $paths.Ollama -Recurse -Force
    Assert-Signed $exe 'Ollama Inc.'
  }
  Ok ("Ollama: " + ((Invoke-Exe $exe --version | Out-String).Trim() -replace '\s+', ' '))
}

# Ollama из трея (если друг ставил её раньше) держит порт 11434 и мешает службе — выключаю её автозапуск.
function Stop-TrayOllama {
  $lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'Ollama.lnk'
  $tray = Get-Process -Name 'ollama app' -ErrorAction SilentlyContinue
  if (-not $tray -and -not (Test-Path -LiteralPath $lnk)) { return }
  Warn 'найдена Ollama со значком в трее — выключаю её автозапуск (сервер ATOMLAB запускает свою)'
  Act 'остановить «ollama app» и убрать ярлык автозагрузки' {
    $tray | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $lnk) { Move-Item -LiteralPath $lnk -Destination (Join-Path $paths.Root 'Ollama.lnk.disabled') -Force }
  }
}

function Install-Tailscale {
  $ts = Find-Tailscale
  if ($ts) { Ok ("Tailscale: " + ((Invoke-Exe $ts version | Select-Object -First 1))); return }
  if ($script:AtomDry) { Say '    [DRY] winget install Tailscale.Tailscale (запасной путь: pkgs.tailscale.com MSI, подпись «Tailscale Inc.», TS_UNATTENDEDMODE=always)' 'DarkCyan'; return }
  if (-not (Invoke-Winget 'Tailscale.Tailscale')) {
    Warn 'winget не справился — качаю Tailscale с pkgs.tailscale.com'
    $msi = Join-Path $paths.Cache 'tailscale-setup-latest-amd64.msi'
    Get-File 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' $msi
    Assert-Signed $msi 'Tailscale Inc.'
    $p = Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/qn', '/norestart', 'TS_UNATTENDEDMODE=always', 'TS_NOLAUNCH=1', 'TS_INSTALLUPDATES=always' -Wait -PassThru
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "установщик Tailscale вернул $($p.ExitCode)" }
  }
  Update-PathFromRegistry
  if (-not (Find-Tailscale)) { throw 'Tailscale не установился' }
  Ok 'Tailscale установлен'
}

if ($full) {
  Step '2. Git';        Install-Git
  Step '3. Node.js LTS'; Install-Node
  Step '4. Ollama';     Stop-TrayOllama; Install-Ollama
  Step '5. Tailscale';  Install-Tailscale
} else {
  Update-PathFromRegistry
  if (-not (Find-Git) -or -not (Find-Node)) { Fail 'для code-data нужны git и node'; exit 2 }
}

# ---------------------------------------------------------------- 6. код
Step '6. Код ATOMLAB'
$git = Find-Git
$gsafe = @('-c', ('safe.directory=' + ($paths.Repo -replace '\\', '/')))
if (Test-Path -LiteralPath (Join-Path $paths.Repo '.git')) {
  Ok "репозиторий уже есть: $($paths.Repo) (обновляет задача ATOMLAB Update)"
} else {
  $src = $RepoSource
  # локальный путь → file:// (иначе git игнорирует --depth/--filter)
  if ($src -notmatch '^[a-z]+://' -and (Test-Path -LiteralPath $src)) { $src = 'file:///' + ((Resolve-Path -LiteralPath $src).Path -replace '\\', '/') }
  Act "git clone --depth 1 --filter=blob:none --sparse --branch $Branch $src → $($paths.Repo)" {
    Invoke-Exe $git -c uploadpack.allowFilter=true clone --quiet --depth 1 --filter=blob:none --sparse --branch $Branch $src $paths.Repo | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Warn 'частичный клон не вышел — обычный мелкий клон'
      if (Test-Path -LiteralPath $paths.Repo) { Remove-Item -LiteralPath $paths.Repo -Recurse -Force }
      Invoke-Exe $git clone --quiet --depth 1 --branch $Branch $src $paths.Repo | Out-Host
      if ($LASTEXITCODE -ne 0) { throw 'git clone не удался' }
    } else {
      Invoke-Exe $git @gsafe -C $paths.Repo sparse-checkout set @($cfg.sparse) | Out-Host
      if ($LASTEXITCODE -ne 0) { throw 'git sparse-checkout не удался' }
    }
    # origin — всегда GitHub: автообновление берёт код оттуда (даже если клонировали с локального пути)
    if ($RepoSource -notmatch '^https://') { & $git @gsafe -C $paths.Repo remote set-url origin 'https://github.com/sadykoffalan2105-dev/atomlab' }
  }
  if (-not $script:AtomDry) { Ok ("код: " + ((& $git @gsafe -C $paths.Repo log -1 --format='%h %s') -join '')) }
}

# служебные скрипты → C:\ATOMLAB\bin (оттуда их запускает планировщик; автообновление обновляет их из репозитория);
# вместе с подпапкой comfy\ (картинки: установщик, run-comfy, манифест, узел безопасности)
Act "скрипты обслуживания → $($paths.Bin) (с подпапкой comfy\)" { Copy-AtomScripts $Pkg $paths.Bin }

# ---------------------------------------------------------------- 7. зависимости
Step '7. Зависимости (tsx)'
$depsArgs = @{ Root = $Root }
if ($script:AtomDry) { $depsArgs['DryRun'] = $true }
& (Join-Path $Pkg 'deps.ps1') @depsArgs
$script:AtomDry = [bool]$DryRun

# ---------------------------------------------------------------- 8. данные
Step '8. База знаний (снимок)'
$snap = Join-Path $Pkg 'data'
if (-not (Test-Path -LiteralPath $snap)) {
  Warn "в архиве нет папки data — мозг начнёт с пустого журнала (учебники в коде есть)"
} else {
  $info = Read-Json (Join-Path $snap 'SNAPSHOT.json')
  if ($info) { Say ("    снимок от {0}: записей {1}, векторов {2}" -f $info.builtAt, $info.journal.kept, $info.vectors.count) }
  Get-ChildItem -LiteralPath $snap -Recurse -File | Where-Object { $_.Name -ne 'SNAPSHOT.json' } | ForEach-Object {
    $rel = $_.FullName.Substring($snap.Length).TrimStart('\')
    $dst = Join-Path $paths.Data $rel
    if (Test-Path -LiteralPath $dst) {
      Say "    уже есть, не трогаю: $rel"   # журнал только дописывается — снимок поверх не кладём
    } else {
      Act "копировать $rel ($([Math]::Round($_.Length / 1MB, 1)) МБ)" {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $dst
      }
    }
  }
}

# ---------------------------------------------------------------- 9. config.json
Step '9. Настройки мозга (config.json)'
$wcArgs = @{ Root = $Root }
if ($script:AtomDry) { $wcArgs['DryRun'] = $true }
& (Join-Path $Pkg 'write-brain-config.ps1') @wcArgs
$script:AtomDry = [bool]$DryRun
if ($ChatModel -and -not $script:AtomDry) {
  # проверка на другом ПК: своя модель вместо 14b (в config.json сервера не попадает — только для этого запуска)
  $cj = Read-Json (Join-Path $paths.Data 'config.json')
  Set-StateValue $cj 'chatModels' @($ChatModel)
  Set-StateValue $cj 'fastModels' @($ChatModel)
  Write-JsonNoBom (Join-Path $paths.Data 'config.json') $cj
  Say "    модель для проверки: $ChatModel"
}

# ---------------------------------------------------------------- code-data: запуск и один вопрос
if (-not $full) {
  Step "10. Проверка: мозг на порту $BrainPort"
  if ($script:AtomDry) { Say '    [DRY] node --import tsx brain/server.ts; /health; один вопрос' 'DarkCyan'; exit 0 }
  Set-BrainEnv $paths $BrainPort
  $env:BRAIN_NO_WARM = '1'   # чужой (общий) Ollama не прогреваем лишними моделями
  $loader = Get-TsxLoader $paths
  $node = Find-Node
  $blog = Join-Path $paths.Logs 'brain-test.log'
  $p = Start-Process -FilePath $env:ComSpec -ArgumentList ('/c ""{0}" --import "{1}" brain/server.ts > "{2}" 2>&1"' -f $node, $loader, $blog) -WorkingDirectory $paths.Repo -WindowStyle Hidden -PassThru
  $h = $null
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 2
    $h = Get-BrainHealth $BrainPort
    if ($h -and -not $h.loading) { break }
  }
  if (-not $h) { Fail 'мозг не ответил на /health'; Get-Content -LiteralPath $blog -Tail 30 | Out-Host; Stop-ProcessTree $p.Id; exit 1 }
  Ok ("/health: ok={0}, llm={1} ({2}), база {3} док., векторов {4}, загрузка {5:N0} с" -f $h.ok, $h.llm.available, $h.llm.chatModel, $h.kb.docs, $h.kb.embedded, ((Get-Date) - $t0).TotalSeconds)
  $st = (Invoke-Exe $node --import $loader (Join-Path $paths.Repo 'deploy\brain-pc\selftest.mts') ("--url=http://127.0.0.1:{0}" -f $BrainPort) | Out-String)
  $sj = $null
  try { $sj = ($st.Trim().Split("`n") | Select-Object -Last 1) | ConvertFrom-Json } catch { }
  if ($sj -and $sj.ok) {
    Ok ("вопрос: первый кусок {0} мс, всего {1} мс, кусков {2}, маршрут {3}" -f $sj.firstMs, $sj.totalMs, $sj.chunks, $sj.route)
    Say ("    ответ: " + ($sj.text -replace '\s+', ' ').Substring(0, [Math]::Min(300, $sj.text.Length)))
  } else { Fail ("вопрос не прошёл: " + $st) }
  if ($KeepTestServer) { Say "    мозг оставлен работать (PID $($p.Id))"; exit 0 }
  Stop-ProcessTree $p.Id
  Ok 'проверочный мозг остановлен'
  if ($sj -and $sj.ok) { exit 0 } else { exit 1 }
}

# ---------------------------------------------------------------- 10. Ollama-служба и модели
# (Register-AtomTask — в common.ps1: задачу ATOMLAB Comfy регистрирует и update.ps1 на уже установленных серверах)
Step '10. Ollama (служба) и модели'
$env:OLLAMA_HOST = $cfg.ollama.host
Register-AtomTask 'ATOMLAB Ollama' 'run-ollama.ps1'
Act 'запустить ATOMLAB Ollama' { Start-ScheduledTask -TaskName 'ATOMLAB Ollama' }
if (-not $script:AtomDry) {
  for ($i = 0; $i -lt 60; $i++) { if (Invoke-Http 'http://127.0.0.1:11434/api/version' 2) { break }; Start-Sleep -Seconds 2 }
  if (-not (Invoke-Http 'http://127.0.0.1:11434/api/version' 2)) { throw 'Ollama не запустилась — см. C:\ATOMLAB\logs\ollama-*.log' }
  Ok 'Ollama отвечает'
}
$ollama = Join-Path $paths.Ollama 'ollama.exe'
foreach ($m in @($cfg.models.chat, $cfg.models.fast, $cfg.models.embed) | Select-Object -Unique) {
  Act "ollama pull $m (прогресс ниже)" {
    & $ollama pull $m
    if ($LASTEXITCODE -ne 0) { throw "ollama pull $m не удался" }
  }
}
if (-not $script:AtomDry) {
  $state = Read-State $paths
  Set-StateValue $state 'modelsKey' (Get-ModelsKey $cfg)
  Write-JsonNoBom $paths.State $state
}

# ---------------------------------------------------------------- 11. векторы
Step '11. Векторы поиска (bge-m3 на видеокарте)'
Set-BrainEnv $paths $BrainPort
$loader = Get-TsxLoader $paths
Act 'scripts/brain/embed.mts — досчитать недостающие векторы' {
  Push-Location $paths.Repo
  try { & (Find-Node) --import $loader scripts/brain/embed.mts --batch=64 } finally { Pop-Location }
}

# ---------------------------------------------------------------- 11b. картинки
# ComfyUI + модель картинок + классификатор безопасности (~14 ГБ). Любой сбой — только предупреждение:
# мозг работает и без картинок, а задача ATOMLAB Update докачает недостающее сама.
Step '11b. Картинки (ComfyUI)'
$imageState = 'выключены (image.enabled = false в server-config.json)'
if (Test-ImageEnabled $cfg) {
  $imageState = 'не готовы'
  try {
    $imgArgs = @{ Root = $Root }
    if ($script:AtomDry) { $imgArgs['DryRun'] = $true }
    & (Join-Path $Pkg 'comfy\image-install.ps1') @imgArgs
    $imgCode = $LASTEXITCODE
    $script:AtomDry = [bool]$DryRun
    if ($imgCode -eq 3) { Warn 'картинки скачаны не все — ATOMLAB Update докачает (каждые 15 мин)'; $imageState = 'докачиваются (Update)' }
    elseif ($imgCode -eq 2) { Warn 'для картинок мало места на диске — мозг работает без них'; $imageState = 'мало места на диске' }
    elseif ($imgCode -ne 0) { Warn "установка картинок завершилась с кодом $imgCode — см. C:\ATOMLAB\logs\image-install.log" }
    Register-AtomTask 'ATOMLAB Comfy' 'comfy\run-comfy.ps1'
    Act 'запустить ATOMLAB Comfy' { Start-ScheduledTask -TaskName 'ATOMLAB Comfy' }
    $comfyBase = 'http://127.0.0.1:{0}' -f (Get-ComfyPort $cfg)
    if ($script:AtomDry) {
      Say "    [DRY] ждать $comfyBase/system_stats (≤ 3 мин) и непустой $comfyBase/object_info/ATOMLABSafetyCheck" 'DarkCyan'
    } elseif ($imgCode -eq 0) {
      # Update не должен через 15 мин повторять установку и перезапускать мозг: ключ картинок уже актуален
      $st = Read-State $paths
      Set-StateValue $st 'imageKey' (Get-ImageKey $cfg (Read-Json (Join-Path $Pkg 'comfy\manifest.json')))
      Write-JsonNoBom $paths.State $st
      # первый старт ComfyUI под SYSTEM собирает кеши CUDA — до минуты-двух
      $upUntil = (Get-Date).AddMinutes(3)
      while ((Get-Date) -lt $upUntil -and -not (Test-ComfyUp $cfg 2)) { Start-Sleep -Seconds 3 }
      if (-not (Test-ComfyUp $cfg 2)) { Warn 'ComfyUI не ответил за 3 мин — см. C:\ATOMLAB\logs\comfy-*.log'; $imageState = 'ComfyUI не отвечает' }
      else {
        $oi = Invoke-Http "$comfyBase/object_info/ATOMLABSafetyCheck" 10
        if ($oi -and $oi.PSObject.Properties['ATOMLABSafetyCheck']) { Ok 'ComfyUI отвечает, узел ATOMLABSafetyCheck загружен'; $imageState = 'ComfyUI готов' }
        else { Warn 'ComfyUI отвечает, но узла ATOMLABSafetyCheck нет — см. C:\ATOMLAB\logs\comfy-*.log'; $imageState = 'нет узла безопасности' }
      }
    }
  } catch {
    $script:AtomDry = [bool]$DryRun
    Warn ("картинки: " + $_.Exception.Message + ' — мозг работает без них')
  }
} else {
  Say "    $imageState"
  if (-not $script:AtomDry) {
    $st = Read-State $paths
    Set-StateValue $st 'imageKey' (Get-ImageKey $cfg (Read-Json (Join-Path $Pkg 'comfy\manifest.json')))
    Write-JsonNoBom $paths.State $st
  }
}

# ---------------------------------------------------------------- 12. задачи
Step '12. Автозапуск и автообновление'
Register-AtomTask 'ATOMLAB Brain' 'run-brain.ps1'
Register-AtomTask 'ATOMLAB Update' 'update.ps1' -Repeat
Act 'запустить ATOMLAB Brain' { Start-ScheduledTask -TaskName 'ATOMLAB Brain' }

# ---------------------------------------------------------------- 13. питание
Step '13. Питание: не засыпать от сети'
Act 'powercfg: сон и гибернация от сети — никогда, гибернация выкл.' {
  & powercfg.exe /change standby-timeout-ac 0
  & powercfg.exe /change hibernate-timeout-ac 0
  & powercfg.exe /hibernate off
}

# ---------------------------------------------------------------- 14. Tailscale + Funnel
Step '14. Публичный адрес (Tailscale Funnel)'
$publicUrl = $null
$ts = Find-Tailscale
if (-not $ts -and -not $script:AtomDry) { Warn 'Tailscale не найден — шаг пропущен' }
else {
  if (-not $AuthKey) {
    foreach ($kf in @((Join-Path $Pkg 'ключ.txt'), (Join-Path $Pkg 'key.txt'))) {
      if (Test-Path -LiteralPath $kf) {
        $m = [regex]::Match((Get-Content -LiteralPath $kf -Raw), 'tskey-[A-Za-z0-9_-]+')
        if ($m.Success) { $AuthKey = $m.Value; Ok "ключ Tailscale взят из $(Split-Path -Leaf $kf)" }
      }
    }
  }
  $online = $false
  if ($ts) { $st = Get-TsStatus $ts; $online = [bool]($st -and $st.BackendState -eq 'Running') }
  if ($online) { Ok 'Tailscale уже подключён' }
  else {
    if (-not $AuthKey -and -not $script:AtomDry -and -not $NoPause) { $AuthKey = (Read-Host 'Вставьте ключ Tailscale от владельца (начинается с tskey-) и нажмите Enter').Trim() }
    if (-not $AuthKey) { Warn 'ключа нет — публичный адрес не настроен. Положите ключ в ключ.txt и запустите УСТАНОВИТЬ.bat ещё раз.' }
    else {
      Act 'tailscale up --auth-key=*** --hostname=atomlab-brain --unattended' {
        Invoke-Exe $ts up ("--auth-key=" + $AuthKey) '--hostname=atomlab-brain' '--unattended' | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'tailscale up не удался (ключ неверный или просрочен?)' }
      }
      $online = $true
    }
  }
  if ($online) {
    $fOk = Act "tailscale funnel --bg $BrainPort" { Enable-Funnel $ts $BrainPort 900 }
    if (-not $script:AtomDry) {
      if ($fOk) {
        $publicUrl = Get-FunnelUrl $ts
        $state = Read-State $paths
        Set-StateValue $state 'funnel' 'on'
        Set-StateValue $state 'publicUrl' $publicUrl
        Write-JsonNoBom $paths.State $state
        Ok "Funnel: $publicUrl → 127.0.0.1:$BrainPort"
      } else { Warn 'Funnel не включился — см. ИНСТРУКЦИЯ.txt (владелец: DNS → HTTPS Certificates и Funnel в политике)' }
    }
  }
}

# ---------------------------------------------------------------- 15. удалённое управление (по согласию)
Step '15. Удалённое управление для владельца (по желанию)'
if (-not $Ssh) {
  if ($script:AtomDry -or $NoPause) { $Ssh = 'no' }
  else {
    Say '    Владелец сможет заходить на этот ПК по SSH ТОЛЬКО через закрытую сеть Tailscale (из интернета — нельзя),'
    Say '    чтобы чинить сервер без вашего участия. Нужен пароль учётной записи Windows, его вы сообщаете сами.'
    $a = Read-Host '    Разрешить? (д/н)'
    if ($a -match '^(д|да|y|yes)$') { $Ssh = 'yes' } else { $Ssh = 'no' }
  }
}
if ($Ssh -eq 'yes') {
  Act 'OpenSSH Server: установить, автозапуск, вход только из сети Tailscale (100.64.0.0/10)' {
    Add-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0' | Out-Null
    Set-Service -Name sshd -StartupType Automatic
    Start-Service sshd
    $rule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
    if (-not $rule) { $rule = New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 }
    Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -RemoteAddress @('100.64.0.0/10', 'fd7a:115c:a1e0::/48')
  }
  $report['SSH'] = 'включён (только через Tailscale)'
} else { Say '    пропущено'; $report['SSH'] = 'выключен' }

# ---------------------------------------------------------------- 16. самопроверка и отчёт
Step '16. Самопроверка'
if ($script:AtomDry) {
  Say '    [DRY] /health локально и через Funnel, 20 живых вопросов (scripts/brain/eval.mts --sample=20), отчёт.txt на рабочий стол' 'DarkCyan'
  if (Test-ImageEnabled $cfg) { Say ("    [DRY] картинка: POST http://127.0.0.1:{0}/admin/image/test (X-Brain-Admin из secrets\admin-token.txt, ≤ 240 с) → logs\image-selftest.webp" -f $BrainPort) 'DarkCyan' }
  Say ''
  Say ("  ПРОБНЫЙ ПРОГОН ЗАВЕРШЁН за {0:N0} с — ничего не установлено и не изменено." -f ((Get-Date) - $t0).TotalSeconds) 'Green'
  exit 0
}
$h = $null
for ($i = 0; $i -lt 150; $i++) {
  $h = Get-BrainHealth $BrainPort
  if ($h -and -not $h.loading -and $h.llm.available) { break }
  Start-Sleep -Seconds 2
}
if ($h) { Ok ("локально /health: llm={0} ({1}), база {2} док., векторов {3}" -f $h.llm.available, $h.llm.chatModel, $h.kb.docs, $h.kb.embedded) } else { Fail 'мозг не отвечает локально' }
$report['Мозг локально'] = $(if ($h) { "ok, модель $($h.llm.chatModel), база $($h.kb.docs) док., векторов $($h.kb.embedded)" } else { 'НЕ ОТВЕЧАЕТ' })

$node = Find-Node
$evalJson = Join-Path $paths.Logs 'selftest-eval.json'
Say "    20 живых вопросов (несколько минут)…"
Push-Location $paths.Repo
try {
  $evalOut = (Invoke-Exe $node --import $loader scripts/brain/eval.mts ("--url=http://127.0.0.1:{0}" -f $BrainPort) ("--sample={0}" -f [int]$cfg.selfTest.sample) ("--json=" + $evalJson) | Out-String)
} finally { Pop-Location }
Add-Content -LiteralPath $script:LogFile -Value $evalOut -Encoding UTF8
$rows = @()
# PowerShell 5.1 отдаёт JSON-массив одним объектом — разворачиваем, иначе $rows.Count = 1, а поля — массивы
try { $rows = @((Get-Content -LiteralPath $evalJson -Raw -Encoding UTF8 | ConvertFrom-Json) | ForEach-Object { $_ }) } catch { }
function Get-Pct($vals, [double]$q) {
  $s = @($vals | Sort-Object)
  if (-not $s.Count) { return $null }
  return $s[[int][Math]::Min($s.Count - 1, [Math]::Floor(($q / 100) * ($s.Count - 1) + 0.5))]
}
if ($rows.Count) {
  $pass = @($rows | Where-Object { -not $_.why -or @($_.why).Count -eq 0 }).Count
  $firsts = @($rows | Where-Object { $_.source -eq 'llm' -and $_.firstMs } | ForEach-Object { try { [int][double]$_.firstMs } catch { } })
  $rate = [Math]::Round(100.0 * $pass / $rows.Count, 1)
  $p50 = Get-Pct $firsts 50
  $p95 = Get-Pct $firsts 95
  Ok ("вопросов {0}, прошло {1} ({2} %), первое слово p50 {3} мс, p95 {4} мс" -f $rows.Count, $pass, $rate, $p50, $p95)
  $report['Проверка (20 вопросов)'] = ("прошло {0} из {1} ({2} %); первое слово p50 {3} мс, p95 {4} мс" -f $pass, $rows.Count, $rate, $p50, $p95)
} else {
  Warn 'eval не дал результатов — см. лог установки'
  $report['Проверка (20 вопросов)'] = 'не выполнена'
}

if ($publicUrl) {
  $pj = Join-Path $paths.Logs 'selftest-funnel.json'
  Invoke-Exe $node --import $loader (Join-Path $paths.Repo 'deploy\brain-pc\selftest.mts') ("--url=" + $publicUrl) ("--json=" + $pj) | Out-Null
  $fj = Read-Json $pj
  if ($fj -and $fj.ok) {
    Ok ("через интернет: {0}/health ok, первое слово {1} мс, всего {2} мс (кусков {3})" -f $publicUrl, $fj.firstMs, $fj.totalMs, $fj.chunks)
    $report['Через интернет'] = ("ok, первое слово {0} мс, кусков {1}" -f $fj.firstMs, $fj.chunks)
  } else {
    Warn ("через интернет не ответил: " + $(if ($fj) { $fj.error } else { 'нет ответа' }) + ' (новому адресу иногда нужно 1–10 мин на HTTPS-сертификат и DNS)')
    $report['Через интернет'] = 'не ответил при установке (проверьте позже)'
  }
}
# картинка: POST /admin/image/test (только админ) — весь путь: пауза текста, выгрузка Gemma, рисование, узел безопасности
if (Test-ImageEnabled $cfg) {
  $imgLine = "не проверены: $imageState"
  if ($imageState -eq 'ComfyUI готов') {
    $hi = $null
    for ($i = 0; $i -lt 36; $i++) {   # мозг опрашивает ComfyUI сам (раз в минуту) — ждём image.ready до 3 мин
      $hi = Get-BrainHealth $BrainPort
      if ($hi -and $hi.image -and $hi.image.ready) { break }
      Start-Sleep -Seconds 5
    }
    try {
      $tok = (Get-Content -LiteralPath (Join-Path $paths.Secrets 'admin-token.txt') -Raw).Trim()
      Say '    проверочная картинка (до 4 мин)…'
      $ir = Invoke-RestMethod -UseBasicParsing -Method Post -Uri ("http://127.0.0.1:{0}/admin/image/test" -f $BrainPort) -Headers @{ 'X-Brain-Admin' = $tok } -ContentType 'application/json' -Body '{}' -TimeoutSec 240
      if ($ir.ok -eq $false -or -not $ir.dataUrl) {
        $em = $ir.error
        if ($em -and $em.message) { $em = "$($em.code): $($em.message)" }
        throw ("мозг ответил: " + $(if ($em) { $em } else { 'нет картинки в ответе' }))
      }
      $b64 = ([string]$ir.dataUrl).Substring(([string]$ir.dataUrl).IndexOf(',') + 1)
      [IO.File]::WriteAllBytes((Join-Path $paths.Logs 'image-selftest.webp'), [Convert]::FromBase64String($b64))
      $size = $(if ($ir.width -eq $ir.height) { "$($ir.width)²" } else { "$($ir.width)×$($ir.height)" })
      $gen = 0
      if ($ir.timings -and $ir.timings.genMs) { $gen = [double]$ir.timings.genMs }
      $nsfw = 0.0
      if ($ir.safety) { $nsfw = [double]$ir.safety.nsfw }
      $imgLine = ("ok, {0}, первая {1:N1} с (из них рисование {2:N1} с), nsfw {3:N3}" -f $size, ([double]$ir.ms / 1000), ($gen / 1000), $nsfw)
      Ok ("картинка: " + $imgLine + " → logs\image-selftest.webp")
    } catch {
      $msg = $_.Exception.Message
      if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
      $imgLine = "не удалось — " + ($msg -replace '\s+', ' ')
      Warn ("картинка: " + $imgLine)
    }
  }
  $report['Картинки'] = $imgLine
} else {
  $report['Картинки'] = 'выключены (image.enabled = false)'
}
$report['Ключ учителя'] = (Join-Path $paths.Secrets 'teacher-tokens.txt')
$report['Публичный адрес'] = $(if ($publicUrl) { $publicUrl } else { 'не настроен' })
$report['Папка'] = $paths.Root
$report['Токен администратора'] = (Join-Path $paths.Secrets 'admin-token.txt')
$report['Установка заняла'] = ("{0:N0} мин" -f ((Get-Date) - $t0).TotalMinutes)

$lines = @('ATOMLAB — сервер ИИ-учителя: отчёт об установке', ("Дата: {0:yyyy-MM-dd HH:mm}" -f (Get-Date)), '')
foreach ($k in $report.Keys) { $lines += ("{0}: {1}" -f $k, $report[$k]) }
$lines += ''
$lines += 'Перешлите этот файл владельцу ATOMLAB. Компьютер должен оставаться включённым и подключённым к интернету.'
$txt = ($lines -join "`r`n") + "`r`n"
$desk = [Environment]::GetFolderPath('Desktop')
foreach ($f in @((Join-Path $desk 'отчёт.txt'), (Join-Path $paths.Root 'report.txt'))) {
  try { [IO.File]::WriteAllText($f, $txt, (New-Object System.Text.UTF8Encoding($true))) } catch { }
}

Say ''
Say '  ##########################################################' 'Green'
Say '  #                                                        #' 'Green'
Say '  #                       ГОТОВО                           #' 'Green'
Say '  #                                                        #' 'Green'
Say '  ##########################################################' 'Green'
Say ''
if ($publicUrl) {
  Say '  АДРЕС СЕРВЕРА (отправьте владельцу):' 'White'
  Say ''
  Say ("      " + $publicUrl.ToUpper()) 'Yellow'
  Say ("      " + $publicUrl) 'Yellow'
} else {
  Say '  Сервер работает на этом ПК, но публичного адреса пока нет (см. отчёт.txt).' 'Yellow'
}
Say ''
Say "  Отчёт: $(Join-Path $desk 'отчёт.txt')" 'White'
