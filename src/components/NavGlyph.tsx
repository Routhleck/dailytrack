import type { SVGProps } from 'react'

export type NavGlyphName =
  | 'dashboard'
  | 'today'
  | 'week'
  | 'body'
  | 'reports'
  | 'daily'
  | 'weekly'
  | 'sync'
  | 'profiles'
  | 'preferences'
  | 'settings'
  | 'more'
  | 'menu'

const GLYPH_PATHS: Record<NavGlyphName, string> = {
  dashboard: 'M4 5a2 2 0 0 1 2-2h4v8H4V5Zm0 10h6v6H6a2 2 0 0 1-2-2v-4Zm10-12h4a2 2 0 0 1 2 2v6h-6V3Zm0 12h6v4a2 2 0 0 1-2 2h-4v-6Z',
  today: 'M7 3v2M17 3v2M4 8h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Zm5 8h4m-4 4h4',
  week: 'M5 4h14a1 1 0 0 1 1 1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Zm0 4h14M8 12h2m4 0h2m-8 4h2m4 0h2',
  body: 'M7 5a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2h1V5Zm2 2h6V5a3 3 0 1 0-6 0v2Zm3 4v6',
  reports: 'M6 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 1v5h5M8 13h8M8 17h6',
  daily: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 5h6M9 11h6M9 14h4',
  weekly: 'M5 4h14a1 1 0 0 1 1 1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Zm0 5h14M8 13h8M8 17h8',
  sync: 'M4 11a8 8 0 0 1 13.66-5.66L20 8M20 13a8 8 0 0 1-13.66 5.66L4 16',
  profiles: 'M7 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm10 12a6 6 0 0 0-12 0M17 4h3m-1.5-1.5v3',
  preferences: 'M10 3h4l1 2 2 .6 1.7-1.2 2.8 2.8-1.2 1.7.6 2 2 1v4l-2 1-.6 2 1.2 1.7-2.8 2.8-1.7-1.2-2 .6-1 2h-4l-1-2-2-.6-1.7 1.2-2.8-2.8 1.2-1.7-.6-2-2-1v-4l2-1 .6-2-1.2-1.7 2.8-2.8 1.7 1.2 2-.6 1-2Zm2 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  settings: 'M12 3v3m0 12v3M3 12h3m12 0h3m-2.3-6.3-2.1 2.1M7.4 16.6l-2.1 2.1m0-13.1 2.1 2.1m11.2 8.9 2.1 2.1M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
  more: 'M6 12a1.25 1.25 0 1 1 0 .01V12Zm6 0a1.25 1.25 0 1 1 0 .01V12Zm6 0a1.25 1.25 0 1 1 0 .01V12Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
}

export function NavGlyph({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: NavGlyphName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={GLYPH_PATHS[name]} />
    </svg>
  )
}

