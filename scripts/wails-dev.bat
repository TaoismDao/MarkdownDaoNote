@echo off
setlocal enabledelayedexpansion

rem Resolve project root relative to this script
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%\.."
set "PROJECT_ROOT=%CD%"
popd

set "TEMP_DIR=%PROJECT_ROOT%\.tmp\wails"
if not exist "%TEMP_DIR%" (
    mkdir "%TEMP_DIR%"
    if errorlevel 1 (
        echo Failed to create temporary directory "%TEMP_DIR%".
        exit /b 1
    )
)

set "TMP=%TEMP_DIR%"
set "TEMP=%TEMP_DIR%"

rem Prefer an absolute wails.exe path if available
set "WAILS_CMD="
for /f "delims=" %%I in ('where wails.exe 2^>nul') do (
    set "WAILS_CMD=%%~fI"
    goto :run_wails
)

:run_wails
if defined WAILS_CMD (
    "%WAILS_CMD%" dev %*
) else (
    wails dev %*
)
