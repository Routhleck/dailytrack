# Product Roadmap (2026 Refresh)

This roadmap replaces the old placeholder milestones and reflects current product maturity after `v0.8.1`.
Scope stays practical for solo iteration: one theme per milestone, 3-5 outcomes max.

## Product Direction

- Keep `dailytrack` local-first and markdown-first.
- Prioritize "daily use feel" over feature count.
- Improve trust and clarity: users should always know data status, save status, and sync status.
- Build toward a long-term loop: `record -> trend -> review -> adjust`.

## Milestones

## v0.8.2 - Mobile Polish and Readability

Goal: fix mobile friction found in recent testing and improve baseline readability.

- Ship mobile-specific tutorial flow and overlay positioning fixes.
- Add per-profile typography size control (`small / medium / large`).
- Validate Android safe-area + bottom navigation interactions (tutorial, keyboard, tab overlays).
- Update docs for the new mobile navigation model (`Dashboard / Record / History / More`).
- Defer full screenshot refresh to the pre-`v1.0` release polish pass.

## v0.9.0 - UX Foundation Upgrade

Goal: make core pages easier to understand at a glance.

- Strengthen Dashboard summary cards (completion rate, key status, quick next action).
- Add first-run/empty-state guidance for Dashboard, Body, and Sync.
- Add unified operation feedback (save/sync/import/export toast messages).
- Split Sync view into:
  - user summary (health, last sync, action needed)
  - advanced diagnostics (collapsed by default).

## v0.10.0 - Daily and History Efficiency

Goal: reduce interaction cost on high-frequency workflows.

- Daily page:
  - row-click checklist toggle
  - clearer progress status ("remaining N items")
  - stronger autosave feedback.
- History pages:
  - search + filter upgrades
  - completion-rate badges
  - quicker open/preview flow.
- Preserve markdown/source-of-truth compatibility with all new structured interactions.

## v0.11.0 - Body Analytics Upgrade

Goal: make body tracking more useful for trend decisions.

- Chart range switch (`7d / 30d / 90d / all`).
- "Compared to previous record" delta chips.
- Optional goal line for selected metrics.
- Faster single-field entry path for mobile (enter one metric, submit immediately).

## v0.12.0 - Templates and Goals

Goal: support longer-term personalization without overengineering.

- Better task-template customization (category, ordering, required/optional semantics).
- Improve profile template management UX (diff clarity, safer apply flow).
- Add lightweight weekly goals and progress indicators.
- Keep raw markdown fallback first-class.

## v1.0.0 - Reliability and Trust

Goal: make dailytrack robust enough for long-term primary use.

- Recovery guardrails:
  - safer delete flows
  - recycle-bin/undo strategy for destructive actions.
- Version/snapshot visibility for local changes and sync conflict recovery.
- Release quality hardening:
  - repeatable QA gates for desktop + Android
  - clearer troubleshooting paths in docs.
- Distribution maturity:
  - signed stable channel strategy
  - explicit unsigned testing channel policy.

## Prioritized TODO Backlog

## P0 (Next 2-3 Releases)

- Mobile tutorial alignment and responsive overlay fixes.
- Typography scale setting in Preferences.
- Dashboard summary contrast and information hierarchy pass.
- Empty-state cards with direct CTA actions.
- Sync "simple summary first, advanced details second" layout.

## P1 (After P0 Stabilizes)

- Daily row click-toggle and progress nudges.
- History search/filter/completion metadata.
- Body chart range switch + delta chips.
- Better success/error toast coverage for all write/sync operations.

## P2 (Strategic Enhancements)

- Template customization depth (categories/weights/rules).
- Weekly goal system and monthly review helper.
- Advanced trend correlation hints.
- Export polish (time-range exports, report packaging).

## Not in Scope (for now)

- SaaS backend, multi-user collaboration, auth system.
- Replacing markdown/csv source-of-truth with app-only storage.
- Generic plugin marketplace architecture.
