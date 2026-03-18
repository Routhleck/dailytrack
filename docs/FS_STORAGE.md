# Filesystem Storage

## Local-Only Storage Policy
- All data is stored on local disk.
- No cloud or remote persistence.
- No database.

## Default Data Root
- Default path: `~/life-tracker-data`
- Configurable via Settings page (`dataRoot`).

## Required Layout
```text
life-tracker-data/
  daily/
    YYYY-MM-DD.md
  weekly/
    YYYY-Www.md
  body.csv
  templates/
    daily.md
    weekly.md
```

## Bootstrap Behavior
On startup or on data-root switch:
1. Ensure directories `daily/`, `weekly/`, `templates/` exist.
2. Ensure `body.csv` exists with header row: `date,weight,waist,note`.
3. Ensure template files exist; recreate defaults if missing.

## File Naming Rules
- Daily filename derived from local date: `YYYY-MM-DD.md`.
- Weekly filename derived from ISO-like week id: `YYYY-Www.md`.

## Write Policy
- Writes are explicit (Save button).
- Structured mode writes normalized format.
- Raw mode writes user text directly.
