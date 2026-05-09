import argparse
import json
import os
import random
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import torch
import torch.nn as nn
import torch.optim as optim


STATE_DIM = 55
ACTION_DIM = 9


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


def encode_state(state, dice):
    red = state['positions']['red']
    blue = state['positions']['blue']
    vec = [v / 15.0 for v in red] + [v / 15.0 for v in blue]
    vec.append(state['bearedOff']['red'] / 15.0)
    vec.append(state['bearedOff']['blue'] / 15.0)
    vec.append(1.0 if state['currentTurn'] == 'red' else 0.0)

    dice_pad = list(dice) + [0] * (4 - len(dice))
    vec.extend([d / 6.0 for d in dice_pad[:4]])

    return torch.tensor(vec, dtype=torch.float32)


def encode_action(choice):
    seq = choice.get('sequence') or []
    order = choice.get('order') or []

    seq_pad = list(seq) + [-1] * (4 - len(seq))
    order_pad = list(order) + [0] * (4 - len(order))

    vec = [len(seq) / 4.0]
    for idx in seq_pad[:4]:
        vec.append(idx / 23.0 if idx >= 0 else -1.0)
    vec.extend([d / 6.0 for d in order_pad[:4]])

    return torch.tensor(vec, dtype=torch.float32)


def outcome_reward(winner, player):
    if winner in (None, 'draw', 'unfinished'):
        return 0.0
    return 1.0 if winner == player else -1.0


class PolicyNet(nn.Module):
    def __init__(self, state_dim=STATE_DIM, action_dim=ACTION_DIM, hidden=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim + action_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 1)
        )

    def forward(self, state_batch, action_batch):
        x = torch.cat([state_batch, action_batch], dim=-1)
        return self.net(x).squeeze(-1)


def select_action(model, state_vec, sequences):
    action_vecs = torch.stack([encode_action(s) for s in sequences])
    state_batch = state_vec.unsqueeze(0).repeat(action_vecs.size(0), 1)
    scores = model(state_batch, action_vecs)
    probs = torch.softmax(scores, dim=0)
    if probs.numel() == 1:
        idx = 0
    else:
        idx = torch.multinomial(probs, 1).item()
    log_probs = torch.log(probs + 1e-9)
    return idx, log_probs[idx]


def play_episode(model, base_url, rng, max_turns):
    state = initial_state()
    log_probs = []
    players = []
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

        state_vec = encode_state(state, dice)
        action_index, log_prob = select_action(model, state_vec, sequences)
        choice = sequences[action_index]

        applied = post_json(f'{base_url}/apply', {
            'state': state,
            'sequence': choice.get('sequence'),
            'diceOrder': choice.get('order')
        })

        log_probs.append(log_prob)
        players.append(state['currentTurn'])

        state = applied.get('state') or state
        winner = applied.get('winner')
        if winner:
            break

        state['currentTurn'] = toggle_turn(state['currentTurn'])

    return log_probs, players, winner


def main():
    parser = argparse.ArgumentParser(description='On-policy RL training using the JS engine server.')
    parser.add_argument('--env-url', type=str, default='http://127.0.0.1:9000')
    parser.add_argument('--episodes', type=int, default=50)
    parser.add_argument('--max-turns', type=int, default=10000)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--save', type=str, default='models/policy.pt')
    args = parser.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    model = PolicyNet()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    os.makedirs(os.path.dirname(args.save), exist_ok=True)

    try:
        for episode in range(args.episodes):
            log_probs, players, winner = play_episode(model, args.env_url, random, args.max_turns)

            loss = 0.0
            used_steps = 0
            for log_prob, player in zip(log_probs, players):
                reward = outcome_reward(winner, player)
                if reward == 0.0:
                    continue
                loss = loss + (-reward * log_prob)
                used_steps += 1

            if used_steps > 0:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            label = winner if winner else 'unfinished'
            print(f"Episode {episode + 1}/{args.episodes} - winner: {label} - steps: {len(players)}")

        torch.save(model.state_dict(), args.save)
        print(f"Saved model to {args.save}")

    except (HTTPError, URLError) as err:
        raise SystemExit(f'Env server error: {err}')


if __name__ == '__main__':
    main()
