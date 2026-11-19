# scripts/verify.ps1 - Complete Pramaan AI Verification Pipeline
$ErrorActionPreference = "Stop"

Write-Host "=== [1/7] Frontend TypeScript Check (tsc --noEmit) ===" -ForegroundColor Cyan
Push-Location frontend
try {
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript compilation failed." }
} finally { Pop-Location }

Write-Host "`n=== [2/7] Frontend Lint Check (npm run lint) ===" -ForegroundColor Cyan
Push-Location frontend
try {
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw "Frontend linter failed." }
} finally { Pop-Location }

Write-Host "`n=== [3/7] Frontend Production Build (npm run build) ===" -ForegroundColor Cyan
Push-Location frontend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
} finally { Pop-Location }

Write-Host "`n=== [4/7] Backend Linter (ruff check app tests) ===" -ForegroundColor Cyan
Push-Location backend
try {
    & .\.venv\Scripts\ruff.exe check app tests
    if ($LASTEXITCODE -ne 0) { throw "Backend ruff lint failed." }
} finally { Pop-Location }

Write-Host "`n=== [5/7] Backend Type Checker (mypy app) ===" -ForegroundColor Cyan
Push-Location backend
try {
    & .\.venv\Scripts\mypy.exe app
    if ($LASTEXITCODE -ne 0) { throw "Backend mypy type checking failed." }
} finally { Pop-Location }

Write-Host "`n=== [6/7] Backend Pytest Suite (pytest) ===" -ForegroundColor Cyan
Push-Location backend
try {
    & .\.venv\Scripts\pytest.exe -v
    if ($LASTEXITCODE -ne 0) { throw "Backend pytest suite failed." }
} finally { Pop-Location }

Write-Host "`n=== [7/7] Playwright End-to-End Suite ===" -ForegroundColor Cyan
Push-Location frontend
try {
    npx playwright test
    if ($LASTEXITCODE -ne 0) { throw "Playwright test suite failed." }
} finally { Pop-Location }

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100% GREEN) " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
