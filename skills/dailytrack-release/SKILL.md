---
name: dailytrack-release
description: Prepare, validate, and publish releases for the dailytrack repository. Use when handling version bumps, changelog/devlog updates, GitHub tag releases, release-note writing, CI artifact verification (Windows/macOS), updater readiness checks, and post-release summary edits.
---

# Dailytrack Release

## Overview
Use this skill to run the end-to-end release workflow for `dailytrack` with consistent quality gates and readable GitHub release notes.

## Runbook
1. Confirm release scope.
2. Collect release context.
3. Run quality gates.
4. Update release docs (including versioned changelog section).
5. Create tag and push.
6. Monitor publish workflow.
7. Verify artifacts and updater metadata.
8. Edit release notes to human-readable format.

Read [references/runbook.md](references/runbook.md) before executing the workflow.

## Generate Release Notes Draft
Use the helper script to generate a clean draft from commits between two tags:

```bash
skills/dailytrack-release/scripts/make_release_notes.sh <from_tag> <to_tag>
```

Example:

```bash
skills/dailytrack-release/scripts/make_release_notes.sh v0.2.0 v0.2.1 > /tmp/dailytrack-v0.2.1-notes.md
```

Then edit the draft for clarity and publish it:

```bash
gh release edit v0.2.1 --notes-file /tmp/dailytrack-v0.2.1-notes.md
```

## Release Checks
Use [references/checks.md](references/checks.md) for release-specific verification commands, including:
- workflow run tracking
- artifact list validation
- unsigned macOS helper verification
- updater metadata presence checks

## Changelog Requirement
- Keep `## [Unreleased]` for pending work only.
- For each release tag `vX.Y.Z`, create/update `## [X.Y.Z] - YYYY-MM-DD` in `CHANGELOG.md`.
- Move relevant `Unreleased` bullets into that version section before tagging.
