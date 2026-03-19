# Release Checklist (MVP)

## Product Scope
- [ ] Release only includes local-first agreed MVP scope.
- [ ] No cloud/auth/backend features introduced.

## Quality Gates
- [ ] QA checklist fully passed.
- [ ] Critical parser and storage flows manually verified.
- [ ] Known limitations documented in README.

## Documentation
- [ ] README updated for run steps and data layout.
- [ ] Relevant docs in `docs/` updated.
- [ ] DEVLOG entry appended for release session.
- [ ] CHANGELOG updated with user-visible changes.

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
- [ ] GitHub Actions `publish` workflow green for target tag.
- [ ] Draft release contains Windows + macOS artifacts.
- [ ] Draft release notes reviewed before publishing.
