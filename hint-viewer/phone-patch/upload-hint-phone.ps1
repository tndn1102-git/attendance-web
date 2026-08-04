# ============================================================
#  HINT-PHONE v142 UPLOAD - fantastrick.co.kr/hint-phone/
#  (v142 ending / TIME OUT stops the timer for good - no restart on reconnect)
#  Live originals are backed up in phone-patch\live-backup-20260804\ (previous: -20260803b, -20260803, -20260729)
#  NOTE: ASCII only on purpose - Windows PowerShell 5.1 reads BOM-less
#        .ps1 as ANSI, so Korean text here would break parsing.
# ============================================================
param(
    [string]$FtpHost   = "fantastrick.gabia.io",
    [string]$FtpUser   = "fantastrick",
    [string]$RemoteDir = "/hint-phone/",
    # Unattended run: -Password from env HINTPHONE_FTP_PW (do NOT hardcode it here), -Yes skips prompts.
    [string]$Password  = $env:HINTPHONE_FTP_PW,
    [switch]$Yes
)
$ErrorActionPreference = "Continue"

$LocalDir = Join-Path $PSScriptRoot "deploy"
$Files    = @("websocket.js", "app.js", "sw.js", "index.html")
$CheckUrl = "http://fantastrick.co.kr/hint-phone/"
$ViewerUrl = "https://lockdown-gm-viewer.tndn1102.workers.dev"

Clear-Host
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  HINT-PHONE v142 UPLOAD" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Server:   $FtpHost"
Write-Host "  User:     $FtpUser"
Write-Host "  Remote:   $RemoteDir"
Write-Host "  Local:    $LocalDir"
Write-Host ""
Write-Host "  Files:"
$missing = 0
foreach ($f in $Files) {
    $local = Join-Path $LocalDir $f
    if (Test-Path $local) {
        $kb = [math]::Round((Get-Item $local).Length / 1024, 1)
        Write-Host "    - $f ($kb KB)"
    } else {
        Write-Host "    - $f (NOT FOUND!)" -ForegroundColor Red
        $missing++
    }
}
if ($missing -gt 0) {
    Write-Host ""
    Write-Host "  Missing files in phone-patch\deploy. Abort." -ForegroundColor Red
    if (-not $Yes) { Read-Host -Prompt "  Press Enter to close" }; exit 1
}
Write-Host ""
Write-Host "  Safe during a running game: phones only pick up new files on refresh." -ForegroundColor DarkGray
Write-Host ""

# ---- password ----
if (-not [string]::IsNullOrEmpty($Password)) {
    $plainPwd = $Password
    Write-Host "  Password supplied by parameter/env (unattended)." -ForegroundColor DarkGray
} else {
    Write-Host "  TIP: Use VISIBLE input to verify no typos."
    $mode = Read-Host "  Password input mode: [1] Hidden (default)  [2] Visible"
    if ($mode -eq "2") {
        $plainPwd = Read-Host "  Password (visible)"
    } else {
        $securePwd = Read-Host "  Password (hidden)" -AsSecureString
        $plainPwd  = [System.Net.NetworkCredential]::new("", $securePwd).Password
    }
}
if ([string]::IsNullOrEmpty($plainPwd)) {
    Write-Host "  Password is empty. Exit." -ForegroundColor Red
    if (-not $Yes) { Read-Host -Prompt "  Press Enter to close" }; exit 1
}
$cred = New-Object System.Net.NetworkCredential($FtpUser, $plainPwd)

