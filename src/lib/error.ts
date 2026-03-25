export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  if (error && typeof error === 'object') {
    const maybeRecord = error as Record<string, unknown>
    const message = maybeRecord.message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
    const cause = maybeRecord.cause
    if (typeof cause === 'string' && cause.trim()) {
      return cause
    }
  }
  return fallback
}
