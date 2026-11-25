// n8n Code node: "Make error log line"   (error workflow)
// Mode: Run Once for All Items. Language: JavaScript.
// Paste this whole file into the Code node that comes after the Error Trigger.
//
// Writes the same columns as scripts/log_line.js, with status "error" and the
// name of the node that failed. Fields the error workflow cannot know stay empty.

function csvField(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// The Error Trigger hands over one item describing the failed run.
const execution = $input.first().json.execution;

// The run time to the second, without milliseconds (same as scripts/log_line.js).
const runTime = $now.startOf('second').toISO({ suppressMilliseconds: true });

const fields = [
  runTime,                                        // run_time
  'error',                                        // status
  '',                                             // newest_interval (unknown here)
  '',                                             // flagged (unknown here)
  'no',                                           // sent: the run failed, so no briefing
  '',                                             // input_tokens (unknown here)
  '',                                             // output_tokens (unknown here)
  execution.lastNodeExecuted || 'unknown',        // error_node: where it failed
];

return [{ json: { line: fields.map(csvField).join(',') + '\n' } }];
