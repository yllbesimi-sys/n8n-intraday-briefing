// n8n Code node: "Make log line"   (main workflow)
// Mode: Run Once for All Items. Language: JavaScript.
// Paste this whole file into the Code node.
//
// Runs once at the end of every run that did not fail, on both If paths
// (briefing sent, or quiet). It looks back at what the other nodes did and
// turns that into one CSV line for logs/runs.csv.
//
// Log columns, in this order (the error workflow writes the same columns):
//   run_time         when the run happened, in the workflow's timezone
//   status           "ok" here; "error" from the error workflow
//   newest_interval  the newest interval in the data file, e.g. 11:00
//   flagged          how many intervals were 2+ agents short (0 or 1 with newest-only)
//   sent             "yes" if the briefing went to Telegram, otherwise "no"
//   input_tokens     tokens Claude read (0 when Claude was not called)
//   output_tokens    tokens Claude wrote, thinking included (0 when Claude was not called)
//   error_node       empty here; the error workflow fills in the node that failed

// Put a value in quotes only if it contains a comma, a quote or a line break,
// so it cannot break the CSV columns.
function csvField(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// $('Node name') reads another node's output. isExecuted says whether it ran in this run.
const claudeRan = $('Message a model').isExecuted;
let inputTokens = 0;
let outputTokens = 0;

if (claudeRan) {
  // Claude's full reply reports how many tokens it used. n8n only includes this
  // when the Anthropic node's "Simplify Output" option is off.
  const usage = $('Message a model').first().json.usage;
  if (!usage) {
    throw new Error('No token usage in the Anthropic node output: turn off its "Simplify Output" option');
  }
  inputTokens = usage.input_tokens;
  outputTokens = usage.output_tokens;
}

// The run time to the second. startOf('second') sets the milliseconds to 0, and
// suppressMilliseconds then leaves them out (it only drops milliseconds that are 0).
const runTime = $now.startOf('second').toISO({ suppressMilliseconds: true });

const fields = [
  runTime,                                                       // run_time
  'ok',                                                          // status
  $('Code in JavaScript').last().json.interval_start,            // newest_interval
  $('Sort').isExecuted ? $('Sort').all().length : 0,             // flagged
  $('Send a text message').isExecuted ? 'yes' : 'no',            // sent
  inputTokens,                                                   // input_tokens
  outputTokens,                                                  // output_tokens
  '',                                                            // error_node
];

// One line of text, ending in a line break so the next run starts on a new line.
return [{ json: { line: fields.map(csvField).join(',') + '\n' } }];
