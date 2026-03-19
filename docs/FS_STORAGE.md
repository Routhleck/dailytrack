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

## Write Policy
- Daily/Weekly use debounced autosave and still provide explicit Save button.
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
