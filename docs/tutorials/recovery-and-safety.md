# Recovery and Safety Guardrails

## Profile Delete Safety

- Profile deletion is soft-delete, not immediate hard-delete.
- Deleted profiles move to:

`<data-root>/.trash/<profile>-<timestamp>/`

- In-session undo restore is supported.

## Trash Auto Cleanup

- Old trash entries are purged automatically on startup.
- Current retention window: 7 days.

## Destructive Sync Actions

- Conflict operations use in-app confirmation modal.
- Confirm dry-run impact before applying remote or batch actions.

## Recommended Backup Habit

1. Weekly local export zip.
2. Optional WebDAV snapshot pushes.
3. Keep at least one external backup copy.

## If Something Looks Wrong

- Check `docs/TROUBLESHOOTING.md` first.
- Verify active data root in Settings.
- Avoid repeated writes until root cause is clear.
