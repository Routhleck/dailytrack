# Preferences Schema

## File Location

- Per profile: `profiles/<profile>/preferences.json`

## Versioning

- Current schema version: `7`
- Field: `schemaVersion` (number)
- Rule: app normalizes missing/invalid fields to defaults on load and writes normalized JSON back to disk.

## Schema (v7)

```json
{
  "schemaVersion": 7,
  "sync": {
    "mode": "watch"
  },
  "ui": {
    "typographyScale": "md",
    "showOnlyChanges": {
      "daily": false,
      "weekly": false,
      "body": false
    },
    "mobile": {
      "showSyncBanner": true
    },
    "weeklyCalendarView": "month"
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
    },
    "goals": {
      "weight": { "enabled": false, "value": null },
      "waist": { "enabled": false, "value": null },
      "bodyFat": { "enabled": false, "value": null },
      "muscleMass": { "enabled": false, "value": null },
      "chest": { "enabled": false, "value": null },
      "hip": { "enabled": false, "value": null }
    }
  }
}
```

## Field Notes

- `sync.mode`:
  - `watch`: enable Rust filesystem watcher + polling fallback.
  - `poll`: disable watcher and use polling only.
- `ui.typographyScale`:
  - `sm | md | lg`, controls global app text scale.
- `ui.showOnlyChanges.*`:
  - controls per-page default filter behavior for structured views.
- `ui.mobile.showSyncBanner`:
  - controls visibility of mobile compact sync status banner.
- `ui.weeklyCalendarView`:
  - `month | year`, stores Weekly Notes calendar density preference.
- `body.display.<metric>.decimals`:
  - normalized range: `0..3`.
- `body.goals.<metric>`:
  - `enabled`: show or hide goal line on body trend charts.
  - `value`: target numeric value (nullable).
- Unknown extra fields:
  - currently ignored during normalization.

## Compatibility

- v1/v2 or partially missing files are accepted.
- App upgrades config in-memory and writes back normalized v7 JSON on next save/load.
