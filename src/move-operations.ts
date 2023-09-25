import { MoveOperation } from './index';

export function longestCommonSequence(
  leftHashes: string[],
  rightHashes: string[]
) {
  const m = leftHashes.length;
  const n = rightHashes.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  let longestSequence: string[] = [];
  let offset: number | null = null;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftHashes[i - 1] === rightHashes[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > longestSequence.length) {
          longestSequence = leftHashes.slice(i - dp[i][j], i);
          offset = i - dp[i][j];
        }
      } else {
        dp[i][j] = 0;
      }
    }
  }
  return {
    length: longestSequence.length,
    sequence: longestSequence,
    offset,
  };
}

export function moveOperations(
  leftHashes: string[],
  rightHashes: string[],
  currentPath = ''
): MoveOperation[] {
  const { sequence } = longestCommonSequence(leftHashes, rightHashes);
  const operations: MoveOperation[] = [];
  let workingArr = [...leftHashes];
  let lcsIndex = 0;
  let targetIndex = 0;

  while (targetIndex < rightHashes.length) {
    const targetValue = rightHashes[targetIndex];

    if (sequence[lcsIndex] === targetValue) {
      lcsIndex++;
      targetIndex++;
      continue;
    }

    const sourceIndex = workingArr.indexOf(targetValue);

    if (sourceIndex !== targetIndex && sourceIndex !== -1) {
      operations.push({
        op: 'move',
        from: `${currentPath}/${sourceIndex}`,
        path: `${currentPath}/${targetIndex}`,
      });

      // Update the working array to reflect the move
      const [movedItem] = workingArr.splice(sourceIndex, 1);
      workingArr.splice(targetIndex, 0, movedItem);
    }

    targetIndex++;
  }

  return operations;
}
