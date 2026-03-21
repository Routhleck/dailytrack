export type LineDiffKind = 'same' | 'add' | 'remove'

export type LineDiffRow = {
  kind: LineDiffKind
  leftLineNo: number | null
  rightLineNo: number | null
  leftText: string
  rightText: string
}

function toLines(text: string): string[] {
  if (!text) {
    return []
  }
  return text.replace(/\r\n/g, '\n').split('\n')
}

export function buildLineDiffRows(leftText: string, rightText: string): LineDiffRow[] {
  const left = toLines(leftText)
  const right = toLines(rightText)
  const n = left.length
  const m = right.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: LineDiffRow[] = []
  let i = 0
  let j = 0
  let leftNo = 1
  let rightNo = 1

  while (i < n || j < m) {
    if (i < n && j < m && left[i] === right[j]) {
      rows.push({
        kind: 'same',
        leftLineNo: leftNo,
        rightLineNo: rightNo,
        leftText: left[i],
        rightText: right[j],
      })
      i += 1
      j += 1
      leftNo += 1
      rightNo += 1
      continue
    }

    if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      rows.push({
        kind: 'add',
        leftLineNo: null,
        rightLineNo: rightNo,
        leftText: '',
        rightText: right[j],
      })
      j += 1
      rightNo += 1
      continue
    }

    if (i < n) {
      rows.push({
        kind: 'remove',
        leftLineNo: leftNo,
        rightLineNo: null,
        leftText: left[i],
        rightText: '',
      })
      i += 1
      leftNo += 1
    }
  }

  return rows
}
