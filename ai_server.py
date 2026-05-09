import json
import random
from http.server import BaseHTTPRequestHandler, HTTPServer


def run_model(payload):
    # Placeholder for ML inference. Return one of payload['sequences'].
    raise NotImplementedError('model_not_configured')


class AiHandler(BaseHTTPRequestHandler):
    def _send_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.end_headers()

    def do_OPTIONS(self):
        self._send_headers(204)

    def do_POST(self):
        if self.path != '/move':
            self._send_headers(404)
            self.wfile.write(b'{"error":"not_found"}')
            return

        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length).decode('utf-8') if length > 0 else ''
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._send_headers(400)
            self.wfile.write(b'{"error":"invalid_json"}')
            return

        sequences = payload.get('sequences') or []
        mode = payload.get('mode') or 'random'
        if not sequences:
            self._send_headers(200)
            self.wfile.write(b'{"choice":null}')
            return

        if mode == 'random':
            choice = random.choice(sequences)
            self._send_headers(200)
            self.wfile.write(json.dumps({"choice": choice}).encode('utf-8'))
            return

        if mode == 'model':
            try:
                choice = run_model(payload)
            except NotImplementedError:
                self._send_headers(501)
                self.wfile.write(b'{"error":"model_not_configured"}')
                return
            except Exception:
                self._send_headers(500)
                self.wfile.write(b'{"error":"model_error"}')
                return

            self._send_headers(200)
            self.wfile.write(json.dumps({"choice": choice}).encode('utf-8'))
            return

        self._send_headers(400)
        self.wfile.write(b'{"error":"invalid_mode"}')


def run(host='127.0.0.1', port=8000):
    server = HTTPServer((host, port), AiHandler)
    print(f'AI server running on http://{host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    run()
