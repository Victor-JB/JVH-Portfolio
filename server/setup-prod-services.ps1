# ================================

# Service setup for Joulin Photos (Windows Server 2016)

# Run as Administrator

# ================================



# ---- Config (edit if needed) ----

$AppRoot           = "C:\Users\administrateur\Desktop\JoulinVisionTool"

$ServiceName       = "joulinphotos_nssm_service"

$CaddyServiceName  = "caddy"

$NSSM              = "nssm"  # 'nssm' must be in PATH

$PORT		   = 443



# Run as LocalSystem by default (simplest); set to $false to use a low-priv user

$UseLocalSystem = $true

$SvcUser        = "joulinphotos_service"         # only used when $UseLocalSystem -eq $false

$SvcPassword    = "nOm&bo#tUqU0" # only used when $UseLocalSystem -eq $false



# ---- Derived paths ----

$VenvPath    = Join-Path $AppRoot ".venv"

$LogsDir     = Join-Path $AppRoot "logs"

$DataDir     = Join-Path $AppRoot "data"

$StartBat    = Join-Path $AppRoot "start-app.bat"

$CaddyExe    = "C:\Program Files (x86)\Caddy\caddy.exe"

$Caddyfile   = Join-Path $AppRoot "Caddyfile"

$CaddyData   = Join-Path $AppRoot "caddy-data"

$CaddyConfig = Join-Path $AppRoot "caddy-config"



# ---- Helper: die on error ----

function Fail($msg){ Write-Error $msg; exit 1 }



# ---- Helper: test port owners ($PORT) ----

function Show-PortOwners {

  param([int[]]$Ports = @($PORT))

  Write-Host "`n[ Port ownership check ]"

  foreach ($p in $Ports) {

    try {

      $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction Stop

      if ($conns) {

        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique

        foreach ($pid in $pids) {

          try {

            $proc = Get-Process -Id $pid -ErrorAction Stop

            Write-Host ("Port {0} -> PID {1} ({2})" -f $p, $pid, $proc.ProcessName) -ForegroundColor Yellow

          } catch {

            Write-Host ("Port {0} -> PID {1} (process not found)" -f $p, $pid) -ForegroundColor Yellow

          }

        }

      } else {

        Write-Host ("Port {0} -> free" -f $p) -ForegroundColor Green

      }

    } catch {

      Write-Host ("Port {0} -> unable to query (Get-NetTCPConnection missing?)" -f $p) -ForegroundColor DarkYellow

      Write-Host "Fallback: run 'netstat -ano | findstr :$p' manually"

    }

  }

}



# ---- Create dirs ----

New-Item -ItemType Directory -Path $LogsDir  -Force | Out-Null

New-Item -ItemType Directory -Path $DataDir  -Force | Out-Null

New-Item -ItemType Directory -Path $CaddyData -Force | Out-Null



# ---- Basic ACLs ----

# Keep it simple: Admins/SYSTEM full; Everyone read/exec; grant Modify to data/logs

icacls $AppRoot /inheritance:r /grant:r "Administrators:F" "SYSTEM:F" | Out-Null

icacls $AppRoot /grant:r "Users:(OI)(CI)RX" | Out-Null

icacls $LogsDir /grant:r "Users:(OI)(CI)M" | Out-Null

icacls $DataDir /grant:r "Users:(OI)(CI)M" | Out-Null

icacls $CaddyData /grant:r "Users:(OI)(CI)M" | Out-Null



# If you have a specific service user, you can harden to that account instead:

# icacls $AppRoot  /grant:r "$SvcUser:(OI)(CI)RX"

# icacls $LogsDir  /grant:r "$SvcUser:(OI)(CI)M"

# icacls $DataDir  /grant:r "$SvcUser:(OI)(CI)M"

# icacls $CaddyData/grant:r "$SvcUser:(OI)(CI)M"



# ---- Sanity checks ----

Test-Path $StartBat  | Out-Null; if (-not $?) { Fail "Missing $StartBat" }

Test-Path $CaddyExe  | Out-Null; if (-not $?) { Fail "Missing $CaddyExe" }

Test-Path $Caddyfile | Out-Null; if (-not $?) { Fail "Missing $Caddyfile" }



# ---- Free port? ($PORT) ----

Show-PortOwners



# ---- Open firewall (LAN) ----

