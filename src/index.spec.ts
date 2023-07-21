import {generateJsonPatch, JsonValue} from "./index";
import {applyPatch, deepClone} from "fast-json-patch";
import {expect} from "chai";

describe('a generate json patch function', () => {
    describe('without an array comparator', () => {
        it("can patch scalar number values", () => {
            expectIdentical(1, 2)
        })
        it("can patch scalar string values", () => {
            expectIdentical('hello', 'world')
        })
        it("can patch scalar boolean values", () => {
            expectIdentical(true, false)
        })
        it("can patch empty arrays", () => {
            expectIdentical([], [])
        })
        it("can add top level array elements", () => {
            expectIdentical([1, 2, 3], [1, 2, 3, 4])
        })
        it("can add top level elements", () => {
            expectIdentical({a: "a", b: "b"}, {a: "a", b: "b", c: "c"})
        })
        it("can remove top level array elements", () => {
            expectIdentical([1, 2, 3, 4], [1, 2, 3])
        })
        it("can remove top level elements", () => {
            expectIdentical({a: "a", b: "b", c: "c"}, {a: "a", b: "b"})
        })
        it("can replace top level elements", () => {
            expectIdentical({a: "a", b: "b"}, {a: "a", b: "c"})
        })
        it("can replace top level array elements", () => {
            expectIdentical([1, 2, 3], [1, 2, 4])
        })
        it("can replace an obj prop with an array prop", () => {
            expectIdentical({prop: {hello: 'world'}}, {prop: ['hello', 'world']})
        })
        it("can replace an array prop with an obj prop", () => {
            expectIdentical({prop: ['hello', 'world']}, {prop: {hello: 'world'}})
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
            const patched = applyPatch(
                deepClone(before),
                patch,
                true,
                true
            ).newDocument;

            // as long as we do not support move, the result will be different from 'after' in it's order
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
})

function expectIdentical(before: JsonValue, after: JsonValue) {
    const patch = generateJsonPatch(before, after)
    const patched = applyPatch(
        deepClone(before),
        patch,
        true,
        true
    ).newDocument;
    expect(patched).to.be.eql(after);
}

function expectIdenticalWithComparator(before: JsonValue, after: JsonValue) {
    const patch = generateJsonPatch(before, after, {
        comparator: function (obj: any, direction) {
            if (obj && obj.id) {
                return obj.id;
            }
        }
    })
    const patched = applyPatch(
        deepClone(before),
        patch,
        true,
        true
    ).newDocument;

    expect(patched).to.be.eql(after);
}