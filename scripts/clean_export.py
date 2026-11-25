"""
Replace personal values in exported n8n workflows before they are committed.

Run it from the project folder after every export:
    python scripts/clean_export.py                                  (cleans every file in workflows/)
    python scripts/clean_export.py workflows/stage-5-reliable.json  (cleans one file)

What it changes:
  - every Telegram chat ID                -> YOUR_TELEGRAM_CHAT_ID
  - the project folder in file paths      -> C:\\path\\to\\n8n-intraday
    (only paths that point into the project's data\\ or logs\\ folder)

What it does not need to change: credentials. An export only holds a credential's
name and ID (for example "Anthropic account"), never the API key or bot token.

Running it twice is safe: values that are already placeholders stay as they are.
Afterwards it warns about anything that still looks personal (a C:\\Users\\ path).
"""

import json
import re
import sys
from pathlib import Path

WORKFLOWS_DIR = Path(__file__).parent.parent / "workflows"

CHAT_ID_PLACEHOLDER = "YOUR_TELEGRAM_CHAT_ID"
PROJECT_PLACEHOLDER = r"C:\path\to\n8n-intraday"

# A Windows path into the project's data or logs folder, for example
#   C:\Users\someone\n8n-intraday\logs\runs.csv
# Group 1 is everything from "\data\" or "\logs\" onwards, which we keep.
PROJECT_PATH = re.compile(r"^[A-Za-z]:\\.*?(\\(?:data|logs)\\[^\\]+)$")


def clean_value(key, value, counts):
    """Return the cleaned version of one value, walking into lists and dicts."""
    if isinstance(value, dict):
        return {k: clean_value(k, v, counts) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_value(key, v, counts) for v in value]
    if key == "chatId" and value != CHAT_ID_PLACEHOLDER:
        counts["chat IDs"] += 1
        return CHAT_ID_PLACEHOLDER
    if isinstance(value, str):
        match = PROJECT_PATH.match(value)
        if match and not value.startswith(PROJECT_PLACEHOLDER):
            counts["paths"] += 1
            return PROJECT_PLACEHOLDER + match.group(1)
    return value


def clean_file(path):
    workflow = json.loads(path.read_text(encoding="utf-8"))
    counts = {"chat IDs": 0, "paths": 0}
    for node in workflow.get("nodes", []):
        node["parameters"] = clean_value("parameters", node.get("parameters", {}), counts)

    # Same layout as n8n's own export (2-space indent, no newline at the end),
    # so git only shows the lines that really changed.
    text = json.dumps(workflow, indent=2, ensure_ascii=False)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)

    changes = ", ".join(f"{n} {what}" for what, n in counts.items() if n) or "already clean"
    print(f"{path.name}: {changes}")
    if "\\\\Users\\\\" in text:
        print(f"  WARNING: {path.name} still contains a C:\\Users\\ path. Check it before committing.")


def main():
    files = [Path(arg) for arg in sys.argv[1:]] or sorted(WORKFLOWS_DIR.glob("*.json"))
    for path in files:
        if not path.exists():
            sys.exit(f"No such file: {path}")
        clean_file(path)


if __name__ == "__main__":
    main()
