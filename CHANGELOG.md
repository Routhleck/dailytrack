# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Added completion badges to Daily/Weekly history rows (`checked/total` and `%`) so note status is visible before opening.
- Added body analytics helpers + tests for chart-range filtering and latest-vs-previous metric delta calculation.
- Added body trend chart range controls (`7d / 30d / 90d / all`).
- Added metric delta badges on Body page (`vs previous`) using per-metric unit/decimal display preferences.

### Changed
- Daily/Weekly history now supports status filtering (`All / Completed / Pending`) with visible item count feedback.
- Daily/Weekly history search now supports fast open of the first match via `Enter` key or quick action button.
- Daily/Weekly history now shows an explicit empty-state hint when no notes match current filters.

## [0.9.0] - 2026-03-24

### Added
- Added profile-level typography scale preference (`small / medium / large`) with real-time UI font scaling.
- Added a reusable global toast feedback layer for lightweight success/error/info operation feedback.

### Changed
- Updated mobile tutorial flow to use mobile-specific tour anchors (`Dashboard / Record / History / More`) with responsive tooltip sizing.
- Updated roadmap/docs wording to align with the new mobile navigation model and defer screenshot refresh to pre-`v1.0.0` polish.
- Dashboard summary cards now emphasize completion percentage and remaining-item hints for Today/This Week.
- Dashboard empty states now include direct CTA links for first body record, first daily note, and first weekly note.
- Sync page now uses a summary-first information hierarchy (status, mode, action needed, quick actions) and moves technical details into collapsible advanced diagnostics.
- Sync page actions now emit toast feedback for refresh/sync/export/resolve flows.
- Body page actions now emit toast feedback for save/update-from-disk/date-required flows.
- Body history now shows first-use empty-state guidance when there are no visible records.
- Daily structured checklist now supports row-click toggle (not only checkbox click) for faster completion.
- Daily Core card now shows an explicit remaining-item hint (`N remaining`).
- Daily/Weekly mode switch now shows clearer guidance text (`structured = recommended`, `raw markdown = advanced`).
- Settings page explicit operations now emit toast feedback (WebDAV test/push/pull/delete + export/import/migrate/reset).

### Fixed
- Fixed mobile tutorial overlay positioning on narrow layouts.
- Improved mobile input ergonomics by auto-hiding bottom navigation/group sheets while the software keyboard is open.

## [0.8.1] - 2026-03-24

### Added
- Added mobile grouped-navigation sheets for `Record` (Today/This Week/Body) and `History` (Daily/Weekly list).
- Added a dedicated `/more` mobile hub page for Sync, Profiles, Preferences, Settings, and Reports.
- Added mobile navigation route-to-tab mapping tests for the new 4-tab architecture.

### Changed
- Redesigned mobile bottom navigation from 5 direct tabs to 4 tabs: Dashboard / Record / History / More.
- Updated mobile information architecture by removing the top-left menu entry and consolidating secondary tools under the More hub.

### Fixed
- Fixed Android top safe-area handling by applying status-bar inset spacing to the shell container.

## [0.8.0] - 2026-03-24

### Added
- Added playful animated task checkbox interactions for structured checklist editing.
- Expanded the in-app tutorial into a fuller feature walkthrough (navigation, data model, sync/report flow, and recommended routine).

### Changed
- Introduced a Calm Glass visual system with shared design tokens, glass shell surfaces, and unified card/input/button styles.
- Reworked navigation information architecture into primary/secondary groups with a centralized route config used by desktop sidebar and mobile navigation.
- Refreshed Dashboard, Daily, Weekly, Body, list pages, Reports, Preferences, Sync, Profiles, Settings, and onboarding modal to align with the new visual system.
- Moved technical runtime details out of the main shell; diagnostics now live in Settings so the daily workspace stays focused.
- Preloaded route page chunks after startup so most tab/page switches use warmed cache and feel smoother.

### Fixed
- Removed the duplicate sidebar language switch entry and kept language switching in the top-right shell control.
- Kept the sidebar fixed while main content scrolls and refined route transition animations.

## [0.7.3] - 2026-03-24

### Fixed
- Further adjusted Android adaptive icon foreground framing to prevent launcher text clipping on some devices.
- Hardened Android new-day dashboard load by adding built-in daily/weekly template fallback and partial-load tolerance for transient local read failures.
- Reduced body-form input lag after app resume on Android by pausing polling while typing, adding a short resume poll grace window, and lowering per-keystroke recomputation.

## [0.7.2] - 2026-03-23

### Changed
- Reduced shell-level re-render pressure by scoping mobile sync polling UI into a mobile-only banner component instead of the global app shell.
- Tuned WebDAV bridge scheduling on resume/visibility changes to avoid sync burst spikes after app foreground restore.

