import json
import math
import os
import random
from dataclasses import dataclass, field


TOTAL_CHECKERS = 15
POINT_COUNT = 24
STATE_DIM = 55
ACTION_DIM = 9
TRANSITION_DIM = 12
FEATURE_DIM = STATE_DIM + ACTION_DIM + TRANSITION_DIM


def opponent_of(player):
    return 'blue' if player == 'red' else 'red'


def direction_of(player):
    return 1 if player == 'red' else -1


def home_range(player):
    return (18, 23) if player == 'red' else (0, 5)


def checker_count(value):
    return value if value > 0 else (1 if value == -1 else 0)


def point_count(positions, player, index):
    return checker_count(positions[player][index])


def count_home(state, player):
    start, end = home_range(player)
    return sum(checker_count(state['positions'][player][i]) for i in range(start, end + 1))


def count_pinned(state, player):
    return sum(1 for value in state['positions'][player] if value == -1)


def count_anchors(state, player):
    opponent = opponent_of(player)
    anchors = 0
    for i in range(POINT_COUNT):
        if state['positions'][player][i] >= 2:
            anchors += 1
        elif state['positions'][player][i] > 0 and state['positions'][opponent][i] == -1:
            anchors += 1
    return anchors


def count_singletons(state, player):
    opponent = opponent_of(player)
    singles = 0
    for i in range(POINT_COUNT):
        if state['positions'][player][i] == 1 and state['positions'][opponent][i] == 0:
            singles += 1
    return singles


def pip_distance(state, player):
    distance = 0
    for index, value in enumerate(state['positions'][player]):
        count = checker_count(value)
        if count == 0:
            continue
        point_distance = (POINT_COUNT - index) if player == 'red' else (index + 1)
        distance += count * point_distance
    return distance


def mother_pinned(state, player):
    start = 0 if player == 'red' else 23
    return state['positions'][player][start] == -1


def mother_still_at_start(state, player):
    start = 0 if player == 'red' else 23
    return checker_count(state['positions'][player][start]) > 0


def check_winner(state):
    red_mother = mother_pinned(state, 'red')
    blue_mother = mother_pinned(state, 'blue')
    if red_mother and blue_mother:
        return 'draw'
    if red_mother and not mother_still_at_start(state, 'blue'):
        return 'blue'
    if blue_mother and not mother_still_at_start(state, 'red'):
        return 'red'
    if state['bearedOff']['red'] >= TOTAL_CHECKERS:
        return 'red'
    if state['bearedOff']['blue'] >= TOTAL_CHECKERS:
        return 'blue'
    return None


def clone_state(state):
    return {
        'positions': {
            'red': list(state['positions']['red']),
            'blue': list(state['positions']['blue']),
        },
        'bearedOff': {
            'red': int(state['bearedOff'].get('red', 0)),
            'blue': int(state['bearedOff'].get('blue', 0)),
        },
        'currentTurn': state.get('currentTurn', 'red'),
    }


def apply_choice_for_features(state, choice):
    next_state = clone_state(state)
    player = next_state.get('currentTurn', 'red')
    opponent = opponent_of(player)
    direction = direction_of(player)
    sequence = choice.get('sequence') or []
    order = choice.get('order') or []

    for from_index, die in zip(sequence, order):
        if from_index < 0 or from_index >= POINT_COUNT:
            continue
        if next_state['positions'][player][from_index] <= 0:
            continue

        to_index = from_index + direction * die
        next_state['positions'][player][from_index] -= 1

        if to_index < 0 or to_index >= POINT_COUNT:
            next_state['bearedOff'][player] += 1
        else:
            if (
                next_state['positions'][opponent][to_index] == 1
                and next_state['positions'][player][to_index] == 0
            ):
                next_state['positions'][opponent][to_index] = -1
            next_state['positions'][player][to_index] += 1

        if (
            next_state['positions'][opponent][from_index] == -1
            and next_state['positions'][player][from_index] == 0
        ):
            next_state['positions'][opponent][from_index] = 1

    return next_state


def encode_state(state, dice):
    red = state['positions']['red']
    blue = state['positions']['blue']
    vec = [v / TOTAL_CHECKERS for v in red] + [v / TOTAL_CHECKERS for v in blue]
    vec.append(state['bearedOff']['red'] / TOTAL_CHECKERS)
    vec.append(state['bearedOff']['blue'] / TOTAL_CHECKERS)
    vec.append(1.0 if state.get('currentTurn') == 'red' else 0.0)

    dice_pad = list(dice or []) + [0] * 4
    vec.extend([d / 6.0 for d in dice_pad[:4]])
    return vec


def encode_action(choice):
    seq = choice.get('sequence') or []
    order = choice.get('order') or []
    seq_pad = list(seq) + [-1] * 4
    order_pad = list(order) + [0] * 4

    vec = [len(seq) / 4.0]
    for idx in seq_pad[:4]:
        vec.append(idx / 23.0 if idx >= 0 else -1.0)
    vec.extend([d / 6.0 for d in order_pad[:4]])
    return vec


