# Memory Game - Full Stack Starter Script (Windows PowerShell)
# Starts both Backend and Frontend servers

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Memory Game - Full Stack Development Server" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Backend check and start
Write-Host "[1/2] Starting Backend (FastAPI)..." -ForegroundColor Yellow

if (!(Test-Path "backend")) {
  Write-Host "✗ Backend folder not found" -ForegroundColor Red
  exit 1
}

Push-Location backend

# Check if venv exists
if (!(Test-Path "venv")) {
  Write-Host "Creating virtual environment..." -ForegroundColor Yellow
  python -m venv venv
}

# Activate venv
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Install dependencies
Write-Host "Installing Backend dependencies..." -ForegroundColor Yellow
pip install -q -r requirements.txt

Write-Host "✓ Backend dependencies installed" -ForegroundColor Green

# Start backend
Write-Host "✓ Starting Backend server..." -ForegroundColor Green
Start-Process python -ArgumentList "-m uvicorn main:app --reload" -NoNewWindow

Write-Host "✓ Backend started on http://localhost:8000" -ForegroundColor Green
Write-Host "  Swagger UI: http://localhost:8000/docs" -ForegroundColor Green

Start-Sleep -Seconds 2

# Frontend check and start
Write-Host ""
Write-Host "[2/2] Starting Frontend (Angular)..." -ForegroundColor Yellow

Pop-Location
Push-Location frontend

if (!(Test-Path "node_modules")) {
  Write-Host "Installing Frontend dependencies..." -ForegroundColor Yellow
  npm install
}

Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green

# Start frontend
Write-Host "✓ Starting Frontend server..." -ForegroundColor Green
Start-Process npm -ArgumentList "start" -NoNewWindow

Write-Host "✓ Frontend started on http://localhost:4200" -ForegroundColor Green

Start-Sleep -Seconds 3

Pop-Location

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✓ Both servers are running!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend:  http://localhost:4200"
Write-Host "Backend:   http://localhost:8000"
Write-Host "API Docs:  http://localhost:8000/docs"
Write-Host ""
Write-Host "Press Ctrl+C in the respective terminal windows to stop servers" -ForegroundColor Yellow
Write-Host ""

# Keep script running
Read-Host "Press Enter when done to close this window"
