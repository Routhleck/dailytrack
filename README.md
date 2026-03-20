# dailytrack

Local-first desktop life tracker for Markdown users.

`dailytrack` is a Tauri desktop app that reads and writes your local tracker files.
Markdown and CSV stay as the only source of truth.

## Screenshots

![Dashboard](docs/assets/screenshots/dashboard.png)
![Daily Note](docs/assets/screenshots/daily-note.png)
![Weekly Note](docs/assets/screenshots/weekly-note.png)
![Settings Reset](docs/assets/screenshots/settings.png)

## Why dailytrack

- Local-first and private: no cloud, no account, no remote API.
- Markdown-first: app is an editor/viewer layer, not a hidden database.
- Structured plus raw: toggle checklists in UI or edit raw Markdown directly.
- Profile-based workflow: separate personal/work templates and preferences.
- Real-time feel: debounced autosave with live refresh from disk.

## What It Is

- Desktop app for daily notes, weekly reviews, and body progress.
- Local file parser/editor for known Markdown schema.
- Practical personal tool with minimal complexity.

## What It Is Not

- SaaS or team collaboration product.
- Cloud sync platform.
- Database-backed note system.

## Tech Stack

- Tauri
- React
- TypeScript
- Tailwind CSS
- Recharts

## Quick Start

### Prerequisites

- Node.js LTS
- Rust toolchain
- Tauri platform prerequisites

### Run in dev

```bash
npm install
npm run tauri:dev
```

### Checks

```bash
npm run lint
npm run test
npm run build
```

### Build desktop bundle

```bash
npm run tauri:build
```

## Data Ownership and Storage

Default base data root:

- macOS/Linux: `~/dailytrack-data`
- Windows: `%USERPROFILE%\\dailytrack-data`
- Legacy fallback: if `~/life-tracker-data` exists and `dailytrack-data` does not, app uses legacy path.

Profile layout:

```text
dailytrack-data/
  profiles/
    default/
      daily/
      weekly/
      body.csv
      templates/
        daily.md
        weekly.md
      preferences.json
```

## Core Features

- Dashboard summary for today, this week, body, and recent notes.
- Daily note page:
  - structured checklist editing
  - raw Markdown mode
  - pure autosave mode
- Weekly note page:
  - section checklists
  - reflection fields
  - raw Markdown mode
  - pure autosave mode
- Body progress page:
  - local `body.csv` table + form
  - preference-based metric toggles (weight/waist/body fat/muscle/chest/hip/note)
  - per-metric unit + decimal display format
  - per-metric trend charts
- Profiles:
  - create/switch/delete profile
  - editable template presets
- Preferences:
  - per-profile module toggles
- Settings:
  - migrate-and-switch data root
  - migration safety checks
  - export/import data bundle
  - in-app updater controls (auto-check, manual check, install + restart)
  - tutorial replay
  - reset to first-run state (danger zone)

## Onboarding and Tutorial

- First launch in an empty root opens template setup modal.
- Template presets support English and Chinese variants.
- After initial template setup, a 5-step guide starts once.
- You can replay tutorial in `Settings -> Start Tutorial`.

## Save and Sync Behavior

- Daily/Weekly use debounced autosave only (no manual save button).
- Body records save on submit/delete.
- Live sync supports two per-profile modes:
  - `Watch` (recommended): Rust filesystem watcher emits realtime change events.
  - `Poll`: interval polling only.
- Polling remains as fallback and refreshes pages only when local draft is clean.

## Portability

- Export creates `dailytrack-export-<timestamp>` folder.
- Import merges/copies files into current active profile root.
- Data root migration copies whole root and switches app root.
- Settings displays copy summary after export/import/migration (copied/overwritten/skipped/new dirs).

## GitHub Release CI

- Workflow: `.github/workflows/publish.yml`
- Targets:
  - windows-latest
  - macOS aarch64
  - macOS x86_64
- Trigger:
  - push tag like `v0.2.0`
  - or manual `workflow_dispatch`

Example:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Optional (recommended): for trusted macOS installer output (avoid Gatekeeper "app is damaged" warning), configure these repository secrets:

