# ADR-0002: Use Normalized Markdown Serialization on Structured Save

- Status: Accepted
- Date: 2026-03-18

## Context
The app provides structured editing on top of Markdown files.
For MVP, preserving every original whitespace and formatting detail increases complexity significantly.

## Decision
When saving from structured mode:
- Parse known schema fields.
- Rebuild file with normalized section order and list formatting.

When saving from raw mode:
- Write raw text directly.
- Re-parse to refresh structured state.

## Consequences
- Pros:
  - Predictable output format and simpler implementation.
  - Faster MVP delivery.
  - Stable parser/serializer contract.
- Cons:
  - Original formatting details may change after structured save.

## Revisit Trigger
Revisit if users need higher formatting fidelity than normalized output can provide.
