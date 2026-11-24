// Tests scripts/staffing_gap.js outside n8n, against the real synthetic CSV.
// Run from the project folder:  node scripts/staffing_gap.test.js

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// 1. Read the CSV and turn each row into an item, exactly like Extract from File does:
//    every value stays TEXT, e.g. { json: { actual_contacts: "145", ... } }.
function csvToItems(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const json = {};
    headers.forEach((h, i) => { json[h] = values[i]; });
    return { json };
  });
}

// 2. Run the Code-node file unchanged. n8n gives the code a "$input" object;
//    here we pass a pretend one that hands over our items.
const code = fs.readFileSync(path.join(__dirname, 'staffing_gap.js'), 'utf8');
function runCodeNode(items) {
  const fakeInput = { all: () => items };
  return new Function('$input', code)(fakeInput);
}

const csvFile = path.join(__dirname, '..', 'data', 'intraday_2026-11-23.csv');
const output = runCodeNode(csvToItems(csvFile)).map((item) => item.json);

// 3. The checks.

// Every interval comes out again; the Code node does not drop any.
assert.strictEqual(output.length, 30, 'expected 30 intervals');

// Text has become real numbers.
assert.strictEqual(typeof output[0].actual_contacts, 'number');

// One interval checked by hand: 180 contacts x 300 s / 1800 / 0.85 = 35.3 required,
// 27 logged in, so 8.3 short; 3 people missing AND 20% more calls.
const eleven = output.find((r) => r.interval_start === '11:00');
assert.strictEqual(eleven.required_agents, 35.3);
assert.strictEqual(eleven.gap, -8.3);
assert.strictEqual(eleven.cause, 'adherence and volume');

// Do what the Filter and Sort nodes will do: keep 2+ agents short, worst first.
const flagged = output
  .filter((r) => r.gap <= -2)
  .sort((a, b) => a.gap - b.gap);
assert.deepStrictEqual(
  flagged.map((r) => `${r.interval_start} ${r.cause}`),
  ['11:00 adherence and volume', '10:30 adherence', '17:30 volume'],
);

// The near miss: 14:00 is short, but by less than 2 agents, so it is not flagged.
const two = output.find((r) => r.interval_start === '14:00');
assert.ok(two.gap < 0 && two.gap > -2, '14:00 should be short but not flagged');

// A broken row stops the node with a clear message instead of giving wrong numbers.
assert.throws(
  () => runCodeNode([{ json: { interval_start: '09:00', actual_contacts: 'abc' } }]),
  /Interval 09:00/,
);

console.log('All tests passed. Flagged, worst first:');
for (const r of flagged) console.log(`  ${r.interval_start}  gap ${r.gap}  (${r.cause})`);
