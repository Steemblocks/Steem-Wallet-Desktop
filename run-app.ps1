# Steem Wallet - Desktop or Web Launcher
# Usage: .\run-app.ps1 -Mode web|desktop

param(
    [ValidateSet("web", "desktop", "build")]
    [string]$Mode = "web"
)

Write-Host "🖥️  Steem Wallet Launcher" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

# Setup environment
$env:Path += ";$env:USERPROFILE\.cargo\bin;C:\msys64\ucrt64\bin"
$env:LIB = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\lib\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64"

Set-Location "c:\SteemWallet (blaze)\steemWallet"

switch ($Mode) {
    "web" {
        Write-Host "Starting web version..." -ForegroundColor Green
        Write-Host "Opening http://localhost:5173" -ForegroundColor Green
        npm run dev
    }
    "desktop" {
        Write-Host "Starting desktop app..." -ForegroundColor Green
        Write-Host "Building Tauri application..." -ForegroundColor Yellow
        npm run tauri:dev
    }
    "build" {
        Write-Host "Building desktop installer..." -ForegroundColor Green
        Write-Host "Output: src-tauri\target\release\Steem Wallet.msi" -ForegroundColor Yellow
        npm run tauri:build
    }
}