### Fixed
- Refined desktop/app icon assets to use transparent outer corners and normalized visual padding for better macOS launcher consistency.
- Reworked Android adaptive icon sources (dedicated foreground/background and larger foreground scale) to avoid the "small icon inside rounded rectangle" look.
- Adjusted Android adaptive foreground framing (smaller + upward offset) to prevent bottom letters from being clipped on launcher masks.
- Improved Android new-day resilience by adding built-in daily/weekly template fallback and dashboard partial-load tolerance when one local file read fails.

## [0.7.1] - 2026-03-22

### Fixed
- Fixed WebDAV auto-pull countdown getting stuck at "Now" by using `lastAttemptAt` and a stable local fallback anchor when no pull/push timestamp is available.
- Fixed Sync diagnostics export failure when writing to new nested directories (for example `sync-diagnostics/`) under data root.

## [0.7.0] - 2026-03-22

### Added
- Added template-based `Only show changes` mode for Daily, Weekly, and Body structured pages.
- Added mobile sync status banner with offline/pending/conflict/next-auto-pull visibility and quick link to Sync page.
- Added dedicated diff utilities and tests for daily/weekly template comparisons and body non-empty change detection.

### Changed
- Preferences schema upgraded to v3 with per-page change-filter defaults and mobile sync banner visibility toggle.
- Mobile shell now uses fixed-height + independent main scrolling for safer narrow-screen behavior.
- Body chart rendering now uses measured container sizing to improve small-window/mobile chart visibility.

## [0.6.0] - 2026-03-22

### Added
- Repository-editable template catalog moved to `config/template-presets.json` + `config/templates/**` markdown files.
- Profile template update flow now supports dry-run preview and apply modes (`merge` recommended, `overwrite` optional).
- Per-profile template metadata file added: `templates/template-meta.json` (preset/language/mode/timestamp).
- New tests added for template catalog loading and template update merge/overwrite behavior.

### Changed
- Onboarding and profile-creation flows now persist template source metadata when applying selected presets.
- Profile template parsing/serialization utilities are shared through dedicated schema helpers.
- Profiles page now follows active UI language for template-language default and displays localized template names more clearly.

### Fixed
- Completed bilingual preset descriptions so each template preset has both Chinese and English explanation text.

## [0.5.0] - 2026-03-22

### Added
- Sync page now supports diagnostic export to local `sync-diagnostics/*.json` (with WebDAV password redaction).
- Sync conflict handling now supports batch actions (`keep_local`, `apply_remote`, `mark_resolved`) for selected conflicts.
- Sync page now supports one-click conflict strategy presets for all unresolved conflicts.
- Sync page now shows retry backoff hints and a quick retry action when sync health is degraded.
- Sync conflict actions now include dry-run summaries (expected overwrite/delete counts) before execution.

### Changed
- Sync page now shows sync health, error category, last sync timestamp, and next auto-pull countdown for clearer reliability visibility.
- Applying remote content now asks for confirmation (single and batch flows) to reduce accidental local overwrite risk.
- Realtime sync status now includes retry telemetry (last attempt/success/failure, consecutive failures, total successes/failures).
- Conflict batch actions now execute through a single backend batch command for better large-list performance and consistency.

## [0.4.3] - 2026-03-22

### Added
- WebDAV settings now support a configurable auto-pull interval in seconds.

### Changed
- WebDAV auto-pull now polls on a fixed interval (no local-change trigger required).
- Android release workflows now enforce branded launcher icon resources after `android init`.
- Android release workflows now sign release APKs from repository keystore secrets and prioritize uploading signed APK assets.

### Fixed
- Prevented Android release distribution from defaulting users to unsigned APK artifacts that can fail to install.

## [0.4.2] - 2026-03-21

### Added
- WebDAV now supports an `Auto Pull` toggle with 30-second throttled pull checks after local data-change events.
- Settings now clearly shows updater platform support status (supported/configured split).

### Changed
- Android release pipeline now builds release APKs by default in both `publish.yml` and manual `android-apk.yml`.
- Android manual APK workflow now defaults to `release` mode and keeps `aarch64` target for faster, smaller builds.
- Rust release profile now uses size-oriented optimization (`opt-level=s`, `lto`, `strip`).
- App icon generation flow now uses a manifest-based source setup for consistent desktop/mobile outputs.

### Fixed
- In-app updater checks no longer run on mobile builds, avoiding false "check updates failed" errors on Android.
- Android launcher icon assets regenerated to avoid cropped/incorrect wordmark rendering.

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
