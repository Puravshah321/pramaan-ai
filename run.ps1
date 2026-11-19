# Pramaan AI - PowerShell Launcher
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Starting Pramaan AI (Local-Only RAG Benchmark Platform)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n[1/2] Starting Backend API on http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$Root\backend'; Write-Host '--- Starting Pramaan AI Backend ---' -ForegroundColor Green; & .\`.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload`""

Write-Host "[2/2] Starting Frontend UI on http://localhost:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$Root\frontend'; Write-Host '--- Starting Pramaan AI Frontend ---' -ForegroundColor Green; npx vite --host 0.0.0.0 --port 5173`""

Write-Host "`nApplication started in separate PowerShell windows." -ForegroundColor Green
Write-Host "  - Frontend UI:   http://localhost:5173  (or http://127.0.0.1:5173)" -ForegroundColor White
Write-Host "  - Backend API:   http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  - Swagger Docs:  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "`nTo stop the servers, close the opened PowerShell windows." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
