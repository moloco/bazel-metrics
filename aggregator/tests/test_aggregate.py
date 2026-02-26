import unittest
from datetime import datetime, timedelta, timezone

from aggregator.aggregate import aggregate, empty_summary


def iso(days_offset: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_offset)).strftime("%Y-%m-%dT%H:%M:%SZ")


class AggregateTests(unittest.TestCase):
    def test_idempotent_with_processed_ids(self):
        events = [
            {
                "id": "pre-1-1",
                "timestamp": iso(-1),
                "workflow": "pre-merge",
                "status": "success",
                "attempts": 2,
                "targets": ["//go/pkg/foo:all"],
                "applied": "auto-label",
            },
            {
                "id": "apply-1-1",
                "type": "user_applied",
                "timestamp": iso(-1),
            },
        ]
        first = aggregate(None, events, trend_days=7, retention_days=7)
        second = aggregate(first, events, trend_days=7, retention_days=7)

        self.assertEqual(first["summary"], second["summary"])
        self.assertEqual(first["_processedIds"], second["_processedIds"])

    def test_disabled_reason_is_normalized_to_string(self):
        events = [
            {
                "id": "pre-2-1",
                "timestamp": iso(-1),
                "workflow": "pre-merge",
                "status": "disabled",
                "fixType": "test_disabled",
                "targets": ["//go/pkg/bar:bar_test"],
                "reason": None,
            }
        ]
        result = aggregate(None, events, trend_days=7, retention_days=7)

        self.assertEqual(len(result["disabledTests"]), 1)
        self.assertEqual(result["disabledTests"][0]["reason"], "")

    def test_preserves_historical_trend_outside_retention(self):
        old_day = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
        stored = {
            "summary": empty_summary(),
            "dailyTrend": [
                {
                    "date": old_day,
                    "invocations": 9,
                    "successful": 8,
                    "failed": 1,
                    "disabled": 0,
                    "applied": 4,
                }
            ],
            "disabledTests": [],
            "_processedIds": [],
        }
        result = aggregate(stored, [], trend_days=5, retention_days=1)
        entry = next(item for item in result["dailyTrend"] if item["date"] == old_day)

        self.assertEqual(entry["invocations"], 9)
        self.assertEqual(entry["successful"], 8)


if __name__ == "__main__":
    unittest.main()
