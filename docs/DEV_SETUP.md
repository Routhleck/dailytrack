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
npm run build:desktop:fast
```

## Build Speed Tips
- Use `npm run build:desktop:fast` for local Rust/runtime checks without slow installer bundling.
- In CI, reuse prebuilt frontend assets (`dist/`) across platform matrix jobs.
- Keep Rust cache warm (`swatinem/rust-cache`) and avoid unnecessary lockfile churn.

## Android APK Build
- Local:
  - `npm run tauri -- android init --ci`
  - `npm run tauri -- android build --ci --apk --debug --target aarch64`
  - (release multi-target) `npm run tauri -- android build --ci --apk --target aarch64 x86_64`
- CI:
  - Use `.github/workflows/android-apk.yml` (workflow_dispatch or tag-triggered).

## Environment Notes
- Project is local-first and does not require API keys.
- Data files are created under `~/dailytrack-data` by default.

## Recommended Iteration Loop
1. Run dev app.
2. Verify file bootstrap in data root.
3. Implement one feature slice.
4. Run targeted tests/checklist.
5. Update docs + devlog + changelog.
