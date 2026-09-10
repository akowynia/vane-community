export interface DiffWord {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  wordDiffs?: DiffWord[];
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

function lcs<T>(a: T[], b: T[], equals = (x: T, y: T) => x === y): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (equals(a[i], b[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  return dp;
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const dp = lcs(oldLines, newLines);
  let i = oldLines.length;
  let j = newLines.length;
  const result: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({
        type: 'added',
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return result.reverse();
}

export function computeWordDiff(oldText: string, newText: string): DiffWord[] {
  const tokenize = (s: string) => s.split(/(\s+|[^\w\s])/).filter(Boolean);
  const oldTokens = tokenize(oldText || '');
  const newTokens = tokenize(newText || '');

  const dp = lcs(oldTokens, newTokens);
  let i = oldTokens.length;
  let j = newTokens.length;
  const result: DiffWord[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      result.push({ type: 'unchanged', value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', value: newTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({ type: 'removed', value: oldTokens[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

export function getDiffStats(diffLines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const line of diffLines) {
    if (line.type === 'added') added++;
    else if (line.type === 'removed') removed++;
    else unchanged++;
  }

  return { added, removed, unchanged };
}
