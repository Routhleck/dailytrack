# Parser Spec (MVP)

## Design Principle
Use a lightweight, schema-aware parser for known note formats.
Do not introduce a heavy generic Markdown AST pipeline for MVP.

## Daily Note Parsing
Target sections:
- `# <title>`
- `## Daily Core`
- `## Optional`
- `## One Line`

Checkbox rule:
- Regex: `^- \[( |x|X)\] (.*)$`
- Checked when marker is `x` or `X`

One Line rule:
- Use first non-empty line after `## One Line`
- If missing, normalize to empty string in state

## Daily Serialization Order
1. `# {title}`
2. blank line
3. `## Daily Core` + checklist
4. blank line
5. `## Optional` + checklist
6. blank line
7. `## One Line`
8. `{oneLine}` (if empty, write `-`)

## Weekly Note Parsing
Target sections:
- `# <title>`
- `## Body`
- `## Research`
- `## Life`
- `## Output`
- `## Social`
- `## Reflection`
  - `### 3 good things this week`
  - `### 3 most important things next week`

Checklist rule:
- Same regex as daily

Reflection numbered rule:
- Regex: `^[1-3]\.\s?(.*)$`
- Normalize both lists to length 3

## Weekly Serialization Order
1. `# {title}`
2. Sections in fixed order: Body, Research, Life, Output, Social
3. `## Reflection`
4. `### 3 good things this week` + numbered list 1..3
5. `### 3 most important things next week` + numbered list 1..3

## Template Variable Substitution
- Daily template supports:
  - `{{date}}` -> current note date (`YYYY-MM-DD`)
- Weekly template supports:
  - `{{week}}` -> current week id (`YYYY-Www`)
- Substitution runs only when auto-creating missing files from templates.
- Raw/structured saves do not perform additional template interpolation.

## Raw/Structured Interaction
- Raw save: write raw text, then parse again.
- Structured save: serialize normalized Markdown, write file, then parse again.

## Error Handling
- If required headings are missing, parser should still return a usable structure with defaults.
- Unknown lines are ignored in MVP structured parsing.
- Advanced freeform preservation is deferred; users can use Raw mode when needed.
