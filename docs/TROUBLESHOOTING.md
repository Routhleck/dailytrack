# Troubleshooting

This playbook covers common `dailytrack` runtime/install problems and the fastest recovery steps.

## 1) macOS app blocked by security warning

Symptoms:

- "cannot be opened because it is from an unidentified developer"
- launch is blocked on first open

Why it happens:

- testing-channel macOS builds are currently unsigned

Fix:

1. Move app to `/Applications`.
2. Try opening once (expect block).
3. Open **System Settings -> Privacy & Security**.
4. Click **Open Anyway** for `dailytrack`.
5. Retry app launch.

Terminal fallback:

```bash
xattr -dr com.apple.quarantine /Applications/dailytrack.app
```

## 2) Data root not found / app opens with empty state unexpectedly

Symptoms:

- app starts onboarding unexpectedly
- existing notes are not visible
- errors mention missing `profiles/default` or missing tracker files

Checks:

1. Open **Settings -> Data Root** and verify base path.
2. Confirm expected layout exists:

```text
<base-root>/profiles/<profile>/{daily,weekly,templates,body.csv}
```

3. If path is wrong, switch to correct base root via Settings (desktop) or import bundle on Android.
4. If path is correct but files are missing, restore from export zip/WebDAV snapshot.

## 3) WebDAV connection failures

Symptoms:

- `Test Connection` fails
- push/pull returns auth/network errors

Checks:

1. Verify WebDAV URL begins with `http://` or `https://`.
2. Re-enter username/password (common cause: stale credentials).
3. Confirm server path is writable and not read-only.
4. Confirm network/VPN/firewall allows WebDAV endpoint.
5. Retry with **Test Connection** before push/pull.

If conflicts keep growing:

- open **Sync** page
- review unresolved conflicts
- resolve with `Keep Local` / `Apply Remote` / `Mark Resolved`

## 4) Updater check failures (issue #1 context)

Symptoms:

- `Check updates` fails or reports updater unavailable

Common causes:

- running on mobile build (desktop-only updater support)
- updater secrets were not configured when release was built
- transient network failure to release metadata endpoint

Checks:

1. In **Settings -> App Updates**, verify:
   - `Updater supported on this platform` is `Yes`
   - `Auto-update configured` is `Yes`
2. If configured is `No`, this build is expected to show "not configured".
3. Retry on stable network.
4. If still failing, install manually from latest GitHub release assets.

## 5) Android import path / file access issues

Symptoms:

- import fails after selecting folder
- file picker returns unexpected location

Notes:

- Android uses SAF/file-picker constraints; folder picking may differ by ROM/vendor.
- Import is `.zip`-first on Android and is the recommended path.

Fix:

1. Export data as zip from source device/desktop.
2. Move zip to local device storage.
3. Use Android import flow to pick the zip file directly.
4. Reopen app and verify notes under active profile.

## 6) Template apply failures

Symptoms:

- applying template/preset fails
- today/week note does not reflect expected template content

Checks:

1. Ensure active profile exists and is writable.
2. Retry apply from **Profiles** page.
3. Confirm template files exist:
   - `profiles/<profile>/templates/daily.md`
   - `profiles/<profile>/templates/weekly.md`
4. If template markdown was heavily edited manually, try raw mode cleanup and re-apply.

Recovery:

- If profile was deleted by mistake, restore from profile trash undo (same session) or from `.trash/` entry if still available.

## Escalation Data to Capture

When reporting bugs, include:

- app version + platform
- whether build is stable or testing channel
- exact error message from UI
- related local paths (without sensitive credentials)
- steps to reproduce
- whether issue reproduces after restart

Related docs:

- `docs/DISTRIBUTION_POLICY.md`
- `docs/FS_STORAGE.md`
- `docs/QA_CHECKLIST.md`
- `docs/RELEASE_CHECKLIST.md`
