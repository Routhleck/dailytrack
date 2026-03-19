# Development Setup

## Prerequisites
- Node.js (LTS)
- A package manager (`npm` recommended for MVP)
- Rust toolchain for Tauri runtime
- Platform-specific Tauri prerequisites (macOS/Linux/Windows)

## Planned Commands
These are the current project commands.

```bash
npm install
npm run tauri:dev
npm run test
npm run build
npm run tauri:build
```

## Environment Notes
- Project is local-first and does not require API keys.
- Data files are created under `~/life-tracker-data` by default.

## Recommended Iteration Loop
1. Run dev app.
2. Verify file bootstrap in data root.
3. Implement one feature slice.
4. Run targeted tests/checklist.
5. Update docs + devlog + changelog.
