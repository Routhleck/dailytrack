# Filesystem Storage

## Local-Only Storage Policy
- All data is stored on local disk.
- Optional cloud transport is available via WebDAV snapshot sync and WebDAV realtime file sync.
- WebDAV does not replace local files as source of truth.
- No database.

## Default Base Root
- Default path: `~/dailytrack-data` on macOS/Linux.
- On Windows fallback uses `USERPROFILE`.
- Configurable via Settings page (`baseDataRoot`).
- Legacy compatibility: if legacy `life-tracker-data` exists and `dailytrack-data` does not, default resolution uses the legacy folder.

## Active Layout
```text
dailytrack-data/
  profiles/
    default/
      daily/
        YYYY-MM-DD.md
      weekly/
        YYYY-Www.md
      body.csv
      templates/
        daily.md
        weekly.md
      preferences.json
```

## Body CSV Schema
- Canonical header:
  - `date,weight,waist,bodyFat,muscleMass,chest,hip,note`
- Legacy compatibility:
  - App still reads legacy 4-column files (`date,weight,waist,note`).
  - Missing extended columns are treated as `null`.
- Write normalization:
  - Any app write re-serializes `body.csv` with canonical 8-column header.

## Profile Model
- App runs against one active profile root at a time.
- Profile name validation: 1-64 chars, `[a-zA-Z0-9_-]`.
- At least one profile must always exist.
- Deleting last profile is blocked.
- `preferences.json` stores:
  - section/module visibility toggles
  - body metric display settings (unit + decimals per metric)
  - live sync mode (`watch` or `poll`)

## Bootstrap Behavior
On startup:
1. Ensure base root exists.
2. Ensure `profiles/default` exists.
3. If migrating from legacy layout (`daily/weekly/templates/body.csv` directly under base root), copy legacy files into `profiles/default` once.
4. Ensure active profile has required files (`daily/`, `weekly/`, `templates/`, `body.csv`).
5. If base root was initially empty, app enters first-launch template setup flow and rewrites active profile templates based on selected preset/language.

## Write Policy
- Daily/Weekly use debounced autosave only (no manual save button).
- Body writes on submit/delete.
- Structured mode writes normalized format.
- Raw mode writes user text directly.
- Text file saves use atomic write (`temp file -> rename/replace`) for safer crash/interruption behavior.
- External disk edits use watcher-first sync with polling fallback, and synchronize into UI only when local drafts are not dirty.

## WebDAV Snapshot Sync
- Scope: entire base data root (not per single file merge).
- Trigger:
  - manual `Push` / `Pull`
  - optional interval auto-push
- Remote layout under configured base URL:
  - `meta.json`
  - `snapshots/<snapshot-id>.zip`
- Pull behavior:
  - can create local backup first (`dailytrack-webdav-backup-<timestamp>`)
  - then overwrites local base root with selected snapshot content.
- Snapshot retention:
  - controlled by `maxSnapshots`
  - old snapshots are pruned after successful push.

## WebDAV Realtime File Sync
- Scope: active data-root files (`profiles/*`) with file-level merge behavior.
- Remote layout:
  - `realtime/manifest.json`
  - `realtime/files/<relative-path>`
- Trigger:
  - Sync page manual actions: `Sync Both`, `Push Only`, `Pull Only`
  - background bridge interval when WebDAV is enabled
  - visibility-change opportunistic sync
- Conflict behavior:
  - if both local and remote changed from same base and content differs, conflict is recorded
  - remote side copy is written to local `conflicts/*.conflict-<timestamp>-<device>`
  - unresolved conflicts are shown in Sync page and require manual resolve
- Realtime state file:
  - stored in app config dir as `webdav.realtime.state.<hash>.json`
  - tracked fields include `baseRevision`, `baseFiles`, `conflicts`, `lastPushAt`, `lastPullAt`, `lastError`

## WebDAV Config Storage
- Stored outside data root in Tauri app config directory:
  - `webdav.config.json`
- Contains endpoint and credentials (`username/password`) plus sync options.
- Not included in data-root export/import/migration operations.

## Export and Import
- Export copies current active profile root to timestamped folder:
  - `dailytrack-export-<timestamp>`
- Import copies files from bundle folder into current active profile root.
- Import source validation requires:
  - `daily/`
  - `weekly/`
  - `body.csv`
- Import overwrite modes:
  - `true`: replace existing files
  - `false`: keep existing files, copy missing files only
- Safety guard: export destination cannot be inside current source root.
- Export/import/migration responses include copy summary counters:
  - copied files
  - overwritten files
  - skipped files
  - created directories

## Root Switching vs Migration
- Settings UI uses migration-only flow for root moves.
- `Migrate Data Root` copies current base root to destination and then switches app root.
- Migration safety:
  - source and destination cannot be the same path
  - source and destination cannot be nested

## Reset Data Behavior
- `Reset Data (Danger Zone)` removes app-managed tracker content from current base root:
  - `profiles/`
  - legacy `daily/`, `weekly/`, `templates/`, `body.csv`
- Reset does not recursively delete unknown unrelated files in the same root.
- After reset, app forces first-launch template setup for the current base root.
- Tutorial completion/pending/session-dismiss flags are cleared so onboarding can run again.

## Local Browser Storage Keys
- `dailytrack.dataRoot`: preferred base root path.
- `dailytrack.activeProfile`: active profile name.
- `dailytrack.pendingInitialTemplateRoot`: root waiting for initial template setup completion.
- `dailytrack.uiLanguage`: UI language (`en` or `zh`).
- `dailytrack.updater.autoCheck`: updater auto-check preference (`1`/`0`).
- `dailytrack.tour.pending.v1`: first-run tutorial pending flag.
- `dailytrack.tour.completed.v1`: first-run tutorial completion flag.
- `dailytrack.tour.dismissed.session.v1`: session-only dismissal flag for auto tutorial.
