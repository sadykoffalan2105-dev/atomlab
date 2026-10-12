# Распознавание речи (STT) на сервере мозга: сайдкар atomlab-stt (brain/stt/sidecar, Python) на 127.0.0.1:8788.
# Идемпотентно и без вопросов (задачи от SYSTEM): повторный запуск ничего не переустанавливает.
#
#   stt.ps1 -Root C:\ATOMLAB             полная установка/обновление (install.ps1, шаг 10b; задача «ATOMLAB STT Setup»):
#                                        место на диске → Python 3.12 → venv → torch (cu128) + пакеты → модели (суммы sha256)
#                                        → проверка GPU → прогрев → задача «ATOMLAB STT» (run-stt.ps1) → /health
#   stt.ps1 -Root C:\ATOMLAB -FromUpdate быстрая проверка из update.ps1 (секунды): изменились stt-requirements.txt /
#                                        stt-config.json → запуск задачи «ATOMLAB STT Setup» (установка идёт отдельно и
#                                        не держит автообновление); изменился код сайдкара → флаг run\restart-stt;
#                                        сторож: сайдкар не отвечает → запуск задачи «ATOMLAB STT»
#   -DryRun                              ничего не меняет: печатает каждый шаг ([DRY] …)
# Любой сбой здесь не мешает мозгу: /stt без сайдкара честно отвечает 503, сайт переходит на Web Speech.
param([string]$Root = 'C:\ATOMLAB', [switch]$FromUpdate, [switch]$DryRun)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
$stt = @{
  Dir    = Join-Path $Root 'stt'
  Venv   = Join-Path $Root 'stt\venv'
  Py     = Join-Path $Root 'stt\venv\Scripts\python.exe'
  Models = Join-Path $Root 'stt\models'
  State  = Join-Path $Root 'stt\state.json'
  Python = Join-Path $Root 'python'
  Req    = Join-Path $paths.Repo 'deploy\brain-pc\stt-requirements.txt'
  Side   = Join-Path $paths.Repo 'brain\stt\sidecar'
}
$cfgPath = Join-Path $PSScriptRoot 'stt-config.json'
$scfg = Read-Json $cfgPath
if (-not $scfg) { Warn "нет $cfgPath — STT пропущен"; exit 0 }
$port = [int]$scfg.port
if ($port -le 0) { $port = 8788 }

function Get-Sha([string]$file) {
  if (-not (Test-Path -LiteralPath $file)) { return 'none' }
  return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.Substring(0, 16)
}
# отпечаток установки: требования + настройки STT (их изменение → переустановка через задачу «ATOMLAB STT Setup»)
function Get-InstallKey { return ('{0}|{1}' -f (Get-Sha $stt.Req), (Get-Sha $cfgPath)) }
# отпечаток кода сайдкара: изменился → перезапуск сайдкара (флаг run\restart-stt)
function Get-CodeKey {
  $files = @(Get-ChildItem -LiteralPath $stt.Side -Filter '*.py' -File -ErrorAction SilentlyContinue | Sort-Object Name)
  if (-not $files.Count) { return 'none' }
  return (($files | ForEach-Object { Get-Sha $_.FullName }) -join '')
}
function Read-SttState {
  $s = Read-Json $stt.State
  if (-not $s) { $s = New-Object PSObject }
  return $s
}
function Save-SttState($s) {
  if ($script:AtomDry) { return }
  New-Item -ItemType Directory -Force -Path $stt.Dir | Out-Null
  Write-JsonNoBom $stt.State $s
}
function Get-SttHealth { return (Invoke-Http ("http://127.0.0.1:{0}/health" -f $port) 3) }

function Register-SttTask([string]$name, [string]$file, [string]$extraArgs, [TimeSpan]$limit, [switch]$AtStartup) {
  $ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $arg = ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -Root "{1}" {2}' -f (Join-Path $paths.Bin $file), $Root, $extraArgs).Trim()
  Act "задача планировщика «$name» ($file, SYSTEM)" {
    $action = New-ScheduledTaskAction -Execute $ps -Argument $arg -WorkingDirectory $paths.Bin
    $principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit $limit -MultipleInstances IgnoreNew
    if ($AtStartup) {
      Register-ScheduledTask -TaskName $name -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $principal -Settings $settings -Description 'ATOMLAB: распознавание речи' -Force | Out-Null
    } else {
      Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Settings $settings -Description 'ATOMLAB: установка распознавания речи' -Force | Out-Null
    }
  }
}

