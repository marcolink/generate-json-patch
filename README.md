# generate-json-patch


Creates [RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902/) compliant JSON Patch objects based on two given JSON objects. 

[![Version](https://img.shields.io/npm/v/generate-json-patch.svg)](https://npmjs.org/package/generate-json-patch)
[![Downloads/week](https://img.shields.io/npm/dw/generate-json-patch.svg)](https://npmjs.org/package/generate-json-patch)
[![License](https://img.shields.io/npm/l/generate-json-patch.svg)](https://github.com/marcoxlink/generate-json-patch/blob/main/package.json)


# Installation 
```bash
npm install generate-json-patch
```

# Usage

```typescript
import {generateJSONPatch} from 'generate-json-patch';

const before = { name: "Berta", manufacturer: "Ford", type: "Granada", year: 1972 };
const after = { name: "Berta", manufacturer: "Ford", type: "Granada", year: 1974 };

const patch = generateJSONPatch(before, after):

console.log(patch) // => [{op: 'replace', path: '/year', value: 1974}]
```
                           

> This project is inspired by https://github.com/benjamine/jsondiffpatch
