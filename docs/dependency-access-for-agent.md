# How to provide dependency access in this environment

If you want me to complete package-dependent tasks (like build-time Tailwind migration), the environment needs outbound access for package/binary downloads.

## What is currently failing

- `npm install -D tailwindcss postcss autoprefixer` returns HTTP 403.
- Downloading Tailwind standalone binary from GitHub releases also returns HTTP 403.

That means installs are blocked by network/security policy, not by project code.

## Fastest ways to unblock

### If you're not in an enterprise environment (most likely your case)

Usually this is caused by local npm/proxy config, VPN, or ISP/network filtering. Try these exact steps:

1. Check whether npm is pointed to the public registry:
```bash
npm config get registry
```
It should print:
```text
https://registry.npmjs.org/
```

2. If not, set it explicitly:
```bash
npm config set registry https://registry.npmjs.org/
```

3. Remove accidental proxy settings:
```bash
npm config delete proxy
npm config delete https-proxy
npm config delete http-proxy
```

4. If you use a VPN/ad-block/DNS filter, temporarily disable it and retry.

5. Clear npm cache and retry:
```bash
npm cache clean --force
npm install -D tailwindcss postcss autoprefixer
```

6. If it still fails, test from a different network (phone hotspot is a quick test).

7. If you still see npm warnings about `http-proxy`/`https-proxy`, your environment may be injecting proxy variables. Check with:
```bash
npm config list -l | grep -E "proxy|registry"
```
If proxies are injected but blocked by policy, package access can still fail with 403/ENETUNREACH until that proxy policy is fixed.

On Windows where `grep` is unavailable, use one of these:

**PowerShell:**
```powershell
npm config list -l | Select-String -Pattern "proxy|registry"
```

**cmd.exe (`findstr`):**
```bat
npm config list -l | findstr /R /C:"proxy" /C:"registry"
```

If your output looks like this (proxy null + registry npmjs), npm config is likely fine:
```text
https-proxy = null
proxy = null
registry = "https://registry.npmjs.org/"
```
In that case, the remaining issue is usually network-level blocking (ISP/router/corporate DNS/filtering/AV/VPN), not npm config.

### Option A (best): allow npm registry access
Allow this environment to reach:
- `https://registry.npmjs.org`
- Any CDN endpoints required by npm tarballs (if your policy uses mirrors)

Also ensure no policy blocks packages by name (`tailwindcss`, `postcss`, `autoprefixer`).

### Option B: provide an approved internal registry mirror
If direct npmjs is not allowed, configure npm to an internal mirror that contains required packages.

Example:
```bash
npm config set registry https://<your-internal-registry>
```

Then verify with:
```bash
npm view tailwindcss version
npm view postcss version
npm view autoprefixer version
```

### Option C: pre-seed dependencies in the repo
If network cannot be opened, you can provide:
- Updated `package.json` + `package-lock.json` with required deps already resolved.
- Or vendored tarballs + an `.npmrc` pointing installs to local file paths.

### Option D: prebuild assets externally
As a temporary workaround, you can generate Tailwind build artifacts externally and commit them; I can then wire them into the app and CI.

## Recommended verification checklist

Run these in the same environment before asking me to continue migration:

```bash
npm ping
npm view tailwindcss version
npm install -D tailwindcss postcss autoprefixer
```

If config is clean but install still fails, run these extra checks:
```bash
npm ping
npm view tailwindcss version
nslookup registry.npmjs.org
```

On Windows CMD:
```bat
npm ping
npm view tailwindcss version
nslookup registry.npmjs.org
```

If all succeed, I can finish the build-time migration in one pass.

## Once access is enabled, what I will do next

1. Install Tailwind/PostCSS deps.
2. Add `tailwind.config.js` + `postcss.config.js`.
3. Add Tailwind source CSS and import in `src/main.jsx`.
4. Remove `https://cdn.tailwindcss.com` and runtime config file usage.
5. Keep `npm run check` and CI green.
