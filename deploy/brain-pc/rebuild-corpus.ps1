# Шаг C автообновления (вызывается из update.ps1 одной строкой): пересборка журнала базы знаний и векторов,
# когда в git изменились данные учебников, карта программы Kimyo или код базы.
#  - ключ данных = хеши деревьев git для папок ниже (работает и в мелком клоне --depth 1, где нет истории);
#    ключ изменился (или -Force) → build-corpus (append-only: дописывает только новые тексты, по hash, ничего не
#    удаляет и не переписывает) → embed --only=school (векторы новых записей на GPU) → ключ в run\corpus-key.txt;
#  - Set-BrainEnv задаёт BRAIN_DATA_DIR = C:\ATOMLAB\atomlab-brain-data (папка данных сервера);
#  - ошибка или таймаут → Warn, ключ не сохраняется (повтор в следующий запуск), перезапуск мозга не блокируется;
#  - -DryRun — только печать шагов; нет C:\ATOMLAB\atomlab (сервер не установлен) — сообщение и выход 0.
# Возвращает $true, если журнал пересобран (update.ps1 тогда ставит перезапуск мозга, чтобы он перечитал индекс).
param([string]$Root = 'C:\ATOMLAB', [switch]$DryRun, [switch]$Force, [int]$TimeoutMin = 15)
. (Join-Path $PSScriptRoot 'common.ps1')
$ErrorActionPreference = 'Continue'
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
if (Test-Path -LiteralPath $paths.Logs) { $script:LogFile = Join-Path $paths.Logs 'update.log' }

# папки, от которых зависит журнал базы (источники build-corpus и карта программы строителя A)
$dataDirs = @('src/data/kb', 'src/data/teacher', 'src/data/textbook', 'brain/kb', 'brain/curriculum')
# источники build-corpus для сервера: учебники и школьные карточки (без megaPack и полной Википедии — они в снимке)
$sources = @('textbooks', 'book-index', 'common', 'kb-wiki', 'qabank')

function Invoke-NodeStep([string]$title, [string[]]$nodeArgs, [string]$outFile) {
  # node с таймаутом; вывод — в файл (для разбора «дописано строк» и для разбора ошибок владельцем)
  $node = Find-Node
  $loader = Get-TsxLoader $paths
  if (-not $node -or -not $loader) { Warn "$title пропущен: нет node.exe или tsx"; return $null }
  $argList = @('--import', ('"{0}"' -f $loader)) + $nodeArgs
  $p = Start-Process -FilePath $node -ArgumentList $argList -WorkingDirectory $paths.Repo -NoNewWindow -PassThru -RedirectStandardOutput $outFile -RedirectStandardError ($outFile + '.err')
  $null = $p.Handle   # без этого в PowerShell 5.1 ExitCode после выхода бывает пустым
  if (-not $p.WaitForExit($TimeoutMin * 60 * 1000)) {
    Stop-ProcessTree $p.Id
    Warn "$title не уложился в $TimeoutMin мин — остановлен, повтор в следующий раз"
    return $null
  }
  if ($p.ExitCode -ne 0) { Warn "$title завершился с кодом $($p.ExitCode) — см. $outFile.err"; return $null }
  return (Get-Content -LiteralPath $outFile -Encoding UTF8 -ErrorAction SilentlyContinue)
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $paths.Repo '.git'))) {
    Say "шаг C (журнал базы): нет $($paths.Repo) — сервер не установлен, пропуск"
    return $false
  }
  $git = Find-Git
  if (-not $git) { Warn 'шаг C (журнал базы): git не найден — пропуск'; return $false }
  $g = @('-c', ("safe.directory=" + ($paths.Repo -replace '\\', '/')), '-C', $paths.Repo)
  $parts = foreach ($d in $dataDirs) {
    $h = (Invoke-Exe $git @g rev-parse --verify --quiet ('HEAD:' + $d) | Select-Object -First 1)
    if ($h -and $h -match '^[0-9a-f]{40}$') { "$d=$h" } else { "$d=-" }
  }
  $key = ($parts -join ';')
  $keyFile = Join-Path $paths.Run 'corpus-key.txt'
  $old = ''
  if (Test-Path -LiteralPath $keyFile) { $old = (Get-Content -LiteralPath $keyFile -Raw -ErrorAction SilentlyContinue).Trim() }
  if ($old -eq $key -and -not $Force) { return $false }

  # карта программы Kimyo (строитель A) — источник 'curriculum', только если build-corpus его уже знает
  $cb = Join-Path $paths.Repo 'brain\kb\corpusBuild.ts'
  if ((Test-Path -LiteralPath $cb) -and (Select-String -LiteralPath $cb -Pattern "'curriculum'" -SimpleMatch -Quiet)) { $sources += 'curriculum' }
  $only = ($sources -join ',')
  Say ("шаг C: данные базы изменились{0} — пересборка журнала (--only={1}) и векторов" -f $(if ($Force -and $old -eq $key) { ' (-Force)' } else { '' }), $only)
  if ($script:AtomDry) {
    Say ("    [DRY] node --import tsx scripts/brain/build-corpus.mts --only={0}  (BRAIN_DATA_DIR={1}, таймаут {2} мин)" -f $only, $paths.Data, $TimeoutMin) 'DarkCyan'
    Say ("    [DRY] node --import tsx scripts/brain/embed.mts --only=school --batch=64  (таймаут {0} мин)" -f $TimeoutMin) 'DarkCyan'
    Say ("    [DRY] записать ключ данных в {0}" -f $keyFile) 'DarkCyan'
    return $false
  }

  $cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')
  Set-BrainEnv $paths ([int]$cfg.brain.port)
  $out = Join-Path $paths.Logs ("corpus-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
  $lines = Invoke-NodeStep 'build-corpus' @('scripts/brain/build-corpus.mts', "--only=$only") $out
  if ($null -eq $lines) { return $false }
  $added = ($lines | Select-String -Pattern 'дописано строк:\s*(\d+)' | Select-Object -First 1)
  $n = 0
  if ($added) { $n = [int]$added.Matches[0].Groups[1].Value }
  Ok "журнал базы: дописано строк $n (лог $out)"
  $embLines = Invoke-NodeStep 'embed' @('scripts/brain/embed.mts', '--only=school', '--batch=64') ($out -replace 'corpus-', 'embed-')
  if ($null -ne $embLines) { Ok 'векторы новых записей посчитаны' } else { Warn 'векторы не посчитаны — мозг работает на BM25, векторы добавятся при следующей пересборке' }
  Set-Content -LiteralPath $keyFile -Value $key
  return ($n -gt 0 -or $Force)
} catch {
  Warn ("шаг C (журнал базы): " + $_.Exception.Message)
  return $false
}
