# CLAUDE.md

This file provides guidance for Claude Code (claude.ai/code) to work on this codebase.

## Project Overview

DailyTrack is a local-first desktop life tracker for personal use. It reads and writes local Markdown/CSV files and provides a structured editing UI.

**Core Principles:**
- Local files (Markdown/CSV) are the only source of truth
- The app must never introduce hidden app-only data formats
- Optional WebDAV sync is transport/backup only, not a replacement for local files
- Keep architecture simple and local-first

## Preferred Stack

- Tauri (desktop runtime)
- React (UI framework)
- TypeScript (language)
- Tailwind CSS (styling)

## Key Conventions

### Commit Message Format

Use concise conventional prefixes:
- `feat:` user-facing feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` internal refactor
- `test:` test updates
- `chore:` tooling/maintenance

### Changelog Rules

- Keep one `## [Unreleased]` section for not-yet-tagged work
- Every tagged release must have a matching section: `## [x.y.z] - YYYY-MM-DD`
- Before pushing a new release tag, move relevant Unreleased entries into the version section
- Use user-facing entries grouped under `Added`, `Changed`, `Fixed`

### Definition of Done (DoD)

A task is done only if:
- Feature behavior matches documented schema/contracts
- Local file read/write behavior is verified
- Relevant tests/checklists are completed
- Docs are updated
- `docs/DEVLOG/YYYY-MM.md` entry is appended
- `CHANGELOG.md` updated for user-visible changes

### Development Workflow

1. Confirm requirement and scope boundaries
2. Update docs/specs first when behavior contracts change
3. Implement minimal vertical slice
4. Validate with tests/checklists
5. Update logs and changelog

## Guardrails

- Prefer pragmatic parsers for known note schema over generic Markdown AST pipelines
- Avoid introducing dependencies without clear MVP value
- External file edits are polled and pulled into UI only when there are no unsaved local edits

## Session Best Practices

### Commit Messages & Documentation
- Always use **English** for commit messages, code comments, release notes, and documentation
- Avoid adding Co-Authored-By trailers unless explicitly required

### Release Process
- Check existing skills before using them (e.g., `dailytrack-release` may not exist in all repos)
- When creating releases via GitHub CLI, use `--title` instead of `--name` for the release title
- Verify commit messages are English before pushing tags
- After amending commits, force push is needed: `git push --force origin <branch>`

### Code Comments
- All comments in code must be in English
- This includes Rust `//` comments, TypeScript `//` or `/* */` comments, etc.

## Repository Structure

```
src/              # Frontend app code
src-tauri/       # Desktop runtime (Rust)
docs/             # Architecture, specs, QA, release docs
docs/DEVLOG/     # Day-by-day engineering logs
docs/ADR/        # Key architecture decisions
skills/           # Repo-versioned Codex skills and automation runbooks
```