# ================================================================ быстрая проверка из update.ps1
if ($FromUpdate) {
  New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
  $script:LogFile = Join-Path $paths.Logs 'stt-update.log'
  if (-not $scfg.enabled) { exit 0 }
  $st = Read-SttState
  $key = Get-InstallKey
  if ($st.installedKey -ne $key) {
    # установка/переустановка — отдельной задачей (часы на скачивание не держат автообновление)
    $retry = [double]$scfg.retryHours
    if ($retry -le 0) { $retry = 6 }
    $recent = $false
    if ($st.lastAttemptKey -eq $key -and $st.lastAttemptAt) {
      try { $recent = ((Get-Date) - [datetime]$st.lastAttemptAt).TotalHours -lt $retry } catch { $recent = $false }
    }
    $running = $false
    $t = Get-ScheduledTask -TaskName 'ATOMLAB STT Setup' -ErrorAction SilentlyContinue
    if ($t -and $t.State -eq 'Running') { $running = $true }
    if (-not $recent -and -not $running) {
      Say "STT: требования или настройки изменились ($($st.installedKey) → $key) — запускаю установку отдельной задачей"
      Register-SttTask 'ATOMLAB STT Setup' 'stt.ps1' '' (New-TimeSpan -Hours 4)
      Act 'запустить ATOMLAB STT Setup' { Start-ScheduledTask -TaskName 'ATOMLAB STT Setup' }
    }
    exit 0
  }
  $code = Get-CodeKey
  if ($st.codeKey -ne $code) {
    Act 'перезапуск сайдкара STT (run\restart-stt)' { Set-Content -LiteralPath (Join-Path $paths.Run 'restart-stt') -Value (Get-Date).ToString('s') }
    Set-StateValue $st 'codeKey' $code
    Save-SttState $st
  } elseif (-not (Get-SttHealth)) {
    if (Get-ScheduledTask -TaskName 'ATOMLAB STT' -ErrorAction SilentlyContinue) {
      Warn 'сайдкар STT не отвечает — запускаю задачу ATOMLAB STT'
      Act 'Start-ScheduledTask ATOMLAB STT' { Start-ScheduledTask -TaskName 'ATOMLAB STT' -ErrorAction SilentlyContinue }
    }
  }
  exit 0
}

