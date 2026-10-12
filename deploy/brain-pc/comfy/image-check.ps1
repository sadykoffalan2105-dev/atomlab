# Живая проверка картинок на сервере (ПК друга): запускать там же, от администратора, например по SSH через Tailscale:
#   ssh <пользователь>@atomlab-brain "powershell -NoProfile -ExecutionPolicy Bypass -File C:\ATOMLAB\bin\comfy\image-check.ps1"
# Ничего не ставит и не качает. Проверяет: задачи планировщика, state.json (imageKey/comfyTag/verified), update.log и
# image-install.log без ошибок, ComfyUI (/system_stats, /object_info/ATOMLABSafetyCheck), узел безопасности на пустой
# картинке (EmptyImage → ATOMLABSafetyCheck, без модели рисования), /health мозга (image.ready), полный путь
# POST /admin/image/test (≤ 25 с, nsfw < 0.1; -NoTest — пропустить), файлы старше часа в comfy-out.
#   -Root        папка сервера (C:\ATOMLAB)
#   -NoTest      без /admin/image/test (не трогать очередь текста)
#   -Twice       /admin/image/test два раза подряд (вторая картинка — без перезагрузки Gemma, ≤ 8 с по плану)
# Код выхода: 0 — всё ок, 1 — есть ошибки (строки XX), 2 — только предупреждения (!!).
param([string]$Root = 'C:\ATOMLAB', [switch]$NoTest, [switch]$Twice)
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'common.ps1')
$ErrorActionPreference = 'Continue'
$paths = Get-AtomPaths $Root
$cfg = Get-ServerConfig (Join-Path $paths.Bin 'server-config.json')
$script:bad = 0
$script:warn = 0
function Bad([string]$t) { Fail $t; $script:bad++ }
function Soft([string]$t) { Warn $t; $script:warn++ }
$cport = Get-ComfyPort $cfg
$cbase = "http://127.0.0.1:$cport"
$bport = [int]$cfg.brain.port

