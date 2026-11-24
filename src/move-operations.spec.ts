import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { longestCommonSequence, moveOperations } from './index';

describe('a moveOperations function', () => {
  it('returns an empty array when given two empty arrays', () => {
    assert.deepStrictEqual(moveOperations([], []), []);
  });

  it('returns an empty array when given two arrays with the same values', () => {
    assert.deepStrictEqual(
      moveOperations(['1', '2', '3'], ['1', '2', '3']),
      []
    );
  });

  it('returns no moves for identical order with duplicate hashes', () => {
    assert.deepStrictEqual(
      moveOperations(['a', 'a', 'b'], ['a', 'a', 'b']),
      []
    );
  });

  it('still detects moves when matching prefixes have different lengths', () => {
    assert.deepStrictEqual(moveOperations(['a'], ['a', 'b', 'a']), [
      { op: 'move', from: '/0', path: '/2' },
    ]);
  });

  it('returns a single move operation when given two arrays with one value moved', () => {
    assert.deepStrictEqual(moveOperations(['1', '2', '3'], ['1', '3', '2']), [
      { op: 'move', from: '/2', path: '/1' },
    ]);
  });

  it('returns a single move operation when given two arrays with one value moved and different length', () => {
    assert.deepStrictEqual(
      moveOperations(['1', '2', '3', '4'], ['1', '3', '2']),
      [{ op: 'move', from: '/2', path: '/1' }]
    );
  });

  it('returns an empty array when given two arrays with a removed key', () => {
    assert.deepStrictEqual(
      moveOperations(['0', '1', '2'], ['0', '1', '2', '3']),
      []
    );
  });

  it('returns an empty array when given two arrays with an added key', () => {
    assert.deepStrictEqual(
      moveOperations(['0', '1', '2', '3'], ['0', '1', '2']),
      []
    );
  });
});

describe('a longestCommonSequence function', () => {
  it('matches a brute-force search for all binary arrays up to length four', () => {
    const arrays = Array.from({ length: 31 }, (_, i) =>
      (i + 1).toString(2).slice(1).split('')
    );

    for (const left of arrays) {
      for (const right of arrays) {
        let sequence: string[] = [];
        let offset: number | null = null;

        for (let start = 0; start < left.length; start++) {
          for (
            let end = start + sequence.length + 1;
            end <= left.length;
            end++
          ) {
            const candidate = left.slice(start, end);
            if (
              right.some((_, index) =>
                candidate.every((value, j) => value === right[index + j])
              )
            ) {
              sequence = candidate;
              offset = start;
            }
          }
        }

        assert.deepStrictEqual(longestCommonSequence(left, right), {
          length: sequence.length,
          sequence,
          offset,
        });
      }
    }
  });

  it('does not reuse a match from the current row', () => {
    assert.deepStrictEqual(longestCommonSequence(['a'], ['a', 'a']), {
      length: 1,
      sequence: ['a'],
      offset: 0,
    });
  });

  it('keeps the first left offset when longest matches tie', () => {
    assert.deepStrictEqual(
      longestCommonSequence(
        ['a', 'b', 'x', 'c', 'd'],
        ['c', 'd', 'y', 'a', 'b']
      ),
      { length: 2, sequence: ['a', 'b'], offset: 0 }
    );
  });

  it('resets matches across gaps instead of finding a subsequence', () => {
    assert.deepStrictEqual(
      longestCommonSequence(['a', 'b', 'c'], ['a', 'x', 'b', 'y', 'c']),
      { length: 1, sequence: ['a'], offset: 0 }
    );
  });

  it('returns no sequence for disjoint or one-sided empty arrays', () => {
    for (const [left, right] of [
      [['a'], ['b']],
      [[], ['a']],
      [['a'], []],
    ]) {
      assert.deepStrictEqual(longestCommonSequence(left, right), {
        length: 0,
        sequence: [],
        offset: null,
      });
    }
  });

  it('returns an empty array when given two empty arrays', () => {
    assert.deepStrictEqual(longestCommonSequence([], []), {
      length: 0,
      sequence: [],
      offset: null,
    });
  });

  it('returns the full sequence when given two identical arrays', () => {
    assert.deepStrictEqual(
      longestCommonSequence(['1', '2', '3'], ['1', '2', '3']),
      {
        length: 3,
        sequence: ['1', '2', '3'],
        offset: 0,
      }
    );
  });

  it('returns a sequence at the beginning of an array', () => {
    assert.deepStrictEqual(
      longestCommonSequence(['1', '2', '3', '4'], ['4', '1', '2', '3']),
      {
        length: 3,
        sequence: ['1', '2', '3'],
        offset: 0,
      }
    );
  });

  it('returns a sequence at the end of an array', () => {
    assert.deepStrictEqual(
      longestCommonSequence(['4', '1', '2', '3'], ['1', '2', '3', '4']),
      {
        length: 3,
        sequence: ['1', '2', '3'],
        offset: 1,
      }
    );
  });

  it('returns a sequence at the end of an array with matching prefix', () => {
    assert.deepStrictEqual(
      longestCommonSequence(['0', '1', '2'], ['0', '1', '2', '3']),
      {
        length: 3,
        sequence: ['0', '1', '2'],
        offset: 0,
      }
    );
  });
});
