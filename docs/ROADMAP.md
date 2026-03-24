# Product Roadmap (Detailed Execution Plan)

Last updated: 2026-03-24  
Baseline: after `v0.8.1` release; `v0.8.2` in progress.

This roadmap is intentionally detailed so we can ship in small, traceable batches without scope drift.

## Product North Star

`dailytrack` should feel like:

- local-first and trustworthy
- fast for daily use
- clear at a glance
- powerful without becoming complex

Core loop:

`record -> trend -> review -> adjust`

## Planning Principles

- Markdown/CSV remains the only source of truth.
- Each milestone has one primary theme.
- Each milestone ships 3-5 user-visible outcomes max.
- Every milestone includes validation and docs updates.
- Screenshot refresh is deferred until pre-`v1.0.0` polish.

## Workstreams (Long-Term)

## 1) UI Visual Clarity

Target:

- stronger information contrast
- clearer card hierarchy
- better density options for large screens
- consistent component/semantic color language

## 2) UX Interaction Efficiency

Target:

- faster “Today” completion flow
- clearer structured/raw mode affordances
- better “Only show changes” feedback
- smoother list/search/open actions

## 3) User Trust and Friendliness

Target:

- first-run guidance and stronger empty states
- unified operation feedback (save/sync/import/export)
- safer destructive actions and recovery paths
- clearer sync status language for non-technical users

## 4) Product Depth

Target:

- richer dashboard insights
- better body trend analytics
- stronger template and goal customization
- long-term review/report and retention features

## Milestones

## v0.8.2 - Mobile Polish and Readability (In Progress)

Goal: remove mobile friction and improve baseline readability.

Outcomes:

- Mobile-specific tutorial steps and responsive overlay placement.
- Profile-level typography scale (`small / medium / large`).
- Keyboard-safe bottom navigation and sheet behavior on mobile.
- Android safe-area behavior validation for nav/tutorial/input states.
- Docs alignment for new mobile IA (`Dashboard / Record / History / More`).

Progress snapshot:

- Done: tutorial mobile alignment.
- Done: typography scale preference.
- Done: keyboard-safe nav/sheet behavior.
- In progress: Android interaction QA pass.
- Done: roadmap/docs wording alignment.

## v0.9.0 - UX Foundation Upgrade

Goal: make core pages easier to understand at first glance.

Outcomes:

- Dashboard cards upgraded with clearer emphasis and action hints.
- First-run/empty-state guidance for Dashboard, Body, and Sync.
- Unified feedback layer for key actions (save/sync/import/export).
- Sync page split into:
  - user-facing summary first
  - advanced diagnostics folded by default.

Acceptance focus:

- New users can understand “what to do next” from empty states.
- Sync page can be understood without reading raw diagnostics.

## v0.10.0 - Daily and History Efficiency (In Progress)

Goal: reduce interaction cost on high-frequency workflows.

Outcomes:

- Daily checklist row-click toggle and clearer “remaining items” cue.
- Better structured/raw switch guidance (`recommended` vs `advanced` hint).
- “Only show changes” mode gets explicit banner + empty feedback.
- Daily/Weekly history gets search/filter + completion badges.
- Faster open flow from history list to target note.

Acceptance focus:

- Daily flow can be completed with fewer taps/clicks.
- History is useful for retrieval, not only indexing.

Progress snapshot:

- Done: Daily checklist row-click toggle and remaining-item cue.
- Done: structured/raw mode guidance (`recommended` vs `advanced` hint).
- Done: explicit “only show changes” hints and no-change feedback on structured note pages.
- Done: Daily/Weekly history search + completion status filter + completion badges + first-match quick open.

## v0.11.0 - Body Analytics Upgrade

Goal: make body tracking more decision-useful.

Outcomes:

- Chart ranges: `7d / 30d / 90d / all`.
- Delta chips vs previous record for enabled metrics.
- Optional goal line for selected metrics.
- Faster single-field entry on mobile.
- Better post-submit feedback (new point highlight + change summary).

Acceptance focus:

- User can quickly tell trend direction and recent change.

## v0.12.0 - Templates and Goal Loop

Goal: support personalization while keeping model simple.

Outcomes:

- Deeper template customization (category/order/required semantics).
- Safer template apply UX with clearer diff and impact copy.
- Lightweight weekly goals and progress indicators.
- Better profile-level template management for different life contexts.

Acceptance focus:

- Template customization stays readable and markdown-compatible.

## v0.13.0 - Insights and Review

Goal: convert records into actionable review signals.

Outcomes:

- Dashboard streak and trend comparisons (today/week vs previous period).
- Weakest-area hints (lowest completion sections).
- Better weekly/monthly report outputs (structured + export friendly).
- Optional “next best action” recommendations (rule-based, local-first).

Acceptance focus:

- Dashboard/report provides guidance, not only raw data.

## v0.14.0 - Retention and Routine Support

Goal: increase long-term consistency for personal use.

Outcomes:

- Reminder strategy (daily/weekly/body gaps, configurable).
- Calendar/heatmap visibility for completion streak.
- Lightweight mood/energy tags for richer reflection context.
- More robust search/filter entry points across note history.

Acceptance focus:

- User can maintain routine with less memory burden.

## v1.0.0 - Reliability and Trust

Goal: make `dailytrack` safe enough for long-term primary use.

Outcomes:

- Recovery guardrails (safer delete flow + undo/recycle strategy).
- Version/snapshot visibility for conflict recovery.
- Strong release quality gates for desktop + Android.
- Clear troubleshooting docs and operator playbooks.
- Distribution policy clarity:
  - signed stable channel
  - unsigned testing channel expectations.

Acceptance focus:

- Data-loss anxiety is minimized with clear recovery paths.

## Prioritized Backlog (Rolling)

## P0 (Now -> Next 2 releases)

- Android safe-area + keyboard regression QA closure.
- Sync summary-first layout + diagnostics fold.
- Feedback toasts for core write/sync operations.
- Daily row-click toggle + progress nudge.
- Empty-state CTA coverage for Body and Sync.

## P1 (After P0)

- History search/filter/completion metadata.
- Body chart range + delta chips + goal line.
- Structured/raw mode guidance polish.
- “Only show changes” explanatory banners.

## P2 (Strategic)

- Template categories/weights/rules.
- Weekly goal system + monthly review helper.
- Advanced trend correlation hints.
- Export/report packaging improvements.

## Non-Goals (Unchanged)

- SaaS backend, auth system, multi-user collaboration.
- Replacing markdown/csv source-of-truth with app-only storage.
- Generic plugin marketplace architecture.
