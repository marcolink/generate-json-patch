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

        const leftHashes = leftArr.map((value) => comparator(value, 'left'));
        const rightHashes = rightArr.map((value) => comparator(value, 'right'));
        let currentIndex = 0;

        // TODO: implement remove here
        const notMatchedIndex: number[] = [];
        const shouldMove = [];

        for (let i = 0; i < leftHashes.length; i++) {
            const newPathIndex = `${newPath}/${currentIndex++}`;
            const rightHashIndex = rightHashes.indexOf(leftHashes[i]);
            if (rightHashIndex >= 0) {
                // matched by hash (exists on both sides) - compare elements
                compareObjects(newPathIndex, leftArr[i], rightArr[rightHashIndex]);
                if (i !== rightHashIndex) {
                    // matching hashes, but different indexes
                    shouldMove.push(leftHashes[i]);
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

    function compareArrays(leftArr: any[], rightArr: any[], newPath: string) {
        if (comparator) {
            compareArrayByHash(leftArr, rightArr, newPath);
        } else {
            compareArrayByIndex(leftArr, rightArr, newPath);
        }
    }

    function compareObjects(path: string, leftObj: any, rightObj: any) {
        const isArrayAtTop =
            path === "" && (Array.isArray(leftObj) && Array.isArray(rightObj));

        if (isPrimitiveValue(leftObj) && isPrimitiveValue(rightObj)) {
            if (leftObj !== rightObj) {
                patch.push({op: "replace", path: path, value: rightObj});
            }
            return;
        }

        if (isArrayAtTop) {
            return compareArrays(leftObj, rightObj, "");
        }

        // if one of the current values is an array, we can't go deeper
        if (Array.isArray(leftObj) && !Array.isArray(rightObj) || !Array.isArray(leftObj) && Array.isArray(rightObj)) {
            patch.push({op: "replace", path: path, value: rightObj});
            return;
        }

        for (const rightKey in rightObj) {
            if (hasPropertyFilter && !propertyFilter(rightKey, 'right')) continue;

            let newPath = isArrayAtTop && path === "" ? `/${rightKey}` : `${path}/${rightKey}`;
            const leftValue = leftObj[rightKey];
            const rightValue = rightObj[rightKey];

            if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
                compareArrays(leftValue, rightValue, newPath);
            } else if (typeof rightValue === "object" && rightValue !== null) {
                if (typeof leftValue === "object" && leftValue !== null) {
                    compareObjects(newPath, leftValue, rightValue);
                } else {
                    patch.push({op: "replace", path: newPath, value: rightValue});
                }
            } else if (!leftObj.hasOwnProperty(rightKey)) {
                patch.push({op: "add", path: newPath, value: rightValue});
            } else if (leftValue !== rightValue) {
                patch.push({op: "replace", path: newPath, value: rightValue});
            }
        }

        for (const leftKey in leftObj) {
            if (!leftObj.hasOwnProperty(leftKey) || (hasPropertyFilter && !propertyFilter(leftKey, 'left'))) continue;

            if (!rightObj.hasOwnProperty(leftKey)) {
                let newPath =
                    isArrayAtTop && path === "" ? `/${leftKey}` : `${path}/${leftKey}`;
                patch.push({op: "remove", path: newPath});
            }
        }
    }

    compareObjects("", before, after);

    return [...patch];
}