Step 'Настройки и состояние'
if (-not (Test-ImageEnabled $cfg)) { Soft 'картинки выключены (image.enabled = false в server-config.json)' }
Say ("    server-config: engine {0}, variant {1}, students {2}, comfyPort {3}" -f $cfg.image.engine, $cfg.image.variant, $cfg.image.students, $cport)
$state = Read-State $paths
$manifest = Read-Json (Join-Path $PSScriptRoot 'manifest.json')
$want = Get-ImageKey $cfg $manifest
if ($state.imageKey -eq $want) { Ok "state.imageKey = $want" } else { Soft ("state.imageKey = «{0}», ждём «{1}» — Update ещё не закончил (докачка?)" -f $state.imageKey, $want) }
if ($state.comfyTag -eq $manifest.comfy.tag) { Ok "ComfyUI $($state.comfyTag)" } else { Bad ("comfyTag = «{0}», в манифесте {1}" -f $state.comfyTag, $manifest.comfy.tag) }
$nVer = 0
if ($state.verified) { $nVer = @($state.verified.PSObject.Properties).Count }
Say "    проверенных файлов (state.verified): $nVer"
foreach ($t in 'ATOMLAB Comfy', 'ATOMLAB Update', 'ATOMLAB Brain', 'ATOMLAB Ollama') {
  $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
  if ($task) { Ok ("задача «{0}»: {1}" -f $t, $task.State) } else { Bad "нет задачи «$t»" }
}
foreach ($lf in 'update.log', 'image-install.log') {
  $p = Join-Path $paths.Logs $lf
  if (Test-Path -LiteralPath $p) {
    $errs = @(Get-Content -LiteralPath $p -Encoding UTF8 -Tail 400 | Where-Object { $_ -match '\s(XX|!!)\s' })
    if ($errs.Count) { Soft ("{0}: {1} строк с XX/!! в хвосте, последняя: {2}" -f $lf, $errs.Count, $errs[-1]) } else { Ok "$lf без ошибок (последние 400 строк)" }
  } else { Soft "нет $p" }
}
$gb = [Math]::Round(((Get-ChildItem -LiteralPath $paths.Comfy -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1GB, 1)
Say "    размер $($paths.Comfy): $gb ГБ"

Step "ComfyUI ($cbase)"
$ss = Invoke-Http "$cbase/system_stats" 5
if (-not $ss) { Bad 'ComfyUI не отвечает на /system_stats (см. logs\comfy-*.log и logs\run-comfy.log)' }
else {
  $dev = @($ss.devices)[0]
  Ok ("ComfyUI {0}, Python {1}, {2}: свободно {3:N1} из {4:N1} ГБ видеопамяти" -f $ss.system.comfyui_version, ($ss.system.python_version -split ' ')[0], $dev.name, ($dev.vram_free / 1GB), ($dev.vram_total / 1GB))
  $oi = Invoke-Http "$cbase/object_info/ATOMLABSafetyCheck" 10
  if ($oi -and $oi.PSObject.Properties['ATOMLABSafetyCheck']) { Ok 'узел ATOMLABSafetyCheck загружен' } else { Bad 'узла ATOMLABSafetyCheck нет в /object_info' }
  $q = Invoke-Http "$cbase/queue" 5
  $busy = ($q -and (@($q.queue_running).Count + @($q.queue_pending).Count) -gt 0)
  if ($busy) { Soft 'в очереди ComfyUI идут задания — проверку узла пропускаю (не мешаю мозгу)' }
  else {
    # пустая картинка 512² → наш узел: проверка классификатора без модели рисования (ViT ~0,2 ГБ видеопамяти)
    $graph = @{ prompt = @{ '1' = @{ class_type = 'EmptyImage'; inputs = @{ width = 512; height = 512; batch_size = 1; color = 0 } }; '2' = @{ class_type = 'ATOMLABSafetyCheck'; inputs = @{ images = @('1', 0) } } }; client_id = 'atomlab-image-check' }
    try {
      $t0 = Get-Date
      $pr = Invoke-RestMethod -UseBasicParsing -Method Post -Uri "$cbase/prompt" -ContentType 'application/json' -Body ($graph | ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 20
      $id = [string]$pr.prompt_id
      $res = $null
      for ($i = 0; $i -lt 240 -and -not $res; $i++) {
        Start-Sleep -Milliseconds 250
        $h = Invoke-Http "$cbase/history/$id" 5
        if ($h -and $h.PSObject.Properties[$id]) { $res = $h.$id }
      }
      $sc = $null
      if ($res) { $sc = @($res.outputs.'2'.atomlab_safety)[0] }
      if ($sc) { Ok ("узел безопасности: nsfw {0:N4}, normal {1:N4}, {2} мс (вся задача {3:N1} с)" -f [double]$sc.nsfw, [double]$sc.normal, $sc.ms, ((Get-Date) - $t0).TotalSeconds) }
      elseif ($res) { Bad ("узел безопасности не дал результата: " + (($res.status | ConvertTo-Json -Depth 6 -Compress) -replace '\s+', ' ')) }
      else { Bad 'узел безопасности: нет ответа за 60 с' }
    } catch { Bad ("узел безопасности: " + $_.Exception.Message) }
  }
}

Step "Мозг (127.0.0.1:$bport)"
$hb = Get-BrainHealth $bport
if (-not $hb) { Bad 'мозг не отвечает на /health' }
elseif (-not $hb.image) { Bad '/health без блока image — на сервере старый код мозга (ждём автообновления)' }
else {
  $line = "image: enabled {0}, ready {1}, engine {2}, students {3}" -f $hb.image.enabled, $hb.image.ready, $hb.image.engine, ($hb.image.students | ConvertTo-Json -Compress)
  if ($hb.image.ready) { Ok $line } else { Bad $line }
}
if ($hb -and $hb.image) {
  # граф мозга ↔ живой ComfyUI (каждый узел и вход — по /object_info); ничего не рисует, очередь текста не трогает
  try {
    $vtok = (Get-Content -LiteralPath (Join-Path $paths.Secrets 'admin-token.txt') -Raw).Trim()
    $vr = Invoke-RestMethod -UseBasicParsing -Method Get -Uri "http://127.0.0.1:$bport/admin/image/verify" -Headers @{ 'X-Brain-Admin' = $vtok } -TimeoutSec 60
    $vbad = @($vr.checks | Where-Object { -not $_.ok })
    if ($vr.ok) { Ok ("/admin/image/verify: граф {0}/{1} сходится с ComfyUI, проверок {2}" -f $vr.engine, $vr.variant, @($vr.checks).Count) }
    else { Bad ("/admin/image/verify: расхождения " + ((@($vbad | ForEach-Object { ($_ | ConvertTo-Json -Compress -Depth 3) }) -join ' ') -replace '\s+', ' ')) }
  } catch {
    $em = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $em = $_.ErrorDetails.Message }
    Bad ("/admin/image/verify: " + $em)
  }
}
if (-not $NoTest -and $hb -and $hb.image -and $hb.image.ready) {
  $tok = (Get-Content -LiteralPath (Join-Path $paths.Secrets 'admin-token.txt') -Raw).Trim()
  $runs = 1
  if ($Twice) { $runs = 2 }
  for ($k = 1; $k -le $runs; $k++) {
    try {
      $t0 = Get-Date
      $ir = Invoke-RestMethod -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$bport/admin/image/test" -Headers @{ 'X-Brain-Admin' = $tok } -ContentType 'application/json' -Body '{}' -TimeoutSec 240
      $sec = ((Get-Date) - $t0).TotalSeconds
      if ($ir.ok -eq $false -or -not $ir.dataUrl) { Bad ("/admin/image/test: " + ($ir | ConvertTo-Json -Depth 4 -Compress)); continue }
      $b64 = ([string]$ir.dataUrl).Substring(([string]$ir.dataUrl).IndexOf(',') + 1)
      $out = Join-Path $paths.Logs ("image-check-{0}.webp" -f $k)
      [IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($b64))
      $tm = $ir.timings
      $msg = ("картинка {0}: {1}×{2}, {3:N1} с (очередь {4}, дренаж {5}, выгрузка {6}, рисование {7}, проверка {8}, перезагрузка Gemma {9} мс), nsfw {10:N4} → {11}" -f $k, $ir.width, $ir.height, $sec, $tm.queueMs, $tm.drainMs, $tm.unloadMs, $tm.genMs, $tm.safetyMs, $tm.reloadMs, [double]$ir.safety.nsfw, $out)
      $limit = 25
      if ($k -gt 1) { $limit = 8 }
      if ($sec -le $limit -and [double]$ir.safety.nsfw -lt 0.1) { Ok $msg } else { Soft ($msg + " — порог ≤ $limit с и nsfw < 0.1") }
    } catch {
      $em = $_.Exception.Message
      if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $em = $_.ErrorDetails.Message }
      Bad ("/admin/image/test: " + $em)
    }
  }
}

Step 'Уборка comfy-out / comfy-tmp'
$old = @(Get-ChildItem -LiteralPath $paths.ComfyOut, $paths.ComfyTmp -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddMinutes(-70) })
if ($old.Count) { Soft ("файлов старше часа: {0} (run-comfy.ps1 чистит раз в 10 мин)" -f $old.Count) } else { Ok 'файлов старше часа нет' }

Say ''
if ($script:bad) { Fail "ошибок: $($script:bad), предупреждений: $($script:warn)"; exit 1 }
if ($script:warn) { Warn "ошибок нет, предупреждений: $($script:warn)"; exit 2 }
Ok 'картинки на сервере в порядке'
exit 0
