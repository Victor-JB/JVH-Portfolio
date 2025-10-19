# Simple webhook setup - run as Local System with logging
$ErrorActionPreference = "Stop"

# CONFIG
$NgrokAuth = "XXX"
$NgrokDomain = "X.ngrok-free.app"
$LogDir = "C:\[your_path]"

# Stop and remove existing services
Stop-Service webhook-listener -ErrorAction SilentlyContinue
Stop-Service ngrok-webhook -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
nssm remove webhook-listener confirm 2>$null
nssm remove ngrok-webhook confirm 2>$null

Write-Host "Installing webhook-listener..."
# Install webhook service (runs as Local System by default)
nssm install webhook-listener "C:\[your_path]"
nssm set webhook-listener AppParameters "webhook.py"
nssm set webhook-listener AppDirectory "C:\[...]\JoulinVisionTool\git-webhook"
nssm set webhook-listener AppStdout "$LogDir\webhook.out.log"
nssm set webhook-listener AppStderr "$LogDir\webhook.err.log"
nssm set webhook-listener Start SERVICE_AUTO_START

Write-Host "Installing ngrok-webhook..."
# Install ngrok service with auth token
nssm install ngrok-webhook "C:\[path_to_ngrok.exe]"
nssm set ngrok-webhook AppParameters "http 127.0.0.1:9000 --domain=$NgrokDomain"
nssm set ngrok-webhook AppEnvironmentExtra "NGROK_AUTHTOKEN=$NgrokAuth"
nssm set ngrok-webhook AppStdout "$LogDir\ngrok.out.log"
nssm set ngrok-webhook AppStderr "$LogDir\ngrok.err.log"
nssm set ngrok-webhook Start SERVICE_AUTO_START

# Start services
Write-Host "Starting services..."
Start-Service webhook-listener
Start-Sleep -Seconds 3
Start-Service ngrok-webhook

Write-Host "`nDone! Services running as Local System"
Write-Host "Check status: Get-Service webhook-listener, ngrok-webhook"
Write-Host "Ngrok URL: https://$NgrokDomain"
Write-Host "`nLogs:"
Write-Host "  $LogDir\webhook.out.log & webhook.err.log"
Write-Host "  $LogDir\ngrok.out.log & ngrok.err.log"