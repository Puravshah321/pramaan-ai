@echo off
title Pramaan AI Runner
echo ============================================================
echo Starting Pramaan AI (Local-Only RAG Benchmark Platform)
echo ============================================================

echo [1/2] Starting Backend API on http://127.0.0.1:8000...
start "Pramaan AI - Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting Frontend UI on http://localhost:5173...
start "Pramaan AI - Frontend" cmd /k "cd /d %~dp0frontend && npx vite --host 0.0.0.0 --port 5173"

echo.
echo Application started in two separate terminal windows.
echo - Frontend UI:   http://localhost:5173  (or http://127.0.0.1:5173)
echo - Backend API:   http://127.0.0.1:8000
echo - Swagger Docs:  http://127.0.0.1:8000/docs
echo.
echo To stop the servers, simply close the respective terminal windows.
echo ============================================================
pause
