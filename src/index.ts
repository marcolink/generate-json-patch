import { moveOperations } from './move-operations';

export type JsonObject = { [Key in string]: JsonValue | undefined };

export type JsonArray = JsonValue[] | readonly JsonValue[];

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

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
};

export const defaultObjectHash: ObjectHash = (obj, context) => {
  return context.index.toString();
};

export function generateJSONPatch(
  before: JsonValue,
  after: JsonValue,
  config: JsonPatchConfig = {}
): Patch {
  const { objectHash = defaultObjectHash, propertyFilter } = config;
  const patch: Patch = [];
  const hasPropertyFilter = typeof propertyFilter === 'function';

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
      if (leftJsonValue !== rightJsonValue) {
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

      let newPath =
        isArrayAtTop && path === '' ? `/${rightKey}` : `${path}/${rightKey}`;
      const leftValue = leftJsonValue[rightKey];
      const rightValue = rightJsonValue[rightKey];

      if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
        compareArrays(leftValue, rightValue, newPath);
      } else if (isJsonObject(rightValue)) {
        if (isJsonObject(leftValue)) {
          compareObjects(newPath, leftValue, rightValue);
        } else if (leftJsonValue.hasOwnProperty(rightKey)) {
          patch.push({ op: 'replace', path: newPath, value: rightValue });
        } else {
          patch.push({ op: 'add', path: newPath, value: rightValue });
        }
      } else if (!leftJsonValue.hasOwnProperty(rightKey)) {
        patch.push({ op: 'add', path: newPath, value: rightValue });
      } else if (leftValue !== rightValue) {
        patch.push({ op: 'replace', path: newPath, value: rightValue });
      }
    }

    for (const leftKey in leftJsonValue) {
      if (
        !leftJsonValue.hasOwnProperty(leftKey) ||
        (hasPropertyFilter && !propertyFilter(leftKey, { side: 'left', path }))
      )
        continue;

      if (!rightJsonValue.hasOwnProperty(leftKey)) {
        let newPath =
          isArrayAtTop && path === '' ? `/${leftKey}` : `${path}/${leftKey}`;
        patch.push({ op: 'remove', path: newPath });
      }
    }
  }

  compareObjects('', before, after);

  return [...patch];
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
