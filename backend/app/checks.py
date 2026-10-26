"""Persist the synthetic external checks returned by the ML service."""
from app.scoring import score_application


def run_checks(a) -> tuple[dict, list[dict], dict]:
    result = score_application(a)
    checks = result["checks"]
    items = [
        {
            "kind": kind, "status": "ok" if check["passed"] else "failed",
            "details": {"summary": check["label"], "simulated": True},
        }
        for kind, check in zip(
            ("egrul", "bki", "documents"), checks["externalChecks"], strict=True,
        )
    ]
    return checks, items, result
