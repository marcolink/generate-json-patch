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
