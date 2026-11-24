"""
Make one day of SYNTHETIC intraday contact-centre data as a CSV file.

Nothing here comes from a real company. The numbers are invented so that
exactly three intervals end up 2 or more agents short:
    11:00 (worst), 10:30, 17:30
and one interval (14:00) is a little short but NOT enough to be flagged.

Run it from the project folder:
    python scripts/make_intraday_data.py                  (the whole day)
    python scripts/make_intraday_data.py --interval 10:00  (only 07:00 up to 10:00)

--interval pretends it is that time of day: the file only has the intervals that
have happened so far. Running it again without --interval brings back the full day,
exactly as before.

It writes: data/intraday_2026-11-23.csv
"""

import argparse
import csv
import math
import random
from pathlib import Path

DATE = "2026-11-23"
OUTPUT_FILE = Path(__file__).parent.parent / "data" / f"intraday_{DATE}.csv"

# Planning assumptions (the same ones the Code node will use later).
PLANNED_AHT_SECONDS = 300  # average handling time per contact: 5 minutes
INTERVAL_SECONDS = 1800    # one interval = 30 minutes
TARGET_OCCUPANCY = 0.85    # agents should be busy 85% of the time, not 100%

# Forecast contacts for each 30-minute interval, 07:00 to 21:30.
# Shape of a typical day: morning ramp, peak around 11:00,
# a dip at lunch, a second peak in the late afternoon, quiet evening.
FORECAST = {
    "07:00": 40,  "07:30": 55,  "08:00": 75,  "08:30": 95,
    "09:00": 115, "09:30": 130, "10:00": 140, "10:30": 145,
    "11:00": 150, "11:30": 145, "12:00": 130, "12:30": 120,
    "13:00": 120, "13:30": 125, "14:00": 130, "14:30": 130,
    "15:00": 125, "15:30": 120, "16:00": 120, "16:30": 125,
    "17:00": 130, "17:30": 135, "18:00": 120, "18:30": 100,
    "19:00": 85,  "19:30": 70,  "20:00": 60,  "20:30": 50,
    "21:00": 40,  "21:30": 30,
}

# The planted problems. For these intervals we skip the random noise
# so the result is always the same.
#   volume  = actual contacts as a share of forecast (1.20 = 20% more calls)
#   missing = scheduled agents who did not log in
EVENTS = {
    "10:30": {"volume": 1.00, "missing": 5},  # people missing -> adherence
    "11:00": {"volume": 1.20, "missing": 3},  # more calls AND people missing -> both
    "17:30": {"volume": 1.14, "missing": 0},  # more calls than forecast -> volume
    "14:00": {"volume": 1.00, "missing": 2},  # near miss: short, but under 2 agents
}


def agents_needed(contacts, aht_seconds):
    """How many agents it takes to handle this many contacts in 30 minutes."""
    return contacts * aht_seconds / INTERVAL_SECONDS / TARGET_OCCUPANCY


def make_rows(last_interval=None):
    # A fixed seed makes the "random" numbers the same on every run,
    # so the CSV never changes unless this script changes.
    # Stopping early (last_interval) does not change the rows before it.
    rng = random.Random(23)
    rows = []

    for interval, forecast in FORECAST.items():
        # The planner schedules enough agents for the FORECAST, rounded up.
        scheduled = math.ceil(agents_needed(forecast, PLANNED_AHT_SECONDS))

        if interval in EVENTS:
            event = EVENTS[interval]
            actual = round(forecast * event["volume"])
            aht = PLANNED_AHT_SECONDS
            logged_in = scheduled - event["missing"]
        else:
            # A normal interval: small, harmless differences from the plan.
            actual = round(forecast * rng.uniform(0.96, 1.04))     # +/- 4% calls
            aht = round(PLANNED_AHT_SECONDS * rng.uniform(0.97, 1.03))  # +/- 3% AHT
            logged_in = scheduled + rng.choice([0, 1])             # sometimes 1 extra

        rows.append({
            "date": DATE,
            "interval_start": interval,
            "forecast_contacts": forecast,
            "actual_contacts": actual,
            "aht_seconds": aht,
            "scheduled_agents": scheduled,
            "logged_in_agents": logged_in,
        })

        # Stop after the interval we were asked for: later ones "have not happened yet".
        if interval == last_interval:
            break

    return rows


def main():
    parser = argparse.ArgumentParser(description="Make synthetic intraday data.")
    parser.add_argument(
        "--interval",
        help="last interval to include, as HH:MM (07:00 to 21:30, on the hour or half hour). "
             "Leave it out for the whole day.",
    )
    args = parser.parse_args()

    # Only accept times that exist in the day, e.g. 10:30 but not 10:15 or 23:00.
    if args.interval is not None and args.interval not in FORECAST:
        parser.error(f"--interval must be one of 07:00, 07:30, ... 21:30, not {args.interval}")

    rows = make_rows(args.interval)
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} intervals to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
