import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def ml_url():
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ml"))
    from server import Handler

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()
    thread.join()


@pytest.fixture
def client(tmp_path, monkeypatch, ml_url):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ML_BASE_URL", ml_url)
    from app.config import get_settings
    from app.db import get_engine

    get_settings.cache_clear()
    get_engine.cache_clear()
    from app.main import app

    with TestClient(app) as c:
        yield c
    get_engine().dispose()
    get_engine.cache_clear()
