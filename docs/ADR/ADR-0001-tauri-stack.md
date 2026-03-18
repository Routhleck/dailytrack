# ADR-0001: Use Tauri + React + TypeScript + Tailwind for MVP

- Status: Accepted
- Date: 2026-03-18

## Context
The product is a personal local desktop tool for Markdown/CSV tracking files.
We need desktop filesystem access, low runtime overhead, and a straightforward frontend developer experience.

## Decision
Use:
- Tauri as desktop runtime
- React + TypeScript for UI
- Tailwind CSS for styling

Electron is kept as fallback only if a blocking Tauri issue appears.

## Consequences
- Pros:
  - Better lightweight runtime profile for desktop personal use.
  - Direct local app distribution model.
  - Familiar TS/React development workflow.
- Cons:
  - Rust/Tauri setup prerequisites required.
  - Some desktop integration APIs differ from pure web apps.

## Revisit Trigger
Revisit only if Tauri blocks core local file UX or build/distribution stability.
