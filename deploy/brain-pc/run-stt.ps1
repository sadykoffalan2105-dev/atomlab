# Задача «ATOMLAB STT» (планировщик, при старте системы, от SYSTEM): держит сайдкар распознавания речи живым
# (brain/stt/sidecar/server.py на 127.0.0.1:8788, Python из C:\ATOMLAB\stt\venv).
# Перезапуск по просьбе автообновления/установки: файл run\restart-stt → когда нет активных соединений с 8788.
# Журнал: C:\ATOMLAB\logs\stt-*.log (только длительности, байты, язык, мс, коды — ни текста, ни аудио).
param([string]$Root = 'C:\ATOMLAB')
. (Join-Path $PSScriptRoot 'common.ps1')
$ErrorActionPreference = 'Continue'
$paths = Get-AtomPaths $Root
New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
$script:LogFile = Join-Path $paths.Logs 'run-stt.log'
$scfg = Read-Json (Join-Path $PSScriptRoot 'stt-config.json')
$port = 8788
$device = 'auto'
$whisper = 'on'
if ($scfg) {
  if ([int]$scfg.port -gt 0) { $port = [int]$scfg.port }
  if ($scfg.device) { $device = [string]$scfg.device }
  if (-not $scfg.whisper) { $whisper = 'off' }
  if (-not $scfg.enabled) { Say 'STT выключен (stt-config.json: enabled=false)'; exit 0 }
}
$st = Read-Json (Join-Path $Root 'stt\state.json')
if ($st -and $st.device -eq 'cpu') { $device = 'cpu' }   # установка не нашла CUDA
$py = Join-Path $Root 'stt\venv\Scripts\python.exe'
$server = Join-Path $paths.Repo 'brain\stt\sidecar\server.py'
$flag = Join-Path $paths.Run 'restart-stt'
if (-not (Test-Path -LiteralPath $py)) { Say 'нет C:\ATOMLAB\stt\venv — запустите stt.ps1'; exit 1 }

$env:STT_PORT = "$port"
$env:STT_DEVICE = $device
$env:STT_WHISPER = $whisper
$env:STT_MODELS_DIR = Join-Path $Root 'stt\models'
$env:HF_HOME = Join-Path $Root 'stt\models\hf-home'

$fails = 0
while ($true) {
  if (Invoke-Http ("http://127.0.0.1:{0}/health" -f $port) 3) {
    # уже запущен (вручную или прежней копией) — перезапуск только по флагу и когда свободен
    if ((Test-Path -LiteralPath $flag) -and (Get-ActiveConnections $port) -eq 0) {
      $pf = Join-Path $paths.Run 'stt.pid'
      if (Test-Path -LiteralPath $pf) { Stop-ProcessTree ([int](Get-Content -LiteralPath $pf -Raw)) }
    } else { Start-Sleep -Seconds 30; continue }
  }
  if (-not (Test-Path -LiteralPath $server)) { Say "нет $server — ждём код (update.ps1)"; Start-Sleep -Seconds 120; continue }
  Remove-Item -LiteralPath $flag -ErrorAction SilentlyContinue
  $log = Join-Path $paths.Logs ("stt-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
  Say "старт сайдкара STT на 127.0.0.1:$port ($device) → $log"
  $cmd = '/c ""{0}" -I "{1}" >> "{2}" 2>&1"' -f $py, $server, $log
  $p = Start-Process -FilePath $env:ComSpec -ArgumentList $cmd -WorkingDirectory (Split-Path -Parent $server) -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath (Join-Path $paths.Run 'stt.pid') -Value $p.Id
  $t0 = Get-Date
  while (-not $p.HasExited) {
    if ((Test-Path -LiteralPath $flag) -and (Get-ActiveConnections $port) -eq 0) {
      Say 'перезапуск сайдкара по просьбе автообновления'
      Remove-Item -LiteralPath $flag -ErrorAction SilentlyContinue
      Stop-ProcessTree $p.Id
      break
    }
    Start-Sleep -Seconds 3
  }
  $p.WaitForExit(10000) | Out-Null
  $sec = ((Get-Date) - $t0).TotalSeconds
  Say ("сайдкар завершился через {0:N0} с" -f $sec)
  if ($sec -lt 60) { $fails++ } else { $fails = 0 }
  Start-Sleep -Seconds ([Math]::Min(300, 3 * [Math]::Pow(2, [Math]::Min($fails, 6))))
}