Try { netsh advfirewall firewall add rule name="Caddy $PORT"  dir=in action=allow protocol=TCP localport=$PORT  | Out-Null } Catch {}



# ---- Remove existing services ----

& $NSSM stop $ServiceName | Out-Null; Start-Sleep -Milliseconds 500

& $NSSM remove $ServiceName confirm | Out-Null



& $NSSM stop $CaddyServiceName | Out-Null; Start-Sleep -Milliseconds 500

& $NSSM remove $CaddyServiceName confirm | Out-Null



# ---- APP service (uvicorn/FastAPI) ----

& $NSSM install $ServiceName $StartBat          | Out-Null

& $NSSM set     $ServiceName AppDirectory $AppRoot



if ($UseLocalSystem) {

  # LocalSystem (no creds)

  & $NSSM set $ServiceName ObjectName "LocalSystem"

} else {

  & $NSSM set $ServiceName ObjectName $SvcUser $SvcPassword

}



# Log files + rotation

$appStdout = Join-Path $LogsDir "app-stdout.log"

$appStderr = Join-Path $LogsDir "app-stderr.log"

& $NSSM set $ServiceName AppStdout $appStdout

& $NSSM set $ServiceName AppStderr $appStderr

& $NSSM set $ServiceName AppRotateFiles  1

& $NSSM set $ServiceName AppRotateOnline 1

& $NSSM set $ServiceName AppRotateBytes  10485760   # 10MB

& $NSSM set $ServiceName AppThrottle     1500       # ms



# Auto start + recovery

& sc.exe failure $ServiceName reset= 60 actions= restart/2000/restart/5000/restart/5000 | Out-Null

& $NSSM set $ServiceName Start SERVICE_AUTO_START



# ---- CADDY service ----

# caddy run --config <Caddyfile> --adapter caddyfile --data <CaddyData>

& $NSSM install $CaddyServiceName $CaddyExe "run" "--config" $Caddyfile "--adapter" "caddyfile"

& $NSSM set     $CaddyServiceName AppDirectory $AppRoot



if ($UseLocalSystem) {

  & $NSSM set $CaddyServiceName ObjectName "LocalSystem"

} else {

  & $NSSM set $CaddyServiceName ObjectName $SvcUser $SvcPassword

}



# Caddy throttling + env
$caddyStdout = Join-Path $LogsDir "caddy-stdout.log"
$caddyStderr = Join-Path $LogsDir "caddy-stderr.log"
& $NSSM set $CaddyServiceName AppStdout $caddyStdout
& $NSSM set $CaddyServiceName AppStderr $caddyStderr
& $NSSM set $CaddyServiceName AppRotateFiles  1
& $NSSM set $CaddyServiceName AppRotateOnline 1
& $NSSM set $CaddyServiceName AppRotateBytes  10485760   # 10MB
& $NSSM set $CaddyServiceName AppThrottle     1500
& $NSSM set $CaddyServiceName AppEnvironmentExtra `
	"XDG_DATA_HOME=$CaddyData" `
	"XDG_CONFIG_HOME=$CaddyConfig"




# Auto start + recovery

& sc.exe failure $CaddyServiceName reset= 60 actions= restart/5000/restart/5000/restart/5000 | Out-Null

& $NSSM set $CaddyServiceName Start SERVICE_AUTO_START



# ---- Start services ----

Write-Host "`n[ Starting services ]"

& $NSSM start $ServiceName      | Out-Null

Start-Sleep -Seconds 2

& $NSSM start $CaddyServiceName | Out-Null

Start-Sleep -Seconds 2



Write-Host "`n[ Service status ]"

sc.exe query $ServiceName

sc.exe query $CaddyServiceName



Write-Host "`n[ Next steps ]"

Write-Host "1) On this server: curl http://127.0.0.1:8000/api/health  (should return 200 JSON)"

Write-Host "2) On a client: make photos.joulin resolve to this server (DNS A record or hosts entry)."

Write-Host "3) After Caddy runs once, download CA crt file from /api/crt and trust CA:"

Write-Host "   $CaddyData\pki\authorities\local\root.crt"

Write-Host "   Import into 'Trusted Root Certification Authorities' on client machines."

Write-Host "`nLogs:"

Write-Host "   App logs  : $appStdout / $appStderr"

Write-Host "   Caddy logs: Set in Caddyfile"


