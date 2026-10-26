"""ML transport; the employee's final decision stays in the backend."""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import get_settings
from app.errors import ApiError

CODES = {
    "APPROVED": "approve",
    "APPROVED_WITH_CONDITIONS": "review",
    "MANUAL_REVIEW": "review",
    "NEED_MORE_INFO": "review",
    "REJECTED": "reject",
}


def diverges(code: str | None, decision: str) -> bool:
    return (code == "approve" and decision == "rejected") or (
        code == "reject" and decision == "approved"
    )


def score_application(a) -> dict:
    # Send only scoring features, excluding contacts and document contents.
    payload = {
        "company": {"inn": a.company.get("inn")},
        "productId": a.product_id, "amount": a.amount, "term": a.term,
        "finances": a.finances,
        "documents": [{"kind": d.get("kind")} for d in a.documents],
    }
    settings = get_settings()
    request = Request(
        settings.ml_base_url.rstrip("/") + "/score",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urlopen(request, timeout=settings.ml_timeout_seconds) as response:
            result = json.load(response)
        checks = result["checks"]
        score = checks["score"]
        if (
            type(score) is not int or not 0 <= score <= 1000
            or result["decision"] not in CODES
            or checks["source"] != "rule-based"
            or not isinstance(checks["factors"], list)
            or not isinstance(checks["externalChecks"], list)
            or len(checks["externalChecks"]) != 3
            or any(not isinstance(c, dict) or not isinstance(c.get("label"), str)
                   or type(c.get("passed")) is not bool for c in checks["externalChecks"])
            or not isinstance(checks["modelVersion"], str)
            or not isinstance(checks["recommendation"], str)
            or not isinstance(checks["rating"], str)
            or not isinstance(result["features"], dict)
            or not isinstance(result["assumptions"], list)
        ):
            raise ValueError("Invalid ML response")
        checks["recommendationCode"] = CODES[result["decision"]]
        return result
    except HTTPError as error:
        if error.code == 422:
            raise ApiError(400, "scoring_input", "Проверьте данные заявки для скоринга") from error
        raise ApiError(503, "scoring_unavailable", "Сервис скоринга временно недоступен") from error
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
        raise ApiError(
            503, "scoring_unavailable",
            "Не удалось получить оценку ML. Повторите проверку позднее.",
        ) from error
