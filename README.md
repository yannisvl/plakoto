# Plakoto

Browser Plakoto game for a human red player against a blue computer player.

## Modes

- Random moves: runs entirely in the browser and chooses one legal computer move sequence at random.
- RL model: requires `ai_server.py`. The server chooses blue moves with a trainable policy and updates the policy after each completed game.

## Run

Open `index.html` in a browser for random mode.

For RL model mode, start the AI server first:

```powershell
python ai_server.py
```

Then open `index.html` and choose `RL model`.

The online model is saved to `models/policy.json`. You can override the path with `PLAKOTO_MODEL_PATH`.

## Optional Self-Play Training

Start the JS rules environment:

```powershell
node env_server.js
```

In another terminal, train the same policy file:

```powershell
python ml/train_policy.py --episodes 100
```

The trainer and live server both use the shared rule engine through legal move sequences, so the model never chooses outside the Plakoto rules.
