import type { WebdavConfig } from '../../lib/fs/fileApi'

export function defaultWebdavConfig(): WebdavConfig {
  return {
    enabled: false,
    autoPullEnabled: false,
    autoPullIntervalSec: 30,
    remoteBaseUrl: '',
    username: '',
    password: '',
    autoPushIntervalMin: 0,
    requestTimeoutSec: 90,
    maxSnapshots: 30,
    verifyTls: true,
    deviceId: '',
  }
}

export function normalizeWebdavConfig(config: WebdavConfig): WebdavConfig {
  return {
    ...config,
    autoPullEnabled: Boolean(config.autoPullEnabled),
    autoPullIntervalSec: Number.isFinite(config.autoPullIntervalSec)
      ? Math.max(5, Math.min(3600, Math.round(config.autoPullIntervalSec)))
      : 30,
    remoteBaseUrl: config.remoteBaseUrl.trim(),
    username: config.username.trim(),
    password: config.password.trim(),
    autoPushIntervalMin: Number.isFinite(config.autoPushIntervalMin)
      ? Math.max(0, Math.min(24 * 60, Math.round(config.autoPushIntervalMin)))
      : 0,
    requestTimeoutSec: Number.isFinite(config.requestTimeoutSec)
      ? Math.max(10, Math.min(600, Math.round(config.requestTimeoutSec)))
      : 90,
    maxSnapshots: Number.isFinite(config.maxSnapshots)
      ? Math.max(1, Math.min(365, Math.round(config.maxSnapshots)))
      : 30,
    verifyTls: Boolean(config.verifyTls),
    deviceId: config.deviceId.trim(),
  }
}

export function formatSnapshotTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

export function formatSnapshotSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return '-'
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  const kb = sizeBytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }

  const mb = kb / 1024
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`
  }

  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}
