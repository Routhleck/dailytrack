const translations = {
  en: {
    navFeatures: 'Features',
    navTutorials: 'Tutorials',
    navGallery: 'Gallery',
    navDownload: 'Download',

    heroEyebrow: 'OPEN SOURCE · LOCAL-FIRST · FILE-OWNED',
    heroTitle: 'Turn Markdown files into a reliable daily operating system.',
    heroSubtitle:
      'dailytrack keeps your data in local Markdown/CSV, adds structured editing and autosave, and now provides safer recovery guardrails for long-term personal use.',
    ctaDownload: 'Get Latest Release',
    ctaReadme: 'Read README',
    badgeLocal: 'Local files as source of truth',
    badgeRecover: 'Soft-delete + undo recovery',
    badgeCross: 'macOS / Windows / Android',

    stat1: 'Local Markdown/CSV ownership',
    stat2: 'Editing modes (Structured + Raw)',
    stat3: 'Core tutorials on this page',

    featuresTitle: 'Why teams and solo builders like dailytrack',
    f1Title: 'File ownership first',
    f1Body: 'No hidden app database. Your real data is visible on disk.',
    f2Title: 'Fast daily operations',
    f2Body: 'Checklist-first interactions with debounced autosave by default.',
    f3Title: 'Recovery guardrails',
    f3Body: 'Profile delete is reversible via trash + in-session undo.',
    f4Title: 'Sync toolkit',
    f4Body: 'WebDAV snapshot + realtime sync with conflict tools.',
    f5Title: 'Portable workflow',
    f5Body: 'Move data roots, export zip bundles, and keep control.',
    f6Title: 'Bilingual UX',
    f6Body: 'English and Chinese interfaces with consistent data schema.',

    tutorialsTitle: 'Tutorial Center',
    tutorialsSubtitle: 'Everything you need to start, sync, and recover — directly on this page.',
    tabQuick: 'Quick Start',
    tabDaily: 'Daily + Weekly Flow',
    tabBody: 'Body Tracking',
    tabSync: 'WebDAV Sync',
    tabSafety: 'Recovery & Safety',

    quickTitle: 'Quick Start in 5 Minutes',
    quick1: 'Install from latest release and finish onboarding.',
    quick2: 'Open Daily Note, Weekly Note, and Body once each.',
    quick3: 'Check autosave by reopening the same note page.',
    quick4: 'Confirm your data root path in Settings.',

    dailyTitle: 'Daily + Weekly Operating Rhythm',
    daily1: 'Morning: review Daily Core checklist.',
    daily2: 'During day: update checklist and one-line notes.',
    daily3: 'Week-end: fill Weekly reflections and next-week priorities.',
    daily4: 'Use history pages for calendar/week-grid review.',

    bodyTitle: 'Body Tracking Basics',
    body1: 'Add one record with date + key metrics.',
    body2: 'Configure visible metrics and units in Preferences.',
    body3: 'Use trend ranges (7d/30d/90d/all) for weekly review.',
    body4: 'Attach context in note field for better interpretation.',

    syncTitle: 'WebDAV Sync Tutorial',
    sync1: 'Set URL/credentials and run Test Connection first.',
    sync2: 'Do one manual Push Now to establish baseline snapshot.',
    sync3: 'Use Sync page for Push/Pull/Both operations.',
    sync4: 'Resolve conflicts with preview before batch apply.',

    safetyTitle: 'Recovery & Safety Tutorial',
    safety1: 'Profile deletes go to `.trash` instead of hard deletion.',
    safety2: 'Use in-session Undo immediately after mistaken delete.',
    safety3: 'Review destructive sync actions in confirmation dialog.',
    safety4: 'Keep periodic zip exports as offline backup.',

    galleryTitle: 'Interface Gallery',
    galleryLink: 'View source screenshots',
    gDashboard: 'Dashboard',
    gDaily: 'Daily Note',
    gDailyHistory: 'Daily History',
    gWeekly: 'Weekly Note',
    gWeeklyHistory: 'Weekly History',
    gBody: 'Body',
    gSettings: 'Settings',
    gProfiles: 'Profiles',
    gSync: 'Sync',
    gOnboarding: 'Onboarding',

    finalTitle: 'Ship your personal operating system, not another note silo.',
    finalBody:
      'Start with local files, add structure where it helps, and keep long-term trust in your data.',
    finalDownload: 'Download dailytrack',
    finalHelp: 'Troubleshooting',
    footerText: 'Open source, local-first, built for long-term self-tracking reliability.',
  },
  zh: {
    navFeatures: '功能',
    navTutorials: '教程',
    navGallery: '截图',
    navDownload: '下载',

    heroEyebrow: '开源 · 本地优先 · 文件可见',
    heroTitle: '把 Markdown 文件变成你的可靠日常系统。',
    heroSubtitle:
      'dailytrack 让数据始终保留在本机 Markdown/CSV 中，同时提供结构化编辑、自动保存与更安全的恢复护栏。',
    ctaDownload: '下载最新版本',
    ctaReadme: '查看 README',
    badgeLocal: '本地文件就是唯一数据真相',
    badgeRecover: '软删除 + 撤销恢复',
    badgeCross: 'macOS / Windows / Android',

    stat1: '本地 Markdown/CSV 数据归属',
    stat2: '编辑模式（结构化 + 原文）',
    stat3: '本页内置核心教程数',

    featuresTitle: '为什么 dailytrack 适合长期使用',
    f1Title: '文件归属优先',
    f1Body: '没有隐藏数据库，数据可直接在磁盘上查看。',
    f2Title: '高频记录效率',
    f2Body: '以清单为核心，默认防抖自动保存。',
    f3Title: '恢复护栏',
    f3Body: '档案删除可通过回收区与会话内撤销恢复。',
    f4Title: '同步工具箱',
    f4Body: '支持 WebDAV 快照与实时同步冲突处理。',
    f5Title: '可迁移工作流',
    f5Body: '支持数据根目录迁移与 zip 导出备份。',
    f6Title: '双语体验',
    f6Body: '英文与中文界面，底层数据结构一致。',

    tutorialsTitle: '教程中心',
    tutorialsSubtitle: '从上手到同步到恢复，核心步骤都在这个页面。',
    tabQuick: '快速上手',
    tabDaily: '日周记录流程',
    tabBody: 'Body 教程',
    tabSync: 'WebDAV 同步',
    tabSafety: '恢复与安全',

    quickTitle: '5 分钟快速上手',
    quick1: '从最新 release 安装并完成首次引导。',
    quick2: '分别打开每日、每周、Body 页面进行首次记录。',
    quick3: '返回页面验证自动保存是否生效。',
    quick4: '在设置里确认当前数据根目录。',

    dailyTitle: '每日 + 每周节奏建议',
    daily1: '早晨：查看 Daily Core 清单。',
    daily2: '白天：实时勾选并补充 one-line。',
    daily3: '周末：完成 Weekly 反思与下周重点。',
    daily4: '用 history 日历/周网格做复盘。',

    bodyTitle: 'Body 记录基础',
    body1: '先添加一条含日期与关键指标的记录。',
    body2: '在偏好中设置显示指标、单位与小数位。',
    body3: '使用 7d/30d/90d/all 观察趋势。',
    body4: '在 note 中记录背景方便解释波动。',

    syncTitle: 'WebDAV 同步教程',
    sync1: '先填 URL/账号并执行 Test Connection。',
    sync2: '先做一次 Push Now 建立基线快照。',
    sync3: '在 Sync 页使用 Push/Pull/Both。',
    sync4: '批量操作前先看冲突预览。',

    safetyTitle: '恢复与安全教程',
    safety1: '档案删除会进入 `.trash`，不是立即硬删除。',
    safety2: '误删后可在当前会话立即 Undo。',
    safety3: '破坏性同步操作需确认弹窗后执行。',
    safety4: '建议定期导出 zip 离线备份。',

    galleryTitle: '界面截图',
    galleryLink: '查看截图源文件',
    gDashboard: '仪表盘',
    gDaily: '每日记录',
    gDailyHistory: '每日历史',
    gWeekly: '每周记录',
    gWeeklyHistory: '每周历史',
    gBody: '身体数据',
    gSettings: '设置',
    gProfiles: '档案',
    gSync: '同步',
    gOnboarding: '首次引导',

    finalTitle: '打造你的个人操作系统，而不是另一个信息孤岛。',
    finalBody: '保持本地文件归属，在需要处获得结构化效率，并持续信任你的长期数据。',
    finalDownload: '下载 dailytrack',
    finalHelp: '故障排查',
    footerText: '开源、本地优先，面向长期可靠的自我追踪。',
  },
}

function applyLanguage(lang) {
  const dict = translations[lang] || translations.en
  document.documentElement.lang = lang

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n')
    if (!key) return
    if (Object.prototype.hasOwnProperty.call(dict, key)) {
      node.textContent = dict[key]
    }
  })

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang)
  })

  localStorage.setItem('dailytrack-site-lang', lang)
}

function setupLangSwitch() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang')
      if (!lang) return
      applyLanguage(lang)
    })
  })

  const preferred = localStorage.getItem('dailytrack-site-lang')
  applyLanguage(preferred === 'zh' ? 'zh' : 'en')
}

function setupTutorialTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'))
  const panels = Array.from(document.querySelectorAll('.tutorial-panel'))

  const activate = (topic) => {
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-topic') === topic)
    })
    panels.forEach((panel) => {
      panel.classList.toggle('active', panel.getAttribute('data-topic') === topic)
    })
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const topic = btn.getAttribute('data-topic')
      if (!topic) return
      activate(topic)
    })
  })
}

setupLangSwitch()
setupTutorialTabs()
