import {generateJsonPatch, JsonValue, Patch} from "./index";
import {applyPatch, deepClone} from "fast-json-patch";
import {expect} from "chai";

type Title = string;
type Before = JsonValue;
type After = JsonValue;
type TestDefinition = [Title, Before, After, Patch]

describe('a generate json patch function', () => {

    const tests: TestDefinition[] = [
        ['adds root array elements', [1, 2, 3], [1, 2, 3, 4], [{op: 'add', path: '/3', value: 4}]],
        ['adds root object property', {a: "a", b: "b"}, {a: "a", b: "b", c: "c"}, [{
            op: 'add',
            path: '/c',
            value: 'c'
        }]],
        ['removes root array elements', [1, 2, 3, 4], [1, 2, 3], [{op: 'remove', path: '/3'}]],
        ['removes root object property', {a: "a", b: "b", c: "c"}, {a: "a", b: "b"}, [{op: 'remove', path: '/c'}]],
        ['replaces root number values', 1, 2, [{op: 'replace', path: '', value: 2}]],
        ['replaces root string values', 'hello', 'world', [{op: 'replace', path: '', value: 'world'}]],
        ['replaces root boolean values', true, false, [{op: 'replace', path: '', value: false}]],

        ['replaces root empty arrays', [], [], []],
        ['replaces root object property', {a: "a", b: "b"}, {a: "a", b: "c"}, [{
            op: 'replace',
            path: '/b',
            value: 'c'
        }]],
        ['replaces root array elements', [1, 2, 3], [1, 2, 4], [{op: 'replace', path: '/2', value: 4}]],
        ['replaces an obj prop with an array property', {prop: {hello: 'world'}}, {prop: ['hello', 'world']}, [{
            op: 'replace',
            path: '/prop',
            value: ['hello', 'world']
        }]],
        ['replaces an array prop with an obj property', {prop: ['hello', 'world']}, {prop: {hello: 'world'}}, [{
            op: 'replace',
            path: '/prop',
            value: {hello: 'world'}
        }]],
        ['replaces a deep nested object property',
            {root: {first: {second: {third: 'before'}}}},
            {root: {first: {second: {third: 'after'}}}},
            [{
                op: 'replace',
                path: '/root/first/second/third',
                value: 'after'
            }
            ]
        ],
        ['replaces a deep nested object property along an array path',
            {root: {first: [{}, {second: {third: 'before', list: ['hello', 'world']}}]}},
            {root: {first: [{}, {second: {third: 'after', list: ['hello', 'world']}}]}},
            [{
                op: 'replace',
                path: '/root/first/1/second/third',
                value: 'after'
            }
            ]
        ],
        ['detects several changes on arrays by reference',
            {root: [{id: 1}, {id: 2}, {id: 3}, {id: 4}]},
            {root: [{id: 4}, {id: 3}, {id: 2}]},
            [{
                op: 'replace',
                path: '/root/0/id',
                value: 4
            },{
                op: 'replace',
                path: '/root/1/id',
                value: 3
            },{
                op: 'replace',
                path: '/root/2/id',
                value: 2
            },{
                op: 'remove',
                path: '/root/3',
            }
            ]
        ],
    ]
    tests.forEach(([testTitle, beforeJson, afterJson, patch]) => {
        it(testTitle, () => {
            expectIdentical(beforeJson, afterJson, patch)
        })
    })

    describe('with an array comparator', () => {

        it("handles changes with change and move on the same property", () => {
            const before = [
                {id: 1, paramOne: "future", paramTwo: "past"},
                {id: 2, paramOne: "current"}
            ]
            const after = [
                {id: 2, paramOne: "current"},
                {id: 1, paramOne: "current"}
            ]

            const patch = generateJsonPatch(before, after, {
                comparator: function (obj: any, direction) {
                    return `${obj.id}`;
                }
            })
            const patched = doPatch(before, patch)

            // as long as we do not support move, the result will be different from 'after' in its order
            expect(patched).to.be.eql([
                {id: 1, paramOne: "current"},
                {id: 2, paramOne: "current"}
            ]);
        })

        it("handles changes with custom comparator based on direction param", () => {
            const before = [
                {
                    id: 1, value: 'left'
                },
                {
                    id: 2, value: 'left'
                }
            ]
            const after = [
                {
                    id: 1, value: 'right'
                },
                {
                    id: 2, value: 'right'
                }
            ]

            const patch = generateJsonPatch(before, after, {
                comparator: function (obj: any, direction) {
                    if (obj.id === 1 && direction === 'right') {
                        return '4'
                    }
                    return `${obj.id}`;
                }
            })


            expect(patch).to.be.eql([
                {
                    op: "add",
                    path: "/0",
                    value: {
                        id: 1,
                        value: "right"
                    }
                },
                {
                    op: "replace",
                    path: "/1/value",
                    value: "right"
                }
            ]);
        })

        it.skip("handles changes with change and move on the same property detected by the direction param", () => {

        })
    })
    describe('with property filter', () => {
        it('ignores property on root filter', () => {
            const before = {
                id: 1,
                paramOne: "before",
                paramTwo: {
                    ignoreMe: 'before',
                    doNotIgnoreMe: 'before'
                }
            };

            const after = {
                id: 1,
                paramOne: "after",
                paramTwo: {
                    ignoreMe: 'after',
                    doNotIgnoreMe: 'after'
                }
            };

            const patch = generateJsonPatch(before, after, {
                propertyFilter: function (propertyName, context) {
                    return propertyName !== 'ignoreMe'
                }
            })

            const patched = doPatch(before, patch)
            expect(patched).to.be.eql({
                id: 1,
                paramOne: "after",
                paramTwo: {ignoreMe: 'before', doNotIgnoreMe: 'after'}
            });
        })
    })
})

function doPatch(json: JsonValue, patch: Patch) {
    return applyPatch(
        deepClone(json),
        patch,
        true,
        true
    ).newDocument;
}

function expectIdentical(before: JsonValue, after: JsonValue, expectedPatch?: Patch) {
    const patch = generateJsonPatch(before, after)
    const patched = doPatch(before, patch)
    expect(patched).to.be.eql(after);
    if (expectedPatch) {
        expect(patch).to.be.eql(expectedPatch);
    }
}

//function expectPatch(before: JsonValue, after: JsonValue, patch: Patch) {
//    expect(generateJsonPatch(before, after)).to.be.eql(patch);
//}