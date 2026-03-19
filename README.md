# dailytrack

A local desktop markdown-based life tracker editor.

## Product principle
- Markdown and CSV files are the single source of truth.
- The app only reads/parses/edits local files.
- No database, no cloud sync, no auth, no remote API.

## Stack
- Tauri
- React
- TypeScript
- Tailwind CSS
- Recharts (body trend charts)

## Run locally

### Prerequisites
- Node.js LTS
- Rust toolchain
- Tauri platform prerequisites

### Commands
```bash
npm install
npm run tauri:dev
```

### Quality checks
```bash
npm run lint
npm run test
npm run build
```

### Build release
```bash
npm run tauri:build
```

## Data storage
Default base data root:
- `~/life-tracker-data`
- Windows fallback: `%USERPROFILE%\life-tracker-data`

Configurable in Settings page.

### Active layout (profile-based)
```text
life-tracker-data/
  profiles/
    default/
      daily/
      weekly/
      body.csv
      templates/
        daily.md
        weekly.md
      preferences.json
    <another-profile>/
      ...
```

At runtime, the app operates on one active profile root at a time.

## Profiles and templates
- Use `Profiles` page to:
  - create profile
  - switch profile
  - delete non-active profile
- New profile creation supports built-in template presets:
  - Balanced
  - Minimal
  - Fitness Focus
- Templates are editable when creating profile.
- Current profile templates are also editable directly in `Profiles` page.

## Preferences
Use `Preferences` page to toggle tracking scope per profile:
- daily optional section visibility
- weekly section visibility (Body/Research/Life/Output/Social)
- body fields visibility (weight/waist/note)

These preferences affect structured UI rendering without changing your core file format contract.

## Data portability (Export / Import)
- Use `Settings -> Export Data` to create a backup folder in your chosen destination directory.
- Export creates a timestamped folder: `dailytrack-export-<timestamp>`.
- Use `Settings -> Import Data` to import from an exported folder into current active profile root.
- Import supports overwrite mode for existing files.
- This enables moving data between macOS and Windows machines using local file transfer tools.

## Markdown schema

### Daily note (`daily/YYYY-MM-DD.md`)
```md
# 2026-03-18

## Daily Core
- [ ] ...

## Optional
- [ ] ...

## One Line
-
```

### Weekly note (`weekly/YYYY-Www.md`)
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

### Body file (`body.csv`)
```csv
date,weight,waist,note
2026-03-18,71.2,82.0,steady
```

## Structured editing <-> file mapping
- Structured mode:
  - parse markdown/csv into typed state
  - update checkboxes and fields in UI
  - save via serializer into normalized markdown/csv
- Raw mode (daily/weekly):
  - edit raw markdown text directly
  - save raw text directly
  - app reparses after save to refresh structured view

## Real-time behavior
- Daily/Weekly pages:
  - debounced autosave while editing
  - explicit `Save now` button remains available
  - external disk changes are pulled in automatically when local draft is not dirty
- Body page:
  - saves immediately on submit/delete
  - polls disk for external updates when not actively editing
- Dashboard/Daily list/Weekly list:
  - refresh on in-app data-change events
  - also refresh on short polling intervals/focus to catch external changes

## Implemented pages
- Dashboard
- Daily note detail
- Weekly note detail
- Daily notes list
- Weekly notes list
- Body progress
- Profiles
- Preferences
- Settings (base root + export/import)

## Current limitations
- Structured mode is schema-aware and only targets defined headings/fields.
- Unknown extra markdown content is not preserved by structured save normalization.
- Import is file-level merge/overwrite and does not do semantic conflict resolution.
- No file-locking; conflicting concurrent edits are mitigated by polling + dirty-state guards only.

## Project docs
- [AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md)
- [docs/PARSER_SPEC.md](./docs/PARSER_SPEC.md)
- [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md)
