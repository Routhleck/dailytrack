# Release Verification Checks

## Workflow Status
```bash
gh run list --workflow publish.yml --limit 10
```

## Inspect One Run
```bash
gh run view <run_id>
gh run view <run_id> --log | rg -n "Inject unsigned macOS helper|Re-upload patched unsigned macOS DMG|error|failed"
```

## List Release Assets
```bash
gh release view <tag> --json assets,url | jq
```

## Validate Unsigned macOS Helper Injection
Expected in successful macOS unsigned jobs:
- Step `Inject unsigned macOS helper into DMG` succeeded.
- Step `Re-upload patched unsigned macOS DMG` succeeded.

## Validate Updater Metadata
If updater secrets are configured, release assets should include `latest.json` and signature files.
