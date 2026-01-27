$ErrorActionPreference = "Continue"

Write-Host "STARTING LOCAL PRODUCTION TEST" -ForegroundColor Cyan

# 1. Builder Service (Port 3042)
Write-Host "Starting Builder Service (Port 3042)..." -ForegroundColor Yellow
Start-Process -FilePath "npm.cmd" -ArgumentList "run start --workspace=@bagsscan/builder-service" -NoNewWindow
Start-Sleep -Seconds 5

# 2. Renderer (Port 3003)
Write-Host "Starting Renderer (Port 3003)..." -ForegroundColor Yellow
Start-Process -FilePath "npm.cmd" -ArgumentList "run start --workspace=renderer -- -p 3003" -NoNewWindow
Start-Sleep -Seconds 5

# 3. Web (Port 3000)
Write-Host "Starting Web (Port 3000)..." -ForegroundColor Yellow
# We run this in the current window so it stays open
Write-Host "Starting Web (Port 3000)..." -ForegroundColor Yellow
# Using Start-Process with cmd /c and strict quoting to ensure -p 3000 is passed to next
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start --workspace=@bagsscan/web -- -p 3000" -NoNewWindow
