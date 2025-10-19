# ===============================================
# Restart script for Joulin Photos core application
# To be triggered by a git push webhook
# Run with Administrator privileges
# ===============================================

# ---- Config (must match your boot.ps1) ----
$AppRoot           = "C:\[...]\JoulinVisionTool"
$ServiceName       = "joulinphotos_nssm_service"
$CaddyServiceName  = "caddy"
$NSSM              = "nssm"  # 'nssm' must be in PATH

# ---- Derived paths ----
$StartBat          = Join-Path $AppRoot "server\start-app-prod.bat"
$Caddyfile         = Join-Path $AppRoot "Caddyfile"
$CaddyFileHashFile = Join-Path $AppRoot "\data\caddyfile.hash"

# ---- Helper: die on error ----
function Fail($msg){ Write-Error $msg; exit 1 }

# ---- Pull latest code ----
Write-Host "`n[ Git Pull ]"
cd $AppRoot
git pull

# ---- Check for Caddyfile changes ----
$caddyfileChanged = $false
Write-Host "`n[ Checking for Caddyfile changes ]"

# Get the current hash of the Caddyfile
$currentHash = (Get-FileHash -Path $Caddyfile -Algorithm SHA256).Hash

# Load the previously saved hash
if (Test-Path $CaddyFileHashFile) {
    $previousHash = Get-Content $CaddyFileHashFile
} else {
    $previousHash = "" # No previous hash, so assume it has changed
}

if ($currentHash -ne $previousHash) {
    $caddyfileChanged = $true
    Write-Host "Caddyfile has changed. The Caddy service will be restarted." -ForegroundColor Yellow
    # Save the new hash for next time
    $currentHash | Out-File $CaddyFileHashFile
} else {
    Write-Host "Caddyfile has not changed." -ForegroundColor Green
}

# ---- Restart services conditionally ----

# Restart APP service (your core application) unconditionally after a git push
Write-Host "`n[ Restarting $ServiceName service ]"
& $NSSM stop $ServiceName | Out-Null
Start-Sleep -Seconds 3
& $NSSM start $ServiceName | Out-Null
Start-Sleep -Seconds 3

# Restart Caddy service only if the Caddyfile has changed
if ($caddyfileChanged) {
    Write-Host "`n[ Restarting $CaddyServiceName service ]"
    # An alternative for Caddy is to use `caddy reload` which is more graceful.
    # But since you are using NSSM, a standard service restart is also fine.
    & $NSSM stop $CaddyServiceName | Out-Null
    Start-Sleep -Seconds 3
    & $NSSM start $CaddyServiceName | Out-Null
    Start-Sleep -Seconds 3
}

# ---- Report service status ----
Write-Host "`n[ Service status ]"
sc.exe query $ServiceName
sc.exe query $CaddyServiceName

Write-Host "`n[ Restart complete ]"

