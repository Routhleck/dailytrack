# Data Model

## Type Contracts (MVP+)

```ts
export type CheckboxItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type DailyNote = {
  kind: "daily";
  date: string; // YYYY-MM-DD
  title: string;
  dailyCore: CheckboxItem[];
  optional: CheckboxItem[];
  oneLine: string;
  raw: string;
};

export type WeeklyReflection = {
  goodThings: string[];      // normalized length: 3
  nextWeekTop3: string[];    // normalized length: 3
};

export type WeeklySectionKey =
  | "Body"
  | "Research"
  | "Life"
  | "Output"
  | "Social";

export type WeeklyNote = {
  kind: "weekly";
  weekId: string; // YYYY-Www
  title: string;
  sections: Record<WeeklySectionKey, CheckboxItem[]>;
  reflection: WeeklyReflection;
  raw: string;
};

export type BodyRecord = {
  date: string; // YYYY-MM-DD
  weight: number | null;
  waist: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  chest: number | null;
  hip: number | null;
  note: string;
};

export type TrackerPreferences = {
  daily: {
    showOptional: boolean;
  };
  weekly: {
    sections: Record<WeeklySectionKey, boolean>;
  };
  body: {
    weight: boolean;
    waist: boolean;
    bodyFat: boolean;
    muscleMass: boolean;
    chest: boolean;
    hip: boolean;
    note: boolean;
    display: Record<
      "weight" | "waist" | "bodyFat" | "muscleMass" | "chest" | "hip",
      {
        unit: string;
        decimals: number; // 0-3
      }
    >;
  };
};

export type TemplateMeta = {
  schemaVersion: number; // current: 1
  presetId: string;
  templateLanguage: "en" | "zh";
  lastAppliedAt: string; // ISO timestamp
  lastAppliedMode: "merge" | "overwrite";
};
```

## Storage Contracts
Base root:
- `~/dailytrack-data` (default)

Per profile:
- `profiles/<profile>/daily/YYYY-MM-DD.md`
- `profiles/<profile>/weekly/YYYY-Www.md`
- `profiles/<profile>/body.csv`
- `profiles/<profile>/templates/daily.md`
- `profiles/<profile>/templates/weekly.md`
- `profiles/<profile>/templates/template-meta.json`
- `profiles/<profile>/preferences.json`

## Editing Modes
- Structured mode: edits typed fields, then serializes to Markdown/CSV.
- Raw mode: edits raw file text directly.
- Save behavior:
  - Daily/Weekly: debounced autosave.
  - Body: save on submit/delete.

## Profile Semantics
- App supports create/switch/delete profile.
- Active profile is persisted in localStorage.
- Deleting active profile is blocked in UI (switch first).
- UI language preference is persisted in localStorage (`dailytrack.uiLanguage`).
- First-run tutorial state is persisted in local/session storage:
  - pending: `dailytrack.tour.pending.v1`
  - completed: `dailytrack.tour.completed.v1`
  - session dismiss: `dailytrack.tour.dismissed.session.v1`

## Source of Truth Rule
- Final persisted state always lives in local files.
- In-memory state is transient and reconstructable from files.
