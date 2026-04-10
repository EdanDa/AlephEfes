@echo off
setlocal

if not exist "%~dp0complete-tailwind-migration.ps1" (
  echo Could not find complete-tailwind-migration.ps1 next to this .cmd file.
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%~dp0complete-tailwind-migration.ps1"
