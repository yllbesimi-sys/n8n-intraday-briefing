// n8n Code node: "Summarise today"   (daily summary workflow, Stage 7)
// Mode: Run Once for All Items. Language: JavaScript.
// Built into the workflow through n8n-mcp; this file is the versioned copy.
//
// Gets one item per line of logs/runs.csv (from Extract from File) and turns
// today's lines into one Telegram message. Same counts as scripts/summarise_log.py,
// but for one day only.

// Claude Haiku 5.5 prices in US dollars per million tokens (same as summarise_log.py).
const INPUT_PRICE_PER_MILLION = 0.10;
const OUTPUT_PRICE_PER_MILLION = 0.50;

// Empty fields (for example token counts on error rows) count as 0.
const toInt = (text) => parseInt(text, 10) || 0;

// Today's date in the workflow's timezone, for example 2026-11-25.
const today = $now.toFormat('yyyy-MM-dd');

// Every run_time starts with the date of the run, written in the same timezone.
// An empty log gives one empty item, which this filter drops too.
const runs = $input.all()
  .map((item) => item.json)
  .filter((run) => String(run.run_time || '').startsWith(today));

if (runs.length === 0) {
  return [{ json: { text: `Daily run summary ${today}\nNo runs logged today.`, runs: 0 } }];
}

const ok = runs.filter((r) => r.status === 'ok');
const errors = runs.filter((r) => r.status === 'error');
const sent = ok.filter((r) => r.sent === 'yes');
// Quiet means nothing was flagged, so Claude and Telegram were skipped on purpose.
const quiet = ok.filter((r) => String(r.flagged) === '0');
// Flagged but not sent: only happens when a test runs part of the main workflow.
const flaggedNotSent = ok.filter((r) => String(r.flagged) !== '0' && r.sent === 'no');

const inputTokens = runs.reduce((sum, r) => sum + toInt(r.input_tokens), 0);
const outputTokens = runs.reduce((sum, r) => sum + toInt(r.output_tokens), 0);
const cost = (inputTokens * INPUT_PRICE_PER_MILLION
  + outputTokens * OUTPUT_PRICE_PER_MILLION) / 1000000;

const lines = [
  `Daily run summary ${today}`,
  `Runs: ${runs.length} (${ok.length} ok, ${errors.length} error)`,
  `Briefings sent: ${sent.length}`,
  `Quiet runs: ${quiet.length}`,
];
if (flaggedNotSent.length > 0) {
  lines.push(`Flagged, not sent: ${flaggedNotSent.length} (partial test runs)`);
}
if (errors.length > 0) {
  // Count errors per node, for example "Message a model 1".
  const byNode = {};
  for (const r of errors) byNode[r.error_node] = (byNode[r.error_node] || 0) + 1;
  lines.push('Errors: ' + Object.entries(byNode).map(([node, n]) => `${node} ${n}`).join(', '));
}
lines.push(`Claude: ${inputTokens.toLocaleString('en-US')} tokens in, `
  + `${outputTokens.toLocaleString('en-US')} out, $${cost.toFixed(4)}`);

return [{ json: { text: lines.join('\n'), runs: runs.length } }];
