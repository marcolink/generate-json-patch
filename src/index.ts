type JsonObject = { [Key in string]: JsonValue } & { [Key in string]?: JsonValue | undefined };

type JsonArray = JsonValue[] | readonly JsonValue[];

type JsonPrimitive = string | number | boolean | null | undefined;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface BaseOperation {
    path: string;
}

export interface AddOperation<T = any> extends BaseOperation {
    op: "add";
    value: T;
}

export interface RemoveOperation extends BaseOperation {
    op: "remove";
}

export interface ReplaceOperation<T = any> extends BaseOperation {
    op: "replace";
    value: T;
}

export interface MoveOperation extends BaseOperation {
    op: "move";
    from: string;
}
// We do not generate those
export interface CopyOperation extends BaseOperation {
    op: "copy";
    from: string;
}

// We do not generate those
export interface TestOperation<T = any> extends BaseOperation {
    op: "test";
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

type Context = 'left' | 'right'

/**
 * @param {comparator}
 * @param {propertyFilter}
 **/
export type JsonPatchConfig = {
    comparator?: (obj: JsonValue, context: Context) => string;
    propertyFilter?: (propertyName: string, context: Context) => boolean;
}

function isPrimitiveValue(value: JsonValue): boolean {
    return (
        value === null ||
        typeof value === "undefined" ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    );
}

export function generateJsonPatch(
    before: JsonValue,
    after: JsonValue,
    config: JsonPatchConfig = {}
): Patch {
    const {comparator, propertyFilter} = config;
    const patch: Patch = [];
    const hasPropertyFilter = typeof propertyFilter === 'function';


    // TODO: detect move by reference or identical primitive value, this should be a config flag
    function compareArrayByIndex(leftArr: JsonArray, rightArr: JsonArray, newPath: string) {
        let currentIndex = 0;
        const maxLength = Math.max(leftArr.length, rightArr.length);
        for (let i = 0; i < maxLength; i++) {
            const newPathIndex = `${newPath}/${currentIndex++}`;
            // we have elements on both sides
            if (i < leftArr.length && i < rightArr.length) {
                compareObjects(newPathIndex, leftArr[i], rightArr[i]);
                // we only have elements on arr 2
            } else if (i >= leftArr.length && i < rightArr.length) {
                patch.push({op: "add", path: newPathIndex, value: rightArr[i]});
                // we only have elements on arr 1
            } else if (i < leftArr.length && i >= rightArr.length) {
                patch.push({op: "remove", path: newPathIndex});
                // we need to decrement the current index for further operations
                currentIndex--;
            }
        }
    }

    function compareArrayByHash(leftArr: JsonArray, rightArr: JsonArray, newPath: string) {
        if (!comparator) {
            throw Error('No hash function provided')
        }

        const left1Hashes = leftArr.map((value) => comparator(value, 'left'));
        const rightHashes = rightArr.map((value) => comparator(value, 'right'));
        let currentIndex = 0;

        // TODO: implement remove here
        const notMatchedIndex: number[] = [];
        const shouldMove = [];

        for (let i = 0; i < left1Hashes.length; i++) {
            const newPathIndex = `${newPath}/${currentIndex++}`;
            const rightHashIndex = rightHashes.indexOf(left1Hashes[i]);
            if (rightHashIndex >= 0) {
                // matched by hash (exists on both sides) - compare elements
                compareObjects(newPathIndex, leftArr[i], rightArr[rightHashIndex]);
                if (i !== rightHashIndex) {
                    // matching hashes, but different indexes
                    shouldMove.push(left1Hashes[i]);
                }
            } else {
                // only exists on arr1, has to be added to arr2
                patch.push({op: "add", path: newPathIndex, value: rightArr[i]});
            }
        }

        for (const i of notMatchedIndex) {
            patch.push({op: "remove", path: `${newPath}/${i}`});
        }
    }

    function compareArrays(arr1: any[], arr2: any[], newPath: string) {
        if (comparator) {
            compareArrayByHash(arr1, arr2, newPath);
        } else {
            compareArrayByIndex(arr1, arr2, newPath);
        }
    }

    function compareObjects(path: string, o1: any, o2: any) {
        const isArrayAtTop =
            path === "" && (Array.isArray(o1) && Array.isArray(o2));

        if (isPrimitiveValue(o1) && isPrimitiveValue(o2)) {
            if (o1 !== o2) {
                patch.push({op: "replace", path: path, value: o2});
            }
            return;
        }

        if (isArrayAtTop) {
            return compareArrays(o1, o2, "");
        }

        // if one of the current values is an array, we can't go deeper
        if (Array.isArray(o1) && !Array.isArray(o2) || !Array.isArray(o1) && Array.isArray(o2)) {
            patch.push({op: "replace", path: path, value: o2});
            return;
        }

        for (const key in o2) {
            if (hasPropertyFilter && !propertyFilter(key, 'right')) continue;

            let newPath = isArrayAtTop && path === "" ? `/${key}` : `${path}/${key}`;
            const obj1Value = o1[key];
            const obj2Value = o2[key];

            if (Array.isArray(obj1Value) && Array.isArray(obj2Value)) {
                compareArrays(obj1Value, obj2Value, newPath);
            } else if (typeof obj2Value === "object" && obj2Value !== null) {
                if (typeof obj1Value === "object" && obj1Value !== null) {
                    compareObjects(newPath, obj1Value, obj2Value);
                } else {
                    patch.push({op: "replace", path: newPath, value: obj2Value});
                }
            } else if (!o1.hasOwnProperty(key)) {
                patch.push({op: "add", path: newPath, value: obj2Value});
            } else if (obj1Value !== obj2Value) {
                patch.push({op: "replace", path: newPath, value: obj2Value});
            }
        }

        for (const key in o1) {
            if (!o1.hasOwnProperty(key) || (hasPropertyFilter && !propertyFilter(key, 'left'))) continue;

            if (!o2.hasOwnProperty(key)) {
                let newPath =
                    isArrayAtTop && path === "" ? `/${key}` : `${path}/${key}`;
                patch.push({op: "remove", path: newPath});
            }
        }
    }

    compareObjects("", before, after);

    return [...patch];
}
