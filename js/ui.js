function getPlayerLabel() {
    return currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
}

function setDiceMessage(restrictionText = '') {
    const diceResultEl = document.getElementById('dice-result');
    if (!diceResultEl) return;
    const label = getPlayerLabel();

    if (!rolledDiceDisplay || rolledDiceDisplay.length === 0) {
        diceResultEl.textContent = `${label} roll.`;
        return;
    }

    let text = `${label}: ${rolledDiceDisplay.join(', ')}`;
    if (restrictionText) {
        text += ` - ${restrictionText}`;
    }
    diceResultEl.textContent = text;
}

function setupAiModeControl() {
    const select = document.getElementById('ai-mode');
    if (!select) return;
    aiMode = select.value || 'random';
    select.addEventListener('change', () => {
        aiMode = select.value || 'random';
    });
}

function getCurrentLegalSequences() {
    if (!dice || dice.length === 0) return [];
    return getLegalMoveSequencesForCurrentTurn();
}

function getLegalSequencesForCurrentDie() {
    return getCurrentLegalSequences().filter(choice => {
        return choice && Array.isArray(choice.order) && choice.order[0] === dice[0];
    });
}

function canUseCurrentDieFrom(pointIndex) {
    return getLegalSequencesForCurrentDie().some(choice => {
        return Array.isArray(choice.sequence) && choice.sequence[0] === pointIndex;
    });
}

function rollDice(instant = false) {
    if (gameOver) return; // no rolls after game end
    aiPlaying = false;

    const diceResultEl = document.getElementById('dice-result');

    if (!instant) {
        diceRolling = true;
        const duration = 600;
        const interval = 60;
        const timer = setInterval(() => {
            diceResultEl.textContent = 'Rolling...';
        }, interval);

        setTimeout(() => {
            clearInterval(timer);
            rollDice(true);
        }, duration);

        return;
    }

    diceRolling = false;
    diceRolledThisTurn = true;

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;

    dice = [die1, die2];
    if (die1 === die2) {
        dice = [die1, die1, die1, die1];
    }

    rolledDiceDisplay = dice.slice();

    turnHistory = [];

    // determine play policy ---
    mustPlayAllDice = false;
    singleDieMode = false;
    singleDieReason = null;
    enforcedDie = null;

    const policy = computeMovePolicy(dice);
    mustPlayAllDice = policy.mustPlayAllDice;
    singleDieMode = policy.singleDieMode;
    singleDieReason = policy.singleDieReason;
    enforcedDie = policy.enforcedDie;

    if (singleDieMode && dice.length === 2 && dice[0] !== dice[1] && dice[0] !== enforcedDie) {
        dice.reverse();
    }

    updateDiceMessage();

    if (currentTurn === computerPlayer) {
        aiPlaying = true;
        setTimeout(() => computerPlayTurn(), AI_MOVE_DELAY_MS);
    }
}

function initializeBoard() {
    for (let i = 0; i < 24; i++) {
        const point = document.getElementById(`point-${i}`);
        point.addEventListener('click', () => handlePointClick(i));
    }
    updateBoardDisplay();
}

function handlePointClick(pointIndex) {
    if (gameOver || currentTurn !== humanPlayer || aiPlaying) return;

    if (positions[currentTurn][pointIndex] > 0 && dice.length > 0) {
        // Enforce tie rule: both dice playable but only the higher must be used
        if (singleDieMode && dice.length === 2 && singleDieReason === 'mustUseHigher') {
            const largest = Math.max(dice[0], dice[1]);
            const clickedDieNeeded = dice[0]; // the die that would be used (first in array)
            if (clickedDieNeeded !== largest) {
                alert(`Higher only (${largest}).`);
                return;
            }
        }

        // Enforce "only one die is playable" rule
        if (singleDieMode && dice.length === 2) {
            // die to be used must be first in array (dice[0])
            if (dice[0] !== enforcedDie) {
                const msg = (singleDieReason === 'mustUseHigher')
                    ? `Higher only (${enforcedDie}).`
                    : `Only ${enforcedDie}.`;
                alert(msg);
                return;
            }
        }

        const legalSequences = getCurrentLegalSequences();
        if (legalSequences.length === 0) {
            alert('No legal move. Validate.');
            return;
        }
        if (!canUseCurrentDieFrom(pointIndex)) {
            const hasOtherOrder = legalSequences.some(choice => {
                return choice && Array.isArray(choice.order) && choice.order[0] !== dice[0];
            });
            alert(hasOtherOrder ? 'Swap dice for that move.' : 'That move leaves required dice unused.');
            return;
        }

        saveTurnState();

        const steps = dice[0];
        let validBearOff = false;
        let validMove = false;

        if (canBearOff(currentTurn)) {
            validBearOff = bearOff(currentTurn, pointIndex, steps);
        }
        if (!validBearOff) {
            validMove = moveChecker(currentTurn, pointIndex, steps);
        }

        if (validBearOff || validMove) {
            updateBoardDisplay();
            dice.shift();
            updateDiceMessage();
        }
    }
}

function saveTurnState() {
    // Save the state of the board after each move within the player's turn
    const turnState = {
        positions: {
            red: [...positions.red],
            blue: [...positions.blue]
        },
        bearedOff: { ...bearedOff },
        dice: [...dice],
        mustPlayAllDice: mustPlayAllDice,
        singleDieMode: singleDieMode,
        singleDieReason: singleDieReason,
        enforcedDie: enforcedDie
    };
    turnHistory.push(turnState);
}

