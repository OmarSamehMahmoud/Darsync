@echo off
REM ============================================================
REM  PhotonX C2P launcher (Windows)
REM  Starts the FastAPI backend + serves the glass UI.
REM ============================================================
title PhotonX C2P
cd /d "%~dp0"

REM ---- Port (override by passing one, e.g.  run.bat 8900) ----
if not "%~1"=="" (set PORT=%~1) else (set PORT=8900)

REM Set NVIDIA_API_KEY in the environment before launching the server.
set "PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
    echo Python environment not found: "%PYTHON%"
    echo Create it with Python 3.12 and install requirements.txt. See README.md.
    pause
    exit /b 1
)

echo.
echo   ========================================
echo     PhotonX C2P  -  starting server
echo   ========================================
echo.
echo   UI  ->  http://localhost:%PORT%
echo   API ->  http://localhost:%PORT%/docs
echo.

"%PYTHON%" -m uvicorn backend.main:app --host 0.0.0.0 --port %PORT% --reload
pause
