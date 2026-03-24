# Dailytrack Release Runbook

## 1) Confirm Scope
- Determine target version (`vX.Y.Z`).
- Review commits since previous tag.

```bash
git fetch --tags
git log --oneline --no-merges <prev_tag>..HEAD
```

## 2) Collect Context
- Confirm branch and clean status.
- Confirm app version sync strategy from `.github/workflows/publish.yml`.

```bash
git branch --show-current
git status --short
```

## 3) Quality Gates
Run from repository root:

```bash
npm run lint
npm run test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 4) Update Docs
- Update `CHANGELOG.md` with release-versioned section:
  - keep pending items in `## [Unreleased]`
  - create/update `## [X.Y.Z] - YYYY-MM-DD` for this tag
  - move releasable items from `Unreleased` into that version section
- Append session entry in `docs/DEVLOG/YYYY-MM.md`.
- Ensure `README.md` reflects new user-visible behavior.

## 5) Tag and Push

```bash
git tag vX.Y.Z
git push origin master --tags
```

## 6) Monitor Publish Workflow

```bash
gh run list --workflow publish.yml --limit 5
gh run view <run_id> --log
```

## 7) Verify Release Assets
- Confirm Windows + macOS assets exist.
- For unsigned macOS releases, confirm DMG injection step succeeded.
- If updater is enabled, confirm updater metadata/signatures exist.

Use `references/checks.md` commands.

## 8) Finalize Release Notes
- Generate draft from commit range.
- Rewrite into concise human-readable notes.
- Use English for the final release title/body by default.
- Apply notes with `gh release edit`.

Template: `references/release-notes-template.md`
