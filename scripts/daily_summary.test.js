// Tests scripts/daily_summary.js outside n8n.
// Run from the project folder:  node scripts/daily_summary.test.js

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// A pretend clock: "today" is 2026-11-25 in the workflow's timezone.
const fakeNow = { toFormat: () => '2026-11-25' };

function summarise(rows) {
  const code = fs.readFileSync(path.join(__dirname, 'daily_summary.js'), 'utf8');
  const fn = new Function('$now', '$input', code);
  const items = rows.map((json) => ({ json }));
  return fn(fakeNow, { all: () => items })[0].json;
}

// One run log row, the way Extract from File hands it over (every value is text).
function row(run_time, status, flagged, sent, inTok, outTok, error_node = '') {
  return {
    run_time, status, newest_interval: '11:00', flagged, sent,
    input_tokens: inTok, output_tokens: outTok, error_node,
  };
}

// 1. A day with briefings, quiet runs, a partial test run and an error.
//    Yesterday's run must be left out.
const busy = summarise([
  row('2026-11-24T21:30:00+01:00', 'ok', '1', 'yes', '574', '63'),
  row('2026-11-25T10:00:00+01:00', 'ok', '1', 'no', '574', '63'),
  row('2026-11-25T11:00:00+01:00', 'ok', '1', 'yes', '574', '63'),
  row('2026-11-25T11:30:00+01:00', 'ok', '0', 'no', '0', '0'),
  row('2026-11-25T12:00:00+01:00', 'error', '', 'no', '', '', 'Message a model'),
  row('2026-11-25T12:30:00+01:00', 'ok', '1', 'yes', '574', '63'),
]);
assert.strictEqual(busy.runs, 5);
assert.strictEqual(busy.text, [
  'Daily run summary 2026-11-25',
  'Runs: 5 (4 ok, 1 error)',
  'Briefings sent: 2',
  'Quiet runs: 1',
  'Flagged, not sent: 1 (partial test runs)',
  'Errors: Message a model 1',
  'Claude: 1,722 tokens in, 189 out, $0.0003',
].join('\n'));

// 2. An empty log: Extract from File gives one empty item ("Always Output Data" on).
const empty = summarise([{}]);
assert.strictEqual(empty.runs, 0);
assert.strictEqual(empty.text, 'Daily run summary 2026-11-25\nNo runs logged today.');

console.log('All daily summary tests passed:\n');
console.log(busy.text + '\n');
console.log(empty.text);
