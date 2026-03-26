# Product Roadmap (Detailed Execution Plan)

Last updated: 2026-03-25  
Baseline: after `v0.14.0` release; post-v1.0 milestones added from full codebase review.

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

## 5) Code Quality and Reliability

Target:

- split Rust backend monolith (`lib.rs` + `webdav.rs`) into feature modules
- add Rust `#[cfg(test)]` coverage for path validation, file helpers, and profile logic
- add React `ErrorBoundary` for graceful crash recovery
- add at least one E2E smoke test (open → create note → verify file)
- move blocking HTTP calls (`generate_llm_report`) to async
- increase frontend test coverage beyond parsing (component + integration)

## Milestones

## v0.8.2 - Mobile Polish and Readability

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
- Done: Android interaction QA pass.
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

## v0.10.0 - Daily and History Efficiency

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

Progress snapshot:

- Done: chart range controls (`7d / 30d / 90d / all`).
- Done: delta badges vs previous record for enabled metrics (unit/decimal aware).
- Done: optional goal line (per metric, preference-driven).
- Done: post-submit highlight summary (chart point + history row + delta feedback).

## v0.12.0 - Templates and Goal Loop

Goal: support personalization while keeping model simple.

Outcomes:

- Deeper template customization (category/order/required semantics).
- Safer template apply UX with clearer diff and impact copy.
- Lightweight weekly goals and progress indicators.
- Better profile-level template management for different life contexts.

Acceptance focus:

- Template customization stays readable and markdown-compatible.

Progress snapshot:

- Done: safer template apply UX with clearer impact preview copy.
- Done: overwrite-mode explicit risk acknowledgment before apply.
- Done: weekly lightweight goals and progress indicators.
- Done: structured template editor now supports checklist item reordering (`move up / move down`) for both create-profile and current-profile template flows.
- Done: daily template required semantics via section switching (`Daily Core` <-> `Optional`).
- Done: weekly template category semantics via per-item section reassignment.
- Done: personalization baseline shipped (required/category/order semantics + safer apply loop).
- Deferred: richer rule-engine style template semantics moved to `v0.13+` to keep current model readable and markdown-compatible.

## v0.13.0 - Insights and Review

Goal: convert records into actionable review signals.

Outcomes:

- Dashboard streak and trend comparisons (today/week vs previous period).
- Weakest-area hints (lowest completion sections).
- Better weekly/monthly report outputs (structured + export friendly).
- Optional “next best action” recommendations (rule-based, local-first).

Acceptance focus:

- Dashboard/report provides guidance, not only raw data.

Progress snapshot:

- Done: Dashboard period-over-period comparison baseline (`today` and `this week` vs previous tracked period).
- Done: Dashboard streak signals (daily + weekly consecutive completion).
- Done: Dashboard weakest-area guidance + local rule-based next-best-action card.
- Done: report markdown now includes deterministic `Structured Snapshot` section for export-friendly review output.
- Done: report markdown now includes local rule-based `Local Recommendations` section plus snapshot/recommendation unit-test coverage.
- Done: report structured snapshot now includes previous-period comparison deltas and follows current UI language (`en/zh`) for exported review readability.
- Done: report generation now writes companion structured JSON (`schemaVersion=1`) for export-friendly downstream processing.

## v0.14.0 - Retention and Routine Support

Goal: increase long-term consistency for personal use.

Outcomes:

- Reminder strategy (daily/weekly/body gaps, configurable).
- Calendar/heatmap visibility for completion streak.
- Lightweight mood/energy tags for richer reflection context.
- More robust search/filter entry points across note history.

Acceptance focus:

- User can maintain routine with less memory burden.

Progress snapshot:

- Done: configurable reminder strategy shipped in Preferences (`daily/weekly/body` inactivity thresholds with dashboard reminders).
- Done: dashboard now includes a 28-day daily-completion heatmap for quick streak visibility.
- Done: history pages now include calendar-style navigation (`Daily` monthly calendar + `Weekly` yearly week grid).
- Done: daily notes now support lightweight `Mood & Energy` tags in structured mode and markdown schema.
- Done: history lists now support stronger combined filtering (keyword + status + recency + detail signals).

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

Progress snapshot:

- Done: profile soft-delete flow now moves deleted profiles to `<data-root>/.trash/<profile>-<timestamp>`.
- Done: profile delete now supports in-session undo restore from trash.
- Done: startup trash auto-purge removes entries older than 7 days.
- Done: Sync destructive conflict actions now use in-app confirmation modal (replaces browser confirm).
- Done: added `docs/DISTRIBUTION_POLICY.md` and `docs/TROUBLESHOOTING.md` as v1.0 operator docs.
- Done: upgraded QA and release checklists with v1.0 reliability guardrail checks.
- In progress: README/user-facing presentation refresh and screenshot refresh for final `v1.0.0` release assets.
- In progress: GitHub Pages bilingual landing page rollout and release-homepage alignment.

