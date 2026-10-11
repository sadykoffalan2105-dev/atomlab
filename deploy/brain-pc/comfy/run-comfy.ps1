# Задача «ATOMLAB Comfy» (планировщик, при старте системы, от SYSTEM): держит ComfyUI живым на 127.0.0.1:8188.
# Как run-ollama.ps1: экспоненциальная пауза при частых падениях; перезапуск по флагу run\restart-comfy (его ставит Update).
# Картинки выключены (image.enabled = false) или ComfyUI ещё не скачан — не выходим (задача не должна «падать»), ждём.
# Флаг run\comfy-hold — image-install.ps1 меняет папку ComfyUI: останавливаемся и ждём. Журнал ComfyUI: logs\comfy-<дата>.log.
# Раз в 10 минут чистим comfy-out и comfy-tmp от файлов старше часа (мозг забирает картинку сразу и удаляет PNG сам).
param([string]$Root = 'C:\ATOMLAB')
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'common.ps1')
$ErrorActionPreference = 'Continue'
$paths = Get-AtomPaths $Root
New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
$script:LogFile = Join-Path $paths.Logs 'run-comfy.log'
$cfgPath = Join-Path $paths.Bin 'server-config.json'
$flag = Join-Path $paths.Run 'restart-comfy'
$hold = Join-Path $paths.Run 'comfy-hold'
$py = Join-Path $paths.ComfyRoot 'python_embeded\python.exe'
$mainPy = Join-Path $paths.ComfyRoot 'ComfyUI\main.py'

function Read-Cfg {
  try { return (Get-ServerConfig $cfgPath) } catch { return $null }
}

# файлы старше часа в comfy-out / comfy-tmp (и вложенных папках atomlab/<jobId>)
$script:lastClean = [DateTime]::MinValue
function Clear-ComfyFiles {
  if (((Get-Date) - $script:lastClean).TotalMinutes -lt 10) { return }
  $script:lastClean = Get-Date
  $edge = (Get-Date).AddHours(-1)
  foreach ($d in @($paths.ComfyOut, $paths.ComfyTmp)) {
    if (-not (Test-Path -LiteralPath $d)) { continue }
    Get-ChildItem -LiteralPath $d -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $edge } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }
  }
}

$fails = 0
$said = ''
while ($true) {
  Clear-ComfyFiles
  $cfg = Read-Cfg
  $why = ''
  if (-not $cfg) { $why = 'нет bin\server-config.json' }
  elseif (-not (Test-ImageEnabled $cfg)) { $why = 'картинки выключены (image.enabled = false)' }
  elseif (Test-Path -LiteralPath $hold) { $why = 'image-install обновляет ComfyUI (run\comfy-hold)' }
  elseif (-not (Test-Path -LiteralPath $py) -or -not (Test-Path -LiteralPath $mainPy)) { $why = 'ComfyUI ещё не скачан — его поставит задача ATOMLAB Update' }
  if ($why) {
    if ($why -ne $said) { Say ("жду: " + $why); $said = $why }
    Start-Sleep -Seconds 60
    continue
  }
  $said = ''
  $port = Get-ComfyPort $cfg
  if (Test-PortListening $port) {
    # порт занят: ComfyUI запущен вручную (не мешаем) или чужая программа (ждём, пока освободит)
    if (-not (Test-ComfyUp $cfg 2)) { Say "порт $port занят другой программой — жду" }
    Start-Sleep -Seconds 60
    continue
  }
  Remove-Item -LiteralPath $flag -ErrorAction SilentlyContinue
  # ничего не докачивать в фоне; узел безопасности берёт модель из comfy\models (extra_model_paths.yaml)
  $env:PYTHONIOENCODING = 'utf-8'
  $env:HF_HUB_OFFLINE = '1'
  $env:TRANSFORMERS_OFFLINE = '1'
  $env:HF_HUB_DISABLE_TELEMETRY = '1'
  $env:ATOMLAB_SAFETY_DIR = Join-Path $paths.ComfyModels 'atomlab_safety\falconsai_nsfw'
  New-Item -ItemType Directory -Force -Path $paths.ComfyOut, $paths.ComfyTmp | Out-Null
  $log = Join-Path $paths.Logs ("comfy-{0:yyyyMMdd}.log" -f (Get-Date))
  $argLine = (@(Get-ComfyArgs $cfg $paths | ForEach-Object { ConvertTo-CmdArg $_ }) -join ' ')
  Say "старт ComfyUI на 127.0.0.1:$port → $log"
  $cmd = '/c ""{0}" {1} >> "{2}" 2>&1"' -f $py, $argLine, $log
  $p = Start-Process -FilePath $env:ComSpec -ArgumentList $cmd -WorkingDirectory $paths.ComfyRoot -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath (Join-Path $paths.Run 'comfy.pid') -Value $p.Id
  $t0 = Get-Date
  $tick = 0
  while (-not $p.HasExited) {
    if (Test-Path -LiteralPath $flag) {
      Say 'перезапуск по просьбе автообновления (run\restart-comfy)'
      Remove-Item -LiteralPath $flag -ErrorAction SilentlyContinue
      Stop-ProcessTree $p.Id
      break
    }
    if (Test-Path -LiteralPath $hold) { Say 'остановка: image-install меняет папку ComfyUI'; Stop-ProcessTree $p.Id; break }
    $tick++
    if ($tick % 20 -eq 0) {
      # раз в минуту: владелец выключил картинки — останавливаем ComfyUI (освобождаем видеопамять для Gemma)
      $c2 = Read-Cfg
      if ($c2 -and -not (Test-ImageEnabled $c2)) { Say 'картинки выключены в server-config.json — останавливаю ComfyUI'; Stop-ProcessTree $p.Id; break }
      Clear-ComfyFiles
    }
    Start-Sleep -Seconds 3
  }
  $p.WaitForExit(10000) | Out-Null
  $sec = ((Get-Date) - $t0).TotalSeconds
  Say ("ComfyUI завершился через {0:N0} с" -f $sec)
  if ($sec -lt 60) { $fails++ } else { $fails = 0 }
  # частые падения подряд — пауза длиннее (до 5 мин), чтобы не забить журнал
  Start-Sleep -Seconds ([Math]::Min(300, 5 * [Math]::Pow(2, [Math]::Min($fails, 6))))
}
