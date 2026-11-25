"""
Summarise the run log that the n8n workflows write (logs/runs.csv).

Run it from the project folder:
    python scripts/summarise_log.py                 (reads logs/runs.csv)
    python scripts/summarise_log.py other_log.csv   (reads another file)

It prints how many runs there were, how many sent a briefing, which nodes failed,
and what Claude cost. The column order is set by scripts/log_line.js.
"""

import csv
import sys
from collections import Counter
from pathlib import Path

DEFAULT_LOG = Path(__file__).parent.parent / "logs" / "runs.csv"

# Same columns, same order as scripts/log_line.js and scripts/error_log_line.js.
FIELDS = [
    "run_time", "status", "newest_interval", "flagged", "sent",
    "input_tokens", "output_tokens", "error_node",
]

# Claude Haiku 5.5 prices in US dollars per million tokens.
# Check the current prices on Anthropic's pricing page if you change model.
INPUT_PRICE_PER_MILLION = 0.10
OUTPUT_PRICE_PER_MILLION = 0.50


def to_int(text):
    """Empty fields (for example token counts on error rows) count as 0."""
    return int(text) if text.strip() else 0


def read_runs(log_file):
    """Read the log, one dict per run. Skips the header line and blank lines."""
    runs = []
    with open(log_file, newline="", encoding="utf-8") as f:
        for line_number, row in enumerate(csv.reader(f), start=1):
            if not row or row[0] == "run_time":
                continue
            if len(row) != len(FIELDS):
                sys.exit(f"Line {line_number} has {len(row)} columns, expected {len(FIELDS)}: {row}")
            runs.append(dict(zip(FIELDS, row)))
    return runs


def main():
    log_file = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_LOG
    if not log_file.exists():
        sys.exit(f"No run log yet at {log_file}. The workflow creates it on its first run.")

    runs = read_runs(log_file)
    if not runs:
        sys.exit(f"{log_file} has no runs in it yet.")

    ok_runs = [r for r in runs if r["status"] == "ok"]
    error_runs = [r for r in runs if r["status"] == "error"]
    sent = [r for r in ok_runs if r["sent"] == "yes"]
    # Quiet means nothing was flagged, so Claude and Telegram were skipped on purpose.
    quiet = [r for r in ok_runs if r["flagged"] == "0"]
    # Flagged but not sent: only happens when a test runs part of the workflow
    # (for example "Execute step" on the log node). A real run sends or fails.
    flagged_not_sent = [r for r in ok_runs if r["flagged"] != "0" and r["sent"] == "no"]

    input_tokens = sum(to_int(r["input_tokens"]) for r in runs)
    output_tokens = sum(to_int(r["output_tokens"]) for r in runs)
    cost = (input_tokens * INPUT_PRICE_PER_MILLION
            + output_tokens * OUTPUT_PRICE_PER_MILLION) / 1_000_000

    # ISO times sort correctly as text, so min/max give the first and last run.
    first = min(r["run_time"] for r in runs)[:16].replace("T", " ")
    last = max(r["run_time"] for r in runs)[:16].replace("T", " ")

    print(f"Run log: {log_file}")
    print(f"Period:          {first} to {last}")
    print(f"Runs:            {len(runs)}  (ok {len(ok_runs)}, error {len(error_runs)})")
    print(f"Briefings sent:  {len(sent)}")
    print(f"Quiet runs:      {len(quiet)}")
    if flagged_not_sent:
        print(f"Flagged, not sent: {len(flagged_not_sent)}  (partial test runs)")
    if error_runs:
        by_node = Counter(r["error_node"] for r in error_runs)
        print("Errors by node:  " + ", ".join(f"{node} {count}" for node, count in by_node.most_common()))
    print(f"Tokens:          {input_tokens:,} in, {output_tokens:,} out")
    print(f"Claude cost:     ${cost:.4f}  (Haiku 5.5 prices; error runs not counted)")


if __name__ == "__main__":
    main()
