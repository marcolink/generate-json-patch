const assert = require('node:assert/strict');
const { cpus } = require('node:os');
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { applyPatch } = require('fast-json-patch');
const { generateJSONPatch } = require('../dist/index.js');

const baselinePath = process.argv[2];
const baseline = baselinePath
  ? require(resolve(baselinePath)).generateJSONPatch
  : null;
const runs = 9;
const results = [];

function measure(fn) {
  global.gc();
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function median(samples) {
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
}

console.log(
  `${process.version}, ${process.platform}/${process.arch}, ${cpus()[0].model}`
);
console.log(`Median of ${runs} runs; three warmups; GC outside each timing.`);
if (baselinePath) console.log(`Baseline: ${resolve(baselinePath)}`);

for (const size of [100, 1000, 3000, 5000]) {
  const before = Array.from({ length: size }, (_, i) => ({
    id: `${i}`,
    value: i,
  }));
  const edited = before.map((value, i) =>
    i === size - 1 ? { ...value, value: -1 } : value
  );
  const rotated = [...before.slice(1), before[0]];

  for (const [scenario, after, config] of [
    ['single edit, default hash', edited, {}],
    ['rotate, custom hash', rotated, { objectHash: (value) => value.id }],
  ]) {
    const currentCall = () => generateJSONPatch(before, after, config);
    const baselineCall = () => baseline(before, after, config);
    const patch = currentCall();
    assert.deepStrictEqual(
      applyPatch(structuredClone(before), patch, true, false).newDocument,
      after
    );
    if (baseline) assert.deepStrictEqual(patch, baselineCall());

    for (let i = 0; i < 3; i++) {
      currentCall();
      if (baseline) baselineCall();
    }

    const currentTimes = [];
    const baselineTimes = [];
    for (let i = 0; i < runs; i++) {
      // Alternate the order to reduce bias from temperature and CPU frequency.
      if (baseline && i % 2 === 0) baselineTimes.push(measure(baselineCall));
      currentTimes.push(measure(currentCall));
      if (baseline && i % 2 !== 0) baselineTimes.push(measure(baselineCall));
    }

    const currentMs = median(currentTimes);
    results.push({
      size,
      scenario,
      'current ms': currentMs.toFixed(3),
      ...(baseline && {
        'baseline ms': median(baselineTimes).toFixed(3),
        speedup: `${(median(baselineTimes) / currentMs).toFixed(2)}x`,
      }),
    });
  }
}

console.table(results);
