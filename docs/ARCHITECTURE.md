# Architecture

## Goal
Implement a local-first desktop app that makes Markdown/CSV tracking files easier to view and edit, while preserving them as the source of truth.

## High-Level Layers
- UI Layer (`src/pages`, `src/components`): route views and interaction.
- Feature Layer (`src/features/*`): profile, preference, note, and body domain logic.
- Domain Parsing Layer (`*.parser.ts`, `*.serializer.ts`): convert between files and typed state.
- Local Storage Layer (`src/lib/fs` + Tauri commands): read/write local files only.
- Runtime Memory Layer (`src/lib/state`, `src/lib/fs/writeBehindQueue.ts`):
  - in-session daily/weekly/body cache to reduce repeated `invoke` + disk reads
  - write-behind queue for text writes (idle flush + max-delay guard + lifecycle flush hooks).

## App-Level Contexts
- `DataRootContext`:
  - manages base root, profile list, active profile, active profile root
  - supports create/switch/delete profile
- `PreferencesContext`:
  - loads/saves `preferences.json` per active profile
  - controls section/field visibility in structured pages
  - controls live sync mode (`watch` / `poll`)
  - controls UI defaults (per-page `only show changes`, mobile sync banner visibility)

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
3. Read target local file from active profile root (cache-hit first, disk fallback).
4. Parse content into typed state and update runtime cache.
5. Render structured UI.
6. User edits structured fields or raw Markdown/CSV.
7. Serialize (or raw write) to runtime cache immediately.
8. Queue write-behind flush to disk during idle time, with max-delay/lifecycle forced flush.
9. Filesystem watch events invalidate affected cache keys to keep external edits consistent.

## Responsive Shell
- Startup gate:
  - staged startup overlay is shown before initial interaction (`data root -> preferences -> services -> first render`)
  - router mounts in parallel so first usable frame appears immediately after gate exits.
- Desktop: fixed-height shell with left sidebar + independent main-content scroll.
- Narrow/mobile-like windows:
  - bottom 4-tab nav (`Dashboard` / `Record` / `History` / `More`)
  - grouped sheet shortcuts for `Record` (Today/This Week/Body) and `History` (Daily/Weekly list)
  - dedicated `More` hub page for sync/profiles/preferences/settings/reports
  - compact sync status banner (offline/pending/conflicts/next pull)
  - keyboard-aware bottom bar behavior (auto-hide bar/sheets while typing to avoid overlap)

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
- `features/daily/daily.diff`: template-relative checklist/one-line change detection.
- `features/weekly`: weekly note read/create/parse/edit/save.
- `features/weekly/weekly.diff`: template-relative section/reflection change detection.
- `features/body`: CSV read/edit/save and trend source data.
- `features/body/body.diff`: non-empty metric/note change detection for focus views.
- `features/preferences`: per-profile preferences read/save and context.
- `features/settings`: base root + profile state management.
- `features/webdav`: WebDAV config, snapshot sync controls, realtime sync bridge, lightweight status hook.
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
