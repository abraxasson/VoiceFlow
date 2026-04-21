@echo off
REM VoiceFlow Installer Build Script
REM Requires: Inno Setup 6 installed (https://jrsoftware.org/isdl.php)

setlocal

REM Locate ISCC.exe — check PATH first, then common install locations on all drives
set "ISCC="

REM 1. Check if ISCC is already on PATH
where ISCC.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set "ISCC=ISCC.exe"
)

REM 2. Probe standard install directories across C:, D:, E:, F:
if "%ISCC%"=="" (
    for %%D in (C D E F) do (
        if "%ISCC%"=="" (
            if exist "%%D:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
                set "ISCC=%%D:\Program Files (x86)\Inno Setup 6\ISCC.exe"
            ) else if exist "%%D:\Program Files\Inno Setup 6\ISCC.exe" (
                set "ISCC=%%D:\Program Files\Inno Setup 6\ISCC.exe"
            )
        )
    )
)

if "%ISCC%"=="" (
    echo Error: Inno Setup 6 not found!
    echo Checked: PATH, C/D/E/F:\Program Files (x86^)\Inno Setup 6
    echo Please install from: https://jrsoftware.org/isdl.php
    echo Or add ISCC.exe to your PATH.
    exit /b 1
)

REM Check if build output exists
if not exist "..\dist\VoiceFlow" (
    echo Error: PyInstaller output not found at ..\dist\VoiceFlow
    echo Please run 'pnpm run build' first.
    exit /b 1
)

REM Create output directory
if not exist "..\dist\installer" mkdir "..\dist\installer"

REM Build installer
echo Building VoiceFlow installer...
"%ISCC%" voiceflow.iss

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success! Installer created at: dist\installer\
    dir "..\dist\installer\*.exe"
) else (
    echo.
    echo Error: Installer build failed!
    exit /b 1
)

endlocal
