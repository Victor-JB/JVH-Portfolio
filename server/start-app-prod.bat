@echo off
setlocal

REM --- get repo root (this script’s directory) ---
set APP_ROOT=%~dp0
REM remove trailing backslash if desired
if %APP_ROOT:~-1%==\ set APP_ROOT=%APP_ROOT:~0,-1%

REM --- use repo venv ---
set VENV=%APP_ROOT%\.venv

echo APP_ROOT   = %APP_ROOT%
echo VENV       = %VENV%

REM --- system python (launcher) ---
set PYTHON_CMD=python

REM --- create venv if missing ---
if not exist "%VENV%\Scripts\python.exe" (
    echo Creating venv...
    %PYTHON_CMD% -m venv "%VENV%"
)

REM --- install/update deps ---
"%VENV%\Scripts\python.exe" -m pip install --upgrade pip
"%VENV%\Scripts\python.exe" -m pip install -r "%APP_ROOT%\requirements.txt"

REM --- run uvicorn (bound to localhost) ---
REM Workers: CPU cores (adjust as needed)
set WORKERS=4
set HOST=127.0.0.1
set PORT=8000
set FORWARDED_ALLOW_IPS=127.0.0.1
set APP_MODE=prod
set FORCE_HTTPS=0

cd /d %APP_ROOT%

"%VENV%\Scripts\python.exe" -m api.main
