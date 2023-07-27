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
- `move` operations are ALWAYS **appended at the end**, therefore, they can be ignored (if wanted) when the patch gets applied.
- :paw_prints: ***Is it small?*** Zero dependencies - it's ~**7 KB** (uncompressed).
- :crystal_ball: ***Is it fast?*** I haven't done any performance comparison yet.
- :hatched_chick: ***Is it stable?*** Test coverage is high, but it's still in its early days - bugs are expected.
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

const before = { manufacturer: "Ford", type: "Granada", year: 1972 };
const after = { manufacturer: "Ford", type: "Granada", year: 1974 };

const patch = generateJSONPatch(before, after);

console.log(patch) // => [{op: 'replace', path: '/year', value: 1974}]
```

## Configuration

```typescript
import { generateJSONPatch, JsonPatchConfig, JsonValue } from 'generate-json-patch';

generateJSONPatch({/*...*/}, {/*...*/}, {
    // called when comparing array elements
    objectHash: function(value: JsonValue, context: GeneratePatchContext) {
        // for arrays of primitive values like string and numbers, a stringification is sufficent:
        // return JSON.stringify(value)
        // If we know the shape of the value, we can match be specific properties
        return value.name
    },
    // called for every property on objects. Can be used to ignore sensitive or irrelevant 
    // properties when comparing data.
    propertyFilter: function (propertyName: string, context: GeneratePatchContext) {
        return !['sensitiveProperty'].includes(propertyName);
    },
    array: {
        // When true, no move operations will be created. 
        // The rersulting patch will not lead to identical objects, 
        // as postions of array elements can be different!
        ignoreMove: true
    }
});
``` 

### Patch Context
Both config function (`objectHash`, `propertyFilter`), receive a patch context as second parameter.
This allows for granular decision-making on the provided data.

#### Example
```typescript
import {generateJSONPatch, JsonPatchConfig, JsonValue, pathInfo} from 'generate-json-patch';

const before = {
    manufacturer: "Ford",
    type: "Granada",
    colors: ['red', 'silver', 'yellow'],
    engine: [
        {name: 'Cologne V6 2.6', hp: 125},
        {name: 'Cologne V6 2.0', hp: 90},
        {name: 'Cologne V6 2.3', hp: 108},
        {name: 'Essex V6 3.0', hp: 138},
    ]
}

const after = {
    manufacturer: "Ford",
    type: "Granada",
    colors: ['red', 'silver', 'yellow'],
    engine: [
        {name: 'Essex V6 3.0', hp: 138},
        {name: 'Cologne V6 2.6', hp: 125},
        {name: 'Cologne V6 2.0', hp: 90},
        {name: 'Cologne V6 2.3', hp: 108},
    ]
}

const patch = generateJSONPatch(before, after, {
    objectHash: function (value: JsonValue, context: GeneratePatchContext) {
        const {length, last} = pathInfo(context.path)
        if (length === 2 && last === 'engine') {
            return value.name
        }
        return JSON.stringify(value)
    }
});

console.log(patch) // => [{op: 'replace', from: '/engine/3/hp', value: 140}]
```

> For more examples, check out the [tests](./src/index.spec.ts)


