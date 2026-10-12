# Задача «ATOMLAB Nightly» (ежедневно в 03:00, от SYSTEM): ночной ЖИВОЙ прогон качества на этом сервере.
#   node --import tsx scripts/brain/nightly-live.mts --url=http://127.0.0.1:<порт> --out=C:\ATOMLAB\reports\live-ГГГГММДД.json
#   (brain:eval --sample=40, eval:curriculum sample-live.jsonl, /admin/image/test, voice:eval по фикстурам).
# Ключ админа — secrets\admin-token.txt → env BRAIN_ADMIN_TOKEN (снимает лимиты /chat профиля gpu; нужен картинкам).
# Отчёт отдаёт мозг: GET /admin/live-report (только админ); владелец забирает его npm run brain:live-report.
# Провал порога — красная строка в logs\nightly-eval.log; ЛЮБОЙ сбой здесь — только предупреждение, код выхода 0:
# ночной прогон никогда не мешает автообновлению и работе мозга. Отчёты старше -KeepDays дней удаляются.
# Вручную: powershell -NoProfile -ExecutionPolicy Bypass -File C:\ATOMLAB\bin\nightly-eval.ps1   (или Start-ScheduledTask 'ATOMLAB Nightly')
param([string]$Root = 'C:\ATOMLAB', [switch]$DryRun, [string]$Only = '', [int]$KeepDays = 60)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
$lock = $null
try {
  New-Item -ItemType Directory -Force -Path $paths.Logs, $paths.Run | Out-Null
  $script:LogFile = Join-Path $paths.Logs 'nightly-eval.log'
  # одна копия за раз (замок свежий 4 ч — дольше ночной прогон не идёт)
  $lock = Join-Path $paths.Run 'nightly.lock'
  if ((Test-Path -LiteralPath $lock) -and ((Get-Date) - (Get-Item -LiteralPath $lock).LastWriteTime).TotalHours -lt 4) { $lock = $null; exit 0 }
  Set-Content -LiteralPath $lock -Value $PID

  Update-PathFromRegistry
  $cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')
  $port = [int]$cfg.brain.port
  $reports = Join-Path $Root 'reports'
  $out = Join-Path $reports ('live-{0:yyyyMMdd}.json' -f (Get-Date))
  Step "Ночной живой прогон качества → $out"

  # автообновление как раз ставит код/зависимости — подождать (до 30 мин), чтобы мерить уже новый мозг
  $updLock = Join-Path $paths.Run 'update.lock'
  $until = (Get-Date).AddMinutes(30)
  while (-not $script:AtomDry -and (Test-Path -LiteralPath $updLock) -and ((Get-Date) - (Get-Item -LiteralPath $updLock).LastWriteTime).TotalMinutes -lt 60 -and (Get-Date) -lt $until) { Start-Sleep -Seconds 30 }
  if (-not (Get-BrainHealth $port)) { Warn "мозг не ответил на /health (порт $port) — отчёт всё равно будет (части «ошибка»)" }

  $node = Find-Node
  $loader = Get-TsxLoader $paths
  if (-not $script:AtomDry -and (-not $node -or -not $loader)) { throw 'нет Node.js или tsx (deps.ps1)' }
  $tok = ''
  try { $tok = (Get-Content -LiteralPath (Join-Path $paths.Secrets 'admin-token.txt') -Raw -ErrorAction Stop).Trim() } catch { }
  if (-not $tok) { Warn 'нет secrets\admin-token.txt — картинки не проверятся, /chat пойдёт с лимитами учеников' }
  $commit = ''
  try {
    $git = Find-Git
    if ($git -and (Test-Path -LiteralPath $paths.Repo)) { $commit = ((Invoke-Exe $git -c ("safe.directory=" + ($paths.Repo -replace '\\', '/')) -C $paths.Repo rev-parse --short=8 HEAD) | Select-Object -First 1).Trim() }
  } catch { }
  $sArgs = @('scripts/brain/nightly-live.mts', ("--url=http://127.0.0.1:{0}" -f $port), ("--out=" + $out), '--no-color')
  if ($commit -match '^[0-9a-f]{7,40}$') { $sArgs += ('--commit=' + $commit) }
  if ($Only) { $sArgs += ('--only=' + $Only) }

  if ($script:AtomDry) {
    Say ("    [DRY] node --import tsx " + ($sArgs -join ' ') +' (env BRAIN_ADMIN_TOKEN из secrets\admin-token.txt)') 'DarkCyan'
    Say ("    [DRY] удалить отчёты старше {0} дн. в {1}" -f $KeepDays, $reports) 'DarkCyan'
  } else {
    New-Item -ItemType Directory -Force -Path $reports | Out-Null
    $env:BRAIN_ADMIN_TOKEN = $tok
    Push-Location $paths.Repo
    $nArgs = @('--import', $loader) + $sArgs
    try { $lines = @(Invoke-Exe $node @nArgs) } finally { Pop-Location; Remove-Item Env:BRAIN_ADMIN_TOKEN -ErrorAction SilentlyContinue }
    foreach ($l in $lines) {
      if ($l -match '^\s+XX\s') { Fail ($l.Trim() -replace '^XX\s+', '') }
      elseif ($l -match '^ИТОГ') { if ($l -match 'все пороги') { Ok $l } else { Fail $l } }
      else { Write-Log $l }
    }
    $rep = $null
    try { $rep = Read-Json $out } catch { }
    if ($rep) {
      if ($rep.ok) { Ok ("отчёт {0}: все пороги пройдены ({1})" -f (Split-Path -Leaf $out), @($rep.thresholds).Count) }
      else { Warn ("отчёт {0}: провалено {1} из {2} порогов — обновление это НЕ останавливает" -f (Split-Path -Leaf $out), @($rep.failed).Count, @($rep.thresholds).Count) }
    } else { Warn 'отчёт не записан — см. logs\nightly-eval.log' }
    # старые отчёты (только наши live-*.json)
    Get-ChildItem -LiteralPath $reports -File -Filter 'live-*.json' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }
  }
} catch {
  Warn ('ночной прогон: ' + $_.Exception.Message + ' (на автообновление и работу мозга это не влияет)')
} finally {
  if ($lock) { Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue }
}
exit 0
