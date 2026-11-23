# n8n Intraday Staffing Briefing: Build Plan

Claude Code: read this file at the start of every session, together with CLAUDE.md.
Update the "Progress" section at the end of each stage.

## Goal

Build an n8n workflow that reads a day of intraday contact-centre data, finds the understaffed
intervals, has Claude write a short briefing with a recommended action, and sends it to Telegram
on a schedule. It runs locally on Yll's personal Windows PC, uses synthetic data only, and ends as
a public GitHub repo (`n8n-intraday-briefing`) with a README, screenshots and the exported workflow.

Why: AI operations job listings ask for Claude used in real workflows, automation with tools like
n8n, human oversight and auditability. This project shows all four, on top of 8+ years of WFM work.

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

- Windows, PowerShell. Project folder: `C:\Users\besyl\n8n-intraday`.
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
  -> Filter (2+ agents short) + Sort (worst first)
  -> If: any flagged?
       yes -> Aggregate -> Anthropic node (Claude briefing, max ~400 tokens) -> Telegram -> Log run
       no  -> Log run
Separate Error workflow: Error Trigger -> Telegram alert naming the failed node
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
  `prompts/briefing.md`, a small fast model, max tokens around 400.
- Prompt rules: at most 120 words, one line per interval with cause and one action, use only the
  numbers given, say "no action needed" if nothing is flagged.
- Claude Code: draft `prompts/briefing.md`, then tighten it after Yll pastes 2 or 3 real outputs.
- Done when: three runs in a row give a correct briefing with no invented numbers.

### Stage 4: Deliver on a schedule

- Learn: Schedule Trigger, If node branching, Telegram credentials and chat IDs.
- Build: Schedule Trigger every 30 minutes, 07:00 to 21:30; If node skips Claude and Telegram when
  nothing is flagged; Telegram node sends the briefing.
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
Not before: building by hand is the point.

## Still to set up (before Stages 3 and 4)

- [ ] Anthropic Console: API key named `n8n-local`, low monthly spend limit (e.g. $5). Stored only in
      n8n credentials.
- [ ] Telegram: create a bot with @BotFather (`/newbot`), save the token in n8n credentials, send the
      bot one message.

## Guardrails

- Synthetic data only. Nothing from Teleperformance, its clients or its tools goes into the
  workflow, the repo or a prompt.
- Secrets stay in n8n credentials. Never in a file, screenshot or commit.
- Cost stays small: Claude only runs when an interval is flagged, small model, ~400-token cap,
  Console spend limit as the hard stop.

## Showcasing (Stage 6 and after)

- CV bullet draft: "Built an n8n workflow that flags understaffed intervals from intraday data, uses
  Claude to write a team-lead briefing, and delivers it to Telegram every 30 minutes, with error
  alerts, retries and a run log."
- LinkedIn: add as a project next to Hedum and iDerm Tracker, with the GitHub link and a screenshot.
- Interview story: the WFM problem (intraday gaps found too late), what was automated, design choices
  (Claude only on flagged rows, human decides, every run logged), what broke and how it was fixed.

## Progress

- Stage 1: done (workflow built and exported to `workflows/stage-1-hello.json`; repo on GitHub).
