import { describe, expect, test } from 'vitest'

import {
  checkLatestAndroidRelease,
  compareSemverVersions,
  pickPreferredAndroidApkAsset,
} from './androidRelease.service'

describe('android release semver comparison', () => {
  test('compares stable versions', () => {
    expect(compareSemverVersions('1.1.1', '1.1.0')).toBeGreaterThan(0)
    expect(compareSemverVersions('1.1.1', '1.1.1')).toBe(0)
    expect(compareSemverVersions('1.1.1', '1.2.0')).toBeLessThan(0)
  })

  test('compares prerelease versions', () => {
    expect(compareSemverVersions('1.1.1', '1.1.1-beta.1')).toBeGreaterThan(0)
    expect(compareSemverVersions('1.1.1-beta.2', '1.1.1-beta.10')).toBeLessThan(0)
  })
})

describe('android release apk selection', () => {
  test('prefers universal android apk when present', () => {
    const picked = pickPreferredAndroidApkAsset([
      {
        name: 'dailytrack_1.1.1_android_arm64-v8a-release.apk',
        browser_download_url: 'https://example.com/arm64.apk',
      },
      {
        name: 'dailytrack_1.1.1_android_universal-release.apk',
        browser_download_url: 'https://example.com/universal.apk',
      },
    ])

    expect(picked?.name).toBe('dailytrack_1.1.1_android_universal-release.apk')
    expect(picked?.browser_download_url).toBe('https://example.com/universal.apk')
  })
})

describe('checkLatestAndroidRelease', () => {
  test('returns update payload from latest release', async () => {
    const payload = {
      tag_name: 'v1.1.2',
      html_url: 'https://github.com/Routhleck/dailytrack/releases/tag/v1.1.2',
      assets: [
        {
          name: 'dailytrack_1.1.2_android_universal-release.apk',
          browser_download_url:
            'https://github.com/Routhleck/dailytrack/releases/download/v1.1.2/dailytrack_1.1.2_android_universal-release.apk',
        },
      ],
    }

    const result = await checkLatestAndroidRelease('1.1.1', {
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          json: async () => payload,
        }) as Response,
    })

    expect(result.latestVersion).toBe('1.1.2')
    expect(result.currentVersion).toBe('1.1.1')
    expect(result.isUpdateAvailable).toBe(true)
    expect(result.apkName).toBe('dailytrack_1.1.2_android_universal-release.apk')
  })

  test('throws when latest release has no apk', async () => {
    await expect(
      checkLatestAndroidRelease('1.1.1', {
        fetchImpl: async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              tag_name: 'v1.1.2',
              html_url: 'https://github.com/Routhleck/dailytrack/releases/tag/v1.1.2',
              assets: [],
            }),
          }) as Response,
      }),
    ).rejects.toThrow('Latest release does not contain an Android APK asset.')
  })
})
