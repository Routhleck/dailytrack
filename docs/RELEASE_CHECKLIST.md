# Release Checklist (MVP)

## Product Scope
- [ ] Release only includes local-first agreed MVP scope.
- [ ] No cloud/auth/backend features introduced.

## Quality Gates
- [ ] QA checklist fully passed.
- [ ] Critical parser and storage flows manually verified.
- [ ] Known limitations documented in README.
- [ ] Watch mode and poll mode both verified for data refresh.
- [ ] Atomic write flows validated (daily/weekly/preferences/template updates).
- [ ] Recovery guardrails verified:
  - profile delete requires typed-name confirmation
  - soft-delete round-trip (`profiles/*` -> `.trash/*` -> restore) works
  - startup trash auto-purge (>7 days) works as expected
- [ ] Sync conflict destructive actions require explicit confirmation modal before apply.

## Documentation
- [ ] README updated for run steps and data layout.
- [ ] Screenshot set updated:
  - core set for README/homepage (`dashboard`, `daily-note`, `daily-history`, `weekly-note`, `weekly-history`, `body`, `settings`)
  - extended set for release notes/pages (`profiles`, `sync`, `onboarding`) when available
- [ ] Relevant docs in `docs/` updated.
- [ ] `docs/PREFERENCES_SCHEMA.md` updated when schema changes.
- [ ] `docs/DISTRIBUTION_POLICY.md` updated and release channel expectation is clear.
- [ ] `docs/TROUBLESHOOTING.md` updated for current top known issues.
- [ ] DEVLOG entry appended for release session.
- [ ] CHANGELOG updated with user-visible changes in `## [X.Y.Z] - YYYY-MM-DD` (not left only in `Unreleased`).
- [ ] Release notes drafted with `skills/dailytrack-release` template/script and edited for readability.
- [ ] Release notes explicitly state whether this tag is stable (signed) or testing (unsigned).

## Packaging Readiness
- [ ] Tauri dev build works locally.
- [ ] Production build command succeeds.
- [ ] Default data root bootstrap verified.
- [ ] If publishing trusted macOS installers, configure signing/notarization secrets in GitHub repository:
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
  - `APPLE_CERTIFICATE`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `KEYCHAIN_PASSWORD`
  - `APPLE_SIGNING_IDENTITY` (optional)
- [ ] If enabling in-app auto-update, configure updater secrets:
  - `DAILYTRACK_UPDATER_PUBKEY`
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional)
- [ ] GitHub Actions `publish` workflow green for target tag.
- [ ] `publish` workflow `verify-frontend` job green (single-run lint/test/build gate).
- [ ] Draft release contains Windows + macOS artifacts.
- [ ] If Android packaging is enabled for this release, `android-apk` workflow green and APK artifacts uploaded/reviewed.
- [ ] Unsigned macOS install guidance in release notes/docs points to Privacy & Security -> Open Anyway flow (and optional `xattr` fallback).
- [ ] If updater secrets are set, draft release contains updater metadata (`latest.json` and signatures).
- [ ] Draft release notes reviewed before publishing.
