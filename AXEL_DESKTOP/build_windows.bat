@echo off
setlocal

REM AXEL - Windows build helper (creates .exe)
REM Prereqs: Node.js LTS installed (>= 18)

cd /d %~dp0

echo Installing dependencies...
call npm install
if errorlevel 1 exit /b 1

echo Building Windows executables (NSIS installer + portable exe)...
call npm run dist:win
if errorlevel 1 exit /b 1

echo Done. Check the \release\ folder.
pause
