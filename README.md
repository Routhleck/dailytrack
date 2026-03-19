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

### Build
```bash
npm run build
npm run tauri:build
```

### Test
```bash
npm run test
```

## Data storage
Default data root:
- `~/life-tracker-data`

Configurable in Settings page.

### Expected file layout
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

On startup, the app bootstraps missing directories/files/templates.

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

## Implemented pages
- Dashboard
- Daily note detail
- Weekly note detail
- Daily notes list
- Weekly notes list
- Body progress
- Settings (data root)

## Current limitations
- Structured mode is schema-aware and only targets defined headings/fields.
- Unknown extra markdown content is not preserved by structured save normalization.
- Chunk size warning exists in production build due chart dependency size.
- No concurrent file write conflict handling yet.

## Project docs
- [AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md)
- [docs/PARSER_SPEC.md](./docs/PARSER_SPEC.md)
- [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md)
