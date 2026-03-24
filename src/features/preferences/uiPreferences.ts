import type { TypographyScale } from '../../types/preferences'

const TYPOGRAPHY_SCALE_MAP: Record<TypographyScale, string> = {
  sm: '0.9375',
  md: '1',
  lg: '1.0625',
}

export function applyTypographyScale(scale: TypographyScale): void {
  const value = TYPOGRAPHY_SCALE_MAP[scale] ?? TYPOGRAPHY_SCALE_MAP.md
  document.documentElement.style.setProperty('--dt-font-scale', value)
}

export function resetTypographyScale(): void {
  document.documentElement.style.removeProperty('--dt-font-scale')
}
