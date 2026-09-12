$ErrorActionPreference = 'Continue'
Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
$env:GCM_INTERACTIVE = 'always'
$env:GIT_TERMINAL_PROMPT = '1'

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'git'
$psi.Arguments = 'credential fill'
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.WriteLine('protocol=https')
$p.StandardInput.WriteLine('host=github.com')
$p.StandardInput.WriteLine('')
$p.StandardInput.Close()
if (-not $p.WaitForExit(30000)) { try { $p.Kill() } catch {}; Write-Output 'credential_timeout'; exit 1 }
$out = $p.StandardOutput.ReadToEnd()
$token = $null
foreach ($line in ($out -split "`r?`n")) {
  if ($line.StartsWith('password=')) { $token = $line.Substring(9) }
}
if (-not $token) { Write-Output 'no_token'; exit 1 }

$h = @{
  Authorization = "Bearer $token"
  Accept = 'application/vnd.github+json'
  'User-Agent' = 'atomlab-setup'
  'X-GitHub-Api-Version' = '2022-11-28'
}

$builds = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages/builds?per_page=5' -Headers $h
foreach ($b in @($builds) | Select-Object -First 5) {
  $err = ''
  if ($b.error) { $err = $b.error.message }
  Write-Output ("build status={0} error={1} created={2}" -f $b.status, $err, $b.created_at)
}

$pg = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages' -Headers $h
Write-Output ("pages status={0} cname={1} source={2}/{3}" -f $pg.status, $pg.cname, $pg.source.branch, $pg.source.path)

$wf = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/actions/runs?per_page=5' -Headers $h
foreach ($r in $wf.workflow_runs) {
  Write-Output ("run name={0} status={1}/{2} id={3}" -f $r.name, $r.status, $r.conclusion, $r.id)
}

try {
  $idx = Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sadykoffalan2105-dev/atomlab/gh-pages/index.html' -UseBasicParsing
  Write-Output ("gh-pages-index={0}" -f $idx.StatusCode)
} catch {
  Write-Output 'gh-pages-index=FAIL'
}

# Request a new pages build
try {
  $null = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages/builds' -Method Post -Headers $h
  Write-Output 'pages_build_requested'
} catch {
  Write-Output ("pages_build_err=" + $_.ErrorDetails.Message)
}

Start-Sleep -Seconds 15
$pg2 = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages' -Headers $h
Write-Output ("pages_after={0}" -f $pg2.status)

try {
  $site = Invoke-WebRequest -Uri 'https://sadykoffalan2105-dev.github.io/atomlab/' -UseBasicParsing
  Write-Output ("SITE_OK {0}" -f $site.StatusCode)
} catch {
  $code = ''
  try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  Write-Output ("SITE_FAIL {0}" -f $code)
}
