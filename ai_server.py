import json
import random
from http.server import BaseHTTPRequestHandler, HTTPServer


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
        if not sequences:
            self._send_headers(200)
            self.wfile.write(b'{"choice":null}')
            return

        choice = random.choice(sequences)
        self._send_headers(200)
        self.wfile.write(json.dumps({"choice": choice}).encode('utf-8'))


def run(host='127.0.0.1', port=8000):
    server = HTTPServer((host, port), AiHandler)
    print(f'AI server running on http://{host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    run()
