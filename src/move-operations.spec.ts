import { expect } from 'chai';
import { longestCommonSequence, moveOperations } from './move-operations';

describe('a moveOperations function', () => {
  it('should return an empty array when given two empty arrays', () => {
    expect(moveOperations([], [])).to.eql([]);
  });
  it('should return an empty array when given two arrays with the same values', () => {
    expect(moveOperations(['1', '2', '3'], ['1', '2', '3'])).to.eql([]);
  });
  it('should return a single move operation when given two arrays with one value moved', () => {
    expect(moveOperations(['1', '2', '3'], ['1', '3', '2'])).to.eql([
      { op: 'move', from: '/2', path: '/1' },
    ]);
  });
  it('should return a single move operation when given two arrays with one value moved and different length', () => {
    expect(moveOperations(['1', '2', '3', '4'], ['1', '3', '2'])).to.eql([
      { op: 'move', from: '/2', path: '/1' },
    ]);
  });
  it('should return an empty array when given two arrays with a removed key', () => {
    expect(moveOperations(['0', '1', '2'], ['0', '1', '2', '3'])).to.eql([]);
  });
  it('should return an empty array when given two arrays with aan added key', () => {
    expect(moveOperations(['0', '1', '2', '3'], ['0', '1', '2'])).to.eql([]);
  });
});

describe('a longestCommonSequence function', () => {
  it('should return an empty array when given two empty arrays', () => {
    expect(longestCommonSequence([], [])).to.eql({
      length: 0,
      sequence: [],
      offset: null,
    });
  });
  it('should return the full sequence when given two identical arrays', () => {
    expect(longestCommonSequence(['1', '2', '3'], ['1', '2', '3'])).to.eql({
      length: 3,
      sequence: ['1', '2', '3'],
      offset: 0,
    });
  });
  it('should return the a sequence at the beginning of an array', () => {
    expect(
      longestCommonSequence(['1', '2', '3', '4'], ['4', '1', '2', '3'])
    ).to.eql({
      length: 3,
      sequence: ['1', '2', '3'],
      offset: 0,
    });
  });
  it('should return the a sequence at the end of an array', () => {
    expect(
      longestCommonSequence(['4', '1', '2', '3'], ['1', '2', '3', '4'])
    ).to.eql({
      length: 3,
      sequence: ['1', '2', '3'],
      offset: 1,
    });
  });

  it('should return the a sequence at the end of an array', () => {
    expect(longestCommonSequence(['0', '1', '2'], ['0', '1', '2', '3'])).to.eql(
      {
        length: 3,
        sequence: ['0', '1', '2'],
        offset: 0,
      }
    );
  });
});
