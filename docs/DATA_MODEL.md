# Data Model

## Type Contracts (MVP)

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
  note: string;
};

export type Settings = {
  dataRoot: string;
};
```

## Naming and File Contracts
- Daily: `daily/YYYY-MM-DD.md`
- Weekly: `weekly/YYYY-Www.md`
- Body: `body.csv`
- Templates: `templates/daily.md`, `templates/weekly.md`

## Editing Modes
- Structured mode: edits typed fields, then serializes to Markdown/CSV.
- Raw mode: edits raw file text directly.
- Save behavior (MVP): explicit save button only.

## Source of Truth Rule
- Final persisted state always lives in local files.
- In-memory state is transient and reconstructable from files.
