@echo off
REM Start Vite dev server and wait for it to be ready

echo Starting Vite dev server...
start /b npm run dev:server

REM Wait for server to start (3 seconds should be enough)
timeout /t 3 /nobreak

echo Dev server started!
exit /b 0
