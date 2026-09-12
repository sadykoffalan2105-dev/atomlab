$ErrorActionPreference = 'Continue'
Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
Remove-Item Env:GCM_INTERACTIVE -ErrorAction SilentlyContinue
$env:GIT_TERMINAL_PROMPT = '1'
$env:GCM_INTERACTIVE = 'always'

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
if (-not $p.WaitForExit(45000)) {
  try { $p.Kill() } catch {}
  Write-Output 'credential_timeout'
  exit 1
}
$out = $p.StandardOutput.ReadToEnd()
$token = $null
$user = $null
foreach ($line in ($out -split "`r?`n")) {
  if ($line.StartsWith('password=')) { $token = $line.Substring(9) }
  if ($line.StartsWith('username=')) { $user = $line.Substring(9) }
}
if (-not $token) {
  Write-Output 'no_token'
  exit 1
}
Write-Output ('token_len=' + $token.Length)

$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/vnd.github+json'
  'User-Agent' = 'atomlab-setup'
  'X-GitHub-Api-Version' = '2022-11-28'
}
try {
  $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
  Write-Output ('auth=bearer login=' + $me.login)
} catch {
  $pair = "${user}:${token}"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
  $headers = @{
    Authorization = "Basic $b64"
    Accept = 'application/vnd.github+json'
    'User-Agent' = 'atomlab-setup'
    'X-GitHub-Api-Version' = '2022-11-28'
  }
  $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
  Write-Output ('auth=basic login=' + $me.login)
}

$repo = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab' -Headers $headers
Write-Output ('before_private=' + $repo.private)

if ($repo.private) {
  $null = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab' -Method Patch -Headers $headers -ContentType 'application/json' -Body '{"private":false}'
  Write-Output 'repo_set_public'
} else {
  Write-Output 'repo_already_public'
}

$pagesBody = '{"build_type":"legacy","source":{"branch":"gh-pages","path":"/"}}'
try {
  $null = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages' -Method Put -Headers $headers -ContentType 'application/json' -Body $pagesBody
  Write-Output 'pages_put_ok'
} catch {
  try {
    $null = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages' -Method Post -Headers $headers -ContentType 'application/json' -Body $pagesBody
    Write-Output 'pages_post_ok'
  } catch {
    Write-Output ('pages_err=' + $_.ErrorDetails.Message)
  }
}

# Trigger rebuild: empty commit on gh-pages tip via API dispatch workflow
try {
  $null = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/actions/workflows/publish-site.yml/dispatches' -Method Post -Headers $headers -ContentType 'application/json' -Body '{"ref":"main"}'
  Write-Output 'workflow_dispatched'
} catch {
  Write-Output ('workflow_err=' + $_.ErrorDetails.Message)
}

Start-Sleep -Seconds 10
try {
  $pg = Invoke-RestMethod -Uri 'https://api.github.com/repos/sadykoffalan2105-dev/atomlab/pages' -Headers $headers
  Write-Output ('pages_status=' + $pg.status + ' url=' + $pg.html_url)
} catch {
  Write-Output ('pages_get_err=' + $_.ErrorDetails.Message)
}

try {
  $r = Invoke-WebRequest -Uri 'https://sadykoffalan2105-dev.github.io/atomlab/' -UseBasicParsing
  Write-Output ('SITE_OK ' + $r.StatusCode + ' len=' + $r.Content.Length)
} catch {
  $code = ''
  try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  Write-Output ('SITE_FAIL ' + $code)
}
