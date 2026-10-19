@echo off
chcp 65001 >nul
title Standalone VibePlayer.exe Builder
echo ========================================================
echo       BUILDING STANDALONE VIBEPLAYER.EXE
echo   Embedding all 3D models, textures, audio and scripts
echo ========================================================
echo.

node "%~dp0scripts\build_full_exe.mjs"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] VibePlayer.exe successfully compiled!
    echo  Server auto-shuts down 5 min after browser window closes
    echo  File: %~dp0VibePlayer.exe
    echo ========================================================
) else (
    echo.
    echo  [ERROR] Build failed with error code: %ERRORLEVEL%
)

echo.
pause
