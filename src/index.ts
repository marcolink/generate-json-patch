import { moveOperations } from './move-operations';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type JsonObject =
  | { [Key in string]: JsonValue | undefined }
  | { [key: string]: any };

export type JsonArray = JsonValue[] | readonly JsonValue[];

export interface BaseOperation {
  path: string;
}

export interface AddOperation<T = any> extends BaseOperation {
  op: 'add';
  value: T;
}

export interface RemoveOperation extends BaseOperation {
  op: 'remove';
}

export interface ReplaceOperation<T = any> extends BaseOperation {
  op: 'replace';
  value: T;
}

export interface MoveOperation extends BaseOperation {
  op: 'move';
  from: string;
}

export interface CopyOperation extends BaseOperation {
  op: 'copy';
  from: string;
}

export interface TestOperation<T = any> extends BaseOperation {
  op: 'test';
  value: T;
}

export type Operation =
  | AddOperation
  | RemoveOperation
  | ReplaceOperation
  | MoveOperation
  | CopyOperation
  | TestOperation;

export type Patch = Operation[];

export type GeneratePatchContext = {
  side: 'left' | 'right';
  path: string;
};

export type ObjectHashContext = GeneratePatchContext & { index: number };

export type ObjectHash = (obj: JsonValue, context: ObjectHashContext) => string;

export type PropertyFilter = (
  propertyName: string,
  context: GeneratePatchContext
) => boolean;

export type JsonPatchConfig = {
  objectHash?: ObjectHash;
  propertyFilter?: PropertyFilter;
  array?: { ignoreMove?: boolean };
  maxDepth?: number;
};

export const defaultObjectHash: ObjectHash = (obj, context) => {
  return context.index.toString();
};

export function generateJSONPatch(
  before: JsonValue,
  after: JsonValue,
  config: JsonPatchConfig = {}
): Patch {
  const {
    objectHash = defaultObjectHash,
    propertyFilter,
    maxDepth = Infinity,
  } = config;
  const patch: Patch = [];
  const hasPropertyFilter = typeof propertyFilter === 'function';

  function maxDepthReached(path: string) {
    return maxDepth <= path.split('/').length;
  }

  function compareArrays(leftArr: any[], rightArr: any[], path: string) {
    // if arrays are equal, no further comparison is required
    if (JSON.stringify(leftArr) === JSON.stringify(rightArr)) return;

    const leftHashes = leftArr.map((value, index) =>
      objectHash(value, { side: 'left', path, index })
    );
    const rightHashes = rightArr.map((value, index) =>
      objectHash(value, { side: 'right', path, index })
    );

    let currentIndex = leftArr.length - 1;
    const targetHashes: string[] = [];

    // This is not respecting identical arrays
    if (maxDepthReached(path)) {
      if (JSON.stringify(leftHashes) === JSON.stringify(rightHashes)) return;
      patch.push({ op: 'replace', path: path, value: rightArr });
      return;
    }

    // Change iteration direction: from back to front
    for (let i = leftArr.length - 1; i >= 0; i--) {
      const newPathIndex = `${path}/${currentIndex--}`;
      // find index of element from target array in source array
      const rightHashIndex = rightHashes.indexOf(leftHashes[i]);

      // if element exists in source and target array
      if (rightHashIndex >= 0) {
        compareObjects(newPathIndex, leftArr[i], rightArr[rightHashIndex]);
        targetHashes.unshift(leftHashes[i]);
      } else {
        // only exists on target, we remove it
        patch.push({ op: 'remove', path: newPathIndex });
      }
    }

    const toBeAddedHashes = rightHashes.filter(
      (hash) => !targetHashes.includes(hash)
    );

    currentIndex = targetHashes.length;

    for (const toBeAddedHash of toBeAddedHashes) {
      // Reverse to iterate from back to front
      patch.push({
        op: 'add',
        path: `${path}/${currentIndex++}`,
        value: rightArr[rightHashes.indexOf(toBeAddedHash)],
      });
      targetHashes.push(toBeAddedHash);
    }

    if (config.array?.ignoreMove) {
      return;
    }

    const moveOps = moveOperations(targetHashes, rightHashes, path);
    patch.push(...moveOps);
  }

  function compareObjects(
    path: string,
    leftJsonValue: any,
    rightJsonValue: any
  ) {
    const isArrayAtTop =
      path === '' && [leftJsonValue, rightJsonValue].every(Array.isArray);

    if (isPrimitiveValue(leftJsonValue) || isPrimitiveValue(rightJsonValue)) {
      if (JSON.stringify(leftJsonValue) !== JSON.stringify(rightJsonValue)) {
        patch.push({ op: 'replace', path: path, value: rightJsonValue });
      }
      return;
    }

    if (isArrayAtTop) {
      return compareArrays(leftJsonValue, rightJsonValue, '');
    }

    // if one of the current values is an array, we can't go deeper
    if ([leftJsonValue, rightJsonValue].some(Array.isArray)) {
      patch.push({ op: 'replace', path: path, value: rightJsonValue });
      return;
    }

    for (const rightKey in rightJsonValue) {
      if (
        hasPropertyFilter &&
        !propertyFilter(rightKey, { side: 'right', path })
      )
        continue;

      const newPath = buildPath(path, rightKey);
      const leftValue = leftJsonValue[rightKey];
      const rightValue = rightJsonValue[rightKey];

      if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
        compareArrays(leftValue, rightValue, newPath);
      } else if (isJsonObject(rightValue)) {
        if (isJsonObject(leftValue)) {
          if (maxDepthReached(newPath)) {
            if (!deepEqual(leftValue, rightValue)) {
              patch.push({ op: 'replace', path: newPath, value: rightValue });
            }
          } else {
            compareObjects(newPath, leftValue, rightValue);
          }
        } else if (
          Object.prototype.hasOwnProperty.call(leftJsonValue, rightKey)
        ) {
          patch.push({ op: 'replace', path: newPath, value: rightValue });
        } else {
          patch.push({ op: 'add', path: newPath, value: rightValue });
        }
      } else if (
        !Object.prototype.hasOwnProperty.call(leftJsonValue, rightKey)
      ) {
        patch.push({ op: 'add', path: newPath, value: rightValue });
      } else if (leftValue !== rightValue) {
        patch.push({ op: 'replace', path: newPath, value: rightValue });
      }
    }

    for (const leftKey in leftJsonValue) {
      if (
        !Object.prototype.hasOwnProperty.call(leftJsonValue, leftKey) ||
        (hasPropertyFilter && !propertyFilter(leftKey, { side: 'left', path }))
      )
        continue;

      if (!Object.prototype.hasOwnProperty.call(rightJsonValue, leftKey)) {
        const newPath = buildPath(path, leftKey);
        patch.push({ op: 'remove', path: newPath });
      }
    }
  }

  compareObjects('', before, after);

  return [...patch];
}

