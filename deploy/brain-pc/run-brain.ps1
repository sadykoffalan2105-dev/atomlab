# Задача «ATOMLAB Brain» (планировщик, при старте системы, от SYSTEM): держит сервер мозга живым.
# Перезапуск по просьбе автообновления: файл run\restart-brain → процесс останавливается и стартует заново.
param([string]$Root = 'C:\ATOMLAB', [int]$Port = 0)
. (Join-Path $PSScriptRoot 'common.ps1')
$ErrorActionPreference = 'Continue'
$paths = Get-AtomPaths $Root
New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
$script:LogFile = Join-Path $paths.Logs 'run-brain.log'
$cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')
if ($Port -le 0) { $Port = [int]$cfg.brain.port }
$flag = Join-Path $paths.Run 'restart-brain'
$node = Find-Node
if (-not $node) { Say 'node.exe не найден — переустановите (УСТАНОВИТЬ.bat)'; exit 1 }
Set-BrainEnv $paths $Port

# Ollama может стартовать позже мозга — ждём до 2 мин; без неё мозг всё равно работает (запасной путь) и подхватит её сам
for ($i = 0; $i -lt 60; $i++) { if (Invoke-Http 'http://127.0.0.1:11434/api/version' 2) { break }; Start-Sleep -Seconds 2 }

$fails = 0
while ($true) {
  if (Get-BrainHealth $Port) { Start-Sleep -Seconds 30; continue }   # уже запущен (вручную) — не мешаем
  $loader = Get-TsxLoader $paths
  if (-not $loader) { Say 'нет tsx (runtime\node_modules) — запустите update.ps1 или переустановите'; Start-Sleep -Seconds 120; continue }
  Remove-Item -LiteralPath $flag -ErrorAction SilentlyContinue
  $log = Join-Path $paths.Logs ("brain-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
  Say "старт мозга на порту $Port → $log"
  $cmd = '/c ""{0}" --import "{1}" brain/server.ts >> "{2}" 2>&1"' -f $node, $loader, $log
  $p = Start-Process -FilePath $env:ComSpec -ArgumentList $cmd -WorkingDirectory $paths.Repo -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath (Join-Path $paths.Run 'brain.pid') -Value $p.Id
  $t0 = Get-Date
  while (-not $p.HasExited) {
    if (Test-Path -LiteralPath $flag) {
      Say 'перезапуск по просьбе автообновления'
      Remove-Item -LiteralPath $flag -ErrorAction SilentlyContinue
      Stop-ProcessTree $p.Id
      break
    }
    Start-Sleep -Seconds 3
  }
  $p.WaitForExit(10000) | Out-Null
  $sec = ((Get-Date) - $t0).TotalSeconds
  Say ("мозг завершился через {0:N0} с" -f $sec)
  if ($sec -lt 60) { $fails++ } else { $fails = 0 }
  Start-Sleep -Seconds ([Math]::Min(300, 3 * [Math]::Pow(2, [Math]::Min($fails, 6))))
}
