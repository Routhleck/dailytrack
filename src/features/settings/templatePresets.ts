export type TemplatePreset = {
  id: string
  label: string
  dailyTemplate: string
  weeklyTemplate: string
}

const balancedDaily = `# {{date}}

## Daily Core
- [ ] Train / move body
- [ ] Eat well / protein target
- [ ] Finish the most important research task
- [ ] Walk outside / get sunlight
- [ ] Record one small win / good moment

## Optional
- [ ] Read / learn something
- [ ] Tidy room / desk
- [ ] Social interaction
- [ ] Capture life note / photo / thought

## One Line
-
`

const balancedWeekly = `# {{week}}

## Body
- [ ] 4-5 strength sessions
- [ ] 2-3 cardio sessions
- [ ] 3 core sessions
- [ ] Record weight / waist / progress photo
- [ ] Eat well >= 5 days

## Research
- [ ] 3 deep work sessions
- [ ] Push one key project forward
- [ ] Plan next week

## Life
- [ ] 1 outdoor activity
- [ ] 1 small life-enhancing activity
- [ ] 1 environment reset / cleanup

## Output
- [ ] Publish 1 piece of content
- [ ] Save 3 ideas / materials

## Social
- [ ] Join 1 social activity / meetup
- [ ] Reach out to 1 friend

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`

const minimalDaily = `# {{date}}

## Daily Core
- [ ] Most important task
- [ ] Body movement
- [ ] One meaningful connection

## Optional
- [ ] Read 20 min

## One Line
-
`

const minimalWeekly = `# {{week}}

## Body
- [ ] Move 4 days

## Research
- [ ] One deep milestone

## Life
- [ ] One reset activity

## Output
- [ ] One publishable output

## Social
- [ ] Reach out once

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`

const fitnessDaily = `# {{date}}

## Daily Core
- [ ] Strength session or cardio
- [ ] Protein target reached
- [ ] Sleep target met
- [ ] Log body metrics if needed

## Optional
- [ ] Mobility or stretching
- [ ] Outdoor walk

## One Line
-
`

const fitnessWeekly = `# {{week}}

## Body
- [ ] 5 training sessions
- [ ] 2 cardio sessions
- [ ] Recovery day quality check
- [ ] Log weight / waist / photo

## Research
- [ ] Keep baseline work output

## Life
- [ ] One full reset routine

## Output
- [ ] Summarize weekly fitness insights

## Social
- [ ] One active social plan

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'balanced',
    label: 'Balanced (Default)',
    dailyTemplate: balancedDaily,
    weeklyTemplate: balancedWeekly,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    dailyTemplate: minimalDaily,
    weeklyTemplate: minimalWeekly,
  },
  {
    id: 'fitness',
    label: 'Fitness Focus',
    dailyTemplate: fitnessDaily,
    weeklyTemplate: fitnessWeekly,
  },
]
