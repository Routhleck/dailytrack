# Preferences Schema

## File Location

- Per profile: `profiles/<profile>/preferences.json`

## Versioning

- Current schema version: `3`
- Field: `schemaVersion` (number)
- Rule: app normalizes missing/invalid fields to defaults on load and writes normalized JSON back to disk.

## Schema (v3)

```json
{
  "schemaVersion": 3,
  "sync": {
    "mode": "watch"
  },
  "ui": {
    "showOnlyChanges": {
      "daily": false,
      "weekly": false,
      "body": false
    },
    "mobile": {
      "showSyncBanner": true
    }
  },
  "daily": {
    "showOptional": true
  },
  "weekly": {
    "sections": {
      "Body": true,
      "Research": true,
      "Life": true,
      "Output": true,
      "Social": true
    }
  },
  "body": {
    "weight": true,
    "waist": true,
    "bodyFat": false,
    "muscleMass": false,
    "chest": false,
    "hip": false,
    "note": true,
    "display": {
      "weight": { "unit": "kg", "decimals": 1 },
      "waist": { "unit": "cm", "decimals": 1 },
      "bodyFat": { "unit": "%", "decimals": 1 },
      "muscleMass": { "unit": "kg", "decimals": 1 },
      "chest": { "unit": "cm", "decimals": 1 },
      "hip": { "unit": "cm", "decimals": 1 }
    }
  }
}
```

## Field Notes

- `sync.mode`:
  - `watch`: enable Rust filesystem watcher + polling fallback.
  - `poll`: disable watcher and use polling only.
- `ui.showOnlyChanges.*`:
  - controls per-page default filter behavior for structured views.
- `ui.mobile.showSyncBanner`:
  - controls visibility of mobile compact sync status banner.
- `body.display.<metric>.decimals`:
  - normalized range: `0..3`.
- Unknown extra fields:
  - currently ignored during normalization.

## Compatibility

- v1/v2 or partially missing files are accepted.
- App upgrades config in-memory and writes back normalized v3 JSON on next save/load.
