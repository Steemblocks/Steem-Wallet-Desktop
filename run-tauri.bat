@echo off
REM Initialize Visual Studio environment for x64
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

REM Add Rust to PATH
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

REM Change to project directory
cd /d "c:\SteemWallet (blaze)\steemWallet"

REM Run Tauri dev
npm run tauri:dev
