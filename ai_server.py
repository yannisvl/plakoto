import json
import os
import random
from http.server import BaseHTTPRequestHandler, HTTPServer

from ml.policy_model import PolicyModel


MODEL_PATH = os.environ.get('PLAKOTO_MODEL_PATH', os.path.join('models', 'policy.json'))
MODEL_LR = float(os.environ.get('PLAKOTO_MODEL_LR', '0.03'))

model = PolicyModel.load(MODEL_PATH)
model.lr = MODEL_LR
sessions = {}


def normalize_state(raw):
    raw = raw or {}
    positions = raw.get('positions') or {}
    return {
        'positions': {
            'red': list(positions.get('red') or [])[:24] + [0] * max(0, 24 - len(positions.get('red') or [])),
            'blue': list(positions.get('blue') or [])[:24] + [0] * max(0, 24 - len(positions.get('blue') or [])),
        },
        'bearedOff': {
            'red': int((raw.get('bearedOff') or {}).get('red', 0)),
            'blue': int((raw.get('bearedOff') or {}).get('blue', 0)),
        },
        'currentTurn': 'blue' if raw.get('currentTurn') == 'blue' else 'red',
    }


def choose_model_move(payload):
    sequences = payload.get('sequences') or []
    state = normalize_state(payload.get('state') or {})
    dice = (payload.get('state') or {}).get('dice') or []
    game_id = payload.get('gameId') or 'default'

    index, choice, grad = model.choose(state, dice, sequences, random)
    if choice is None:
        return None, None

    sessions.setdefault(game_id, []).append({
        'player': state['currentTurn'],
        'grad': grad,
    })
    return index, choice


def train_from_result(payload):
    game_id = payload.get('gameId') or 'default'
    winner = payload.get('winner')
    events = sessions.pop(game_id, [])
    updates = model.update_from_episode(events, winner)
    model.save(MODEL_PATH)
    return {
        'ok': True,
        'winner': winner,
        'moves': len(events),
        'updates': updates,
        'games_trained': model.games_trained,
        'model_path': MODEL_PATH,
    }


class AiHandler(BaseHTTPRequestHandler):
    def _send_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

    def _send_json(self, status, payload):
        self._send_headers(status)
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_OPTIONS(self):
        self._send_headers(204)

    def do_GET(self):
        if self.path != '/stats':
            self._send_json(404, {'error': 'not_found'})
            return

        self._send_json(200, {
            'model_path': MODEL_PATH,
            'games_trained': model.games_trained,
            'updates': model.updates,
            'open_sessions': len(sessions),
        })

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length).decode('utf-8') if length > 0 else ''
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._send_json(400, {'error': 'invalid_json'})
            return

        if self.path == '/move':
            sequences = payload.get('sequences') or []
            mode = payload.get('mode') or 'random'
            if not sequences:
                self._send_json(200, {'choice': None})
                return

            if mode == 'random':
                index = random.randrange(len(sequences))
                self._send_json(200, {'index': index, 'choice': sequences[index]})
                return

            if mode == 'model':
                try:
                    index, choice = choose_model_move(payload)
                except Exception as err:
                    self._send_json(500, {'error': 'model_error', 'detail': str(err)})
                    return
                self._send_json(200, {'index': index, 'choice': choice})
                return

            self._send_json(400, {'error': 'invalid_mode'})
            return

        if self.path == '/game_result':
            try:
                result = train_from_result(payload)
            except Exception as err:
                self._send_json(500, {'error': 'training_error', 'detail': str(err)})
                return
            self._send_json(200, result)
            return

        self._send_json(404, {'error': 'not_found'})


def run(host='127.0.0.1', port=8000):
    server = HTTPServer((host, port), AiHandler)
    print(f'AI server running on http://{host}:{port}')
    print(f'RL policy path: {MODEL_PATH}')
    server.serve_forever()


if __name__ == '__main__':
    run()
