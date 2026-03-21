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

## Documentation
- [ ] README updated for run steps and data layout.
- [ ] Relevant docs in `docs/` updated.
- [ ] `docs/PREFERENCES_SCHEMA.md` updated when schema changes.
- [ ] DEVLOG entry appended for release session.
- [ ] CHANGELOG updated with user-visible changes.
- [ ] Release notes drafted with `skills/dailytrack-release` template/script and edited for readability.

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
- [ ] Unsigned macOS DMG includes `fix-dailytrack-quarantine.command` and `INSTALL_UNSIGNED_MAC.md`.
- [ ] If updater secrets are set, draft release contains updater metadata (`latest.json` and signatures).
- [ ] Draft release notes reviewed before publishing.
