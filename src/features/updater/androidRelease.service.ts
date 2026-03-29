type GitHubReleaseAsset = {
  name: string
  browser_download_url: string
}

type GitHubLatestRelease = {
  tag_name: string
  html_url: string
  published_at?: string
  assets?: GitHubReleaseAsset[]
}

type FetchResponseLike = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponseLike>

export type AndroidReleaseUpdate = {
  currentVersion: string
  latestVersion: string
  releaseTag: string
  releaseUrl: string
  publishedAt?: string
  apkName: string
  apkUrl: string
  isUpdateAvailable: boolean
}

type CheckAndroidReleaseOptions = {
  owner?: string
  repo?: string
  fetchImpl?: FetchLike
}

const DEFAULT_OWNER = 'Routhleck'
const DEFAULT_REPO = 'dailytrack'

async function fetchWithTauriHttp(url: string, options?: RequestInit): Promise<FetchResponseLike> {
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
  const response = await tauriFetch(url, {
    method: options?.method || 'GET',
    headers: options?.headers,
  })
  return {
    ok: response.ok,
    status: response.status,
    json: () => (response as Response).json(),
  }
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '')
}

function parseVersion(value: string): { core: number[]; preRelease: string[] } | null {
  const normalized = normalizeVersion(value)
  if (!normalized) {
    return null
  }

  const [coreRaw, preReleaseRaw] = normalized.split('-', 2)
  const coreParts = coreRaw.split('.')
  if (coreParts.length === 0) {
    return null
  }

  const core: number[] = []
  for (const part of coreParts) {
    if (!/^\d+$/.test(part)) {
      return null
    }
    core.push(Number.parseInt(part, 10))
  }

  const preRelease = preReleaseRaw ? preReleaseRaw.split('.').filter((part) => part.length > 0) : []
  return { core, preRelease }
}

function compareIdentifiers(left: string, right: string): number {
  const leftIsNum = /^\d+$/.test(left)
  const rightIsNum = /^\d+$/.test(right)

  if (leftIsNum && rightIsNum) {
    const leftNum = Number.parseInt(left, 10)
    const rightNum = Number.parseInt(right, 10)
    if (leftNum === rightNum) {
      return 0
    }
    return leftNum > rightNum ? 1 : -1
  }

  if (leftIsNum && !rightIsNum) {
    return -1
  }
  if (!leftIsNum && rightIsNum) {
    return 1
  }

  if (left === right) {
    return 0
  }
  return left > right ? 1 : -1
}

export function compareSemverVersions(left: string, right: string): number {
  const leftParsed = parseVersion(left)
  const rightParsed = parseVersion(right)

  if (!leftParsed || !rightParsed) {
    const normalizedLeft = normalizeVersion(left)
    const normalizedRight = normalizeVersion(right)
    if (normalizedLeft === normalizedRight) {
      return 0
    }
    return normalizedLeft > normalizedRight ? 1 : -1
  }

  const maxCoreLength = Math.max(leftParsed.core.length, rightParsed.core.length)
  for (let index = 0; index < maxCoreLength; index += 1) {
    const leftCore = leftParsed.core[index] ?? 0
    const rightCore = rightParsed.core[index] ?? 0
    if (leftCore !== rightCore) {
      return leftCore > rightCore ? 1 : -1
    }
  }

  const leftHasPre = leftParsed.preRelease.length > 0
  const rightHasPre = rightParsed.preRelease.length > 0
  if (!leftHasPre && !rightHasPre) {
    return 0
  }
  if (!leftHasPre && rightHasPre) {
    return 1
  }
  if (leftHasPre && !rightHasPre) {
    return -1
  }

  const maxPreLength = Math.max(leftParsed.preRelease.length, rightParsed.preRelease.length)
  for (let index = 0; index < maxPreLength; index += 1) {
    const leftId = leftParsed.preRelease[index]
    const rightId = rightParsed.preRelease[index]
    if (leftId == null) {
      return -1
    }
    if (rightId == null) {
      return 1
    }
    const result = compareIdentifiers(leftId, rightId)
    if (result !== 0) {
      return result
    }
  }

  return 0
}

export function pickPreferredAndroidApkAsset(
  assets: { name: string; browser_download_url: string }[],
): { name: string; browser_download_url: string } | null {
  const apkAssets = assets.filter((asset) => asset.name.toLowerCase().endsWith('.apk'))
  if (apkAssets.length === 0) {
    return null
  }

  const preferredPatterns = [
    'android_universal-release.apk',
    'android_universal',
    'universal',
    '_android_',
  ]

  for (const pattern of preferredPatterns) {
    const picked = apkAssets.find((asset) => asset.name.toLowerCase().includes(pattern))
    if (picked) {
      return picked
    }
  }

  return apkAssets[0]
}

export async function checkLatestAndroidRelease(
  currentVersion: string,
  options: CheckAndroidReleaseOptions = {},
): Promise<AndroidReleaseUpdate> {
  const owner = options.owner ?? DEFAULT_OWNER
  const repo = options.repo ?? DEFAULT_REPO

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
  const response = await fetchWithTauriHttp(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release: HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as GitHubLatestRelease
  if (!payload.tag_name || !payload.html_url) {
    throw new Error('Invalid release payload returned by GitHub.')
  }

  const apkAsset = pickPreferredAndroidApkAsset(payload.assets ?? [])
  if (!apkAsset) {
    throw new Error('Latest release does not contain an Android APK asset.')
  }

  const normalizedCurrent = normalizeVersion(currentVersion)
  const normalizedLatest = normalizeVersion(payload.tag_name)

  return {
    currentVersion: normalizedCurrent,
    latestVersion: normalizedLatest,
    releaseTag: payload.tag_name,
    releaseUrl: payload.html_url,
    publishedAt: payload.published_at,
    apkName: apkAsset.name,
    apkUrl: apkAsset.browser_download_url,
    isUpdateAvailable: compareSemverVersions(normalizedLatest, normalizedCurrent) > 0,
  }
}