def encode_transition(state, choice):
    player = state.get('currentTurn', 'red')
    opponent = opponent_of(player)
    before = state
    after = apply_choice_for_features(state, choice)
    winner = check_winner(after)
    order = choice.get('order') or []
    sequence = choice.get('sequence') or []
    pip_delta = pip_distance(before, player) - pip_distance(after, player)

    return [
        pip_delta / 24.0,
        (after['bearedOff'][player] - before['bearedOff'][player]) / TOTAL_CHECKERS,
        (count_home(after, player) - count_home(before, player)) / TOTAL_CHECKERS,
        (count_pinned(after, opponent) - count_pinned(before, opponent)) / TOTAL_CHECKERS,
        (count_pinned(after, player) - count_pinned(before, player)) / TOTAL_CHECKERS,
        (count_anchors(after, player) - count_anchors(before, player)) / POINT_COUNT,
        (count_singletons(after, player) - count_singletons(before, player)) / POINT_COUNT,
        1.0 if winner == player else 0.0,
        1.0 if winner == opponent else 0.0,
        1.0 if winner == 'draw' else 0.0,
        (sum(order[:len(sequence)]) / 24.0) if sequence else 0.0,
        len(sequence) / 4.0,
    ]


def featurize(state, dice, choice):
    features = encode_state(state, dice) + encode_action(choice) + encode_transition(state, choice)
    if len(features) != FEATURE_DIM:
        raise ValueError(f'feature length {len(features)} != {FEATURE_DIM}')
    return features


def dot(left, right):
    return sum(a * b for a, b in zip(left, right))


def softmax(scores, temperature=0.8):
    if not scores:
        return []
    temp = max(temperature, 0.05)
    scaled = [score / temp for score in scores]
    top = max(scaled)
    exps = [math.exp(min(40.0, value - top)) for value in scaled]
    total = sum(exps)
    if total <= 0:
        return [1.0 / len(scores)] * len(scores)
    return [value / total for value in exps]


def weighted_index(probs, rng=random):
    marker = rng.random()
    acc = 0.0
    for index, prob in enumerate(probs):
        acc += prob
        if marker <= acc:
            return index
    return len(probs) - 1


def outcome_reward(winner, player):
    if winner in (None, 'draw', 'unfinished'):
        return 0.0
    return 1.0 if winner == player else -1.0


@dataclass
class PolicyModel:
    weights: list = field(default_factory=lambda: [0.0] * FEATURE_DIM)
    lr: float = 0.03
    l2: float = 0.0001
    games_trained: int = 0
    updates: int = 0

    def score(self, features):
        return dot(self.weights, features)

    def choose(self, state, dice, sequences, rng=random):
        if not sequences:
            return None, None, []

        feature_rows = [featurize(state, dice, choice) for choice in sequences]
        scores = [self.score(features) for features in feature_rows]
        probs = softmax(scores)
        index = weighted_index(probs, rng)
        expected = [0.0] * FEATURE_DIM
        for prob, features in zip(probs, feature_rows):
            for i, value in enumerate(features):
                expected[i] += prob * value
        grad = [value - expected[i] for i, value in enumerate(feature_rows[index])]
        return index, sequences[index], grad

    def update_from_episode(self, events, winner):
        applied = 0
        for event in events:
            reward = outcome_reward(winner, event.get('player'))
            if reward == 0.0:
                continue
            grad = event.get('grad') or []
            if len(grad) != FEATURE_DIM:
                continue
            for i, value in enumerate(grad):
                self.weights[i] = self.weights[i] * (1.0 - self.lr * self.l2) + self.lr * reward * value
            applied += 1

        self.games_trained += 1
        self.updates += applied
        return applied

    def to_dict(self):
        return {
            'version': 1,
            'feature_dim': FEATURE_DIM,
            'weights': self.weights,
            'lr': self.lr,
            'l2': self.l2,
            'games_trained': self.games_trained,
            'updates': self.updates,
        }

    @classmethod
    def from_dict(cls, data):
        weights = list(data.get('weights') or [])
        if len(weights) != FEATURE_DIM:
            weights = [0.0] * FEATURE_DIM
        return cls(
            weights=weights,
            lr=float(data.get('lr', 0.03)),
            l2=float(data.get('l2', 0.0001)),
            games_trained=int(data.get('games_trained', 0)),
            updates=int(data.get('updates', 0)),
        )

    @classmethod
    def load(cls, path):
        if not os.path.exists(path):
            return cls()
        with open(path, 'r', encoding='utf-8') as handle:
            return cls.from_dict(json.load(handle))

    def save(self, path):
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        temp_path = f'{path}.tmp'
        with open(temp_path, 'w', encoding='utf-8') as handle:
            json.dump(self.to_dict(), handle, indent=2)
        os.replace(temp_path, path)
