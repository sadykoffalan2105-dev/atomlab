# Удаление сервера мозга ATOMLAB (УДАЛИТЬ.bat): задачи планировщика, Funnel, выход из Tailscale;
# по отдельному согласию — модели Ollama и папка C:\ATOMLAB (вместе с базой знаний этого сервера).
# Программы (Git, Node.js, Tailscale) не удаляются — ими могут пользоваться другие; их можно убрать в «Параметры → Приложения».
param([string]$Root = 'C:\ATOMLAB', [switch]$DryRun, [switch]$Yes)
. (Join-Path $PSScriptRoot 'common.ps1')
$script:AtomDry = [bool]$DryRun
$paths = Get-AtomPaths $Root
if (-not $DryRun -and -not (Test-Admin)) { Fail 'нужны права администратора'; exit 2 }

function Ask([string]$q) {
  if ($Yes) { return $true }
  if ($script:AtomDry) { Say "    [DRY] вопрос: $q → нет" 'DarkCyan'; return $false }
  return ((Read-Host "$q (д/н)") -match '^(д|да|y|yes)$')
}

Say ''
Say '  ATOMLAB — удаление сервера ИИ-учителя' 'White'

Step '1. Задачи планировщика'
foreach ($t in 'ATOMLAB Update', 'ATOMLAB Brain', 'ATOMLAB Ollama') {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Act "остановить и удалить «$t»" {
      Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
      Unregister-ScheduledTask -TaskName $t -Confirm:$false
    }
  } else { Say "    нет задачи «$t»" }
}
Step '2. Процессы'
foreach ($f in 'brain.pid', 'ollama.pid') {
  $pf = Join-Path $paths.Run $f
  if (Test-Path -LiteralPath $pf) {
    $procId = [int](Get-Content -LiteralPath $pf -Raw)
    Act "остановить процесс $f ($procId)" { Stop-ProcessTree $procId }
  }
}
$ollamaExe = Join-Path $paths.Ollama 'ollama.exe'
Get-Process -Name 'ollama' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $ollamaExe } | ForEach-Object {
  Act "остановить ollama ($($_.Id))" { Stop-Process -Id $_.Id -Force }
}

Step '3. Tailscale'
$ts = Find-Tailscale
if ($ts) {
  Act 'tailscale funnel reset' { & $ts funnel reset 2>&1 | Out-Null }
  if (Ask 'Отключить этот ПК от сети Tailscale владельца (tailscale logout)?') {
    Act 'tailscale logout' { & $ts logout 2>&1 | Out-Null }
  }
} else { Say '    Tailscale не установлен' }

Step '4. SSH (если включали)'
if (Get-Service -Name sshd -ErrorAction SilentlyContinue) {
  if (Ask 'Выключить удалённый вход по SSH (OpenSSH Server)?') {
    Act 'остановить sshd и выключить автозапуск' { Stop-Service sshd -ErrorAction SilentlyContinue; Set-Service sshd -StartupType Disabled }
  }
} else { Say '    не включался' }

Step '5. Модели и файлы'
if (Test-Path -LiteralPath $paths.Models) {
  $gb = [Math]::Round(((Get-ChildItem -LiteralPath $paths.Models -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1GB, 1)
  if (Ask "Удалить модели Ollama ($gb ГБ в $($paths.Models))?") {
    Act "удалить $($paths.Models)" { Remove-Item -LiteralPath $paths.Models -Recurse -Force }
  }
}
if (Test-Path -LiteralPath $paths.Root) {
  if (Ask "Удалить ВСЮ папку $($paths.Root) (код, база знаний этого сервера, журналы)? Восстановить будет нельзя") {
    Act "удалить $($paths.Root)" { Remove-Item -LiteralPath $paths.Root -Recurse -Force }
  } else { Say "    папка $($paths.Root) оставлена" }
}
Say ''
Say '  Готово. Git, Node.js и Tailscale остались — их можно удалить в «Параметры → Приложения».' 'Green'
