# n8n Intraday Staffing Briefing: Build Plan

Claude Code: read this file at the start of every session, together with CLAUDE.md.
Update the "Progress" section at the end of each stage.

## Goal

Build an n8n workflow that reads a day of intraday contact-centre data, finds the understaffed
intervals, has Claude write a short briefing with a recommended action, and sends it to Telegram
on a schedule. It runs locally on Yll's personal Windows PC, uses synthetic data only, and ends as
a public GitHub repo (`n8n-intraday-briefing`) with a README, screenshots and the exported workflow.

Private notes: `docs/career-notes.md` (git-ignored, only on Yll's PC).

The finished workflow:

1. Runs every 30 minutes during operating hours, or on demand.
2. Loads the interval file and calculates required agents and the gap per interval.
3. Sends only the problem intervals to Claude, with a fixed prompt and a token limit.
4. Posts the briefing to Telegram, with a human deciding what to act on.
5. Logs every run, and sends an alert if any step fails.

## Who does what

| Who | Job |
| --- | --- |
| Yll | Decides what the workflow should do, builds every node in the n8n canvas, tests, reviews every change before it is committed |
| Claude Code | Teacher and pair: explains each n8n concept before the stage starts, gives node-by-node build steps, writes Code-node JavaScript, prompts, scripts, README; debugs from exported workflow JSON or screenshots; handles Git |
| n8n (local, http://localhost:5678) | Runs the workflow, stores credentials, shows each node's input and output |

How Yll asks for help when something breaks: in n8n, select all nodes (Ctrl+A), copy (Ctrl+C), and
paste the JSON into the chat, or export the workflow into `workflows/` and say "read
workflows/<file>.json". Add a screenshot of the failing node's input/output if useful.

## Environment (already set up, keep these facts)

- Windows, PowerShell. Project folder: this repo's folder on Yll's PC. Exports in `workflows/` use
  the placeholder `C:\path\to\n8n-intraday` instead of the real path (see `scripts/clean_export.py`).
- Node.js 24 (n8n supports Node 20.19 to 24.x only; Node 26 does not work).
- n8n installed globally with npm. npm 12 blocks install scripts by default, so it was installed with
  `npm install -g n8n --allow-scripts=@parcel/watcher,isolated-vm,sqlite3,agent-browser,oracledb,protobufjs,msgpackr-extract,ssh2,@sentry/node-native-stacktrace,@sentry/node-cpu-profiler,cpu-features,@scarf/scarf`.
  Use the same flag when updating n8n.
- Start n8n with `.\start-n8n.ps1`. It sets `N8N_RESTRICT_FILE_ACCESS_TO` to the project's `data`
  and `logs` folders (n8n 2.x only lets file nodes touch `~/.n8n-files` otherwise), then runs `n8n`.
- PowerShell execution policy is RemoteSigned. Downloaded .ps1 files need `Unblock-File` once;
  files Claude Code creates locally do not.
- n8n must keep running in its own PowerShell window while working.

## Architecture

```
Schedule Trigger (every 30 min, 07:00-21:30)
  -> Read/Write Files from Disk + Extract from File (CSV -> one item per interval)
  -> Code: find gaps (required agents, gap, cause)
  -> Filter (2+ agents short, newest interval only; Always Output Data on)
  -> If: any flagged?
       yes -> Sort (worst first) -> Aggregate -> Anthropic node (Claude briefing, max 1500 tokens)
              -> Telegram -> Log run
       no  -> Log run
  (If sits before Sort: on a quiet run the Filter outputs one empty item, and Sort fails on an
   item without a "gap" field.)
  Log run = Code (one CSV line) -> Convert to File (text) -> Write File to Disk, append to
  logs/runs.csv. Anthropic and Telegram retry on fail: 3 tries, 5 seconds apart.
Separate Error workflow: Error Trigger -> Telegram alert naming the failed node
                                      -> Code (error line) -> Convert to File -> append to logs/runs.csv
```

Quiet runs skip Claude and Telegram, which keeps cost near zero and the chat free of noise.

## Project folder layout

```
n8n-intraday/
  CLAUDE.md                 project rules for Claude Code
  README.md                 portfolio page (Stage 6)
  start-n8n.ps1             sets file access, runs n8n
  data/                     synthetic interval CSVs
  logs/                     run log (git-ignored)
  prompts/briefing.md       the Claude prompt, versioned
  scripts/                  dataset generator, Code-node source, helpers
  workflows/                exported workflow JSON, one per stage
  docs/PLAN.md              this file
  docs/screenshots/         canvas and Telegram screenshots
```

## Stages

Each stage is 1 to 2 evenings. Finish the "done when" check before moving on, and commit at the end
of every stage with message "Stage N: <what changed>".

### Stage 1: Hello world (DONE)

- Learn: the canvas, nodes, items, the JSON each node passes on, test runs, pinned data.
- Build: Manual Trigger, then Edit Fields (Set) with `message = "hello"`.
- Claude Code: CLAUDE.md, .gitignore, git init, first commit, connect to GitHub and push.
- Done when: Yll can explain what one "item" is.

### Stage 2: Load the data and find the gaps

- Learn: reading files, CSV to items, expressions like `{{ $json.actual_contacts }}`, the Code node,
  Filter and Sort.
- Build: Read/Write Files from Disk (read `data/intraday_2026-11-23.csv`, absolute path), Extract
  from File (CSV), Code node, Filter (gap of 2 or more agents short), Sort (worst first).
- Code node logic: required agents = actual contacts x AHT seconds / 1800 / 0.85 target occupancy;
  gap = logged-in agents - required; cause = adherence if logged-in < scheduled, volume if actual >
  110% of forecast (can be both).
- Claude Code: write the Code-node JavaScript in `scripts/staffing_gap.js` (n8n Code node, "Run Once
  for All Items") with plain-language comments, plus a small Node test against the CSV.
- Done when: the output shows exactly 11:00, 10:30 and 17:30, in that order.

### Stage 3: Add Claude

- Learn: credentials, the Anthropic node, prompt design, token limits, why the model only sees the
  flagged rows.
- Build: Aggregate (flagged rows into one item), then the Anthropic node with the prompt from
  `prompts/briefing.md`, a small fast model (Claude Haiku 5.5), max tokens 1500 (400 was too low:
  thinking counts toward the limit and used all of it).
- Prompt rules: at most 120 words, one line per interval with cause and one action, use only the
  numbers given, say "no action needed" if nothing is flagged.
- Claude Code: draft `prompts/briefing.md`, then tighten it after Yll pastes 2 or 3 real outputs.
- Done when: three runs in a row give a correct briefing with no invented numbers.

### Stage 4: Deliver on a schedule

- Learn: Schedule Trigger, If node branching, Telegram credentials and chat IDs.
- Build: Schedule Trigger every 30 minutes, 07:00 to 21:30; If node skips Claude and Telegram when
  nothing is flagged; Telegram node sends the briefing.
- Decision (Yll): each run reports only the newest interval, so a problem is reported once, not
  every 30 minutes for the rest of the day. Done with a second Filter condition:
  `{{ $json.interval_start }}` equals `{{ $('Code in JavaScript').last().json.interval_start }}`.
  With the full-day file the newest interval is 21:30, so a full-day run is quiet; test with
  `--interval 11:00` (1 interval flagged) and `--interval 10:00` (quiet).
- Claude Code: add an `--interval` option to `scripts/make_intraday_data.py` to generate data up to
  a given time of day.
- Done when: the briefing arrives in Telegram on schedule, and a quiet run sends nothing.

### Stage 5: Make it reliable

- Learn: Error Trigger workflows, retry on fail, logging, human approval.
- Build: Retry on fail (3 tries) on the Anthropic and Telegram nodes; a second workflow with an Error
  Trigger that sends a Telegram alert naming the failed node; a run log appended to `logs/runs.csv`
  (time, intervals flagged, tokens used, sent yes/no).
- Optional: Telegram "send and wait for response", so a supervisor approves the suggested action.
- Claude Code: define the log format and write `scripts/summarise_log.py` (runs, alerts, cost).
- Done when: Yll breaks the API key on purpose, gets the error alert, then fixes it.

### Stage 6: Ship it

- Learn: exporting workflows, what an export contains, writing for recruiters.
- Build: export both workflows into `workflows/`, screenshots of the canvas and a Telegram briefing
  into `docs/screenshots/`.
- Claude Code: check exports contain no secrets or personal data, write README.md (what it does,
  architecture, screenshots, how to run, what was learned, note that data is synthetic), push.
- Done when: someone can read the README in 2 minutes and understand what it does and why.

After Stage 6, optional: connect Claude Code to n8n through the community n8n-mcp server
(https://github.com/czlonkowski/n8n-mcp) and build a second workflow that way, to compare.
Not before: building by hand is the point. Done as Stage 7, see `docs/stage-7-mcp.md`. It is the one
agreed exception to "Yll builds every node": Claude Code built that workflow through n8n-mcp.

## Still to set up (before Stages 3 and 4)

- [x] Anthropic Console: API key named `n8n-local`, low monthly spend limit (e.g. $5). Stored only in
      n8n credentials.
- [ ] Telegram: create a bot with @BotFather (`/newbot`), save the token in n8n credentials, send the
      bot one message.

## Guardrails

- Synthetic data only. Nothing from Teleperformance, its clients or its tools goes into the
  workflow, the repo or a prompt.
- Secrets stay in n8n credentials. Never in a file, screenshot or commit.
- Personal values (Telegram chat ID, local path) stay out of committed exports: run
  `python scripts/clean_export.py` after every export, before committing.
- Cost stays small: Claude only runs when an interval is flagged, small model, 1500-token cap,
  Console spend limit as the hard stop.

## Progress

- Stage 1: done (workflow built and exported to `workflows/stage-1-hello.json`; repo on GitHub).
- Stage 2: done (workflow exported to `workflows/stage-2-gaps.json`; output is 11:00, 10:30, 17:30;
  data from `scripts/make_intraday_data.py`, Code node from `scripts/staffing_gap.js`, tested by
  `node scripts/staffing_gap.test.js`).
- Stage 3: done (workflow exported to `workflows/stage-3-briefing.json`; prompt v3 in
  `prompts/briefing.md` gave the same correct briefing 3 runs in a row; v1 to v3 fixes are in its
  change log).
- Stage 4: done (workflow exported to `workflows/stage-4-schedule.json`; scheduled run delivered the
  11:00 briefing at 21:30; quiet run (`--interval 10:00`) sent nothing; newest-only confirmed with
  `--interval 11:00`). Bugs fixed on the way: Sort crashed on the quiet run's empty item (If moved
  before Sort); schedule never fired until the workflow was published (saving is not publishing).
- Stage 5: done (main workflow exported to `workflows/stage-5-reliable.json`, error workflow to
  `workflows/stage-5-errors.json`; broken-key test: a scheduled run with a fake Anthropic key
  failed after 3 tries, the Telegram alert named "Message a model", and the error line reached the
  log; real key restored and a manual run sent the briefing again). Optional approval step not
  built.
  - Run log `logs/runs.csv` (git-ignored), one line per run. Columns: run_time, status (ok/error),
    newest_interval, flagged, sent (yes/no), input_tokens, output_tokens, error_node. Written by
    `scripts/log_line.js` (main) and `scripts/error_log_line.js` (error workflow), tested by
    `node scripts/log_line.test.js`; summarised by `python scripts/summarise_log.py` (runs,
    briefings, errors by node, tokens, cost at Haiku 5.5 prices).
  - Learned: token counts are only in the Anthropic output with "Simplify Output" off; error
    workflows only run for production (scheduled) runs, not manual ones; with a fake key the
    Anthropic Model list cannot load, so pick the model "By ID"; Luxon's `suppressMilliseconds`
    only drops milliseconds that are 0, so the log uses `$now.startOf('second')`.
  - Bug fixed: Make log line was first wired from the Anthropic node instead of Telegram. It still
    logged "sent: yes", only because n8n runs the higher branch on the canvas first; now it hangs
    off Telegram, so the log is written after the message is sent.
- Stage 6: done (`README.md` with what it does, why, diagram, worked calculation, design choices,
  what broke, how to run; screenshots in `docs/screenshots/`: Telegram briefing, main workflow
  canvas, error alert, each checked for personal data).
  Privacy decisions (Yll), made after finding the repo was already public:
  the Telegram chat ID and the local path are replaced with placeholders in all exports by
  `scripts/clean_export.py` (older commits still hold the real values; history not rewritten);
  timezone `Europe/Belgrade` kept; career notes moved to the git-ignored `docs/career-notes.md`;
  commit author email kept.
- Stage 7 (optional): done (Claude Code connected to n8n through n8n-mcp 2.103.2 and built "Daily
  run summary (MCP-built)": every day at 22:00, read `logs/runs.csv`, summarise today's runs with
  `scripts/daily_summary.js` (tested by `node scripts/daily_summary.test.js`), send to Telegram.
  Exported to `workflows/stage-7-daily-summary.json` and cleaned. First manual run sent the expected
  summary; Yll published it. Comparison in `docs/stage-7-mcp.md`, short version in the README).
  - Decisions (Yll): build the end-of-day summary (not a webhook version); the n8n API key lives in
    the Windows user environment variable `N8N_API_KEY`, never in a file. The MCP server is
    registered for this project only (local scope, in the Claude Code user config, not the repo),
    with telemetry off and the delete, credential, variable, data table, folder, template, agent,
    audit and evaluation tools switched off.
  - Done by hand: chat ID, first run (n8n-mcp cannot start a Schedule trigger), publishing, export.
  - Learned: n8n-mcp blocks localhost unless `WEBHOOK_SECURITY_MODE=moderate`; on Windows Claude
    Code starts `npx` through `cmd /c`; validation passes with placeholder values, so it checks
    structure, not facts.
  - To undo: delete the API key in n8n, delete `N8N_API_KEY` in Windows, and run
    `claude mcp remove n8n-mcp -s local`.
