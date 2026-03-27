# Distribution Policy

## Purpose

This document defines how `dailytrack` binaries are distributed and what trust expectations users should have for each release channel.

## Release Channels

### Stable channel (signed)

- Goal: highest-trust install path for long-term users.
- macOS: signed + notarized app bundles.
- Windows: Authenticode-signed installers.
- Linux: signed repository packages (future target).
- Updater metadata/signatures are published with each stable release.

### Testing channel (unsigned)

- Purpose: fast validation builds before full signing/notarization is available.
- macOS/Windows installers may show OS trust warnings on first launch.
- Linux builds are published as unsigned AppImage/DEB artifacts for manual validation.
- Users should verify release origin from the official GitHub repo and release page.

### Current status

- Current public builds are distributed under the **testing channel** policy.
- Stable signed channel remains the target policy and will become default once signing identities/certificates are fully provisioned.

## Platform Installation Expectations

### macOS (testing channel)

Artifacts:

- `dailytrack_*_aarch64.dmg` (Apple Silicon)
- `dailytrack_*_x64.dmg` (Intel)

Expected behavior:

- Gatekeeper may block first launch because build is unsigned.

Recommended workaround (preferred):

1. Install `dailytrack.app` into `/Applications`.
2. Open the app once (it will be blocked).
3. Open **System Settings -> Privacy & Security**.
4. Find the block message for `dailytrack` and click **Open Anyway**.
5. Confirm to launch.

Terminal fallback:

```bash
xattr -dr com.apple.quarantine /Applications/dailytrack.app
```

### Windows (testing channel)

Artifacts:

- `dailytrack_*_x64_en-US.msi`
- `dailytrack_*_x64-setup.exe`

Expected behavior:

- SmartScreen warning may appear for unsigned installers.

User action:

- Click **More info -> Run anyway** after verifying installer source from the official release page.

### Android APK sideload

Artifacts (depending on workflow/run mode):

- `dailytrack_*_aarch64.apk`
- `dailytrack_*_x86_64.apk`

Install flow:

1. Download/copy the APK to the device.
2. Open APK and allow installs from unknown sources for your file manager/browser.
3. Continue install (Play Protect may show a warning for non-Play-distributed builds).
4. Launch app and verify data root bootstrap completes.

### Linux (testing channel)

Artifacts:

- `dailytrack_*_amd64.AppImage`
- `dailytrack_*_amd64.deb`

Expected behavior:

- AppImage may require executable permission (`chmod +x`) before launch.
- DEB install may require manual dependency fixups on older distributions.

User action:

1. Download from the official GitHub Releases page.
2. For AppImage: run `chmod +x <artifact>.AppImage` then launch.
3. For DEB: install with `sudo apt install ./<artifact>.deb`.

## In-App Updater Policy

- In-app updater requires updater metadata/signatures (`latest.json` + `.sig`) produced by CI.
- Required CI secrets include:
  - `DAILYTRACK_UPDATER_PUBKEY`
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional)
- If updater signing secrets are missing, release artifacts can still be published; updater is expected to report "not configured".

## Maintainer Checklist Requirements

Before publishing a release:

- Confirm whether this release is `stable` (signed) or `testing` (unsigned).
- Verify release notes clearly state channel expectations.
- Ensure `docs/TROUBLESHOOTING.md` includes current install/recovery guidance.
- Keep `docs/RELEASE_CHECKLIST.md` aligned with this policy.
