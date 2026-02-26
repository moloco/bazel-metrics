#!/usr/bin/env python3
"""Aggregate AI fix events from GCS into a dashboard-ready JSON file.

Reads individual event JSONs written by the AI fix workflows in marvel2,
aggregates them into ai-fix-metrics.json with:
  - All-time summary counters
  - 30-day daily trend (preserved across event cleanup)
  - Accumulated disabled tests list
  - Recent runs (last 50)

Raw events older than 7 days are cleaned up after aggregation.
The aggregator is idempotent -- running it multiple times on the same
events produces the same result thanks to processed-ID tracking.
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

GCS_BUCKET = "bazel-metrics-data"
EVENTS_PREFIX = "ai-fix-events/"
OUTPUT_KEY = "ai-fix-metrics.json"
TREND_DAYS = 30
EVENT_RETENTION_DAYS = 7
RECENT_RUNS_LIMIT = 50


def empty_summary():
    return {
        "totalInvocations": 0,
        "successfulFixes": 0,
        "failedFixes": 0,
        "testsDisabled": 0,
        "autoAppliedFixes": 0,
        "userAppliedFixes": 0,
        "postMerge": {
            "totalInvocations": 0,
            "successfulFixes": 0,
            "failedFixes": 0,
            "testsDisabled": 0,
        },
        "preMerge": {
            "totalInvocations": 0,
            "successfulFixes": 0,
            "failedFixes": 0,
            "testsDisabled": 0,
        },
    }


def parse_ts(ts_str):
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        return None


def load_existing_metrics(bucket, output_key):
    blob = bucket.blob(output_key)
    if blob.exists():
        return json.loads(blob.download_as_text())
    return None


def load_events(bucket):
    events = []
    for prefix in [
        "ai-fix-events/post-merge/",
        "ai-fix-events/pre-merge/",
        "ai-fix-events/user-applied/",
    ]:
        for blob in bucket.list_blobs(prefix=prefix):
            try:
                event = json.loads(blob.download_as_text())
                event["_blob_name"] = blob.name
                events.append(event)
            except (json.JSONDecodeError, Exception) as e:
                print(f"Warning: failed to parse {blob.name}: {e}", file=sys.stderr)
    return events


def aggregate(stored_data, all_events, trend_days, retention_days):
    now = datetime.now(timezone.utc)
    retention_cutoff_day = (now - timedelta(days=retention_days)).strftime("%Y-%m-%d")

    if stored_data:
        summary = stored_data.get("summary", empty_summary())
        disabled_tests = {t["target"]: t for t in stored_data.get("disabledTests", [])}
        processed_ids = set(stored_data.get("_processedIds", []))
        stored_trend = {e["date"]: e for e in stored_data.get("dailyTrend", [])}
    else:
        summary = empty_summary()
        disabled_tests = {}
        processed_ids = set()
        stored_trend = {}

    fix_events = [e for e in all_events if e.get("workflow") in ("post-merge", "pre-merge")]
    apply_events = [e for e in all_events if e.get("type") == "user_applied"]

    # Process new fix events into summary
    for event in fix_events:
        eid = event.get("id", "")
        if not eid or eid in processed_ids:
            continue
        processed_ids.add(eid)

        status = event.get("status", "failure")
        workflow = event.get("workflow", "")
        wf_key = "postMerge" if workflow == "post-merge" else "preMerge"

        summary["totalInvocations"] += 1
        summary[wf_key]["totalInvocations"] += 1

        if status == "success":
            summary["successfulFixes"] += 1
            summary[wf_key]["successfulFixes"] += 1
        elif status == "disabled":
            summary["testsDisabled"] += 1
            summary[wf_key]["testsDisabled"] += 1
        else:
            summary["failedFixes"] += 1
            summary[wf_key]["failedFixes"] += 1

        if event.get("applied") == "auto-label":
            summary["autoAppliedFixes"] += 1

        if status == "disabled" or event.get("fixType") == "test_disabled":
            for target in event.get("targets", []):
                disabled_tests[target] = {
                    "target": target,
                    "disabledAt": event.get("timestamp", ""),
                    "workflow": workflow,
                    "reason": event.get("reason") or "",
                    "runId": eid,
                }

    # Process new apply events
    for event in apply_events:
        eid = event.get("id", "")
        if not eid or eid in processed_ids:
            continue
        processed_ids.add(eid)
        summary["userAppliedFixes"] += 1

    # Build daily trend from raw events (last retention_days)
    # Days outside the retention window are preserved from stored data
    zeros = {"invocations": 0, "successful": 0, "failed": 0, "disabled": 0, "applied": 0}
    daily_counts = defaultdict(lambda: dict(zeros))

    for event in fix_events:
        ts = parse_ts(event.get("timestamp", ""))
        if not ts:
            continue
        day = ts.strftime("%Y-%m-%d")
        daily_counts[day]["invocations"] += 1
        status = event.get("status", "failure")
        if status == "success":
            daily_counts[day]["successful"] += 1
        elif status == "disabled":
            daily_counts[day]["disabled"] += 1
        else:
            daily_counts[day]["failed"] += 1
        if event.get("applied") == "auto-label":
            daily_counts[day]["applied"] += 1

    for event in apply_events:
        ts = parse_ts(event.get("timestamp", ""))
        if not ts:
            continue
        day = ts.strftime("%Y-%m-%d")
        daily_counts[day]["applied"] += 1

    daily_trend = []
    for i in range(trend_days):
        day = (now - timedelta(days=trend_days - 1 - i)).strftime("%Y-%m-%d")
        if day >= retention_cutoff_day:
            daily_trend.append({"date": day, **daily_counts.get(day, zeros)})
        elif day in stored_trend:
            daily_trend.append(stored_trend[day])
        else:
            daily_trend.append({"date": day, **zeros})

    # Recent runs from raw events
    recent_runs = []
    for event in fix_events:
        recent_runs.append({
            "id": event.get("id", ""),
            "timestamp": event.get("timestamp", ""),
            "workflow": event.get("workflow", ""),
            "status": event.get("status", "failure"),
            "targets": event.get("targets", []),
            "attempts": event.get("attempts", 0),
            "prUrl": event.get("prUrl"),
            "prNumber": event.get("prNumber"),
            "applied": event.get("applied", ""),
        })
    recent_runs.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    recent_runs = recent_runs[:RECENT_RUNS_LIMIT]

    # Prune processedIds to only IDs present in current events
    current_ids = {e.get("id") for e in all_events if e.get("id")}
    processed_ids = processed_ids & current_ids

    return {
        "timestamp": now.isoformat(),
        "summary": summary,
        "dailyTrend": daily_trend,
        "disabledTests": list(disabled_tests.values()),
        "recentRuns": recent_runs,
        "_processedIds": sorted(processed_ids),
    }


def cleanup_old_events(bucket, retention_days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    deleted = 0
    for prefix in [
        "ai-fix-events/post-merge/",
        "ai-fix-events/pre-merge/",
        "ai-fix-events/user-applied/",
    ]:
        for blob in bucket.list_blobs(prefix=prefix):
            if blob.updated and blob.updated < cutoff:
                blob.delete()
                deleted += 1
                print(f"Deleted old event: {blob.name}")
    print(f"Cleaned up {deleted} events older than {retention_days} days")


def main():
    from google.cloud import storage

    parser = argparse.ArgumentParser(description="Aggregate AI fix metrics from GCS")
    parser.add_argument("--bucket", default=GCS_BUCKET)
    parser.add_argument("--output-key", default=OUTPUT_KEY)
    parser.add_argument("--retention-days", type=int, default=EVENT_RETENTION_DAYS)
    parser.add_argument("--trend-days", type=int, default=TREND_DAYS)
    parser.add_argument("--dry-run", action="store_true", help="Print output without uploading")
    args = parser.parse_args()

    client = storage.Client()
    bucket = client.bucket(args.bucket)

    print(f"Loading existing metrics from gs://{args.bucket}/{args.output_key}...")
    existing = load_existing_metrics(bucket, args.output_key)

    print(f"Loading raw events from gs://{args.bucket}/ai-fix-events/...")
    events = load_events(bucket)
    print(f"Found {len(events)} raw events")

    print("Aggregating...")
    result = aggregate(existing, events, args.trend_days, args.retention_days)

    s = result["summary"]
    print(f"  Total invocations: {s['totalInvocations']}")
    print(f"  Successful: {s['successfulFixes']}")
    print(f"  Failed: {s['failedFixes']}")
    print(f"  Disabled: {s['testsDisabled']}")
    print(f"  Auto-applied: {s['autoAppliedFixes']}")
    print(f"  User-applied: {s['userAppliedFixes']}")
    print(f"  Disabled tests tracked: {len(result['disabledTests'])}")
    print(f"  Recent runs: {len(result['recentRuns'])}")

    if args.dry_run:
        public = {k: v for k, v in result.items() if not k.startswith("_")}
        print(json.dumps(public, indent=2))
        return

    print(f"Uploading to gs://{args.bucket}/{args.output_key}...")
    blob = bucket.blob(args.output_key)
    blob.upload_from_string(json.dumps(result, indent=2), content_type="application/json")

    cleanup_old_events(bucket, args.retention_days)
    print("Done!")


if __name__ == "__main__":
    main()
