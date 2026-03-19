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

## Data Flow
1. Resolve base root path.
2. Ensure profile storage and active profile root.
3. Read target local file from active profile root.
4. Parse content into typed state.
5. Render structured UI.
6. User edits structured fields or raw Markdown/CSV.
7. Serialize (or raw write) back to file.
8. Re-read and parse to refresh UI consistency.

## Runtime Boundaries
- Frontend: React + TypeScript + Tailwind.
- Desktop runtime: Tauri.
- Persistence: local filesystem only.
- No remote services.

## Feature Modules
- `features/daily`: daily note read/create/parse/edit/save.
- `features/weekly`: weekly note read/create/parse/edit/save.
- `features/body`: CSV read/edit/save and trend source data.
- `features/preferences`: per-profile preferences read/save and context.
- `features/settings`: base root + profile state management.
- `features/dashboard`: summary and recent-file aggregation.

## Key Constraints
- Markdown/CSV is the single source of truth.
- No database and no hidden app-only storage.
- For MVP, normalized output formatting is acceptable after save.
