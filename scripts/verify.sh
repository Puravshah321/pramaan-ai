#!/usr/bin/env bash
# scripts/verify.sh - Complete Pramaan AI Verification Pipeline
set -e

echo "=== [1/7] Frontend TypeScript Check ==="
(cd frontend && npx tsc --noEmit)

echo "=== [2/7] Frontend Lint Check ==="
(cd frontend && npm run lint)

echo "=== [3/7] Frontend Production Build ==="
(cd frontend && npm run build)

echo "=== [4/7] Backend Linter (ruff) ==="
if [ -f "backend/.venv/bin/ruff" ]; then
    (cd backend && .venv/bin/ruff check app tests)
else
    (cd backend && .venv/Scripts/ruff.exe check app tests)
fi

echo "=== [5/7] Backend Type Checker (mypy) ==="
if [ -f "backend/.venv/bin/mypy" ]; then
    (cd backend && .venv/bin/mypy app)
else
    (cd backend && .venv/Scripts/mypy.exe app)
fi

echo "=== [6/7] Backend Pytest Suite ==="
if [ -f "backend/.venv/bin/pytest" ]; then
    (cd backend && .venv/bin/pytest -v)
else
    (cd backend && .venv/Scripts/pytest.exe -v)
fi

echo "=== [7/7] Playwright End-to-End Suite ==="
(cd frontend && npx playwright test)

echo "========================================================"
echo " ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100% GREEN) "
echo "========================================================"
