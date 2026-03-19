export type TemplateLanguage = 'en' | 'zh'

export type TemplateVariant = {
  dailyTemplate: string
  weeklyTemplate: string
}

export type TemplatePreset = {
  id: string
  labels: Record<TemplateLanguage, string>
  descriptions?: Partial<Record<TemplateLanguage, string>>
  variants: Record<TemplateLanguage, TemplateVariant>
}

export function resolvePreferredTemplateLanguage(): TemplateLanguage {
  if (typeof navigator === 'undefined') {
    return 'en'
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function getTemplatePresetById(id: string): TemplatePreset {
  return TEMPLATE_PRESETS.find((preset) => preset.id === id) ?? TEMPLATE_PRESETS[0]
}

export function getTemplateVariant(
  preset: TemplatePreset,
  language: TemplateLanguage,
): TemplateVariant {
  return preset.variants[language]
}

const blankTemplate: TemplateVariant = {
  dailyTemplate: `# {{date}}

## Daily Core
- [ ] 

## Optional
- [ ] 

## One Line
-
`,
  weeklyTemplate: `# {{week}}

## Body
- [ ] 

## Research
- [ ] 

## Life
- [ ] 

## Output
- [ ] 

## Social
- [ ] 

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'balanced',
    labels: {
      en: 'Balanced (Default)',
      zh: '平衡日常（默认）',
    },
    descriptions: {
      en: 'Balanced checklist for body, focus, and life rhythm.',
      zh: '在身体、专注和生活节奏间取得平衡。',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

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
`,
        weeklyTemplate: `# {{week}}

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
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 训练或活动身体
- [ ] 饮食达标 / 蛋白质达标
- [ ] 完成今天最重要的研究任务
- [ ] 出门步行 / 晒太阳
- [ ] 记录一个小收获

## Optional
- [ ] 阅读或学习一点内容
- [ ] 整理桌面或房间
- [ ] 进行一次社交互动
- [ ] 记录一条生活片段 / 想法

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 4-5 次力量训练
- [ ] 2-3 次有氧训练
- [ ] 3 次核心训练
- [ ] 记录体重 / 腰围 / 进展照片
- [ ] 5 天以上饮食达标

## Research
- [ ] 3 次深度工作
- [ ] 推进一个关键项目
- [ ] 规划下周重点

## Life
- [ ] 1 次户外活动
- [ ] 1 次提升生活体验的小活动
- [ ] 1 次环境整理 / 清洁

## Output
- [ ] 发布 1 条内容
- [ ] 沉淀 3 条素材或想法

## Social
- [ ] 参加 1 次社交活动
- [ ] 主动联系 1 位朋友

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'minimal',
    labels: {
      en: 'Minimal',
      zh: '极简',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] Most important task
- [ ] Body movement
- [ ] One meaningful connection

## Optional
- [ ] Read 20 min

## One Line
-
`,
        weeklyTemplate: `# {{week}}

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
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 最重要任务
- [ ] 身体活动
- [ ] 一次有意义的连接

## Optional
- [ ] 阅读 20 分钟

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 4 天以上身体活动

## Research
- [ ] 完成 1 个深度里程碑

## Life
- [ ] 1 次重置型活动

## Output
- [ ] 产出 1 个可发布成果

## Social
- [ ] 主动联系 1 次

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'fitness',
    labels: {
      en: 'Fitness Focus',
      zh: '体能优先',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

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
`,
        weeklyTemplate: `# {{week}}

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
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 力量训练或有氧
- [ ] 蛋白质目标达成
- [ ] 睡眠目标达成
- [ ] 按需记录身体指标

## Optional
- [ ] 拉伸或灵活性训练
- [ ] 户外步行

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 5 次训练
- [ ] 2 次有氧
- [ ] 恢复日质量检查
- [ ] 记录体重 / 腰围 / 照片

## Research
- [ ] 保持基础工作产出

## Life
- [ ] 1 次完整重置流程

## Output
- [ ] 总结本周训练洞察

## Social
- [ ] 1 次主动社交安排

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'deep-work',
    labels: {
      en: 'Deep Work',
      zh: '深度工作',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 2-3 focused deep work blocks
- [ ] Complete one high-impact task
- [ ] Protect distraction-free window
- [ ] Shutdown review before end of day

## Optional
- [ ] Read one technical paper section
- [ ] Capture one implementation insight

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] Move body >= 4 days

## Research
- [ ] 10 deep work blocks
- [ ] Resolve one major unknown
- [ ] Write weekly research summary

## Life
- [ ] One environment cleanup

## Output
- [ ] Publish one serious progress update

## Social
- [ ] One thoughtful check-in

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 2-3 个深度专注时段
- [ ] 完成 1 个高影响任务
- [ ] 保证无干扰窗口
- [ ] 收工前完成复盘

## Optional
- [ ] 阅读一段技术资料
- [ ] 记录一个实现洞察

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 4 天以上身体活动

## Research
- [ ] 10 个深度工作时段
- [ ] 解决 1 个关键未知问题
- [ ] 输出本周研究总结

## Life
- [ ] 1 次环境整理

## Output
- [ ] 发布 1 条实质性进展

## Social
- [ ] 1 次高质量沟通

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'creator',
    labels: {
      en: 'Creator',
      zh: '创作者',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] Produce one core creative block
- [ ] Finish one shippable chunk
- [ ] Gather one inspiration input
- [ ] Polish one existing piece

## Optional
- [ ] Capture 3 idea bullets
- [ ] Review audience feedback

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] Keep energy routine stable

## Research
- [ ] Study one strong creator reference

## Life
- [ ] One recharge activity

## Output
- [ ] Publish 2 pieces
- [ ] Build 1 reusable content asset

## Social
- [ ] One community interaction

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 完成 1 个核心创作时段
- [ ] 做完 1 个可发布片段
- [ ] 获取 1 条灵感输入
- [ ] 打磨 1 份已有内容

## Optional
- [ ] 记录 3 条想法
- [ ] 回看用户反馈

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 保持稳定精力节律

## Research
- [ ] 研究 1 个优秀创作者样本

## Life
- [ ] 1 次主动充电活动

## Output
- [ ] 发布 2 条内容
- [ ] 沉淀 1 个可复用素材资产

## Social
- [ ] 1 次社区互动

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'student',
    labels: {
      en: 'Student',
      zh: '学习成长',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] Focused study session
- [ ] Solve practice problems
- [ ] Review and summarize notes
- [ ] Ask one question or clarify one gap

## Optional
- [ ] Spaced repetition review
- [ ] Teach-back in one paragraph

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] Keep sleep and movement baseline

## Research
- [ ] 5 focused study sessions
- [ ] Finish one chapter/module
- [ ] Weekly summary and question list

## Life
- [ ] One cleanup/reset for study environment

## Output
- [ ] Submit one assignment/project milestone

## Social
- [ ] Discuss one topic with peer

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 1 次专注学习
- [ ] 完成练习题
- [ ] 复盘并整理笔记
- [ ] 提出 1 个问题或补齐 1 个盲点

## Optional
- [ ] 间隔复习
- [ ] 用一段话讲解当天内容

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 保持睡眠和活动基线

## Research
- [ ] 5 次专注学习
- [ ] 完成 1 个章节/模块
- [ ] 输出周总结与问题清单

## Life
- [ ] 1 次学习环境整理

## Output
- [ ] 提交 1 个作业或项目里程碑

## Social
- [ ] 与同伴讨论 1 个主题

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'recovery',
    labels: {
      en: 'Recovery',
      zh: '恢复调整',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] Sleep and wake rhythm kept
- [ ] Gentle movement or walk
- [ ] Nutritious meals and hydration
- [ ] Reduce one stress source

## Optional
- [ ] 10-minute breathing or meditation
- [ ] Journal one emotional check-in

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 7 days sleep baseline
- [ ] 4 days gentle movement
- [ ] Track recovery signals

## Research
- [ ] Keep only essential commitments

## Life
- [ ] One environment comfort upgrade

## Output
- [ ] One small but meaningful output

## Social
- [ ] One low-pressure social touchpoint

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 保持睡眠作息节律
- [ ] 温和活动或散步
- [ ] 饮食与补水达标
- [ ] 减少 1 个压力源

## Optional
- [ ] 10 分钟呼吸/冥想
- [ ] 记录一次情绪状态

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 7 天睡眠基线
- [ ] 4 天温和活动
- [ ] 记录恢复信号

## Research
- [ ] 只保留必要任务承诺

## Life
- [ ] 1 次舒适度优化

## Output
- [ ] 1 个小而有意义的产出

## Social
- [ ] 1 次低压力社交连接

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'social',
    labels: {
      en: 'Social Growth',
      zh: '社交关系',
    },
    variants: {
      en: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] Reach out to one person
- [ ] Start one small conversation
- [ ] Follow up one pending message
- [ ] Record one social learning

## Optional
- [ ] Plan one meetup/activity
- [ ] Practice one communication skill

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] Keep baseline energy for social life

## Research
- [ ] Reflect on one communication pattern

## Life
- [ ] Join one community space

## Output
- [ ] Share one useful resource publicly

## Social
- [ ] 3 proactive reach-outs
- [ ] 1 in-person meetup or long call
- [ ] 1 gratitude message

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
      zh: {
        dailyTemplate: `# {{date}}

## Daily Core
- [ ] 主动联系 1 个人
- [ ] 发起 1 次小交流
- [ ] 跟进 1 条待回复消息
- [ ] 记录 1 个社交观察

## Optional
- [ ] 计划 1 次见面或活动
- [ ] 练习 1 个沟通技巧

## One Line
-
`,
        weeklyTemplate: `# {{week}}

## Body
- [ ] 保持社交所需精力基线

## Research
- [ ] 复盘 1 个沟通模式

## Life
- [ ] 参与 1 个社区空间

## Output
- [ ] 公开分享 1 条有用资源

## Social
- [ ] 3 次主动联系
- [ ] 1 次线下见面或长通话
- [ ] 1 条感谢信息

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
      },
    },
  },
  {
    id: 'blank',
    labels: {
      en: 'Blank Skeleton',
      zh: '空白骨架',
    },
    descriptions: {
      en: 'Keep structure, start with empty checklist items.',
      zh: '保留结构，从空白条目开始编辑。',
    },
    variants: {
      en: blankTemplate,
      zh: blankTemplate,
    },
  },
]
