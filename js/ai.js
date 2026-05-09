function computerPlayTurn() {
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

    const choice = sequences[Math.floor(Math.random() * sequences.length)];
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
