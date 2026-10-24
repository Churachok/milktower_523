"""Small local, stateless scoring service. No accounts, uploads or persistence."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from demo import MODEL_VERSION, score_application


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/healthz":
            self.respond(200, {"status": "ok", "modelVersion": MODEL_VERSION})
        else:
            self.respond(404, {"message": "Маршрут не найден"})

    def do_POST(self):
        if self.path != "/score":
            return self.respond(404, {"message": "Маршрут не найден"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                return self.respond(413, {"message": "Ожидается JSON размером до 64 КиБ"})
            if self.headers.get_content_type() != "application/json":
                return self.respond(415, {"message": "Ожидается application/json"})
            payload = json.loads(self.rfile.read(length))
            self.respond(200, score_application(payload))
        except (ValueError, TypeError, OverflowError, RecursionError) as error:
            self.respond(422, {"message": str(error) if isinstance(error, ValueError) else "Некорректные входные данные"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), Handler) as server:
        print(f"Synthetic scoring {MODEL_VERSION}: http://{args.host}:{args.port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
