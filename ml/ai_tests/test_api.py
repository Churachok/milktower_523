"""The optional API must start and score without a Groq key or network calls."""
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient

from main import app


class OptionalApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.env = patch.dict(os.environ, {"GROQ_API_KEY": ""})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_health_without_key(self):
        self.assertEqual(self.client.get("/healthz").json(), {"status": "ok"})

    def test_core_score_without_key(self):
        response = self.client.post("/score", json={
            "company": {"inn": "5408123456"}, "productId": "working",
            "amount": 2400000, "term": 18,
            "finances": {"revenue": 12000000, "expenses": 7000000, "debt": 0, "years": 3},
            "documents": [{"kind": "statement"}, {"kind": "report"}],
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["checks"]["score"], 1000)

    def test_invalid_score(self):
        self.assertEqual(self.client.post("/score", json={}).status_code, 422)

    def test_ai_helpers_report_missing_key(self):
        self.assertEqual(self.client.post("/api/v1/generate-client-request", json={}).status_code, 503)
        response = self.client.post("/api/v1/extract-document", files={"file": ("test.pdf", b"%PDF", "application/pdf")})
        self.assertEqual(response.status_code, 503)

    def test_document_extraction_and_client_request_without_network(self):
        content = '{"revenue":12000000,"expenses":7000000,"other_items":{},"summary":"Синтетический пример"}'
        completion = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])
        create = unittest.mock.Mock(return_value=completion)
        fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch("main.get_groq_client", return_value=fake):
            document = Path(__file__).resolve().parents[2] / "docs/fixtures/financial-report.pdf"
            response = self.client.post("/api/v1/extract-document", files={"file": (document.name, document.read_bytes(), "application/pdf")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["revenue"], 12000000)
            response = self.client.post("/api/v1/generate-client-request", json={"purpose":"Закупка сырья"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["request_text"], content)
            self.assertEqual(create.call_count, 2)


if __name__ == "__main__":
    unittest.main()
