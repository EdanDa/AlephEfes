# How to provide dependency access in this environment

If you want me to complete package-dependent tasks (like build-time Tailwind migration), the environment needs outbound access for package/binary downloads.

## What is currently failing

- `npm install -D tailwindcss postcss autoprefixer` returns HTTP 403.
- Downloading Tailwind standalone binary from GitHub releases also returns HTTP 403.

That means installs are blocked by network/security policy, not by project code.

## Fastest ways to unblock

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

If all succeed, I can finish the build-time migration in one pass.

## Once access is enabled, what I will do next

1. Install Tailwind/PostCSS deps.
2. Add `tailwind.config.js` + `postcss.config.js`.
3. Add Tailwind source CSS and import in `src/main.jsx`.
4. Remove `https://cdn.tailwindcss.com` and runtime config file usage.
5. Keep `npm run check` and CI green.
