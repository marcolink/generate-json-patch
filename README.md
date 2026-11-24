# generate-json-patch

Create [RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902/) compliant JSON Patch objects based on two given [JSON](https://www.ecma-international.org/publications-and-standards/standards/ecma-404/) objects with a configurable interface. 

[![Version](https://img.shields.io/npm/v/generate-json-patch.svg)](https://npmjs.org/package/generate-json-patch)
[![Downloads/week](https://img.shields.io/npm/dw/generate-json-patch.svg)](https://npmjs.org/package/generate-json-patch)
[![Size](https://img.shields.io/bundlephobia/min/generate-json-patch.svg)](https://npmjs.org/package/generate-json-patch)
[![Tests](https://github.com/marcolink/generate-json-patch/workflows/CI%20Tests/badge.svg?branch=main)](https://github.com/marcolink/generate-json-patch/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/generate-json-patch.svg)](https://github.com/marcoxlink/generate-json-patch/blob/main/package.json)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
# TL;DR
- Can diff any two [JSON](https://www.ecma-international.org/publications-and-standards/standards/ecma-404/)  compliant objects - returns differences as [JSON Patch](http://jsonpatch.com/).
- Elegant array diffing by providing an `objectHash` to match array elements
- Ignore specific keys by providing a `propertyFilter`
- LCS-based move detection (or disable moves with `array.ignoreMove`)
- Limit traversal with `maxDepth` to collapse deep trees into a single replace
- :paw_prints: ***Is it small?*** Zero dependencies - it's ~**3 KB** (minified).
- Ships ESM + CJS builds with types
- :crystal_ball: ***Is it fast?*** I haven't done any performance comparison yet.
- The interface is inspired by [jsondiffpatch](https://github.com/benjamine/jsondiffpatch)
- **100%** Typescript

# Installation 
Works on node and browser environments. 
```bash
npm install generate-json-patch
```

# Usage

```typescript
import { generateJSONPatch } from 'generate-json-patch';

const before = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1972,
  colors: ['red', 'silver', 'yellow'],
  engine: [
    { name: 'Cologne V6 2.6', hp: 125 },
    { name: 'Cologne V6 2.0', hp: 90 },
    { name: 'Cologne V6 2.3', hp: 108 },
    { name: 'Essex V6 3.0', hp: 138 },
  ],
};

const after = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1974,
  colors: ['red', 'silver', 'yellow'],
  engine: [
    { name: 'Essex V6 3.0', hp: 138 },
    { name: 'Cologne V6 2.6', hp: 125 },
    { name: 'Cologne V6 2.3', hp: 108 },
    { name: 'Cologne V6 2.0', hp: 90 },
  ],
};

const patch = generateJSONPatch(before, after);

console.log(patch);
// [
//   { op: 'replace', path: '/year', value: 1974 },
//   { op: 'move', from: '/engine/3', path: '/engine/0' },
// ]
```

## Configuration

`generateJSONPatch(before, after, config?)` accepts the options below. The examples reuse the same payload shown in the Usage section.

### `objectHash`

Match array elements by a stable hash instead of position. Useful to detect moves and edits for arrays of objects.

```typescript
import { generateJSONPatch, type JsonValue, type ObjectHashContext, pathInfo } from 'generate-json-patch';

const before = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1972,
  colors: ['red', 'silver', 'yellow'],
  engine: [
    { name: 'Cologne V6 2.6', hp: 125 },
    { name: 'Cologne V6 2.0', hp: 90 },
    { name: 'Cologne V6 2.3', hp: 108 },
    { name: 'Essex V6 3.0', hp: 138 },
  ],
};

const after = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1974,
  colors: ['red', 'silver', 'yellow'],
  engine: [
    { name: 'Essex V6 3.0', hp: 138 },
    { name: 'Cologne V6 2.6', hp: 125 },
    { name: 'Cologne V6 2.3', hp: 108 },
    { name: 'Cologne V6 2.0', hp: 90 },
  ],
};

const patch = generateJSONPatch(before, after, {
  objectHash(value: JsonValue, context: ObjectHashContext) {
    const { length, last } = pathInfo(context.path);
    if (length === 2 && last === 'engine') {
      // keep engine comparisons stable by model name
      // @ts-expect-error JsonValue does not guarantee shape
      return value?.name;
    }
    // default to position for other arrays
    return context.index.toString();
  },
});

console.log(patch);
// [
//   { op: 'replace', path: '/year', value: 1974 },
//   { op: 'move', from: '/engine/3', path: '/engine/0' },
// ]
```

### `propertyFilter`

Skip properties when diffing. Return `false` to ignore a field.

```typescript
const before = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1972,
  vin: 'secret-123',
};

const after = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1974,
  vin: 'secret-456',
};

const patch = generateJSONPatch(before, after, {
  propertyFilter(propertyName) {
    return propertyName !== 'vin';
  },
});

console.log(patch);
// [
//   { op: 'replace', path: '/year', value: 1974 }
// ]
```

### `array.ignoreMove`

Prevent move operations if order does not matter to you. The resulting patch will not reorder arrays.

```typescript
const before = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1972,
  engine: [
    { name: 'Cologne V6 2.6', hp: 125 },
    { name: 'Cologne V6 2.0', hp: 90 },
    { name: 'Cologne V6 2.3', hp: 108 },
    { name: 'Essex V6 3.0', hp: 138 },
  ],
};

const after = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1972,
  engine: [
    { name: 'Essex V6 3.0', hp: 138 },
    { name: 'Cologne V6 2.6', hp: 125 },
    { name: 'Cologne V6 2.3', hp: 108 },
    { name: 'Cologne V6 2.0', hp: 90 },
  ],
};

const unorderedPatch = generateJSONPatch(before, after, {
  objectHash: (value: any) => value.name,
  array: { ignoreMove: true },
});

console.log(unorderedPatch);
// []
```

### `maxDepth`

Stop descending deeper than a given path depth. When the limit is reached, a `replace` is emitted for that subtree.

```typescript
const before = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1972,
  specs: {
    trim: 'Base',
    colorOptions: ['red', 'silver', 'yellow'],
  },
};

const after = {
  manufacturer: 'Ford',
  model: 'Granada',
  year: 1974,
  specs: {
    trim: 'Ghia',
    colorOptions: ['red', 'silver', 'yellow'],
  },
};

const patch = generateJSONPatch(before, after, { maxDepth: 2 });

console.log(patch);
// [
//   {
//     op: 'replace',
//     path: '/specs',
//     value: { trim: 'Ghia', colorOptions: ['red', 'silver', 'yellow'] },
//   },
//   { op: 'replace', path: '/year', value: 1974 },
// ]
```

### Patch Context

Both config functions (`objectHash`, `propertyFilter`) receive a context as the second parameter to drive fine-grained decisions:

- `side`: `'left' | 'right'` indicating the value being inspected
- `path`: JSON Pointer-style path to the current value
- `index`: only on `objectHash`, giving the array index being processed

See the `objectHash` example above for how `pathInfo` can be combined with the context to scope hashing logic.

### How moves are found (Longest Common Subsequence)

When `ignoreMove` is `false`, array reorders emit move operations instead of delete/add pairs. We minimize moves by:

1. Hashing array elements with `objectHash` to get stable identifiers.
2. Computing the **[Longest Common Subsequence (LCS)](https://en.wikipedia.org/wiki/Longest_common_subsequence)** between the current order and the target order. The LCS represents items that stay in place.
3. Walking the target order and moving only the out-of-place items, keeping LCS items anchored. This yields the smallest set of `{ op: 'move', from, path }` operations needed to reach the target sequence.

This is implemented in `move-operations.ts` (`longestCommonSequence` + `moveOperations`) and is exercised in the tests in `src/move-operations.spec.ts`.

> For more examples, check out the [tests](./src/index.spec.ts)
