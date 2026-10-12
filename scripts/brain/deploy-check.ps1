# Проверка скриптов сервера мозга (deploy/brain-pc/**) на ноутбуке владельца — БЕЗ админа, ничего не ставит.
# Обязательна после любой правки deploy/brain-pc: если update.ps1 (или то, что он вызывает) сломается на ПК друга,
# сервер больше не обновится сам, и починить его удалённо будет нельзя.
#   1) каждый .ps1 разбирается парсером Windows PowerShell 5.1, файл в UTF-8 с BOM;
#   2) comfy\manifest.json: у всех движков/вариантов есть url, size, sha256;
#   3) update.ps1 -DryRun на временном корне (поддельный origin с новым коммитом, порт мозга 18787 — 8787 не трогаем):
#      проходит до перезапуска мозга; затем с поломками в шаге картинок (битый manifest.json, исключение
#      и код 1 в image-install) — всё равно код 0 и перезапуск мозга (необязательный шаг лишь предупреждает);
#   4) install.ps1 -DryRun и uninstall.ps1 -DryRun на временном корне.
# Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\brain\deploy-check.ps1   (код 0 — всё зелёное)
param([switch]$Keep)
$ErrorActionPreference = 'Continue'   # git пишет в stderr — в 5.1 с 'Stop' это было бы исключением
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dep = Join-Path $repo 'deploy\brain-pc'
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$script:pass = 0
$script:fail = 0
function Check([bool]$cond, [string]$what, [string]$extra = '') {
  if ($cond) { $script:pass++; Write-Host ("  ok  " + $what) -ForegroundColor Green }
  else { $script:fail++; Write-Host ("  XX  " + $what + $(if ($extra) { "`n      " + $extra } else { '' })) -ForegroundColor Red }
}
function Run-Ps([string]$file, [string[]]$a) {
  $out = & $ps -NoProfile -ExecutionPolicy Bypass -File $file @a 2>&1 | Out-String -Width 400
  return @{ code = $LASTEXITCODE; out = $out }
}
function Tail([string]$s) { return ((($s -split "`n") | Select-Object -Last 8) -join "`n      ") }

Write-Host '1) разбор PowerShell 5.1 и BOM' -ForegroundColor Cyan
Get-ChildItem -LiteralPath $dep -Recurse -File -Filter *.ps1 | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  $bom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
  $tok = $null; $err = $null
  [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tok, [ref]$err) | Out-Null
  $rel = $_.FullName.Substring($dep.Length + 1)
  Check ($bom -and @($err).Count -eq 0) ("$rel (BOM, разбор)") ((@($err) | ForEach-Object { "$($_.Extent.StartLineNumber): $($_.Message)" }) -join '; ')
}

Write-Host '2) comfy\manifest.json' -ForegroundColor Cyan
$r = Run-Ps (Join-Path $dep 'comfy\image-install.ps1') @('-CheckManifest')
Check ($r.code -eq 0) 'image-install.ps1 -CheckManifest' (Tail $r.out)

