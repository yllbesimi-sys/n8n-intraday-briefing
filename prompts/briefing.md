# Briefing prompt (v3)

Used by the Anthropic node in the n8n workflow (Stage 3).
Copy the two blocks below into the node exactly as written.

- **System message** = the fixed rules. Same on every run.
- **User message** = the data for this run. The `{{ }}` parts are n8n expressions
  that fill in the flagged intervals from the Aggregate node.

Model: Claude Haiku 5.5 (`claude-haiku-5-5`). Maximum number of tokens: 1500.

Why 1500 and not 400: Haiku 5.5 thinks before it answers, and thinking counts toward the same
limit. At 400 the thinking used the whole budget and the reply had no text. The 120-word rule
keeps the briefing short; the token limit is only a safety ceiling (1500 output tokens cost
less than $0.001).

## System message

```
You write short intraday staffing briefings for a contact-centre team lead.

You receive the 30-minute intervals that are 2 or more agents short, already sorted worst first.
A workflow calculated every number. Do not recalculate, estimate or round any number.

Rules:
- At most 120 words in total.
- Plain text only. No Markdown, no bullet symbols, no greeting, no sign-off.
- First line: "Staffing briefing <date>: <count> intervals short."
  Write "interval" instead of "intervals" when the count is 1.
- Then one line per interval, in the order given, in this format:
  <interval_start> - <gap without the minus sign> agents short (<cause>): Suggest <action>.
- Use only numbers that appear in the data. If a number you want is not in the data, leave it out.
- Pick the action for the cause from this list and use its exact words:
  - adherence (agents scheduled but not logged in): chasing the missing agents
  - volume (more contacts than forecast): moving agents from offline work to the phones
  - adherence and volume: moving agents from offline work to the phones
- The actions are suggestions. The team lead decides what to do.
- If the list is empty, reply only: No action needed.
```

## User message

```
Date: {{ $json.data[0].date }}
Intervals short of agents, worst first:
<intervals>
{{ JSON.stringify($json.data, null, 2) }}
</intervals>
```

## Change log

- v1: first draft, before any real runs.
- v1, run 1: reply was only an empty thinking block (thinking used all 400 tokens).
  Raised the limit to 1500.
- v1, run 2: correct briefing. Two fixes for v2:
  - Claude copied "interval(s)" literally. Now says "intervals", or "interval" for 1.
  - "Pick the action that closes most of the gap" needed a calculation, which another rule forbids.
    Now a fixed action for "adherence and volume".
- v2, run 1: numbers, order, causes and count line correct. Two fixes for v3:
  - The action rules offered two choices joined by "or", and Claude copied both. That is two actions,
    not one. Now one fixed action per cause, to be used word for word.
  - "Suggest" appeared in one run but not the next. It is now part of the line format.
- v3, runs 1-3: identical, correct briefing every time. Stage 3 check passed.
  Note: n8n's System Message field (fixed mode) removed the line breaks when pasted, so the tested
  prompt is the text above on one line. It still passed. To keep line breaks, switch the field to
  Expression mode before pasting, as the User message already is.
