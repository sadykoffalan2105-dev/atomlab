# Задача «ATOMLAB Update» (каждые 15 минут, от SYSTEM): автообновление + сторож.
#  1) сторож: Ollama и мозг живы, Funnel включён;
#  2) git fetch; есть новые коммиты → код до origin (reset --hard: в мелком клоне это надёжнее pull);
#     package-lock.json изменился → зависимости; модели в server-config.json изменились → ollama pull + config.json;
#  3) перезапуск мозга только когда он свободен (нет открытых соединений), иначе — в следующий раз
#     (после forceRestartAfterRuns попыток — всё равно). Журнал: C:\ATOMLAB\logs\update.log.
param([string]$Root = 'C:\ATOMLAB', [switch]$DryRun, [switch]$Force)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
$script:LogFile = Join-Path $paths.Logs 'update.log'

# одна копия за раз
$lock = Join-Path $paths.Run 'update.lock'
if ((Test-Path -LiteralPath $lock) -and ((Get-Date) - (Get-Item -LiteralPath $lock).LastWriteTime).TotalMinutes -lt 60) { exit 0 }
Set-Content -LiteralPath $lock -Value $PID

try {
  Update-PathFromRegistry
  $cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')
  $port = [int]$cfg.brain.port
  $state = Read-State $paths
  $git = Find-Git
  if (-not $git) { throw 'git не найден' }
  $repo = $paths.Repo
  # задача идёт от SYSTEM, а папку создал администратор — git иначе откажется («dubious ownership»)
  $g = @('-c', ("safe.directory=" + ($repo -replace '\\', '/')), '-C', $repo)

  # --- 1. сторож ---
  if (-not (Invoke-Http 'http://127.0.0.1:11434/api/version' 3)) {
    Warn 'Ollama не отвечает — запускаю задачу ATOMLAB Ollama'
    Act 'Start-ScheduledTask ATOMLAB Ollama' { Start-ScheduledTask -TaskName 'ATOMLAB Ollama' -ErrorAction SilentlyContinue }
  }
  if (-not (Get-BrainHealth $port)) {
    Start-Sleep -Seconds 20
    if (-not (Get-BrainHealth $port)) {
      Warn 'мозг не отвечает — запускаю задачу ATOMLAB Brain'
      Act 'Start-ScheduledTask ATOMLAB Brain' { Start-ScheduledTask -TaskName 'ATOMLAB Brain' -ErrorAction SilentlyContinue }
    }
  }
  # картинки: ComfyUI установлен, включён, а /system_stats молчит — поднимаем задачу ATOMLAB Comfy
  if ((Test-ImageEnabled $cfg) -and (Test-Path -LiteralPath (Join-Path $paths.ComfyRoot 'python_embeded\python.exe')) -and -not (Test-ComfyUp $cfg 3)) {
    if (Get-ScheduledTask -TaskName 'ATOMLAB Comfy' -ErrorAction SilentlyContinue) {
      Warn 'ComfyUI не отвечает — запускаю задачу ATOMLAB Comfy'
      Act 'Start-ScheduledTask ATOMLAB Comfy' { Start-ScheduledTask -TaskName 'ATOMLAB Comfy' -ErrorAction SilentlyContinue }
    }
  }
  $ts = Find-Tailscale
  if ($ts -and $state.funnel -eq 'on') {
    $fs = (Invoke-Exe $ts funnel status | Out-String)
    if ($fs -notmatch ("127\.0\.0\.1:" + $port)) {
      Warn 'Funnel выключен — включаю снова'
      Act "tailscale funnel --bg $port" { Enable-Funnel $ts $port 60 | Out-Null }
    }
  }

  # --- 2. обновление кода ---
  $branch = $cfg.update.branch
  if (-not $branch) { $branch = 'main' }
  Invoke-Exe $git @g fetch --depth 1 --quiet origin $branch | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "git fetch не удался (код $LASTEXITCODE)" }
  $head = (& $git @g rev-parse HEAD).Trim()
  $remote = (& $git @g rev-parse FETCH_HEAD).Trim()
  $pending = ($state.restartPending -eq $true)
  if ($head -ne $remote -or $Force) {
    $changed = @(& $git @g diff --name-only $head $remote)
    Say ("новые коммиты: {0} → {1}, файлов изменено: {2}" -f $head.Substring(0, 8), $remote.Substring(0, 8), $changed.Count)
    Act "git reset --hard $($remote.Substring(0, 8))" { & $git @g reset --hard --quiet $remote; if ($LASTEXITCODE -ne 0) { throw 'git reset не удался' } }
    # набор папок мелкого клона — из server-config.json (новая папка, нужная мозгу, добавляется там)
    $newCfgPath = Join-Path $repo 'deploy\brain-pc\server-config.json'
    if (Test-Path -LiteralPath $newCfgPath) {
      $newCfg = Get-ServerConfig $newCfgPath
      if ($newCfg.sparse) { Act 'git sparse-checkout set' { Invoke-Exe $git @g sparse-checkout set @($newCfg.sparse) | Out-Null } }
    }
    # сами скрипты обслуживания тоже обновляются (вступят в силу со следующего запуска)
    Act 'обновить C:\ATOMLAB\bin из deploy\brain-pc' {
      Get-ChildItem -LiteralPath (Join-Path $repo 'deploy\brain-pc') -File | Where-Object { $_.Extension -in '.ps1', '.json' } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $paths.Bin -Force
      }
    }
    $cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')
    if ($changed -contains 'package-lock.json' -or $changed -contains 'package.json') {
      Say 'package-lock.json изменился — обновляю зависимости'
      if (-not $script:AtomDry) { & (Join-Path $paths.Bin 'deps.ps1') -Root $Root }
    }
    $pending = $true
  }

  # --- модели ---
  $key = Get-ModelsKey $cfg
  if ($state.modelsKey -ne $key) {
    Say "модели изменились: $($state.modelsKey) → $key"
    $ollama = Join-Path $paths.Ollama 'ollama.exe'
    if (-not (Test-Path -LiteralPath $ollama)) { $ollama = Find-Exe 'ollama.exe' }
    foreach ($m in @($cfg.models.chat, $cfg.models.fast, $cfg.models.embed) | Select-Object -Unique) {
      Act "ollama pull $m" { Invoke-Exe $ollama pull $m | Out-Null; if ($LASTEXITCODE -ne 0) { throw "ollama pull $m не удался" } }
    }
    Act 'config.json: модели' { & (Join-Path $paths.Bin 'write-brain-config.ps1') -Root $Root }
    # прежние модели выгружаются из видеопамяти (keep_alive у профиля gpu — навсегда), но остаются на диске:
    # откат = вернуть строку в server-config.json, без повторной загрузки
    $newSet = @($cfg.models.chat, $cfg.models.fast, $cfg.models.embed)
    foreach ($m in @(([string]$state.modelsKey) -split '\|' | Where-Object { $_ -and ($newSet -notcontains $_) } | Select-Object -Unique)) {
      Act "ollama stop $m (выгрузить из видеопамяти)" { Invoke-Exe $ollama stop $m | Out-Null }
    }
    Set-StateValue $state 'modelsKey' $key
    $pending = $true
  }

  # --- картинки (ComfyUI) ---
  # Ключ картинок (движок|вариант|выпуск ComfyUI|версия манифеста|вкл, + ученики/ключи/порт/резерв) изменился или пришли
  # правки deploy/brain-pc/comfy/** → comfy\image-install.ps1 (докачка ≤ 50 мин за запуск, код 3 — продолжит в следующий раз),
  # затем перезапуск ComfyUI, когда его очередь пуста, config.json мозга и перезапуск мозга по общим правилам ниже.
  # Подпапку bin\comfy синхронизируем здесь (старый update.ps1 копировал только верхний уровень deploy\brain-pc).
  if ($cfg.image) {
    $comfyTouched = (@($changed | Where-Object { $_ -like 'deploy/brain-pc/comfy/*' }).Count -gt 0)
    $imgScript = Join-Path $paths.Bin 'comfy\image-install.ps1'
    if ($comfyTouched -or $Force -or -not (Test-Path -LiteralPath $imgScript)) {
      Act 'обновить C:\ATOMLAB\bin (с подпапкой comfy\) из deploy\brain-pc' { Copy-AtomScripts (Join-Path $repo 'deploy\brain-pc') $paths.Bin }
    }
    if (-not (Test-Path -LiteralPath $imgScript)) { $imgScript = Join-Path $repo 'deploy\brain-pc\comfy\image-install.ps1' }
    $imgManifest = Read-Json (Join-Path (Split-Path -Parent $imgScript) 'manifest.json')
    $ikey = Get-ImageKey $cfg $imgManifest
    $needImg = ($state.imageKey -ne $ikey) -or $comfyTouched -or $Force
    if (-not $needImg -and (Test-ImageEnabled $cfg) -and -not (Test-Path -LiteralPath (Join-Path $paths.ComfyRoot 'python_embeded\python.exe'))) { $needImg = $true }
    if ($needImg) {
      Say "картинки: $($state.imageKey) → $ikey"
      $imgArgs = @{ Root = $Root; BudgetMinutes = 50; Quiet = $true }
      if ($script:AtomDry) { $imgArgs['DryRun'] = $true }
      $imgCode = 1
      # сбой картинок не должен останавливать обновление мозга — только предупреждение
      try {
        if ((Test-ImageEnabled $cfg) -and -not (Get-ScheduledTask -TaskName 'ATOMLAB Comfy' -ErrorAction SilentlyContinue)) {
          Register-AtomTask 'ATOMLAB Comfy' 'comfy\run-comfy.ps1'   # серверы, поставленные до картинок: задачу добавляет Update
        }
        if (Test-Path -LiteralPath $imgScript) { & $imgScript @imgArgs; $imgCode = $LASTEXITCODE } else { Warn "нет $imgScript" }
      } catch { Warn ("картинки: " + $_.Exception.Message) }
      $script:AtomDry = [bool]$DryRun
      # image-install сам пишет state.json (verified, comfyTag) — переносим, чтобы наш $state их не затёр
      $fresh = Read-State $paths
      foreach ($k in 'verified', 'comfyTag') { if ($fresh.PSObject.Properties[$k]) { Set-StateValue $state $k $fresh.$k } }
      if ($imgCode -eq 0) {
        $cport = Get-ComfyPort $cfg
        if (Test-ComfyUp $cfg 3) {
          # перезапуск ComfyUI, когда в его очереди пусто (окно картинок ≤ 30 с — ждём не дольше idleWaitMinutes)
          if (-not $script:AtomDry) {
            $qDeadline = (Get-Date).AddMinutes([int]$cfg.update.idleWaitMinutes)
            while ((Get-Date) -lt $qDeadline) {
              $q = Invoke-Http ("http://127.0.0.1:{0}/queue" -f $cport) 3
              if (-not $q -or (@($q.queue_running).Count -eq 0 -and @($q.queue_pending).Count -eq 0)) { break }
              Start-Sleep -Seconds 10
            }
          }
          Act 'перезапуск ComfyUI (run\restart-comfy)' { Set-Content -LiteralPath (Join-Path $paths.Run 'restart-comfy') -Value (Get-Date).ToString('s') }
        } elseif (Test-ImageEnabled $cfg) {
          Act 'Start-ScheduledTask ATOMLAB Comfy' { Start-ScheduledTask -TaskName 'ATOMLAB Comfy' -ErrorAction SilentlyContinue }
        }
        Act 'config.json: картинки' { & (Join-Path $paths.Bin 'write-brain-config.ps1') -Root $Root }
        Set-StateValue $state 'imageKey' $ikey
        $pending = $true
      } elseif ($imgCode -eq 3) {
        Say 'картинки докачиваются — продолжу в следующий запуск'
      } else {
        Warn "картинки: image-install вернул код $imgCode (см. logs\image-install.log) — повторю в следующий запуск"
      }
    }
  }

  # --- 3. перезапуск мозга, когда свободен ---
  if ($pending) {
    $runs = 0
    if ($state.pendingRuns) { $runs = [int]$state.pendingRuns }
    $limit = [int]$cfg.update.forceRestartAfterRuns
    $waitMin = [int]$cfg.update.idleWaitMinutes
    $idle = 0
    $deadline = (Get-Date).AddMinutes($waitMin)
    while ((Get-Date) -lt $deadline) {
      if ((Get-ActiveConnections $port) -eq 0) { $idle++ } else { $idle = 0 }
      if ($idle -ge 2) { break }
      Start-Sleep -Seconds 10
    }
    if ($idle -ge 2 -or $runs + 1 -ge $limit) {
      Act 'перезапуск мозга (run\restart-brain)' { Set-Content -LiteralPath (Join-Path $paths.Run 'restart-brain') -Value (Get-Date).ToString('s') }
      Set-StateValue $state 'restartPending' $false
      Set-StateValue $state 'pendingRuns' 0
      Set-StateValue $state 'lastRestart' (Get-Date).ToString('s')
      Ok 'мозг перезапускается с новым кодом'
    } else {
      Set-StateValue $state 'restartPending' $true
      Set-StateValue $state 'pendingRuns' ($runs + 1)
      Say "мозг занят — перезапуск в следующий раз (попытка $($runs + 1) из $limit)"
    }
  }
  Set-StateValue $state 'lastUpdateCheck' (Get-Date).ToString('s')
  if (-not $script:AtomDry) { Write-JsonNoBom $paths.State $state }

  # старые журналы (> 14 дней) — только наши логи в C:\ATOMLAB\logs, папку данных не трогаем
  Get-ChildItem -LiteralPath $paths.Logs -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | ForEach-Object {
    Act "удалить старый лог $($_.Name)" { Remove-Item -LiteralPath $_.FullName -Force }
  }
} catch {
  Fail ("автообновление: " + $_.Exception.Message)
  exit 1
} finally {
  Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue
}
