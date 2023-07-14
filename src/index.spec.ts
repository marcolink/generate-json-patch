import {generateJsonPatch} from "./index";
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
    })
    describe('with an array comparator', () => {

        it("handles changes with change and move on the same property", () => {
            expectIdenticalWithComparator([
                {id: 1, paramOne: "future", paramTwo: "past"},
                {id: 2, paramOne: "current"}
            ], [
                {id: 2, paramOne: "current"},
                {id: 1, paramOne: "current"},
            ])
        })
    })
})

function expectIdentical(before: any, after: any) {
    const patch = generateJsonPatch(before, after)
    const patched = applyPatch(
        deepClone(before),
        patch,
        true,
        true
    ).newDocument;
    expect(patched).to.be.eql(after);
}

function expectIdenticalWithComparator(before: any, after: any) {
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