Write-Host '3) update.ps1 -DryRun на временном корне' -ForegroundColor Cyan
$TmpRoot = Join-Path $env:TEMP ("atomlab-deploy-check-{0}" -f $PID)
if (Test-Path -LiteralPath $TmpRoot) { Remove-Item -LiteralPath $TmpRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $TmpRoot | Out-Null
try {
  $src = Join-Path $TmpRoot 'src'
  $git = 'git.exe'
  $null = & $git init -q $src
  $null = & $git -C $src config user.email check@atomlab.local
  $null = & $git -C $src config user.name check
  # коммит A — deploy/brain-pc из origin/main (так сейчас на сервере), коммит B — рабочая копия
  $tarf = Join-Path $TmpRoot 'a.tar'
  $null = & $git -C $repo archive -o $tarf origin/main deploy/brain-pc
  $null = & tar.exe -xf $tarf -C $src
  $null = & $git -C $src add -A
  $null = & $git -C $src commit -q -m A
  $a = (& $git -C $src rev-parse HEAD).Trim()
  Remove-Item -LiteralPath (Join-Path $src 'deploy') -Recurse -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $src 'deploy') | Out-Null
  Copy-Item -LiteralPath $dep -Destination (Join-Path $src 'deploy\brain-pc') -Recurse
  $null = & $git -C $src add -A
  $null = & $git -C $src commit -q -m B
  $null = & $git -C $src branch -M main
  $null = & $git clone -q --bare $src (Join-Path $TmpRoot 'origin.git')
  $null = & $git clone -q ('file:///' + ((Join-Path $TmpRoot 'origin.git') -replace '\\', '/')) (Join-Path $TmpRoot 'atomlab')
  $null = & $git -C (Join-Path $TmpRoot 'atomlab') reset -q --hard $a
  # bin — новые скрипты (как после первого запуска нового update.ps1); порт мозга — не 8787
  . (Join-Path $dep 'common.ps1')
  $ErrorActionPreference = 'Continue'
  Copy-AtomScripts $dep (Join-Path $TmpRoot 'bin')
  $cfgFile = Join-Path $TmpRoot 'bin\server-config.json'
  $c = Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $c.brain.port = 18787
  [IO.File]::WriteAllText($cfgFile, ($c | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText((Join-Path $TmpRoot 'state.json'), '{}', (New-Object Text.UTF8Encoding($false)))
  $upd = Join-Path $TmpRoot 'bin\update.ps1'
  $restart = 'перезапуск мозга \(run\\restart-brain\)'

  $r = Run-Ps $upd @('-Root', $TmpRoot, '-DryRun')
  Check ($r.code -eq 0 -and $r.out -match $restart -and $r.out -match 'пробный прогон' -and $r.out -match 'ATOMLAB Comfy') 'update.ps1 -DryRun: код, картинки, ComfyUI, перезапуск мозга' (Tail $r.out)

  $m = Join-Path $TmpRoot 'bin\comfy\manifest.json'
  $mText = [IO.File]::ReadAllText($m)
  [IO.File]::WriteAllText($m, '{ broken')
  $r = Run-Ps $upd @('-Root', $TmpRoot, '-DryRun')
  Check ($r.code -eq 0 -and $r.out -match $restart -and $r.out -match 'шаг пропущен') 'битый manifest.json → предупреждение, мозг всё равно перезапускается' (Tail $r.out)
  [IO.File]::WriteAllText($m, $mText)

  $i = Join-Path $TmpRoot 'bin\comfy\image-install.ps1'
  $iText = [IO.File]::ReadAllBytes($i)
  [IO.File]::WriteAllText($i, "throw 'boom'")
  $r = Run-Ps $upd @('-Root', $TmpRoot, '-DryRun')
  Check ($r.code -eq 0 -and $r.out -match $restart -and $r.out -match 'boom') 'исключение в image-install → предупреждение, мозг перезапускается' (Tail $r.out)
  [IO.File]::WriteAllText($i, 'exit 1')
  $r = Run-Ps $upd @('-Root', $TmpRoot, '-DryRun')
  Check ($r.code -eq 0 -and $r.out -match $restart -and $r.out -match 'вернул код 1') 'image-install с кодом 1 → предупреждение, мозг перезапускается' (Tail $r.out)
  [IO.File]::WriteAllBytes($i, $iText)

  Write-Host '4) install.ps1 / uninstall.ps1 -DryRun' -ForegroundColor Cyan
  $r = Run-Ps (Join-Path $dep 'install.ps1') @('-DryRun', '-Root', (Join-Path $TmpRoot 'fresh'), '-BrainPort', '18787', '-NoPause')
  Check ($r.code -eq 0 -and $r.out -match '11b\.' -and $r.out -match '/admin/image/test' -and $r.out -match '/admin/image/verify') 'install.ps1 -DryRun: шаг 11b, самопроверка картинки' (Tail $r.out)
  New-Item -ItemType Directory -Force -Path (Join-Path $TmpRoot 'comfy\ComfyUI_windows_portable'), (Join-Path $TmpRoot 'comfy-out') | Out-Null
  $r = Run-Ps (Join-Path $dep 'uninstall.ps1') @('-Root', $TmpRoot, '-DryRun')
  Check ($r.code -eq 0 -and $r.out -match 'ATOMLAB Comfy' -and $r.out -match 'Удалить картинки') 'uninstall.ps1 -DryRun: задача и папки ComfyUI' (Tail $r.out)
} catch {
  Check $false ('сбой проверки: ' + $_.Exception.Message)
} finally {
  if (-not $Keep) { Remove-Item -LiteralPath $TmpRoot -Recurse -Force -ErrorAction SilentlyContinue } else { Write-Host "временный корень оставлен: $TmpRoot" }
}

Write-Host ''
Write-Host ("deploy-check: {0} ok, {1} ошибок" -f $script:pass, $script:fail) -ForegroundColor $(if ($script:fail) { 'Red' } else { 'Green' })
if ($script:fail) { exit 1 }
exit 0
