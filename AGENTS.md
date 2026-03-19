# AGENTS.md

## Project Mission
Build a local desktop life tracker for personal use.
The app reads and writes local Markdown/CSV files and provides a structured editing UI.

## Non-Goals
- Cloud sync
- Auth/accounts
- Remote API backend
- Team collaboration
- Database storage
- Mobile app

## Source of Truth
- Markdown and CSV files are the only source of truth.
- The app must not introduce hidden app-only data formats.
- Structured editing and raw editing must both map back to local files.

## Preferred Stack
- Tauri
- React
- TypeScript
- Tailwind CSS

## Repository Structure Conventions
- `src/` for frontend app code
- `src-tauri/` for desktop runtime
- `docs/` for architecture, specs, QA, release docs
- `docs/DEVLOG/` for day-by-day engineering logs
- `docs/ADR/` for key architecture decisions

## Data Layout Contract
Default local data root: `~/dailytrack-data`

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

On Windows, default base root falls back to `%USERPROFILE%\\dailytrack-data`.

## Sync Behavior Contract
- Markdown/CSV remains the source of truth on disk.
- Daily/Weekly editors use debounced autosave and also keep explicit `Save now`.
- Dashboard/list pages react to in-app data-change events and periodic polling.
- External file edits are polled and pulled into UI only when there are no unsaved local edits.

## Development Workflow
1. Confirm requirement and scope boundaries.
2. Update docs/specs first when behavior contracts change.
3. Implement minimal vertical slice.
4. Validate with tests/checklists.
5. Update logs and changelog.

## Definition of Done (DoD)
A task is done only if:
- Feature behavior matches documented schema/contracts.
- Local file read/write behavior is verified.
- Relevant tests/checklists are completed.
- Docs are updated (`README.md` and affected files in `docs/`).
- `docs/DEVLOG/*.md` entry is appended.
- `CHANGELOG.md` is updated for user-visible changes.

## Testing Requirements (MVP)
- Parser/serializer roundtrip checks for daily/weekly notes.
- CSV read/write checks for body records.
- File bootstrap checks for missing templates/directories.
- Manual UI QA checklist pass before release.

## Logging Rules
For each development session, append one entry in `docs/DEVLOG/YYYY-MM.md` with:
- Date
- Goal
- Changes
- Validation
- Risks
- Next

## ADR Rules
Create or update ADR when changing:
- Stack/runtime decision (e.g., Tauri vs Electron)
- Data persistence or serialization strategy
- Parsing strategy and compatibility boundaries

## Commit Message Convention
Use concise conventional prefixes:
- `feat:` user-facing feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` internal refactor
- `test:` test updates
- `chore:` tooling/maintenance

## Guardrails
- Keep architecture simple and local-first.
- Prefer pragmatic parsers for known note schema over generic Markdown AST pipelines.
- Avoid introducing dependencies without clear MVP value.
