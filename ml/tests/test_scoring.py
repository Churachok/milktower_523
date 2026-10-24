import json
import math
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from demo import COMPANIES, score_application
from domain.result_builder import build_result_payload
from domain.scoring import calculate_score
from server import Handler


def application(**changes):
    return {
        "company": {"inn": "5408123456"},
        "productId": "working", "amount": 2_400_000, "term": 18,
        "finances": {"revenue": 12_000_000, "expenses": 7_000_000, "debt": 0, "years": 3},
        "documents": [{"kind": "statement"}, {"kind": "report"}],
        **changes,
    }


class ScoringTests(unittest.TestCase):
    def test_five_documented_scenarios(self):
        for inn, amount, score, decision in [
            ("7701234567", 1_500_000, 1000, "APPROVED"),
            ("7702345678", 1_000_000, 500, "MANUAL_REVIEW"),
            ("7703456789", 5_000_000, 250, "NEED_MORE_INFO"),
            ("7704567890", 800_000, 650, "APPROVED_WITH_CONDITIONS"),
            ("7705678901", 2_000_000, 0, "REJECTED"),
        ]:
            with self.subTest(inn=inn):
                app = {"requested_amount": amount}
                checks = calculate_score(COMPANIES[inn], app)
                result = build_result_payload(checks, app)
                self.assertEqual(checks["score"], score)
                self.assertEqual(result["decision"], decision)
                if decision in ("REJECTED", "MANUAL_REVIEW", "NEED_MORE_INFO"):
                    self.assertIsNone(result["approved_amount"])
                if decision == "APPROVED_WITH_CONDITIONS":
                    self.assertEqual(result["approved_amount"], 560_000)

    def test_additional_documents_move_scenario_c_to_manual_review(self):
        app = {"requested_amount": 5_000_000, "documents_provided": True}
        result = build_result_payload(calculate_score(COMPANIES["7703456789"], app), app)
        self.assertEqual(result["checks"]["score"], 350)
        self.assertEqual(result["decision"], "MANUAL_REVIEW")

    def test_inactive_registration_cannot_be_compensated_by_positive_factors(self):
        company = {**COMPANIES["7701234567"], "egrul_status": "LIQUIDATED"}
        self.assertEqual(calculate_score(company, {"requested_amount": 100_000, "documents_provided": True})["score"], 0)

    def test_decision_boundaries(self):
        for score, decision in [(0, "REJECTED"), (199, "REJECTED"), (200, "NEED_MORE_INFO"),
                                (349, "NEED_MORE_INFO"), (350, "MANUAL_REVIEW"), (549, "MANUAL_REVIEW"),
                                (550, "APPROVED_WITH_CONDITIONS"), (749, "APPROVED_WITH_CONDITIONS"),
                                (750, "APPROVED"), (1000, "APPROVED")]:
            with self.subTest(score=score):
                self.assertEqual(build_result_payload({"score": score, "factors": []}, {"requested_amount": 100_000})["decision"], decision)

    def test_finances_change_the_score_and_explanation(self):
        healthy = score_application(application())
        stressed = score_application(application(finances={"revenue": 1_000_000, "expenses": 2_000_000, "debt": 10_000_000, "years": 3}))
        self.assertGreater(healthy["checks"]["score"], stressed["checks"]["score"])
        self.assertEqual(healthy["features"]["monthly_revenue_avg"], 1_000_000)
        self.assertAlmostEqual(healthy["features"]["net_profit_avg"], 5_000_000 / 12)
        self.assertTrue(any(f["code"] == "NEGATIVE_PROFIT" for f in stressed["checks"]["factors"]))
        self.assertNotIn("status", healthy)

    def test_synthetic_profile_does_not_overwrite_user_finances(self):
        result = score_application(application(company={"inn": "7703456789"}))
        self.assertEqual(result["features"]["monthly_revenue_avg"], 1_000_000)
        self.assertTrue(result["features"]["bki_has_delays"])
        self.assertFalse(result["checks"]["externalChecks"][1]["passed"])

    def test_initial_documents_do_not_count_as_requested_additional_documents(self):
        before = score_application(application())
        after = score_application(application(documents=[{"kind": "statement"}, {"kind": "report"}, {"kind": "additional"}]))
        self.assertFalse(any(f["code"] == "DOCS_PROVIDED" for f in before["checks"]["factors"]))
        self.assertTrue(any(f["code"] == "DOCS_PROVIDED" for f in after["checks"]["factors"]))

    def test_missing_documents_do_not_produce_an_approval_suggestion(self):
        result = score_application(application(documents=[]))
        self.assertEqual(result["decision"], "NEED_MORE_INFO")
        self.assertIsNone(result["approved_amount"])
        self.assertFalse(result["checks"]["externalChecks"][2]["passed"])

    def test_reduced_suggestion_below_product_minimum_requires_manual_review(self):
        result = score_application(application(
            company={"inn": "7704567890"}, amount=100_000, term=24,
            finances={"revenue": 1_000_000, "expenses": 500_000, "debt": 600_000, "years": 1},
        ))
        self.assertEqual(result["checks"]["score"], 650)
        self.assertEqual(result["decision"], "MANUAL_REVIEW")
        self.assertIsNone(result["approved_amount"])

    def test_invalid_input_is_rejected(self):
        for payload in [None, [], {}, application(amount=math.inf), application(term=18.5), application(amount=True),
                        application(productId="unknown"), application(company={"inn": []}),
                        application(finances={"revenue": "nan", "expenses": 0, "debt": 0, "years": 3}),
                        application(finances={"revenue": 1, "expenses": 0, "debt": 0, "years": "Infinity"}),
                        application(documents=[None])]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                score_application(payload)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_health_and_real_score(self):
        with urlopen(self.base + "/healthz", timeout=2) as response:
            self.assertEqual(json.load(response)["status"], "ok")
        request = Request(self.base + "/score", data=json.dumps(application()).encode(), headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=2) as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertEqual(json.load(response)["checks"]["source"], "rule-based")

    def test_invalid_json_and_route(self):
        for path, data, status in [("/score", b"{", 422), ("/missing", b"{}", 404), ("/score", b"[]", 422)]:
            request = Request(self.base + path, data=data, headers={"Content-Type": "application/json"})
            with self.subTest(path=path), self.assertRaises(HTTPError) as raised:
                urlopen(request, timeout=2)
            self.assertEqual(raised.exception.code, status)
            raised.exception.close()


if __name__ == "__main__":
    unittest.main()
