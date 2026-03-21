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
- [ ] Legacy 4-column `body.csv` (`date,weight,waist,note`) is parsed without data loss.
- [ ] Expanded body columns (`bodyFat,muscleMass,chest,hip`) roundtrip correctly.
- [ ] Body metric toggles in Preferences correctly control form/table/chart visibility.
- [ ] Body metric unit/decimals settings apply to table/dashboard/chart labels and values.

## UI Workflows
- [ ] Structured mode toggle/check/edit works.
- [ ] Raw mode edit/save works.
- [ ] Daily/Weekly pages autosave without manual save button.
- [ ] Save writes to local file and reloads state.
- [ ] Dashboard summary matches detail pages.
- [ ] UI language toggle (`EN` / `中文`) switches core page copy and persists after restart.
- [ ] Profiles page supports template language switch for preset preview/fill.
- [ ] After first-launch template setup completes, 5-step sidebar tutorial auto-opens once.
- [ ] Skipping auto tutorial closes it and prevents repeated automatic prompts.
- [ ] `Settings -> Start Tutorial` can replay the tutorial on demand.

## Regression Safety
- [ ] Migration-based root switch updates all views correctly.
- [ ] `Migrate Data Root` copies data and switches to destination root.
- [ ] Migration rejects same-path or nested source/destination roots.
- [ ] Export/import/migration success messages include copy summary counters.
- [ ] `Reset Data` requires explicit `RESET` confirmation.
- [ ] `Reset Data` clears app-managed tracker files and re-enters first-run template setup.
- [ ] Existing user files remain readable after app restart.
- [ ] Legacy root layout migrates into `profiles/default` on first profile bootstrap.
- [ ] Empty new root triggers first-launch template setup modal.
- [ ] Selecting preset/blank in first-launch modal writes `templates/daily.md` and `templates/weekly.md`.

## In-App Updater
- [ ] Settings shows updater configured status and current app version.
- [ ] Manual check shows either latest-version message or available-update state.
- [ ] Available update can be installed via install-and-restart action.
- [ ] Auto-check preference persists across app restarts.
- [ ] If updater secrets are missing in CI, release still succeeds without updater artifacts.

## Sync Mode
- [ ] `Preferences -> Live Sync -> Watch` pushes external file edits into UI without waiting for poll interval.
- [ ] `Preferences -> Live Sync -> Poll` disables watcher path and still refreshes via polling.

## WebDAV Sync
- [ ] Save WebDAV config succeeds and persists after app restart.
- [ ] `Test Connection` succeeds with valid URL/credentials and fails with clear error on invalid credentials.
- [ ] `Push Now` uploads a new snapshot and appears in snapshot list.
- [ ] `Pull Latest` restores data correctly and refreshes UI state.
- [ ] `Pull Selected` restores the selected snapshot.
- [ ] Pull with backup enabled creates `dailytrack-webdav-backup-<timestamp>` in parent directory.
- [ ] Auto-push interval triggers background push when enabled.
- [ ] Snapshot deletion removes selected snapshot from remote meta/list.

## WebDAV Realtime Sync
- [ ] Sync page can load realtime status (`pendingChanges`, `conflicts`, `lastPush`, `lastPull`).
- [ ] `Sync Both` applies bidirectional updates and refreshes other pages.
- [ ] `Push Only` uploads local-only changes without pulling remote-only changes.
- [ ] `Pull Only` downloads remote-only changes without pushing local-only changes.
- [ ] Conflict case generates unresolved entry and conflict copy file under `conflicts/`.
- [ ] Conflict resolve actions (`Keep Local`, `Apply Remote`, `Mark Resolved`) update conflict list and data files correctly.
- [ ] Background realtime bridge sync does not block editing and emits refresh events on updates.