## v1.1.0 - Search and Navigation Power

Goal: make retrieval and navigation fast for power users.

Outcomes:

- Full-text search across all daily/weekly notes (in-memory index over markdown files).
- Keyboard shortcuts for high-frequency navigation (`Ctrl+T` today, `Ctrl+W` this week, `Ctrl+/` search).
- Year-view daily completion heatmap (extend 28-day heatmap to full GitHub-style year grid).
- Quick-open command palette for jumping to any note by date or keyword.

Acceptance focus:

- User can find any past note within seconds without manual browsing.

## v1.2.0 - Data Safety and History

Goal: eliminate data-loss anxiety with local recovery options.

Outcomes:

- Per-file save history (keep last N snapshots on each write, stored under `.<filename>.history/`).
- Simple undo buffer for structured editing (last 3 states in memory).
- System tray quick-capture (one-click body log or toggle today's first unchecked item, desktop only).
- CLI companion for terminal users (`dailytrack log --weight 72.5`, `dailytrack today --check "Train"`).

Acceptance focus:

- Accidental edits can always be recovered without WebDAV or manual backups.

## v1.3.0 - Analytics and Insights

Goal: turn accumulated data into actionable personal insights.

Outcomes:

- Per-item recurring goal tracking ("Exercise 4x/week" with automatic counting from checklist completions).
- Cross-signal correlation hints (e.g. "productivity highest on exercise days") from local completion + body + mood data.
- PDF/HTML export for weekly/monthly reports (render existing LLM + structured snapshots).
- Photo/file attachments linked from daily notes (stored in `daily/attachments/`).

Acceptance focus:

- User gets periodic insights without needing to manually cross-reference notes.

## v2.0.0 - Extensibility and Custom Tracking

Goal: support tracking beyond the built-in daily/weekly/body dimensions.

Outcomes:

- User-defined custom tracker sections (arbitrary tracking dimensions as new file types under profile).
- Calendar integration (iCal export of completion data, optional calendar event import).
- Natural language quick-entry parsing ("worked out, ate well, 72kg" → structured fields).
- Community template sharing (import/export template packs as portable bundles).

Acceptance focus:

- Power users can extend the tracker to fit personal workflows without forking the app.

## Prioritized Backlog (Rolling)

## P0 (Now -> Next 2 releases)

- Startup/resume smoothness hardening:
  - keep first paint and first interaction unblocked
  - move sync/update/background checks off the critical interaction path
  - reduce main-thread work during app resume (desktop + Android).
- Dashboard streak/trend comparisons (today/week vs previous period).
- Weakest-area guidance and next-action hints.
- Weekly/monthly report output quality (structured + export-friendly markdown).
- Sync reliability polish for mobile background/foreground resume.
- Android import/export onboarding polish (zip-first flow copy + diagnostics clarity).

P0 progress snapshot:

- Done: startup background task deferral (route preload + updater delayed checks).
- Done: visibility-aware refresh and reload coalescing for dashboard/list/note polling.
- Done: deferred non-critical bridge/overlay mounting (filesystem watch, webdav bridge, tutorial, mobile sync banner).
- Done: lightweight runtime performance telemetry + diagnostics export baseline.
- In progress: targeted Android resume black-screen elimination and first-input latency hardening.

## P1 (After P0)

- Reminder strategy and schedule controls (daily/weekly/body inactivity).
- Calendar/heatmap visibility for completion streak.
- History search/filter expansion (keywords + tags + completion combined filters).
- Lightweight mood/energy tags and weekly review integration.

## P2 (Strategic)

- Template categories/weights/rules.
- Weekly goal system + monthly review helper.
- Advanced trend correlation hints.
- Export/report packaging improvements.
- Full-text note search with in-memory index.
- Per-file save history for local recovery.
- Keyboard shortcuts and command palette.
- CLI companion for terminal-based quick entry.
- PDF/HTML report export.
- Year-view completion heatmap.
- Per-item recurring goal tracking.
- Photo/file attachments for daily notes.
- Cross-signal correlation insights.
- Custom user-defined tracker sections.
- Calendar integration (iCal export).
- Natural language quick-entry parsing.

## Non-Goals (Unchanged)

- SaaS backend, auth system, multi-user collaboration.
- Replacing markdown/csv source-of-truth with app-only storage.
- Generic plugin marketplace architecture.
