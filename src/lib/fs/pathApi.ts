export function normalizeRootPath(root: string): string {
  return root.endsWith('/') ? root.slice(0, -1) : root
}

export function joinPath(root: string, ...parts: string[]): string {
  const base = normalizeRootPath(root)
  const suffix = parts.map((part) => part.replace(/^\/+|\/+$/g, '')).join('/')
  return `${base}/${suffix}`
}
