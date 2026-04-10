@echo off
setlocal

if not exist "%~dp0complete-tailwind-migration.mjs" (
  echo Could not find complete-tailwind-migration.mjs next to this .cmd file.
  exit /b 1
)

node "%~dp0complete-tailwind-migration.mjs"
