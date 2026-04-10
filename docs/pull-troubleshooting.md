# Git pull troubleshooting for local changes/untracked files

If `git pull` fails with messages like:

- `Your local changes to the following files would be overwritten by merge`
- `The following untracked working tree files would be overwritten by merge`

then your local working tree must be cleaned/stashed first.

## Safe path (recommended)

Run from repo root:

```bash
git status
```

### Option A — keep your local work, then pull

```bash
git add -A
git commit -m "wip: save local changes before pull"
git pull
```

If you don't want a commit yet:

```bash
git stash push -u -m "wip before pull"
git pull
git stash pop
```

### Option B — discard local changes and align to remote branch

⚠️ This deletes local uncommitted changes.

```bash
git reset --hard
git clean -fd
git pull
```

## For your specific output

Your pull is blocked by:

- modified tracked file: `package.json`
- untracked file: `docs/repo-investigation-2026-04-09.md`

So run one of the workflows above first, then pull again.

## If `git pull` says "Already up to date" but you still don't have expected files

You may be on `main` while fixes exist on a different branch (for example a `codex/...` branch).

Check remote branches:
```bash
git branch -r
```

Switch to the expected branch (example):
```bash
git switch -c codex-fixes origin/codex/investigate-repo-and-suggest-improvements-91qydf
```

Then verify the script content again.
