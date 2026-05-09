async function requestAiMove(sequences) {
    const payload = {
        mode: aiMode || 'random',
        sequences: sequences,
        state: {
            currentTurn: currentTurn,
            dice: dice.slice(),
            positions: {
                red: positions.red.slice(),
                blue: positions.blue.slice()
            },
            bearedOff: { ...bearedOff },
            mustPlayAllDice: mustPlayAllDice,
            singleDieMode: singleDieMode,
            singleDieReason: singleDieReason,
            enforcedDie: enforcedDie
        }
    };

    const response = await fetch(AI_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`AI server error: ${response.status}`);
    }

    const data = await response.json();
    if (data && typeof data.index === 'number' && sequences[data.index]) {
        return sequences[data.index];
    }
    return data ? data.choice : null;
}

async function computerPlayTurn() {
    if (gameOver || currentTurn !== computerPlayer) {
        aiPlaying = false;
        return;
    }
    aiPlaying = true;

    let sequences = [];
    if (singleDieMode) {
        if (typeof enforcedDie === 'number') {
            sequences = getValidMoveSequencesWithOrder([enforcedDie], false);
        }
    } else if (mustPlayAllDice) {
        sequences = getValidMoveSequencesWithOrder(dice, true);
    } else {
        sequences = getValidMoveSequencesWithOrder(dice, false);
    }

    if (!sequences || sequences.length === 0) {
        aiPlaying = false;
        validateMoves(true);
        return;
    }

    let choice = null;
    try {
        choice = await requestAiMove(sequences);
    } catch (err) {
        aiPlaying = false;
        if (typeof setDiceMessage === 'function') {
            setDiceMessage(aiMode === 'model' ? 'AI not ready.' : 'AI offline.');
        }
        return;
    }

    if (!choice || !Array.isArray(choice.sequence) || !Array.isArray(choice.order)) {
        aiPlaying = false;
        if (typeof setDiceMessage === 'function') {
            setDiceMessage('AI error.');
        }
        return;
    }

    const sequence = choice.sequence.slice();
    dice = choice.order.slice();

    const playNextMove = () => {
        if (gameOver) {
            aiPlaying = false;
            return;
        }
        if (sequence.length === 0) {
            updateBoardDisplay();
            if (!gameOver) updateDiceMessage();
            aiPlaying = false;
            if (!gameOver) {
                setTimeout(() => validateMoves(true), AI_MOVE_DELAY_MS);
            }
            return;
        }

        const fromIndex = sequence.shift();
        const steps = dice[0];
        let moved = false;

        if (canBearOff(currentTurn)) {
            moved = bearOff(currentTurn, fromIndex, steps);
        }
        if (!moved) {
            moved = moveChecker(currentTurn, fromIndex, steps);
        }
        if (moved) {
            dice.shift();
        }

        updateBoardDisplay();
        if (!gameOver) updateDiceMessage();

        if (!moved) {
            aiPlaying = false;
            if (!gameOver) {
                setTimeout(() => validateMoves(true), AI_MOVE_DELAY_MS);
            }
            return;
        }

        setTimeout(playNextMove, AI_MOVE_DELAY_MS);
    };

    setTimeout(playNextMove, AI_MOVE_DELAY_MS);
}
