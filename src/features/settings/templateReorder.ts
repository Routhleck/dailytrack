export function reorderByOffset<T>(items: T[], index: number, offset: -1 | 1): T[] {
  if (index < 0 || index >= items.length) {
    return items
  }

  const nextIndex = index + offset
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item)
  return next
}