function undoMove() {
    if (currentTurn !== humanPlayer || aiPlaying) return;
    if (turnHistory.length > 0) {
        const lastTurnState = turnHistory.pop(); // Retrieve the last move in the current turn

        // Restore the game state from the last move
        positions.red = [...lastTurnState.positions.red];
        positions.blue = [...lastTurnState.positions.blue];
        bearedOff.red = lastTurnState.bearedOff.red;
        bearedOff.blue = lastTurnState.bearedOff.blue;
        dice = [...lastTurnState.dice];
        mustPlayAllDice = lastTurnState.mustPlayAllDice;
        singleDieMode = !!lastTurnState.singleDieMode;
        singleDieReason = lastTurnState.singleDieReason || null;
        enforcedDie = (typeof lastTurnState.enforcedDie === 'number') ? lastTurnState.enforcedDie : null;

        updateBoardDisplay(); // Update the board display
        updateDiceMessage(); // Update the dice message
    } else {
        alert('No moves to undo!');
    }
}

function validateMoves(fromAI = false) {
    if (!fromAI && (currentTurn !== humanPlayer || aiPlaying)) return;
    if (!fromAI && (diceRolling || !diceRolledThisTurn)) {
        rolledDiceDisplay = [];
        setDiceMessage();
        return;
    }
    // Confirm the player's moves for this turn and switch to the next player
    const legalSequences = getCurrentLegalSequences();
    if (dice.length === 0 || legalSequences.length === 0 || (singleDieMode && dice.length <= 1)) {
        turnHistory = [];
        currentTurn = currentTurn === humanPlayer ? computerPlayer : humanPlayer;
        diceRolledThisTurn = false;
        diceRolling = false;
        rolledDiceDisplay = [];
        setDiceMessage();
        setTimeout(() => rollDice(), 50);
    } else {
        alert('You still have moves left!');
    }
}

function swapDice() {
    if (currentTurn !== humanPlayer || aiPlaying) return;
    if (dice.length <= 1) return;
    if (singleDieMode) {
        alert(`Swap disabled (${enforcedDie} only).`);
        return;
    }
    dice.reverse();
    if (rolledDiceDisplay && rolledDiceDisplay.length > 1) {
        rolledDiceDisplay.reverse();
    }
    updateDiceMessage();
}

function updateDiceMessage() {
    if (!rolledDiceDisplay || rolledDiceDisplay.length === 0) {
        setDiceMessage();
        return;
    }

    let restriction = '';
    const legalSequences = getCurrentLegalSequences();
    const hasMoves = legalSequences.length > 0;
    const currentDiePlayable = getLegalSequencesForCurrentDie().length > 0;

    if (dice.length === 0) {
        restriction = 'Validate.';
    } else if (!hasMoves) {
        restriction = 'No moves. Validate.';
    } else if (!currentDiePlayable) {
        restriction = 'Swap dice.';
    } else if (singleDieMode && dice.length >= 2) {
        if (singleDieReason === 'mustUseHigher') {
            restriction = `Higher only (${enforcedDie}).`;
        } else {
            restriction = `Only ${enforcedDie}.`;
        }
    } else if (singleDieMode && dice.length === 1) {
        restriction = 'Validate.';
    } else if (!mustPlayAllDice && rolledDiceDisplay.length === 4) {
        restriction = 'Use as many as possible.';
    }

    setDiceMessage(restriction);
}

function updateBoardDisplay() {
    for (let i = 0; i < 24; i++) {
        document.getElementById(`point-${i}`).innerHTML = '';

        // Update red checkers
        let redCheckersCount = positions.red[i];
        for (let j = 0; j < Math.min(redCheckersCount, 5); j++) {
            document.getElementById(`point-${i}`).innerHTML += `<div class="checker red"></div>`;
        }
        if (redCheckersCount > 5) {
            document.getElementById(`point-${i}`).innerHTML += `<div class="checker-count">${redCheckersCount}</div>`;
        }

        // Update blue checkers
        let blueCheckersCount = positions.blue[i];
        for (let j = 0; j < Math.min(blueCheckersCount, 5); j++) {
            document.getElementById(`point-${i}`).innerHTML += `<div class="checker blue"></div>`;
        }
        if (blueCheckersCount > 5) {
            document.getElementById(`point-${i}`).innerHTML += `<div class="checker-count">${blueCheckersCount}</div>`;
        }

        // Update locked checkers
        if (positions.red[i] === -1) {
            document.getElementById(`point-${i}`).innerHTML += `<div class="checker red"></div>`;
        }
        if (positions.blue[i] === -1) {
            document.getElementById(`point-${i}`).innerHTML += `<div class="checker blue"></div>`;
        }
    }
}

// Initialize the board and setup event listeners
initializeBoard();
setupAiModeControl();
// Auto-roll at the beginning of the game (shows rolling effect)
setTimeout(() => rollDice(), 200);

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore shortcuts with modifiers
    const target = e.target;
    const tag = target && target.tagName;
    // don't trigger while typing in inputs or editable elements
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;
    if (currentTurn !== humanPlayer || aiPlaying) return;

    const key = (e.key || '').toLowerCase();
    if (key === 'v') {
        const validateBtn = document.querySelector("button[onclick='validateMoves()']");
        if (validateBtn) validateMoves();
    } else if (key === 'u') {
        const undoBtn = document.querySelector("button[onclick='undoMove()']");
        if (undoBtn) undoMove();
    } else if (key === 's') {
        const swapBtn = document.querySelector("button[onclick='swapDice()']");
        if (swapBtn) swapDice();
    }
});
