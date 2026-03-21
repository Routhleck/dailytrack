# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Reserve this section for changes not tagged yet.
- Before cutting a release, move entries into a matching `## [x.y.z] - YYYY-MM-DD` section.

## [0.4.1] - 2026-03-21

### Fixed
- App startup now recovers from stale/invalid saved data-root paths by falling back safely.
- Android top safe-area spacing fixed to avoid status-bar overlap.
- Android CI build now syncs app version from release tag (no more `0.1.0` fallback).

### Changed
- Android APK build merged into `publish.yml` so release assets are produced in one pipeline.
- Android APK artifact naming normalized to release-style names.

## [0.4.0] - 2026-03-21

### Added
- Responsive shell improvements for narrow/mobile layouts.
- WebDAV realtime sync loop, conflict list/actions, and line-level diff preview.
- Android APK CI workflow and release artifact upload path.

### Changed
- Release pipeline speed-up: shared frontend verify job + prebuilt dist reuse.
- Sync diff supports "only changed lines" mode.

### Fixed
- Mobile menu backdrop-close behavior and stale sync preview state cleanup.

## [0.3.3] - 2026-03-20

### Added
- Structured template editing in create-profile flow.
- README user-first download flow and compact screenshot gallery.

## [0.3.2] - 2026-03-20

### Added
- Structured template mode as default with add/remove checklist item support.

## [0.3.1] - 2026-03-20

### Fixed
- WebDAV settings autosave reliability improved; sync actions force-save config first.

## [0.3.0] - 2026-03-20

### Added
- WebDAV cloud snapshot sync (push/pull/list/delete) with settings controls.
- Repo release skill (`skills/dailytrack-release`) and release-note workflow docs.

## [0.2.1] - 2026-03-20

### Added
- Unsigned macOS DMG quarantine helper injection in release CI.

### Fixed
- Onboarding now always starts from language selection step.

## [0.2.0] - 2026-03-20

### Added
- LLM-powered weekly/monthly report generation (provider-configurable).
- Startup language-first onboarding step.
- Filesystem watch mode with polling fallback for sync refresh.
- Safer atomic writes and richer copy summary for data operations.

### Changed
- Default desktop window size and body-chart behavior optimized for smaller screens.

## [0.1.8] - 2026-03-19

### Added
- Security hardening for CSP and Rust file-path root checks.
- Parser refactor for shared checklist parse/serialize utilities.

### Changed
- Autosave/polling tuning and safer body sort behavior.

## [0.1.7] - 2026-03-19

### Fixed
- Release version sync from tag to Tauri/Cargo versions.
- Publish workflow now creates non-draft tagged releases.

### Changed
- Added MIT license and ignored local updater key artifacts.

## [0.1.6] - 2026-03-19

### Fixed
- Updater public key handling switched to base64-compatible config path.

## [0.1.5] - 2026-03-19

### Fixed
- Simplified updater signing env handling in CI and stabilized updater key wiring.

## [0.1.4] - 2026-03-19

### Fixed
- Portable updater pubkey decoding across macOS and Windows runners.

## [0.1.3] - 2026-03-19

### Fixed
- CI updater key normalization and empty mac-sign env edge-case handling.

## [0.1.2] - 2026-03-19

### Fixed
- GitHub Actions expression fix to avoid `secrets` context misuse in step conditions.

## [0.1.1] - 2026-03-19

### Added
- In-app updater flow and optional updater artifact generation in CI.
- Extended body metrics and per-metric unit/decimal display configuration.

### Changed
- Release workflow supports unsigned macOS fallback when signing secrets are absent.

## [0.1.0] - 2026-03-19

### Added
- Initial local-first Markdown/CSV tracker MVP (daily/weekly/body/dashboard/settings).
- Profile workflows, template flows, autosave editor experience, and migration/import/export basics.
- Baseline docs (`AGENTS.md`, architecture/data/storage/parser/release docs) and README scaffolding.