const tokenEscapedTildeRegExp = /~/g;
const tokenEscapedSlashRegExp = /\//g;

/**
 * Escapes a JSON Pointer reference token per RFC 6901.
 * Order matters: "~" must be replaced before "/" to preserve "~1" sequences.
 */
function escapeReferenceToken(token: string): string {
  return token
    .replace(tokenEscapedTildeRegExp, '~0')
    .replace(tokenEscapedSlashRegExp, '~1');
}

/**
 * Builds an RFC 6901-compliant JSON Pointer path by escaping a key token
 * and appending it to the current path.
 */
function buildPath(path: string, key: string): string {
  const escapedKey = escapeReferenceToken(key);
  if (path === '') {
    return `/${escapedKey}`;
  }
  return `${path}/${escapedKey}`;
}

function isPrimitiveValue(value: JsonValue): value is JsonValue {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'undefined' ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value?.constructor === Object;
}

function deepEqual(objA: any, objB: any) {
  return stringifySorted(objA) === stringifySorted(objB);
}

function stringifySorted(obj: any): string {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return JSON.stringify(obj.map((item) => stringifySorted(item)));
  }

  const sortedObj: Record<string, string> = {};
  const sortedKeys = Object.keys(obj).sort();

  sortedKeys.forEach((key) => {
    sortedObj[key] = stringifySorted(obj[key]);
  });

  return JSON.stringify(sortedObj);
}

export type PathInfoResult = {
  segments: string[];
  length: number;
  last: string;
};

export function pathInfo(path: string): PathInfoResult {
  const segments = path.split('/');
  const length = segments.length;
  const last = segments[length - 1];
  return { segments, length, last };
}

export { moveOperations, longestCommonSequence } from './move-operations';
