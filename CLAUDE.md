# n8n Intraday Staffing Briefing

Goal: an n8n workflow that flags understaffed intervals from intraday data,
has Claude write a briefing, and sends it to Telegram. Portfolio project.

**At the start of every session, read `docs/PLAN.md`** (full build plan, stages and teacher brief).

## Rules
- Synthetic data only. Never add real Teleperformance or client data.
- Never write API keys or tokens into any file. Credentials live in n8n.
- The user builds nodes in the n8n canvas themselves. Claude writes files, code and docs.
- Explain code in plain language; the user is learning.
- Show the diff and wait for the user's OK before every commit.
- Commit message: "Stage N: <what changed>".

## Setup facts
- Start n8n with `.\start-n8n.ps1` (needs Node.js 20.19 to 24.x), then open http://localhost:5678.
- n8n file nodes may only read/write `data/` and `logs/` (set by `N8N_RESTRICT_FILE_ACCESS_TO` in the start script).
  Put input files in `data/` and any output or run logs in `logs/`.
