const translations = {
  en: {
    heroEyebrow: 'LOCAL-FIRST LIFE TRACKING',
    heroTitle: 'Your notes stay as files. The app stays out of the way.',
    heroSubtitle:
      'dailytrack reads and writes Markdown/CSV directly on your device, with structured editing, autosave, and sync tools that never replace local files as source of truth.',
    ctaDownload: 'Download Latest',
    ctaReadme: 'Read Full README',
    featuresTitle: 'Why dailytrack',
    f1Title: 'Local files first',
    f1Body: 'Markdown and CSV remain the only source of truth.',
    f2Title: 'Structured + raw',
    f2Body: 'Fast checkbox workflows and raw markdown fallback in one place.',
    f3Title: 'Recovery guardrails',
    f3Body: 'Safer delete flow with profile trash + in-session undo restore.',
    f4Title: 'Sync toolbox',
    f4Body: 'WebDAV snapshot + realtime sync with conflict resolution tools.',
    f5Title: 'Cross-platform',
    f5Body: 'macOS, Windows, and Android APK sideload support.',
    galleryTitle: 'Interface Preview',
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
    downloadsTitle: 'Download Channels',
    downloadsBody:
      'Stable signed channel is the target. Current public builds follow testing-channel expectations.',
    downloadMac: 'macOS Builds',
    downloadWin: 'Windows Builds',
    downloadAndroid: 'Android APK',
    policyLink: 'Distribution Policy',
    troubleshootLink: 'Troubleshooting',
    footerText: 'Built for private, long-term self tracking with local data ownership.',
  },
  zh: {
    heroEyebrow: '本地优先生活追踪',
    heroTitle: '你的记录就是文件本身，应用只是高效编辑器。',
    heroSubtitle:
      'dailytrack 直接读写本机 Markdown/CSV，提供结构化编辑、自动保存与同步工具，但不会替代本地文件作为数据真相。',
    ctaDownload: '下载最新版本',
    ctaReadme: '查看完整 README',
    featuresTitle: '为什么选择 dailytrack',
    f1Title: '文件优先',
    f1Body: 'Markdown 与 CSV 始终是唯一数据来源。',
    f2Title: '结构化 + 原文',
    f2Body: '快速勾选编辑与原始 Markdown 回退并存。',
    f3Title: '恢复护栏',
    f3Body: '删除更安全：档案进回收区，并支持会话内撤销恢复。',
    f4Title: '同步工具箱',
    f4Body: '支持 WebDAV 快照与实时同步，并提供冲突处理工具。',
    f5Title: '多平台',
    f5Body: '支持 macOS、Windows 与 Android APK 侧载。',
    galleryTitle: '界面预览',
    galleryLink: '查看截图来源',
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
    downloadsTitle: '下载通道',
    downloadsBody: '目标是稳定签名通道；当前公开构建按测试通道预期提供。',
    downloadMac: 'macOS 构建',
    downloadWin: 'Windows 构建',
    downloadAndroid: 'Android APK',
    policyLink: '分发策略',
    troubleshootLink: '故障排查',
    footerText: '为长期、私密、自主管理的数据追踪而设计。',
  },
}

function setLanguage(lang) {
  const dict = translations[lang] || translations.en
  document.documentElement.lang = lang

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n')
    if (!key) return
    const value = dict[key]
    if (typeof value === 'string') {
      node.textContent = value
    }
  })

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang)
  })

  localStorage.setItem('dailytrack-site-lang', lang)
}

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang')
    if (!lang) return
    setLanguage(lang)
  })
})

const preferred = localStorage.getItem('dailytrack-site-lang')
setLanguage(preferred === 'zh' ? 'zh' : 'en')
