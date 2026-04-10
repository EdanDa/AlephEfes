# Run this from repo root on a machine that has npm registry access.
# Example: powershell -ExecutionPolicy Bypass -File .\scripts\complete-tailwind-migration.ps1
# Script version: 2026-04-10.3

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir 'complete-tailwind-migration.mjs'

if (-not (Test-Path $nodeScript)) {
  throw "Could not find $nodeScript"
}

node $nodeScript
