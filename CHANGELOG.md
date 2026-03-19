# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added
- Documentation baseline for MVP development workflow.
- `AGENTS.md` collaboration and engineering guardrails.
- Architecture, data model, parser, storage, setup, QA, and release docs under `docs/`.
- Initial ADRs for stack and markdown normalization strategy.
- Tauri + React + TypeScript + Tailwind app shell with sidebar navigation and route structure.
- Local data root bootstrap command to create `daily/`, `weekly/`, `templates/`, and `body.csv`.
- Daily and weekly markdown parser/serializer/service modules.
- Structured + raw editing workflows for daily and weekly notes.
- Body CSV table/form editing with weight and waist trend charts.
- Dashboard summaries and daily/weekly file list pages.
- Parser and CSV roundtrip unit tests via Vitest.

### Changed
- Replaced template starter UI with tracker-focused desktop layout.
- Updated README with run/build/test instructions and markdown schema contracts.
- Switched route pages to lazy-loaded chunks to reduce initial bundle size.

### Fixed
- Removed unused scaffold assets and legacy starter styles.
