import argparse
import json
import os
import random
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

if __package__ in (None, ''):
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.policy_model import PolicyModel


def post_json(url, payload, timeout=10):
    data = json.dumps(payload).encode('utf-8')
    req = Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def initial_state():
    return {
        'positions': {
            'red': [15] + [0] * 23,
            'blue': [0] * 23 + [15]
        },
        'bearedOff': {
            'red': 0,
            'blue': 0
        },
        'currentTurn': 'red'
    }


def roll_dice(rng):
    d1 = rng.randint(1, 6)
    d2 = rng.randint(1, 6)
    if d1 == d2:
        return [d1, d1, d1, d1]
    return [d1, d2]


def toggle_turn(turn):
    return 'blue' if turn == 'red' else 'red'


def play_episode(model, base_url, rng, max_turns):
    state = initial_state()
    events = []
    winner = None

    for _ in range(max_turns):
        dice = roll_dice(rng)
        legal = post_json(f'{base_url}/legal_moves', {
            'state': state,
            'dice': dice
        })
        sequences = legal.get('sequences') or []

        if not sequences:
            state['currentTurn'] = toggle_turn(state['currentTurn'])
            continue

        index, choice, grad = model.choose(state, dice, sequences, rng)
        if choice is None:
            state['currentTurn'] = toggle_turn(state['currentTurn'])
            continue

        applied = post_json(f'{base_url}/apply', {
            'state': state,
            'sequence': choice.get('sequence'),
            'diceOrder': choice.get('order')
        })

        if not applied.get('valid', False):
            raise RuntimeError(f'engine rejected legal sequence {index}: {choice}')

        events.append({
            'player': state['currentTurn'],
            'grad': grad,
        })

        state = applied.get('state') or state
        winner = applied.get('winner')
        if winner:
            break

        state['currentTurn'] = toggle_turn(state['currentTurn'])

    return events, winner


def main():
    parser = argparse.ArgumentParser(description='On-policy RL self-play training using the JS rule engine.')
    parser.add_argument('--env-url', type=str, default='http://127.0.0.1:9000')
    parser.add_argument('--episodes', type=int, default=50)
    parser.add_argument('--max-turns', type=int, default=10000)
    parser.add_argument('--lr', type=float, default=0.03)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--save', type=str, default='models/policy.json')
    args = parser.parse_args()

    rng = random.Random(args.seed)
    model = PolicyModel.load(args.save)
    model.lr = args.lr

    try:
        for episode in range(args.episodes):
            events, winner = play_episode(model, args.env_url, rng, args.max_turns)
            updates = model.update_from_episode(events, winner)
            label = winner if winner else 'unfinished'
            print(
                f'Episode {episode + 1}/{args.episodes} - '
                f'winner: {label} - moves: {len(events)} - updates: {updates}'
            )

        model.save(args.save)
        print(f'Saved model to {args.save}')

    except (HTTPError, URLError) as err:
        raise SystemExit(f'Env server error: {err}')


if __name__ == '__main__':
    main()
