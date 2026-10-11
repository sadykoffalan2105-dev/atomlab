# Задача «ATOMLAB Ollama» (планировщик, при старте системы, от SYSTEM): держит `ollama serve` живым.
# Ollama — из C:\ATOMLAB\ollama (архив с GitHub, без значка в трее), модели — C:\ATOMLAB\ollama-models.
param([string]$Root = 'C:\ATOMLAB')
. (Join-Path $PSScriptRoot 'common.ps1')
$ErrorActionPreference = 'Continue'
$paths = Get-AtomPaths $Root
New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
$script:LogFile = Join-Path $paths.Logs 'run-ollama.log'
$cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')

$exe = Join-Path $paths.Ollama 'ollama.exe'
if (-not (Test-Path -LiteralPath $exe)) { $exe = Find-Exe 'ollama.exe' @("$env:LOCALAPPDATA\Programs\Ollama\ollama.exe") }
if (-not $exe) { Say 'ollama.exe не найден — переустановите (УСТАНОВИТЬ.bat)'; exit 1 }

$envs = Get-OllamaEnv $cfg $paths
foreach ($k in $envs.Keys) { Set-Item -Path ("env:" + $k) -Value $envs[$k] }

$fails = 0
while ($true) {
  if (Invoke-Http 'http://127.0.0.1:11434/api/version' 2) {
    # кто-то уже держит порт (например, Ollama из трея) — не дублируем, проверяем раз в минуту
    Start-Sleep -Seconds 60
    continue
  }
  $log = Join-Path $paths.Logs ("ollama-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
  Say "старт: $exe serve → $log"
  $p = Start-Process -FilePath $env:ComSpec -ArgumentList ('/c ""{0}" serve >> "{1}" 2>&1"' -f $exe, $log) -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath (Join-Path $paths.Run 'ollama.pid') -Value $p.Id
  $t0 = Get-Date
  $p.WaitForExit()
  $sec = ((Get-Date) - $t0).TotalSeconds
  Say ("ollama serve завершился (код {0}) через {1:N0} с" -f $p.ExitCode, $sec)
  if ($sec -lt 60) { $fails++ } else { $fails = 0 }
  # частые падения подряд — пауза длиннее (до 5 мин), чтобы не забить журнал
  Start-Sleep -Seconds ([Math]::Min(300, 5 * [Math]::Pow(2, [Math]::Min($fails, 6))))
}