# ================================================================ полная установка / обновление
if (-not $script:AtomDry) {
  New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run, $stt.Dir | Out-Null
  $script:LogFile = Join-Path $paths.Logs ("stt-install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
}
$st = Read-SttState
$key = Get-InstallKey
Set-StateValue $st 'lastAttemptKey' $key
Set-StateValue $st 'lastAttemptAt' (Get-Date).ToString('s')
Save-SttState $st
function Finish([string]$report) {
  Set-StateValue $st 'report' $report
  Save-SttState $st
  Say ("    STT: " + $report)
}

if (-not $scfg.enabled) { Finish 'выключен (stt-config.json: enabled=false)'; exit 0 }
if (-not (Test-Path -LiteralPath $stt.Req)) { Warn "нет $($stt.Req) — код ещё не получен"; Finish 'пропущен: нет кода'; exit 0 }

# одна установка за раз
$lock = Join-Path $paths.Run 'stt-install.lock'
if ((-not $script:AtomDry) -and (Test-Path -LiteralPath $lock) -and ((Get-Date) - (Get-Item -LiteralPath $lock).LastWriteTime).TotalHours -lt 4) {
  Say 'STT: установка уже идёт (run\stt-install.lock)'
  exit 0
}
if (-not $script:AtomDry) { Set-Content -LiteralPath $lock -Value $PID }

try {
  Update-PathFromRegistry
  # git нужен pip для пакета gigaam (git+https)
  $git = Find-Git
  if ($git) { $env:Path = (Split-Path -Parent $git) + ';' + $env:Path }

  # --- 1. место на диске (venv с torch ≈ 5 ГБ, модели ≈ 3 ГБ, запас) ---
  Step 'STT 1. Место на диске'
  $need = [double]$scfg.minDiskGB
  if ($need -le 0) { $need = 12 }
  $drive = (Split-Path -Qualifier $Root).TrimEnd(':')
  $freeGB = 0
  try { $freeGB = [Math]::Round((Get-PSDrive -Name $drive -ErrorAction Stop).Free / 1GB, 1) } catch { $freeGB = 0 }
  if ((-not (Test-Path -LiteralPath $stt.Py)) -and $freeGB -lt $need -and $freeGB -gt 0) {
    Warn ("свободно {0} ГБ, нужно ≥ {1} ГБ" -f $freeGB, $need)
    Finish ("пропущен: мало места ({0} ГБ из {1})" -f $freeGB, $need)
    exit 0
  }
  Ok ("свободно {0} ГБ" -f $freeGB)

  # --- 2. Python 3.12 (свой, в C:\ATOMLAB\python: ни PATH, ни лаунчер системы не трогаем) ---
  Step 'STT 2. Python'
  $pyHome = Join-Path $stt.Python 'python.exe'
  $ver = [string]$scfg.python.version
  $havePy = $false
  if (Test-Path -LiteralPath $pyHome) {
    $v = (Invoke-Exe $pyHome --version | Out-String).Trim()
    if ($v -like "Python $ver*" -or $v -like 'Python 3.12*') { $havePy = $true; Ok "уже стоит: $v" }
  }
  if (-not $havePy) {
    $inst = Join-Path $paths.Cache ("python-{0}-amd64.exe" -f $ver)
    $okPy = $false
    try {
      Act "скачать $($scfg.python.url)" { Get-File $scfg.python.url $inst }
      if (-not $script:AtomDry) { Assert-Signed $inst ([string]$scfg.python.signer) }
      Act "установить Python $ver в $($stt.Python) (тихо, без PATH)" {
        $a = @('/quiet', 'InstallAllUsers=1', ("TargetDir=" + $stt.Python), 'Include_launcher=0', 'PrependPath=0', 'Include_test=0', 'Shortcuts=0', 'AssociateFiles=0')
        $p = Start-Process -FilePath $inst -ArgumentList $a -Wait -PassThru
        if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "установщик Python: код $($p.ExitCode)" }
      }
      $okPy = $true
    } catch {
      Warn ("Python с python.org не установился: " + $_.Exception.Message)
    }
    if (-not $okPy -and $scfg.python.winget -and (Test-Winget)) {
      Act "winget $($scfg.python.winget)" { if (-not (Invoke-Winget ([string]$scfg.python.winget))) { throw 'winget не смог' } }
      $cand = @("$env:ProgramFiles\Python312\python.exe") | Where-Object { Test-Path -LiteralPath $_ }
      if ($cand) { $pyHome = $cand[0]; $okPy = $true }
    }
    if (-not $okPy -and -not $script:AtomDry) { throw 'Python не установлен' }
  }

  # --- 3. venv ---
  Step 'STT 3. Окружение Python (venv)'
  if (Test-Path -LiteralPath $stt.Py) { Ok "уже есть: $($stt.Venv)" } else {
    Act "python -m venv $($stt.Venv)" {
      Invoke-Exe $pyHome -m venv $stt.Venv | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "venv: код $LASTEXITCODE" }
    }
  }

  # --- 4. пакеты: torch (cu128 — RTX 50xx/sm_120), затем требования ---
  Step 'STT 4. Пакеты (torch cu128, GigaAM, faster-whisper)'
  $env:PIP_DISABLE_PIP_VERSION_CHECK = '1'
  $env:PIP_NO_INPUT = '1'
  $env:PIP_CACHE_DIR = Join-Path $paths.Cache 'pip'
  $torchPk = @($scfg.torch.packages)
  $torchWant = ([string]$torchPk[0]) -replace '^torch==', ''
  $torchHave = ''
  if (Test-Path -LiteralPath $stt.Py) { $torchHave = ((Invoke-Exe $stt.Py -I -c 'import torch;print(torch.__version__.split(chr(43))[0])' | Select-Object -Last 1) -as [string]) }
  if ($torchHave -and $torchHave.Trim() -eq $torchWant) { Ok "torch $torchHave уже стоит" } else {
    Act ("pip install {0} --index-url {1}" -f ($torchPk -join ' '), $scfg.torch.indexUrl) {
      Invoke-Exe $stt.Py -m pip install --upgrade pip | Out-Host
      Invoke-Exe $stt.Py -m pip install @torchPk --index-url ([string]$scfg.torch.indexUrl) | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "pip torch: код $LASTEXITCODE" }
    }
  }
  if ($st.reqKey -eq (Get-Sha $stt.Req) -and (Test-Path -LiteralPath $stt.Py)) { Ok 'требования не менялись' } else {
    Act "pip install -r stt-requirements.txt" {
      Invoke-Exe $stt.Py -m pip install -r $stt.Req | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "pip requirements: код $LASTEXITCODE" }
    }
    Set-StateValue $st 'reqKey' (Get-Sha $stt.Req)
    Save-SttState $st
  }

  # --- 5. модели (sha256 по метаданным хаба; HF недоступен → зеркало) ---
  Step 'STT 5. Модели (GigaAM-Multilingual, whisper large-v3-turbo)'
  $fetchArgs = @('-I', (Join-Path $stt.Side 'fetch_models.py'), $stt.Models, ('--gigaam-repo=' + $scfg.models.gigaamRepo), ('--gigaam-revs=' + $scfg.models.gigaamRevs), ('--whisper-repo=' + $scfg.models.whisperRepos))
  if (-not $scfg.whisper) { $fetchArgs += '--no-whisper' }
  Act "fetch_models.py → $($stt.Models)" {
    Invoke-Exe $stt.Py @fetchArgs | Out-Host
    # не фатально: пакет gigaam сам докачает свои веса при прогреве
    if ($LASTEXITCODE -ne 0) { Warn 'часть моделей не скачалась или не сошлась сумма — см. журнал; прогрев покажет, что работает' }
  }

  # --- 6. видеокарта ---
  Step 'STT 6. Видеокарта'
  $device = [string]$scfg.device
  if (-not $device) { $device = 'auto' }
  $smi = Find-Exe 'nvidia-smi.exe' @("$env:SystemRoot\System32\nvidia-smi.exe")
  $cuda = ''
  if (Test-Path -LiteralPath $stt.Py) { $cuda = ((Invoke-Exe $stt.Py -I -c 'import torch;print(torch.cuda.is_available())' | Select-Object -Last 1) -as [string]) }
  if ($smi -and $cuda -and $cuda.Trim() -eq 'True') { Ok 'CUDA доступна (torch.cuda.is_available)' }
  elseif (-not $script:AtomDry) { Warn 'CUDA недоступна — сайдкар будет работать на CPU (лёгкая модель 220M)'; $device = 'cpu' }

  # --- 7. прогрев (2 с синтетики из памяти) ---
  Step 'STT 7. Прогрев'
  $env:STT_MODELS_DIR = $stt.Models
  $env:STT_DEVICE = $device
  $env:STT_WHISPER = $(if ($scfg.whisper) { 'on' } else { 'off' })
  $warm = $null
  Act 'warmup.py' {
    $out = (Invoke-Exe $stt.Py -I (Join-Path $stt.Side 'warmup.py') | Select-Object -Last 1) -as [string]
    try { $script:warm = $out | ConvertFrom-Json } catch { $script:warm = $null }
  }
  $warm = $script:warm
  if ($warm -and $warm.ok) {
    Ok ("движки: " + (($warm.engines | ForEach-Object { "{0}@{1}" -f $_.name, $_.device }) -join ', '))
  } elseif (-not $script:AtomDry) { Warn 'прогрев не прошёл — сайдкар всё равно запускается (мозг ответит 503, пока движки не загрузятся)' }

  # --- 8. задача «ATOMLAB STT» и запуск ---
  Step 'STT 8. Автозапуск сайдкара'
  Register-SttTask 'ATOMLAB STT' 'run-stt.ps1' '' ([TimeSpan]::Zero) -AtStartup
  Act 'перезапустить ATOMLAB STT' {
    Set-Content -LiteralPath (Join-Path $paths.Run 'restart-stt') -Value (Get-Date).ToString('s')
    Start-ScheduledTask -TaskName 'ATOMLAB STT'
  }
  $h = $null
  if (-not $script:AtomDry) {
    for ($i = 0; $i -lt 90; $i++) { $h = Get-SttHealth; if ($h -and $h.ok) { break }; Start-Sleep -Seconds 2 }
  }
  Set-StateValue $st 'installedKey' $key
  Set-StateValue $st 'codeKey' (Get-CodeKey)
  Set-StateValue $st 'device' $device
  if ($h -and $h.ok) {
    $eng = (($h.engines | Where-Object { $_.loaded } | ForEach-Object { "{0}@{1}" -f $_.name, $_.device }) -join ', ')
    Ok "сайдкар отвечает: $eng"
    Finish ("ok, {0}" -f $eng)
  } elseif ($script:AtomDry) {
    Finish 'пробный прогон'
  } else {
    Warn "сайдкар не ответил за 3 мин — см. $($paths.Logs)\stt-*.log"
    Finish 'установлен, но сайдкар не отвечает (см. logs\stt-*.log)'
  }
} catch {
  Fail ("STT: " + $_.Exception.Message)
  Finish ("ошибка: " + $_.Exception.Message)
  exit 1
} finally {
  if (-not $script:AtomDry) { Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue }
}
exit 0
