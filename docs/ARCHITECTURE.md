# Architecture

## Goal
Implement a local-first desktop app that makes Markdown/CSV tracking files easier to view and edit, while preserving them as the source of truth.

## High-Level Layers
- UI Layer (`src/pages`, `src/components`): route views and interaction.
- Feature Layer (`src/features/*`): note/body domain logic and orchestration.
- Domain Parsing Layer (`*.parser.ts`, `*.serializer.ts`): convert between files and typed state.
- Local Storage Layer (`src/lib/fs` + Tauri file APIs): read/write local files only.

## Data Flow
1. Resolve active data root path.
2. Read target local file.
3. Parse content into typed state.
4. Render structured UI.
5. User edits structured fields or raw Markdown/CSV.
6. Serialize (or raw write) back to file.
7. Re-read and parse to refresh UI consistency.

## Runtime Boundaries
- Frontend: React + TypeScript + Tailwind.
- Desktop runtime: Tauri.
- Persistence: local filesystem only.
- No remote services.

## Feature Modules
- `features/daily`: daily note read/create/parse/edit/save.
- `features/weekly`: weekly note read/create/parse/edit/save.
- `features/body`: CSV read/edit/save and trend source data.
- `features/dashboard`: summary and recent-file aggregation.
- `features/settings`: local `dataRoot` management.

## Key Constraints
- Markdown/CSV is the single source of truth.
- No database and no hidden app-only storage.
- For MVP, normalized output formatting is acceptable after save.
