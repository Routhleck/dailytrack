# Architecture

## Goal
Implement a local-first desktop app that makes Markdown/CSV tracking files easier to view and edit, while preserving them as the source of truth.

## High-Level Layers
- UI Layer (`src/pages`, `src/components`): route views and interaction.
- Feature Layer (`src/features/*`): profile, preference, note, and body domain logic.
- Domain Parsing Layer (`*.parser.ts`, `*.serializer.ts`): convert between files and typed state.
- Local Storage Layer (`src/lib/fs` + Tauri commands): read/write local files only.

## App-Level Contexts
- `DataRootContext`:
  - manages base root, profile list, active profile, active profile root
  - supports create/switch/delete profile
- `PreferencesContext`:
  - loads/saves `preferences.json` per active profile
  - controls section/field visibility in structured pages
  - controls live sync mode (`watch` / `poll`)

## Live Sync
- Watch-first path:
  - Rust emits `dailytrack://fs-changed` for data-root filesystem changes.
  - Frontend bridge converts these to app-level `data-changed` events.
- Polling fallback:
  - Pages still poll as safety fallback.
  - Poll interval is longer when watch mode is enabled.

## Data Flow
1. Resolve base root path.
2. Ensure profile storage and active profile root.
3. Read target local file from active profile root.
4. Parse content into typed state.
5. Render structured UI.
6. User edits structured fields or raw Markdown/CSV.
7. Serialize (or raw write) back to file.
8. Re-read and parse to refresh UI consistency.

## Responsive Shell
- Desktop: sticky left sidebar navigation.
- Narrow/mobile-like windows:
  - bottom primary nav (Today/Week/Body/Sync)
  - top quick menu for secondary routes (Dashboard/Lists/Reports/Profiles/Preferences/Settings)

## Runtime Boundaries
- Frontend: React + TypeScript + Tailwind.
- Desktop runtime: Tauri.
- Persistence: local filesystem.
- Optional remote transport:
  - WebDAV snapshot backup/sync (config + snapshots + metadata)
  - WebDAV realtime manifest/file sync (`realtime/manifest.json` + `realtime/files/*`)
- Remote transport must not replace local markdown/csv source-of-truth files.

## Feature Modules
- `features/daily`: daily note read/create/parse/edit/save.
- `features/weekly`: weekly note read/create/parse/edit/save.
- `features/body`: CSV read/edit/save and trend source data.
- `features/preferences`: per-profile preferences read/save and context.
- `features/settings`: base root + profile state management.
- `features/webdav`: WebDAV config, snapshot sync controls, realtime sync bridge.
- `features/dashboard`: summary and recent-file aggregation.
- `pages/SyncPage.tsx`: realtime sync status/actions/conflict resolution UI.

## WebDAV Realtime Flow
1. Frontend triggers `webdav_realtime_sync_now` (push/pull/both) from Sync page or bridge.
2. Rust backend scans active data root, compares local state vs base manifest vs remote manifest.
3. Non-conflicting deltas are pushed/pulled as files under `realtime/files`.
4. Manifest revision is bumped on remote writes.
5. Conflicts are recorded in local realtime state and remote copy is written into `conflicts/*`.
6. Frontend exposes unresolved conflicts and lets user resolve by strategy:
   - `keep_local`
   - `apply_remote`
   - `mark_resolved`

## Key Constraints
- Markdown/CSV is the single source of truth.
- No database and no hidden app-only storage.
- For MVP, normalized output formatting is acceptable after save.
