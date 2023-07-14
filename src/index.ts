type JsonObject = {[Key in string]: JsonValue} & {[Key in string]?: JsonValue | undefined};

type JsonArray = JsonValue[] | readonly JsonValue[];

type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | JsonObject | JsonArray;

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

export interface CopyOperation extends BaseOperation {
    op: "copy";
    from: string;
}

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

type Direction = 'left' | 'right'
interface Config {
    comparator?: (obj: JsonValue, direction: Direction) => string;
}

export function generateJsonPatch(
    before: JsonValue,
    after: JsonValue,
    config: Config = {}
): Patch {
    const {comparator} = config;
    const patch: Patch = [];

    function isScalar(value: JsonValue): boolean {
        return (
            value === null ||
            typeof value === "undefined" ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        );
    }

    function getComparatorHash(obj: JsonValue, direction: Direction): string {
        if (comparator && typeof obj === "object" && obj !== null) {
            return comparator(obj, direction);
        }
        return 'unknown';
    }

    function compareArrayByIndex(arr1: JsonArray, arr2: JsonArray, newPath: string) {
        let currentIndex = 0;
        const maxLength = Math.max(arr1.length, arr2.length);
        for (let i = 0; i < maxLength; i++) {
            const newPathIndex = `${newPath}/${currentIndex++}`;
            // we have elements on both sides
            if (i < arr1.length && i < arr2.length) {
                compareObjects(newPathIndex, arr1[i], arr2[i]);
                // we only have elements on arr 2
            } else if (i >= arr1.length && i < arr2.length) {
                patch.push({op: "add", path: newPathIndex, value: arr2[i]});
                // we only have elements on arr 1
            } else if (i < arr1.length && i >= arr2.length) {
                patch.push({op: "remove", path: newPathIndex});
                // we need to decrement the current index for further operations
                currentIndex--;
            }
        }
    }

    function compareArrayByHash(arr1: JsonArray, arr2: JsonArray, newPath: string) {
        if (!getComparatorHash) {
            throw Error('No hash function provided')
        }

        const arr1Hashes = arr1.map((value) => getComparatorHash(value, 'left'));
        const arr2Hashes = arr2.map((value) => getComparatorHash(value, 'right'));
        let currentIndex = 0;

        const notMatchedIndex: number[] = [];
        const shouldMove = [];

        for (let i = 0; i < arr1Hashes.length; i++) {
            const newPathIndex = `${newPath}/${currentIndex++}`;
            const arr2HashIndex = arr2Hashes.indexOf(arr1Hashes[i]);
            if (arr2HashIndex >= 0) {
                // matched by hash (exists on both sides) - compare elements
                compareObjects(newPathIndex, arr1[i], arr2[arr2HashIndex]);
                if (i !== arr2HashIndex) {
                    // matching hashes, but different indexes
                    shouldMove.push(arr1Hashes[i]);
                }
            } else {
                // only exists on arr1, has to be added to arr2
                patch.push({op: "add", path: newPathIndex, value: arr2[i]});
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
            path === "" && (Array.isArray(o1) || Array.isArray(o2));

        if (isScalar(o1) && isScalar(o2)) {
            if (o1 !== o2) {
                patch.push({op: "replace", path: path, value: o2});
            }
            return;
        }

        if (isArrayAtTop) {
            return compareArrays(o1, o2, "");
        }

        for (const key in o2) {
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
            if (!o1.hasOwnProperty(key)) continue;

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
