import type { JsonValue, ObjectHashContext, Patch } from './index';
import { generateJSONPatch, pathInfo } from './index';
import { applyPatch, deepClone } from 'fast-json-patch';
import { assert, expect } from 'chai';

type Title = string;
type Before = JsonValue;
type After = JsonValue;
type TestDefinition = [Title, Before, After, Patch];

const jsonValues = {
  arrayOfNumbers: [1, 2, 4],
  arrayOfStrings: ['one', 'two', 'three'],
  arrayOfBooleans: [true, false, true],
  primitiveString: 'hello world',
  primitiveNumber: 42,
  primitiveNull: null,
  primitiveNumberZero: 0,
  primitiveBooleanTrue: true,
  primitiveBooleanFalse: false,
  jsonObjectWithFlatPropertiesAndStringValues: { a: 'a', b: 'b', c: 'c' },
  jsonObjectWithFlatPropertiesAndNumberValues: { a: 3, b: 2, c: 1 },
  jsonObjectWithFlatPropertiesAndMixedValues: { a: true, b: 'b', c: 12 },
} as const;

describe('a generate json patch function', () => {
  describe('can do all operations on different shaped JSON values', () => {
    const keys = Object.keys(jsonValues);
    const keyPairs = keys.flatMap((key, i) =>
      keys.slice(i + 1).map((nextKey) => [key, nextKey])
    );

    keyPairs.forEach(([keyOne, keyTwo]) => {
      it(`${splitKey(keyOne)} becomes ${splitKey(keyTwo)}`, () => {
        // @ts-ignore
        expectPatchedEqualsAfter(jsonValues[keyOne], jsonValues[keyTwo]);
      });
      it(`${splitKey(keyTwo)} becomes ${splitKey(keyOne)}`, () => {
        // @ts-ignore
        expectPatchedEqualsAfter(jsonValues[keyTwo], jsonValues[keyOne]);
      });
    });
  });

  const tests: TestDefinition[] = [
    [
      'adds root array elements',
      [1, 2, 3],
      [1, 2, 3, 4],
      [{ op: 'add', path: '/3', value: 4 }],
    ],
    [
      'adds root object property',
      { a: 'a', b: 'b' },
      { a: 'a', b: 'b', c: 'c' },
      [
        {
          op: 'add',
          path: '/c',
          value: 'c',
        },
      ],
    ],
    [
      'removes root array elements',
      [1, 2, 3, 4],
      [1, 2, 3],
      [{ op: 'remove', path: '/3' }],
    ],
    [
      'removes root object property',
      { a: 'a', b: 'b', c: 'c' },
      { a: 'a', b: 'b' },
      [{ op: 'remove', path: '/c' }],
    ],
    [
      'replaces root number values',
      1,
      2,
      [{ op: 'replace', path: '', value: 2 }],
    ],
    [
      'replaces root string values',
      'hello',
      'world',
      [{ op: 'replace', path: '', value: 'world' }],
    ],
    [
      'replaces root boolean values',
      true,
      false,
      [{ op: 'replace', path: '', value: false }],
    ],

    ['replaces root empty arrays', [], [], []],
    [
      'replaces root object property',
      { a: 'a', b: 'b' },
      { a: 'a', b: 'c' },
      [
        {
          op: 'replace',
          path: '/b',
          value: 'c',
        },
      ],
    ],
    [
      'replaces root array elements',
      [1, 2, 3],
      [1, 2, 4],
      [{ op: 'replace', path: '/2', value: 4 }],
    ],
    [
      'replaces an obj prop with an array property',
      { prop: { hello: 'world' } },
      { prop: ['hello', 'world'] },
      [
        {
          op: 'replace',
          path: '/prop',
          value: ['hello', 'world'],
        },
      ],
    ],
    [
      'replaces an array prop with an obj property',
      { prop: ['hello', 'world'] },
      { prop: { hello: 'world' } },
      [
        {
          op: 'replace',
          path: '/prop',
          value: { hello: 'world' },
        },
      ],
    ],
    [
      'replaces a deep nested object property',
      { root: { first: { second: { third: 'before' } } } },
      { root: { first: { second: { third: 'after' } } } },
      [
        {
          op: 'replace',
          path: '/root/first/second/third',
          value: 'after',
        },
      ],
    ],
    [
      'replaces a deep nested object property along an array path',
      {
        root: {
          first: [
            {},
            { second: { third: 'before', list: ['hello', 'world'] } },
          ],
        },
      },
      {
        root: {
          first: [{}, { second: { third: 'after', list: ['hello', 'world'] } }],
        },
      },
      [
        {
          op: 'replace',
          path: '/root/first/1/second/third',
          value: 'after',
        },
      ],
    ],
    [
      'detects several changes on arrays by reference',
      { root: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] },
      { root: [{ id: 4 }, { id: 3 }, { id: 2 }] },
      [
        {
          op: 'remove',
          path: '/root/3',
        },
        {
          op: 'replace',
          path: '/root/2/id',
          value: 2,
        },
        {
          op: 'replace',
          path: '/root/1/id',
          value: 3,
        },
        {
          op: 'replace',
          path: '/root/0/id',
          value: 4,
        },
      ],
    ],
  ];
  tests.forEach(([testTitle, beforeJson, afterJson, patch]) => {
    describe(testTitle, () => {
      it("patched 'before' equals 'after'", () => {
        expectPatchedEqualsAfter(beforeJson, afterJson);
      });
      it('patch matches expected patch', () => {
        expectPatch(beforeJson, afterJson, patch);
      });
    });
  });

  describe('with an array value hash function', () => {
    it('throws when objectHash is not a function', () => {
      const before = [{ id: 1, paramOne: 'before' }];
      const after = [{ id: 2, paramOne: 'after' }];

      assert.throws(() =>
        generateJSONPatch(before, after, {
          // @ts-ignore
          objectHash: 'not-a-function',
        })
      );
    });

    it('handles changes with change and move on the same property', () => {
      const before = [
        { id: 1, paramOne: 'future', paramTwo: 'past' },
        { id: 2, paramOne: 'current' },
      ];
      const after = [
        { id: 2, paramOne: 'current' },
        { id: 1, paramOne: 'current' },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any) {
          return `${obj.id}`;
        },
      });

      const patched = doPatch(before, patch);
      expect(patched).to.be.eql([
        { id: 2, paramOne: 'current' },
        { id: 1, paramOne: 'current' },
      ]);
    });

    it('handles changes on array objects with different shape', () => {
      const before = [{ id: 1, paramOne: 'current' }];
      const after = [
        {
          id: 1,
          paramOne: 'future',
          paramTwo: 'past',
          paramThree: { nested: 'some text' },
        },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any) {
          return `${obj.id}`;
        },
      });
      const patched = doPatch(before, patch);

      // as long as we do not support move, the result will be different from 'after' in its order
      expect(patched).to.be.eql([
        {
          id: 1,
          paramOne: 'future',
          paramTwo: 'past',
          paramThree: { nested: 'some text' },
        },
      ]);
    });

    it('handles changes with custom objectHash based on direction param', () => {
      const before = [
        {
          id: 1,
          value: 'before',
        },
        {
          id: 2,
          value: 'before',
        },
      ];
      const after = [
        {
          id: 1,
          value: 'after',
        },
        {
          id: 2,
          value: 'after',
        },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any, context) {
          if (obj.id === 1 && context.side === 'right') {
            return '4';
          }
          return `${obj.id}`;
        },
      });

      expect(patch).to.be.eql([
        {
          op: 'replace',
          path: '/1/value',
          value: 'after',
        },
        {
          op: 'remove',
          path: '/0',
        },
        {
          op: 'add',
          path: '/1',
          value: {
            id: 1,
            value: 'after',
          },
        },
        {
          from: '/1',
          op: 'move',
          path: '/0',
        },
      ]);
    });

    it('handles changes with change and move on the same property and added elements', () => {
      const before = [
        {
          id: 1,
          value: 'left',
        },
        {
          id: 2,
          value: 'left',
        },
        {
          id: 3,
          value: 'left',
        },
      ];
      const after = [
        {
          id: 3,
          value: 'right',
        },
        {
          id: 1,
          value: 'right',
        },
        {
          id: 2,
          value: 'right',
        },
        {
          id: 4,
          value: 'right',
        },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any) {
          return `${obj.id}`;
        },
      });

      const patched = doPatch(before, patch);

      expect(patched).to.eql(after);
    });

    it('handles changes with change and move on the same property and removed elements', () => {
      const before = [
        {
          id: 1,
          value: 'left',
        },
        {
          id: 2,
          value: 'left',
        },
        {
          id: 3,
          value: 'left',
        },
      ];
      const after = [
        {
          id: 3,
          value: 'right',
        },
        {
          id: 1,
          value: 'right',
        },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any) {
          return `${obj.id}`;
        },
      });

      const patched = doPatch(before, patch);

      expect(patched).to.eql(after);
    });

    it('handles changes with change and move on the same property and added/removed elements', () => {
      const before = [
        {
          id: 1,
          value: 'left',
        },
        {
          id: 2,
          value: 'left',
        },
        {
          id: 3,
          value: 'left',
        },
      ];
      const after = [
        {
          id: 3,
          value: 'right',
        },
        {
          id: 1,
          value: 'right',
        },
        {
          id: 5,
          value: 'right',
        },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any) {
          return `${obj.id}`;
        },
      });

      const patched = doPatch(before, patch);

      expect(patched).to.eql(after);
    });

    it('handles changes with on array but ignores moves', () => {
      const before = [
        {
          id: 1,
          value: 'left',
        },
        {
          id: 2,
          value: 'left',
        },
        {
          id: 3,
          value: 'left',
        },
      ];
      const after = [
        {
          id: 3,
          value: 'right',
        },
        {
          id: 1,
          value: 'right',
        },
        {
          id: 5,
          value: 'right',
        },
      ];

      const patch = generateJSONPatch(before, after, {
        objectHash: function (obj: any) {
          return `${obj.id}`;
        },
        array: { ignoreMove: true },
      });

      const patched = doPatch(before, patch);

      expect(patched).to.eql([
        {
          id: 1,
          value: 'right',
        },
        {
          id: 3,
          value: 'right',
        },
        {
          id: 5,
          value: 'right',
        },
      ]);
    });

    it('runs context example from readme', () => {
      const before = {
        manufacturer: 'Ford',
        type: 'Granada',
        colors: ['red', 'silver', 'yellow'],
        engine: [
          { name: 'Cologne V6 2.6', hp: 125 },
          { name: 'Cologne V6 2.0', hp: 90 },
          { name: 'Cologne V6 2.3', hp: 108 },
          { name: 'Essex V6 3.0', hp: 150 },
        ],
      };

      const after = {
        manufacturer: 'Ford',
        type: 'Granada',
        colors: ['red', 'silver', 'yellow'],
        engine: [
          { name: 'Essex V6 3.0', hp: 138 },
          { name: 'Cologne V6 2.6', hp: 125 },
          { name: 'Cologne V6 2.0', hp: 90 },
          { name: 'Cologne V6 2.3', hp: 108 },
        ],
      };

      const patch = generateJSONPatch(before, after, {
        objectHash: function (value: JsonValue, context: ObjectHashContext) {
          const { length, last } = pathInfo(context.path);
          if (length === 2 && last === 'engine') {
            // @ts-ignore
            return value?.name;
          }
          return context.index.toString();
        },
      });

      const patched = doPatch(before, patch);
      expect(patched).to.be.eql(after);

      expect(patch).to.be.eql([
        { op: 'replace', path: '/engine/3/hp', value: 138 },
        { op: 'move', from: '/engine/3', path: '/engine/0' },
      ]);
    });
  });

  describe('with property filter', () => {
    it('ignores property on root filter', () => {
      const before = {
        id: 1,
        paramOne: 'before',
        paramTwo: {
          ignoreMe: 'before',
          doNotIgnoreMe: 'before',
        },
      };

      const after = {
        id: 1,
        paramOne: 'after',
        paramTwo: {
          ignoreMe: 'after',
          doNotIgnoreMe: 'after',
        },
      };

      const patch = generateJSONPatch(before, after, {
        propertyFilter: function (propertyName) {
          return propertyName !== 'ignoreMe';
        },
      });

      const patched = doPatch(before, patch);
      expect(patched).to.be.eql({
        id: 1,
        paramOne: 'after',
        paramTwo: { ignoreMe: 'before', doNotIgnoreMe: 'after' },
      });
    });

    it('only respects the prop filter at a given path length', () => {
      const before = {
        id: 1,
        paramOne: 'before',
        paramTwo: {
          ignoreMe: 'before',
          doNotIgnoreMe: 'before',
          two: {
            ignoreMe: 'before',
          },
        },
      };

      const after = {
        id: 1,
        paramOne: 'after',
        paramTwo: {
          ignoreMe: 'after',
          doNotIgnoreMe: 'after',
          two: {
            ignoreMe: 'after',
          },
        },
      };

      const patch = generateJSONPatch(before, after, {
        propertyFilter: function (propertyName, context) {
          if (pathInfo(context.path).length > 2) return true;
          return propertyName !== 'ignoreMe';
        },
      });

      const patched = doPatch(before, patch);
      expect(patched).to.be.eql({
        id: 1,
        paramOne: 'after',
        paramTwo: {
          ignoreMe: 'before',
          doNotIgnoreMe: 'after',
          two: { ignoreMe: 'after' },
        },
      });

      expect(patch).to.eql([
        { op: 'replace', path: '/paramOne', value: 'after' },
        { op: 'replace', path: '/paramTwo/doNotIgnoreMe', value: 'after' },
        { op: 'replace', path: '/paramTwo/two/ignoreMe', value: 'after' },
      ]);
    });

    it('handles consecutive array removal', () => {
      const before = [1, 2, 3];
      const after = [1];

      const patch = generateJSONPatch(before, after);

      const patched = doPatch(before, patch);
      expect(patched).to.be.eql([1]);

      expect(patch).to.eql([
        { op: 'remove', path: '/2' },
        { op: 'remove', path: '/1' },
      ]);
    });
  });

  describe('with maxDepth config', () => {
    const before = {
      firstLevel: {
        secondLevel: {
          thirdLevel: {
            fourthLevel: 'hello-world',
          },
          thirdLevelTwo: 'hello',
        },
      },
    };

    const after = {
      firstLevel: {
        secondLevel: {
          thirdLevel: {
            fourthLevel: 'hello-brave-new-world',
          },
          thirdLevelTwo: 'hello',
        },
      },
    };

    const patch = generateJSONPatch(before, after, { maxDepth: 3 });
    expect(patch).to.eql([
      {
        op: 'replace',
        path: '/firstLevel/secondLevel',
        value: {
          thirdLevel: {
            fourthLevel: 'hello-brave-new-world',
          },
          thirdLevelTwo: 'hello',
        },
      },
    ]);
  });
});

function doPatch(json: JsonValue, patch: Patch) {
  return applyPatch(deepClone(json), patch, true, false).newDocument;
}

function expectPatchedEqualsAfter(before: JsonValue, after: JsonValue) {
  const patch = generateJSONPatch(before, after);
  const patched = doPatch(before, patch);
  expect(patched).to.be.eql(after);
}

function expectPatch(
  before: JsonValue,
  after: JsonValue,
  expectedPatch: Patch
) {
  const patch = generateJSONPatch(before, after);
  expect(patch).to.be.eql(expectedPatch);
}

function splitKey(input: string): string {
  return input
    .split(/(?=[A-Z])/)
    .map((s) => s.toLowerCase())
    .join(' ');
}
