export type MoveBetweenListsResult<T> = {
  source: T[]
  target: T[]
  moved: boolean
}

export function moveItemBetweenLists<T>(
  source: T[],
  target: T[],
  index: number,
): MoveBetweenListsResult<T> {
  if (index < 0 || index >= source.length) {
    return {
      source,
      target,
      moved: false,
    }
  }

  const nextSource = [...source]
  const [item] = nextSource.splice(index, 1)
  return {
    source: nextSource,
    target: [...target, item],
    moved: true,
  }
}
