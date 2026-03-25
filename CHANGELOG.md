# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Added configurable routine reminder strategy in Preferences:
  - dashboard reminder enable/disable
  - daily completion gap threshold (days)
  - weekly completion gap threshold (weeks)
  - body record gap threshold (days)
- Added dashboard routine support cards:
  - reminder panel with triggered inactivity hints
  - 28-day daily completion heatmap with intensity legend
- Added calendar-like history navigation:
  - Daily Notes now includes a monthly calendar view (click day to open/create note)
  - Weekly Notes now includes a yearly ISO week grid (click week to open/create note)
- Added lightweight `Mood & Energy` tags to Daily notes:
  - structured UI inputs
  - markdown parser/serializer support (`## Mood & Energy`)
  - backward-compatible parsing for existing notes without this section
- Added stronger history filters for Daily/Weekly lists:
  - recency windows
  - detail-aware filters (one-line / mood-energy / reflection)
  - keyword search now also matches lightweight content previews

### Changed
- Updated built-in and preset daily templates to include `Mood & Energy` section.

### Fixed
- Fixed existing-user onboarding WebDAV pull scope:
  - onboarding now pulls snapshots into base data root (same scope as Settings WebDAV), avoiding nested profile-root restore mistakes.
- Fixed onboarding-time WebDAV race:
  - realtime WebDAV bridge is now paused while initial onboarding is unfinished, preventing premature auto-sync/conflict churn before user completes import/pull.

## [0.13.0] - 2026-03-25

### Added
- Added Dashboard insight layer for v0.13.0 kickoff:
  - period-over-period comparison (`today` and `this week` vs previous tracked period),
  - daily/weekly completion streak indicators,
  - weakest-section hint and rule-based `Next Best Action` recommendation card.
- Added deterministic `Structured Snapshot` section to generated weekly/monthly reports for export-friendly review output.
- Added deterministic `Local Recommendations` section to generated reports, derived from local completion/body signals (model-independent baseline guidance).
- Added report snapshot/recommendation unit tests for structured report output consistency.
- Added previous-period comparison lines in report structured snapshot (`current target` vs `previous target`) for completion/body count deltas.
- Added report-language aware markdown rendering:
  - report generation now follows current UI language (`en`/`zh`) for section headings and local recommendations.
- Added structured report companion JSON export:
  - generating a report now also writes `reports/<period>/<target>.json` (schemaVersion=1) with snapshot/comparison/recommendation fields.

### Changed
- Dashboard recent daily/weekly lists now use normalized latest-first ordering before rendering.

## [0.12.2] - 2026-03-25

### Changed
- Improved tab/page switch loading experience:
  - replaced abrupt plain-text `Loading...` fallback with a skeleton-style loading card.
  - added a short delayed-display threshold to avoid flicker on fast route transitions.
  - added motion-reduced fallback behavior for accessibility-friendly transitions.
- Improved Settings page transition smoothness (especially `/settings` route spikes seen in diagnostics):
  - WebDAV section is now collapsed by default and initialized lazily on first expand.
  - deferred WebDAV config/snapshot bootstrap to reduce first-enter render pressure.
  - raised Settings-related route preload priority during background page preloading.
- Reduced perceived stutter when update notifications appear:
  - auto update check now starts in idle time after startup delay (instead of competing with active interactions).
  - updater result state application now uses non-urgent transition scheduling.
  - update banner switched to floating overlay notification (no main-content layout push).

### Fixed
- Fixed performance diagnostics export path on Settings:
  - export now writes under current profile root (`<profile-root>/perf-diagnostics`) to satisfy local write-scope validation and avoid export failures.

## [0.12.1] - 2026-03-25

### Added
- Added lightweight runtime performance telemetry sampling:
  - startup and shell marks
  - resume-to-first-frame samples
  - route-switch-to-frame samples
  - dashboard/daily/weekly load-duration samples
  - browser paint/input/long-task snapshots when supported by runtime.
- Added Settings diagnostics export for performance snapshots to local data root (`perf-diagnostics/*.json`).

### Changed
- Reduced startup jank by making route-page preload less aggressive:
  - desktop preload now starts later
  - mobile skips preload entirely
  - preload runs incrementally instead of loading all route chunks at once.
- Auto update checks now start with delayed background scheduling instead of running immediately on app startup.
- GitHub Actions workflows were upgraded to Node 24 compatible action versions and now force JavaScript actions to run on Node 24.
- Reduced foreground resume load spikes by delaying WebDAV bridge startup/resume sync windows.
- Reduced background refresh pressure on mobile sync status by using slower countdown ticks and visibility-aware refresh.
- Dashboard/list refresh now coalesces bursty updates and avoids overlapping disk reads.
- Daily/Weekly/Body polling now respects visibility/resume grace windows and skips redundant overlapping reloads.
- Mobile keyboard detection now batches viewport events with `requestAnimationFrame` to reduce input/render jitter while typing.
- Startup now defers non-critical background bridges (`FilesystemWatchBridge` / `WebdavSyncBridge`) to keep first interaction smoother.
- Shell overlays now mount later (mobile sync banner and tutorial guide), reducing startup-side reactive work.
- Updater capability probing (`getVersion` / support/config checks) now starts later in background instead of immediately on app mount.
- Desktop route preload now also uses idle scheduling fallback, reducing contention with initial foreground interactions.
- Added lightweight runtime performance telemetry sampling:
  - startup and shell marks
  - resume-to-first-frame samples
  - route-switch-to-frame samples
  - dashboard/daily/weekly load-duration samples
  - browser paint/input/long-task snapshots when supported by runtime.
- Settings diagnostics now support exporting performance diagnostics JSON to local data root (`perf-diagnostics/`).

## [0.12.0] - 2026-03-25

### Added
- Added weekly lightweight goal-progress panel (sections completed count + weakest section hint + per-section badges).
- Added structured template checklist reordering controls (`move up / move down`) in Profiles for both create-profile and current-profile template editors (daily + weekly sections).
- Added template item category switching in Profiles structured editor:
  - Daily items can move between `Daily Core` and `Optional` (required semantics).
  - Weekly items can change section category (`Body/Research/Life/Output/Social`) per item.
- Added first-run onboarding user-type split (`New User` / `Existing User`).
- Added existing-user onboarding actions directly in modal:
  - local export-folder import
  - WebDAV config + connection test + pull latest snapshot
  - skip for now (finish onboarding without entering Settings).
- Added native folder picker support (Tauri dialog plugin) for path-heavy flows:
  - onboarding existing-user import source path
  - Settings migrate destination / export destination / import source.
- Added smart import path handling:
  - import now supports both directory source and `.zip` source.
  - Android/mobile import can use document picker file selection and import from selected zip bytes.

### Changed
- Profile template update flow now shows clearer impact preview copy and requires explicit risk acknowledgment before overwrite apply.
- English locale labels now use English wording for language selectors (`English / Chinese`) instead of mixed Chinese terms.
- Export behavior is now zip-first across platforms:
  - `export_data_bundle` produces `dailytrack-export-<timestamp>.zip` instead of a copied folder tree.
- Android settings behavior is now mobile-optimized:
  - migration is disabled (fixed local data root)
  - export target directory is fixed under local root
  - import flow is zip-file-first on mobile.

### Fixed
- Fixed Android writable-path validation when storage paths resolve through alias roots (for example `/data/data/...` vs `/data/user/0/...`), which could cause:
  - initial template apply failures
  - failed auto-create of new-day Daily/Weekly notes
  - failed Sync diagnostics export writes.
- Improved runtime error detail visibility for onboarding template apply, Dashboard/Daily load failures, and diagnostics export failures.
- Fixed onboarding template language mismatch on first run by preventing route preloads during initial template setup and force-applying selected template content to current-day/current-week notes after onboarding apply.
- Fixed Android path picker regression by adding mobile fallback for directory picking:
  - when folder picker is unavailable on mobile, the app now asks to pick any file and derives its parent directory automatically.
- Fixed Android old-user import usability by switching import flow to mobile-compatible strategy:
  - when directory picker is unsupported, users can pick a file (for example export zip) and complete import in-app.
- Fixed Android export handoff friction by adding post-export actions:
  - one-tap system share for exported zip
  - save-as flow to choose destination for the generated zip.

## [0.11.0] - 2026-03-24

### Added
- Added body analytics helpers + tests for chart-range filtering and latest-vs-previous metric delta calculation.
- Added body trend chart range controls (`7d / 30d / 90d / all`).
- Added metric delta badges on Body page (`vs previous`) using per-metric unit/decimal display preferences.
- Added per-metric body goal-line preferences (`enabled + value`) and chart `ReferenceLine` rendering.
- Added post-submit body change summary feedback (`vs previous`) and temporary highlight for the saved record in chart/history.

## [0.10.0] - 2026-03-24

### Added
- Added completion badges to Daily/Weekly history rows (`checked/total` and `%`) so note status is visible before opening.

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
