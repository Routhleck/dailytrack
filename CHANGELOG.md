# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added
- Documentation baseline for MVP development workflow.
- `AGENTS.md` collaboration and engineering guardrails.
- Architecture, data model, parser, storage, setup, QA, and release docs under `docs/`.
- Initial ADRs for stack and markdown normalization strategy.
- Tauri + React + TypeScript + Tailwind app shell with sidebar navigation and route structure.
- Local data root bootstrap command to create `daily/`, `weekly/`, `templates/`, and `body.csv`.
- Daily and weekly markdown parser/serializer/service modules.
- Structured + raw editing workflows for daily and weekly notes.
- Body CSV table/form editing with weight and waist trend charts.
- Dashboard summaries and daily/weekly file list pages.
- Parser and CSV roundtrip unit tests via Vitest.
- Settings page export/import actions for local data portability across computers.
- New Tauri commands:
  - `export_data_bundle`
  - `import_data_bundle`
- Profile management workflow:
  - create profile
  - switch profile
  - delete profile (with safeguards)
- Template preset support for profile creation (Balanced / Minimal / Fitness Focus).
- Profile template editing for current active profile.
- Preferences page for per-profile toggles:
  - daily optional section visibility
  - weekly section visibility
  - body metric visibility (weight/waist/note)
- New Tauri profile commands:
  - `list_profiles`
  - `ensure_profile`
  - `create_profile`
  - `delete_profile`
- Realtime sync utilities and event bus (`src/lib/liveSync.ts`) for cross-page refresh.
- Data-root migration command and Settings workflow for one-click copy + switch.
- GitHub Actions publish pipeline for Windows + macOS release artifacts (`.github/workflows/publish.yml`).
- First-launch template setup workflow for brand-new empty data roots.
- Bilingual UI framework with runtime language toggle (`EN` / `中文`) and persisted locale preference.
- Expanded template preset pack with bilingual variants and Blank Skeleton option.
- First-use guided tutorial overlay (5-step sidebar highlight flow) with auto-start after initial template setup.
- Manual tutorial replay action in Settings (`Start Tutorial`).
- Full reset action in Settings danger zone to wipe tracker data and return to first-run setup.
- README screenshot placeholder assets under `docs/assets/screenshots/` for public-repo presentation.

### Changed
- Replaced template starter UI with tracker-focused desktop layout.
- Updated README with run/build/test instructions and markdown schema contracts.
- Switched route pages to lazy-loaded chunks to reduce initial bundle size.
- Improved default data root resolution for Windows by falling back to `USERPROFILE`.
- Migrated runtime storage model to profile-based roots under `profiles/<profile>/`.
- Dashboard, Daily, Weekly, and Body pages now respect profile preferences.
- Eslint ignore updated to skip `src-tauri/target/**` artifacts produced by Rust builds.
- Daily/Weekly pages now run in pure autosave mode (debounced) without manual save button.
- Dashboard and note list pages now refresh from live events + periodic polling.
- Body page now emits live change events and reloads external file updates via polling.
- Renamed default base root to `dailytrack-data` and added automatic fallback to legacy `life-tracker-data` when present.
- Settings now explicitly separates root switching (`Save Data Root`) from migration (`Migrate Data Root`).
- Migration UI now validates unsafe paths early and provides quick "Use This Path for Migration" action.
- README and release checklist now document tag-based automated release flow.
- `ensure_data_root` now returns root metadata (`root`, `isFirstRun`) to drive first-launch onboarding behavior.
- Profiles and onboarding flows now support selecting template language (English/中文).
- Settings now includes tutorial replay entry; first-run tutorial auto-trigger uses persisted pending/completed/session-dismiss flags.
- Settings now includes guarded `Reset Data` flow requiring `RESET` confirmation and re-triggering initial template setup.
- README reorganized for open-source onboarding: screenshots, value proposition, quick start, data model summary, and CI/release guidance.

### Fixed
- Removed unused scaffold assets and legacy starter styles.
