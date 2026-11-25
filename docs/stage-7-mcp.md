# Stage 7: building a workflow through MCP

Stages 1 to 6 were built by hand in the n8n canvas. For Stage 7, Claude Code built a second, small
workflow through the community [n8n-mcp](https://github.com/czlonkowski/n8n-mcp) server instead,
so the two ways of building can be compared.

## What MCP is, in one paragraph

MCP (Model Context Protocol) is a standard way to give an AI assistant extra tools. n8n-mcp is a
small program on this PC that Claude Code starts. It gives Claude two kinds of tools: a reference of
n8n's nodes (exact types, versions and parameter names, plus a validator), and tools that read,
create and change workflows in my local n8n through n8n's public API.

## Setup

- n8n-mcp 2.103.2, started by Claude Code with `npx`, registered for this project only. That setting
  lives in my Claude Code user config, not in this repo.
- The n8n API key is a Windows user environment variable, `N8N_API_KEY`, entered in Windows'
  environment variables window. Claude Code passes it on to n8n-mcp when it starts. It is not in
  any file in this repo, and Claude never saw it.

```powershell
claude mcp add n8n-mcp --scope local `
  -e MCP_MODE=stdio -e LOG_LEVEL=error -e DISABLE_CONSOLE_OUTPUT=true `
  -e N8N_API_URL=http://localhost:5678 `
  -e WEBHOOK_SECURITY_MODE=moderate `
  -e N8N_MCP_TELEMETRY_DISABLED=true `
  -e DISABLED_TOOLS=n8n_delete_workflow,n8n_manage_credentials,n8n_audit_instance,n8n_manage_variables,n8n_manage_datatable,n8n_manage_folders,n8n_deploy_template,n8n_manage_agents,n8n_explore_node_resources,n8n_evaluations `
  -- cmd /c npx -y n8n-mcp@2.103.2
```

Why each setting:

| Setting | Why |
|---|---|
| `WEBHOOK_SECURITY_MODE=moderate` | n8n-mcp refuses `localhost` addresses by default. `moderate` allows localhost and still blocks other private addresses. |
| `N8N_MCP_TELEMETRY_DISABLED=true`, plus `npx n8n-mcp telemetry disable` once | n8n-mcp sends usage data by default, including cleaned-up copies of the workflows it builds. |
| `DISABLED_TOOLS=...` | Switches off the tools this stage did not need: deleting workflows, credentials, variables, data tables, folders, templates, agents and audits. This limits what n8n-mcp offers Claude, not what the API key itself can do. |
| `cmd /c npx` | On Windows, Claude Code needs `cmd /c` to start `npx`. |
| `@2.103.2` | A fixed version, so an update cannot change the tools without me noticing. |

## What was built

**Daily run summary (MCP-built)**, exported to `workflows/stage-7-daily-summary.json`:

```
Every day at 22:00 -> Read run log -> CSV to items -> Summarise today (Code) -> Send summary (Telegram)
```

It reads `logs/runs.csv`, keeps today's runs, and sends one message. The Code-node logic is in
`scripts/daily_summary.js`, tested by `node scripts/daily_summary.test.js`. No Claude call, so it
costs nothing to run. The first run sent:

```
Daily run summary 2026-11-25
Runs: 10 (9 ok, 1 error)
Briefings sent: 4
Quiet runs: 4
Flagged, not sent: 1 (partial test runs)
Errors: Message a model 1
Claude: 2,870 tokens in, 315 out, $0.0004
```

## How it went

Through MCP, Claude:

1. looked up the current version and parameter names of each node (`get_node`)
2. validated the whole workflow before sending it (`validate_workflow`): 0 errors, 0 warnings
3. created it in n8n in one call (`n8n_create_workflow`), unpublished
4. validated it again inside n8n (`n8n_validate_workflow`): 0 errors, 0 warnings
5. after my test run, read only the Code node's output from the run (`n8n_executions`) and checked
   it against the expected message: it matched line for line

By hand, in the canvas, I:

1. replaced the chat ID placeholder (kept out of the chat on purpose)
2. clicked Execute workflow: n8n-mcp can only start workflows with a webhook, form or chat
   trigger, not a Schedule trigger
3. published it
4. downloaded the export, so the real chat ID never passed through Claude

From downloading n8n-mcp to the first successful run took 13 minutes (21:39 to 21:52), including
creating the API key, setting the environment variable and restarting the Claude app.

## By hand versus through MCP

| | By hand (Stages 1 to 6) | Through MCP (Stage 7) |
|---|---|---|
| Who places the nodes | Me, in the canvas, field by field | Claude, all 5 nodes, settings and connections in one call |
| Finding the right settings | Clicking through each node's options | Looked up from n8n-mcp's node reference |
| Checking before a run | Test runs and pinned data | Validation before and after creating it |
| Checking a run's output | I paste JSON or screenshots into the chat | Claude reads the run output itself |
| First run | Each stage hit problems (see "What broke" in the README) | Worked on the first run |
| Setup | Nothing beyond n8n | API key, environment variable, app restart, settings above |
| Running a scheduled workflow | Execute in the canvas | Still by hand |

**What was faster:** building and checking. One call made the whole workflow, including the
credential, retries (3 tries, 5 seconds apart), timezone and "Always Output Data". Claude
checked the result in n8n directly instead of waiting for me to paste it.

**What needed doing by hand:** the chat ID, the first run, publishing and the export. No node needed
fixing. When saving, n8n dropped two default values (`"field": "days"` in the trigger and
`"operation": "csv"` in Extract from File) and added default settings. That changed nothing in
how it runs, but the export is not identical to what was sent.

## What this comparison does not show

- **It was fast because the hard problems were already solved by hand.** File access limited to
  `data/` and `logs/`, the timezone, the log format, empty items on quiet runs, retries, and
  publishing versus saving all came from Stages 1 to 6. The MCP build reused those answers. I knew
  what to ask for and how to check the result because I had built the first workflow myself.
- **This workflow is simple:** one path, no branching, no Claude call.
- **Validation checks structure, not facts.** It passed with a placeholder chat ID and would pass
  with a wrong file path. The Code-node logic was checked by its offline test, not by MCP.
- **Claude does not see the canvas.** Node positions are coordinates it picked; someone still has
  to open the workflow and look at it.
- **Access is wide.** The API key works for everything n8n's API allows on this instance, not only
  what n8n-mcp offers. Whatever the tools return (workflow JSON, run output) goes into the chat with
  Claude. That is why the chat ID stayed a placeholder and only the Code node's output was read.

## Turning it off

1. Delete the API key in n8n: Settings, n8n API.
2. Delete `N8N_API_KEY` in Windows' environment variables window.
3. `claude mcp remove n8n-mcp -s local`
