@echo off
title Flyera Launcher
echo ========================================================
echo    FLYERA - Water & Glass Logistics Management Suite
echo ========================================================
echo.
echo [1/2] Starting FastAPI Backend on port 8000...
start "Flyera Backend (Port 8000)" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload"

echo [2/2] Starting Next.js Frontend on port 3000...
start "Flyera Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo    Servers are starting in separate terminal windows!
echo.
echo    - Frontend App: http://localhost:3000
echo    - Backend API:  http://127.0.0.1:8000
echo    - API Docs:     http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause

