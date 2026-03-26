# WebDAV Sync Setup and Conflict Handling

## Setup

1. Open Settings -> WebDAV.
2. Enter URL, username, password.
3. Click `Test Connection` first.

## Snapshot Sync

- `Push Now`: upload local snapshot.
- `Pull Latest`: download latest remote snapshot.
- `Pull Selected`: restore from chosen snapshot.

## Realtime Sync

Use Sync page actions:

- `Sync Both`
- `Push Only`
- `Pull Only`

## Conflict Handling

If conflicts appear:

1. Inspect local/remote previews.
2. Resolve with:
   - `Keep Local`
   - `Apply Remote`
   - `Mark Resolved`
3. Prefer explicit dry-run review before batch operations.
