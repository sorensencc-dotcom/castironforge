@echo off
REM file: start-dashboard.bat
REM Proper launcher for the CIC Dashboard for Windows/WSL users.

echo 🚀 Launching CIC Dashboard...
wsl node scripts/launcher.js
pause
