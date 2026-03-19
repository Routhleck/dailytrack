# QA Checklist (MVP)

## Parser and Serialization
- [ ] Daily parser reads title, Daily Core, Optional, One Line.
- [ ] Daily serializer outputs fixed section order.
- [ ] Weekly parser reads five sections and reflection lists.
- [ ] Weekly serializer outputs fixed section and reflection order.
- [ ] Roundtrip parse -> serialize -> parse remains semantically consistent.

## Filesystem Behavior
- [ ] Missing data root directories are auto-created.
- [ ] Missing templates are auto-recreated.
- [ ] Missing `body.csv` is created with header.
- [ ] Today/This Week files auto-created from templates when absent.
- [ ] Profile list/bootstrap works (`profiles/default` auto-created).
- [ ] Profile switching changes active dataset.
- [ ] Profile deletion is blocked when only one profile remains.

## Body CSV
- [ ] Read table data correctly.
- [ ] Add/edit/delete row persists to file.
- [ ] Invalid numeric input handled as null-safe state.
- [ ] Disabled body fields from preferences are hidden but existing file data is preserved.

## UI Workflows
- [ ] Structured mode toggle/check/edit works.
- [ ] Raw mode edit/save works.
- [ ] Save writes to local file and reloads state.
- [ ] Dashboard summary matches detail pages.
- [ ] UI language toggle (`EN` / `中文`) switches core page copy and persists after restart.
- [ ] Profiles page supports template language switch for preset preview/fill.

## Regression Safety
- [ ] Changing data root switches all views correctly.
- [ ] `Save Data Root` only switches root and does not copy previous root data.
- [ ] `Migrate Data Root` copies data and switches to destination root.
- [ ] Migration rejects same-path or nested source/destination roots.
- [ ] Existing user files remain readable after app restart.
- [ ] Legacy root layout migrates into `profiles/default` on first profile bootstrap.
- [ ] Empty new root triggers first-launch template setup modal.
- [ ] Selecting preset/blank in first-launch modal writes `templates/daily.md` and `templates/weekly.md`.