- `APPLE_ID`
- `APPLE_PASSWORD` (app-specific password)
- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE` (base64-encoded `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_SIGNING_IDENTITY` (optional but recommended)

Optional (recommended): for in-app auto-update artifacts (`latest.json` + signatures), configure:

- `DAILYTRACK_UPDATER_PUBKEY` (public key embedded into app at build time)
- `TAURI_SIGNING_PRIVATE_KEY` (private key used to sign updater artifacts)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional, if private key is password protected)

When updater secrets are missing, CI still publishes installers, but auto-update metadata/signatures are skipped.

### Updater Key Generation (One-Time)

```bash
npm run tauri signer generate -- --ci --write-keys /tmp/dailytrack-updater.key
cat /tmp/dailytrack-updater.key.pub
```

- Put the public key content into `DAILYTRACK_UPDATER_PUBKEY`.
- Put the private key content into `TAURI_SIGNING_PRIVATE_KEY`.
- If your key has a password, set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## macOS Install Notice (Unsigned Builds)

If your release build is not signed/notarized yet, macOS Gatekeeper may show:

`"dailytrack" is damaged and can’t be opened.`

Temporary user-side workaround (manual command):

```bash
xattr -dr com.apple.quarantine /Applications/dailytrack.app
```

Or remove quarantine on the downloaded DMG first:

```bash
xattr -dr com.apple.quarantine ~/Downloads/dailytrack_*.dmg
```

Release helper option (for unsigned DMG builds):

1. Drag `dailytrack.app` into `/Applications`.
2. In the same mounted DMG window, run `fix-dailytrack-quarantine.command`.
3. Re-open dailytrack.

For production/public distribution, use signed + notarized macOS artifacts.

## Lower-Cost Distribution Options (Before Apple Developer Program)

If you are not ready for Apple Developer Program yet ($99/year):

- Prefer sharing source code and local run steps (`npm run tauri:dev`).
- Provide unsigned `.app.tar.gz` for technical users with manual quarantine removal.
- Mark releases clearly as `unsigned preview` to set user expectation.

These options are acceptable for early testing, but not ideal for broad public distribution.

## Markdown Schema

Daily note (`daily/YYYY-MM-DD.md`):

```md
# 2026-03-18

## Daily Core
- [ ] ...

## Optional
- [ ] ...

## One Line
-
```

Weekly note (`weekly/YYYY-Www.md`):

```md
# 2026-W12

## Body
- [ ] ...

## Research
- [ ] ...

## Life
- [ ] ...

## Output
- [ ] ...

## Social
- [ ] ...

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
```

Body CSV (`body.csv`):

```csv
date,weight,waist,bodyFat,muscleMass,chest,hip,note
2026-03-18,71.2,82.0,14.8,33.5,97.0,98.2,steady
```

## Limitations

- Structured save is schema-aware and normalizes formatting.
- Unknown custom Markdown blocks may not be preserved in structured mode.
- Import is file-level merge/overwrite without semantic conflict resolution.
- No file locking.

## Future TODOs

### P0 (v0.2.0 target)
- Replace polling-first behavior completely with watcher-first flow across all major pages.
- Add atomic write tests (including failure-path cleanup and Windows replace behavior).
- Expand service-layer test coverage for import/migrate/profile/preferences edge cases.
- Add migration/import post-check verification report (expected file set + mismatch hints).

### P1 (next)
- Add native folder picker dialogs for root path/import/export/migration flows.
- Add lightweight conflict preview before import overwrite.
- Add richer onboarding with template explanation and first-week quick-start checklist.

### P2 (backlog)
- Add optional file history snapshots for rollback safety.
- Add plugin-like custom metric sections while keeping markdown/csv as source of truth.
- Add additional template packs maintained by community contributors.

## Milestone Roadmap

### v0.2.0 - Local-First Stability
- Goal:
  - Make sync/write behavior robust enough for daily long-term usage.
  - Improve observability and recoverability for filesystem operations.
- Planned deliverables:
  - watcher-first live sync with polling fallback
  - atomic text writes on core save paths
  - import/export/migration operation summary
  - preference schema versioning and normalization hardening
  - improved docs for schema/sync/release process
  - broader automated tests for service + config paths
- Definition of done:
  - `npm run lint`, `npm run test`, `npm run build`, `cargo check` all pass
  - QA checklist items for sync/storage/import/migration pass
  - release checklist fully checked before tag publish

## Project Docs

- [AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md)
- [docs/PARSER_SPEC.md](./docs/PARSER_SPEC.md)
- [docs/FS_STORAGE.md](./docs/FS_STORAGE.md)
- [docs/PREFERENCES_SCHEMA.md](./docs/PREFERENCES_SCHEMA.md)
- [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md)
- [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md)
