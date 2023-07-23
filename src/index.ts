type JsonObject = { [Key in string]: JsonValue } | { [Key in string]?: JsonValue };

type JsonArray = JsonValue[] | readonly JsonValue[];

type JsonPrimitive = string | number | boolean | null;

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

export type GeneratePatchContext = {
    side: 'left' | 'right',
    path: string
}

export type Comparator = (obj: JsonValue, context: GeneratePatchContext) => string;

export type PropertyFilter = (propertyName: string, context: GeneratePatchContext) => boolean;

/**
 * @param {comparator}
 * @param {propertyFilter}
 **/
export type JsonPatchConfig = {
    comparator?: Comparator;
    propertyFilter?: PropertyFilter,
    array?: { ignoreMove?: boolean }
}

export function generateJSONPatch(
    before: JsonValue,
    after: JsonValue,
    config: JsonPatchConfig = {}
): Patch {
    const {comparator, propertyFilter} = config;
    const patch: Patch = [];
    const hasPropertyFilter = typeof propertyFilter === 'function';

    // TODO: detect move by reference or identical primitive value, this should be a config flag
    /*
    Maybe we can just use a default comparator for indexed array comparison that creates hashes of the value :thinking:
     */
    function compareArrayByIndex(leftArr: JsonArray, rightArr: JsonArray, path: string) {
        let currentIndex = 0;
        const maxLength = Math.max(leftArr.length, rightArr.length);
        for (let i = 0; i < maxLength; i++) {
            const newPathIndex = `${path}/${currentIndex++}`;
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

    // TODO: detect move by comparator
    function compareArrayByHash(leftArr: JsonArray, rightArr: JsonArray, path: string) {
        if (typeof comparator !== 'function') {
            throw Error('No comparator function provided')
        }

        const leftHashes = leftArr.map((value) => comparator(value, {side: "left", path}));
        const rightHashes = rightArr.map((value) => comparator(value, {side: "right", path}));
        let currentIndex = 0;

        const targetHashes: string[] = []


        for (let i = 0; i < leftHashes.length; i++) {
            const newPathIndex = `${path}/${currentIndex++}`;
            const rightHashIndex = rightHashes.indexOf(leftHashes[i]);

            // matched by hash (exists on both sides) - compare elements
            if (rightHashIndex >= 0) {
                compareObjects(newPathIndex, leftArr[i], rightArr[rightHashIndex]);
                targetHashes.push(leftHashes[i])
            } else {
                // only exists on left, we remove it
                patch.push({op: "remove", path: newPathIndex});
                currentIndex--
            }
        }

        const toBeAddedHashes = rightHashes.filter(hash => !targetHashes.includes(hash))

        for (const toBeAddedHash of toBeAddedHashes) {
            patch.push({
                op: "add",
                path: `${path}/${currentIndex++}`,
                value: rightArr[rightHashes.indexOf(toBeAddedHash)]
            });
            targetHashes.push(toBeAddedHash)
        }

        if(config.array?.ignoreMove){
            return
        }

        // we calculate all move operations and add them at the end.
        // This way, we can always ignore them when we apply the resulting patch
        for (let i = rightHashes.length - 1; i >= 0; i--) {
            const hash = rightHashes[i]
            const targetIndex = rightHashes.indexOf(hash)
            const currentIndex = targetHashes.indexOf(hash)
            if (currentIndex !== targetIndex) {
                patch.push({op: "move", from: `${path}/${currentIndex}`, path: `${path}/${targetIndex}`})
                moveArrayElement(targetHashes, currentIndex, targetIndex)
            }
        }
    }

    function compareArrays(leftArr: any[], rightArr: any[], path: string) {

        // if arrays are equal, no further comparison is required
        if(JSON.stringify(leftArr) === JSON.stringify(rightArr))return

        if (comparator) {
            compareArrayByHash(leftArr, rightArr, path);
        } else {
            compareArrayByIndex(leftArr, rightArr, path);
        }
    }

    // TODO: type input with JSONValue
    function compareObjects(path: string, leftObj: any, rightObj: any) {
        const isArrayAtTop =
            path === "" && (Array.isArray(leftObj) && Array.isArray(rightObj));

        if (isPrimitiveValue(leftObj) || isPrimitiveValue(rightObj)) {
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
            if (hasPropertyFilter && !propertyFilter(rightKey, {side: "right", path})) continue;

            let newPath = isArrayAtTop && path === "" ? `/${rightKey}` : `${path}/${rightKey}`;
            const leftValue = leftObj[rightKey];
            const rightValue = rightObj[rightKey];

            if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
                compareArrays(leftValue, rightValue, newPath);
            } else if (isJsonObject(rightValue)) {
                if (isJsonObject(leftValue)) {
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
            if (!leftObj.hasOwnProperty(leftKey) || (hasPropertyFilter
                && !propertyFilter(leftKey, {side: "left", path}))) continue;

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

function isPrimitiveValue(value: JsonValue): boolean {
    return (
        value === undefined ||
        value === null ||
        typeof value === "undefined" ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    );
}

function isJsonObject(value: JsonValue): value is JsonObject {
    return value?.constructor === Object
}

function moveArrayElement(array: any[], from: number, to: number) {
    array.splice(to, 0, array.splice(from, 1)[0]);
}

/**
 *
 * @property {string[]} segments first element will always be en empty string ("")
 */
export type PathInfoResult = { segments: string[]; length: number; last: string }

/**
 *
 * @param {string} path - a "/" separated path
 * @returns {PathInfoResult}
 */
export function pathInfo(path: string): PathInfoResult {
    const segments = path.split('/')
    const length = segments.length
    const last = segments[length - 1]
    return {segments, length, last}
}