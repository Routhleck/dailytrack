# Filesystem Storage

## Local-Only Storage Policy
- All data is stored on local disk.
- No cloud or remote persistence.
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
- External disk edits are polled and synchronized back into UI only when local drafts are not dirty.

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
- `dailytrack.tour.pending.v1`: first-run tutorial pending flag.
- `dailytrack.tour.completed.v1`: first-run tutorial completion flag.
- `dailytrack.tour.dismissed.session.v1`: session-only dismissal flag for auto tutorial.
