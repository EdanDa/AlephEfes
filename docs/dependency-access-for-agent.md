# Dependency access checklist (concise)

This file is intentionally short and stable. It does **not** track interaction-by-interaction logs.

## Purpose

Use this when package installs fail (e.g. `npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer`) and a task depends on external dependencies.

## 1) Verify you're in the repo root

```powershell
cd C:\Users\edeyo\AlephEfes
dir
```

## 2) Verify npm registry + proxy settings

```powershell
npm config get registry
npm config list -l | Select-String -Pattern "proxy|registry"
```

Expected baseline:
- registry is `https://registry.npmjs.org/`
- `proxy` and `https-proxy` are `null` unless intentionally required.

## 3) Connectivity checks

```powershell
npm ping
npm view tailwindcss version
nslookup registry.npmjs.org
```

## 4) If checks pass locally, run migration helper

Preferred cross-shell runner:
```powershell
node .\scripts\complete-tailwind-migration.mjs
```

Alternative wrappers:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\complete-tailwind-migration.ps1
```

```bat
scripts\complete-tailwind-migration.cmd
```

## 5) If helper script is missing on your branch

```powershell
git log --all -- scripts/complete-tailwind-migration.mjs
git checkout <commit-hash> -- scripts/complete-tailwind-migration.mjs
```

Example from your current history:
```powershell
git checkout a32fdd37aadae7ad25433f9878213da6a62816f6 -- scripts/complete-tailwind-migration.mjs
```

## 6) After successful migration

Run:
```powershell
npm run check
```

Then commit only meaningful migration files (no transient troubleshooting output).