# ---- preflight: remote dir must exist (guards against wrong path/account) ----
Write-Host ""
Write-Host "  Checking remote path..." -ForegroundColor Yellow
try {
    $req = [System.Net.FtpWebRequest]::Create("ftp://$FtpHost$RemoteDir")
    $req.Credentials = $cred
    $req.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
    $req.UsePassive = $true
    $resp = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $listing = $reader.ReadToEnd()
    $reader.Close(); $resp.Close()
    $names = ($listing -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    Write-Host "    OK - $($names.Count) entries in $RemoteDir" -ForegroundColor Green
    foreach ($f in $Files) {
        if ($names -notcontains $f) {
            Write-Host "    WARN: $f not found remotely - check the path" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "    FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Wrong account or path. Try another remote dir, e.g.:" -ForegroundColor Yellow
    Write-Host "    .\upload-hint-phone.ps1 -RemoteDir '/html/hint-phone/'" -ForegroundColor Yellow
    Write-Host "    .\upload-hint-phone.ps1 -FtpUser 'other' -RemoteDir '/hint-phone/'" -ForegroundColor Yellow
    if (-not $Yes) { Read-Host -Prompt "  Press Enter to close" }; exit 1
}

Write-Host ""
if ($Yes) { $confirm = "Y"; Write-Host "  Upload now? (Y/N): Y (unattended)" } else { $confirm = Read-Host "  Upload now? (Y/N)" }
if ($confirm -notmatch "^[yY]") {
    Write-Host "  Aborted." -ForegroundColor Yellow
    if (-not $Yes) { Read-Host -Prompt "  Press Enter to close" }; exit 0
}

# ---- upload ----
Write-Host ""
Write-Host "  Uploading..." -ForegroundColor Yellow
$webclient = New-Object System.Net.WebClient
$webclient.Credentials = $cred
$ok = 0; $fail = 0
foreach ($f in $Files) {
    $local  = Join-Path $LocalDir $f
    $remote = "ftp://$FtpHost$RemoteDir$f"
    Write-Host "    -> $f ... " -NoNewline
    try {
        $webclient.UploadFile($remote, $local) | Out-Null
        Write-Host "OK" -ForegroundColor Green; $ok++
    } catch {
        Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red; $fail++
    }
}
$webclient.Dispose()

Write-Host ""
if ($fail -eq 0) { $resultColor = "Green" } else { $resultColor = "Yellow" }
Write-Host "  Result: $ok OK / $fail FAIL" -ForegroundColor $resultColor

# ---- verify the live site actually serves v142 ----
if ($fail -eq 0) {
    Write-Host ""
    Write-Host "  Verifying live..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    try {
        $idx = (New-Object System.Net.WebClient).DownloadString($CheckUrl + "index.html?cb=" + (Get-Random))
        $wsj = (New-Object System.Net.WebClient).DownloadString($CheckUrl + "websocket.js?cb=" + (Get-Random))
        $apj = (New-Object System.Net.WebClient).DownloadString($CheckUrl + "app.js?cb=" + (Get-Random))
        $vOk = ($idx -match "websocket\.js\?v=141") -and ($idx -match "app\.js\?v=136")
        $rOk = ($wsj -match "__settime__") -and ($wsj -match "__timeack__") -and ($wsj -match "__ldcCatchUp") `
               -and ($wsj -match "__timereq__") -and ($wsj -match "__timeres__") -and ($wsj -match "_gmTimeSynced")
        $aOk = ($apj -match "applyStage") -and ($apj -match "catchUpBest") -and ($apj -match "stopTimerForGood") -and ($apj -match "timerStopped")
        if ($vOk) { Write-Host "    index.html   ?v=141/136  : OK" -ForegroundColor Green }
        else      { Write-Host "    index.html   ?v=141/136  : NO" -ForegroundColor Red }
        if ($rOk) { Write-Host "    websocket.js patches     : OK" -ForegroundColor Green }
        else      { Write-Host "    websocket.js patches     : NO" -ForegroundColor Red }
        if ($aOk) { Write-Host "    app.js       scheduler   : OK" -ForegroundColor Green }
        else      { Write-Host "    app.js       scheduler   : NO" -ForegroundColor Red }
        $rOk = $rOk -and $aOk
        if ($vOk -and $rOk) {
            Write-Host ""
            Write-Host "  DONE. Next: refresh BOTH tablets once (v142 must be on both)." -ForegroundColor Green
            Write-Host "  Then in the viewer: type a time + Apply -> must show 2 phones applied:" -ForegroundColor Green
            Write-Host "  $ViewerUrl" -ForegroundColor Cyan
            Write-Host ""
            if (-not $Yes) {
                $open = Read-Host "  Open the GM viewer now? (Y/N)"
                if ($open -match "^[yY]") { Start-Process $ViewerUrl }
            }
        }
    } catch {
        Write-Host "    verify request failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "  ROLLBACK: re-upload the files in phone-patch\live-backup-20260804\" -ForegroundColor Red
    Write-Host "  to the same remote path (that is the exact live set before v142)." -ForegroundColor Red
}

Write-Host ""
if (-not $Yes) { Read-Host -Prompt "  Press Enter to close" }
