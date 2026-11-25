// Tests scripts/log_line.js and scripts/error_log_line.js outside n8n.
// Run from the project folder:  node scripts/log_line.test.js

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// A pretend clock. Like n8n's real $now, it has milliseconds, and
// startOf('second') gives a copy without them. If the code forgot startOf,
// the ".942" would end up in the log line and the tests below would fail.
const fakeNow = {
  toISO: () => '2026-11-25T11:00:00.942+01:00',
  startOf: (unit) => {
    assert.strictEqual(unit, 'second');
    return { toISO: () => '2026-11-25T11:00:00+01:00' };
  },
};

// A pretend $('Node name'): we decide which nodes "ran" and what they output.
function makeFakeDollar(nodes) {
  return (name) => {
    const items = nodes[name];
    return {
      isExecuted: items !== undefined,
      all: () => items,
      first: () => items[0],
      last: () => items[items.length - 1],
    };
  };
}

function runFile(file, args) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const fn = new Function('$', '$now', '$input', code);
  return fn(args.$, fakeNow, args.$input)[0].json.line;
}

const intervals = [
  { json: { interval_start: '10:30' } },
  { json: { interval_start: '11:00' } },
];

// 1. A run that sent a briefing.
const sentLine = runFile('log_line.js', {
  $: makeFakeDollar({
    'Code in JavaScript': intervals,
    Sort: [{ json: { interval_start: '11:00', gap: -8.3 } }],
    'Message a model': [{ json: { usage: { input_tokens: 812, output_tokens: 95 } } }],
    'Send a text message': [{ json: { ok: true } }],
  }),
});
assert.strictEqual(sentLine, '2026-11-25T11:00:00+01:00,ok,11:00,1,yes,812,95,\n');

// 2. A quiet run: Sort, Claude and Telegram never ran.
const quietLine = runFile('log_line.js', {
  $: makeFakeDollar({ 'Code in JavaScript': intervals }),
});
assert.strictEqual(quietLine, '2026-11-25T11:00:00+01:00,ok,11:00,0,no,0,0,\n');

// 3. Claude ran but "Simplify Output" was on, so there is no usage: stop with a clear message.
assert.throws(
  () => runFile('log_line.js', {
    $: makeFakeDollar({
      'Code in JavaScript': intervals,
      Sort: [{ json: {} }],
      'Message a model': [{ json: { content: [] } }],
    }),
  }),
  /Simplify Output/,
);

// 4. The error workflow: a node name with a comma gets quotes, so the columns stay intact.
const errorLine = runFile('error_log_line.js', {
  $input: { first: () => ({ json: { execution: { lastNodeExecuted: 'Message a model, retry' } } }) },
});
assert.strictEqual(errorLine, '2026-11-25T11:00:00+01:00,error,,,no,,,"Message a model, retry"\n');

console.log('All log line tests passed:');
for (const line of [sentLine, quietLine, errorLine]) process.stdout.write('  ' + line);
