// n8n Code node: "Find gaps"
// Mode: Run Once for All Items. Language: JavaScript.
// Paste this whole file into the Code node.
//
// Input:  one item per interval, straight from Extract from File (CSV).
// Output: the same 30 items, with numbers instead of text, plus three new fields:
//           required_agents  how many agents the actual contacts needed
//           gap              logged-in minus required (negative = short of agents)
//           cause            "adherence", "volume", "adherence and volume" or "none"

const INTERVAL_SECONDS = 1800;  // one interval = 30 minutes
const TARGET_OCCUPANCY = 0.85;  // agents should be busy 85% of the time, not 100%
const VOLUME_LIMIT = 1.10;      // more than 110% of forecast counts as a volume problem

// Round to one decimal place, so 3.2352941 shows as 3.2
function round1(n) {
  return Math.round(n * 10) / 10;
}

const results = [];

for (const item of $input.all()) {
  const row = item.json;

  // CSV values arrive as text ("145"). Number() turns them into real numbers (145).
  const forecast = Number(row.forecast_contacts);
  const actual = Number(row.actual_contacts);
  const aht = Number(row.aht_seconds);
  const scheduled = Number(row.scheduled_agents);
  const loggedIn = Number(row.logged_in_agents);

  // If a column is missing or not a number, stop with a clear error
  // instead of quietly calculating nonsense.
  if ([forecast, actual, aht, scheduled, loggedIn].some(Number.isNaN)) {
    throw new Error(`Interval ${row.interval_start}: a number column is missing or not a number`);
  }

  // Agents needed for the contacts that actually came in:
  // total talk time (contacts x seconds each), divided by the seconds in one interval,
  // divided by 0.85 because nobody can be busy every single second.
  const required = actual * aht / INTERVAL_SECONDS / TARGET_OCCUPANCY;

  // How many agents we have compared to how many we need. -3.2 means 3.2 agents short.
  const gap = loggedIn - required;

  // Why are we short? It can be one reason, both, or neither.
  const causes = [];
  if (loggedIn < scheduled) causes.push('adherence');               // people missing
  if (actual > forecast * VOLUME_LIMIT) causes.push('volume');      // more calls than planned

  results.push({
    json: {
      date: row.date,
      interval_start: row.interval_start,
      forecast_contacts: forecast,
      actual_contacts: actual,
      aht_seconds: aht,
      scheduled_agents: scheduled,
      logged_in_agents: loggedIn,
      required_agents: round1(required),
      gap: round1(gap),
      cause: causes.length > 0 ? causes.join(' and ') : 'none',
    },
  });
}

// A Code node must return a list of items, each shaped like { json: { ... } }.
return results;
