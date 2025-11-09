let currentTurn = 'red'; // Start with the red player
let dice = [];
let positions = {
    red: Array(24).fill(0),
    blue: Array(24).fill(0)
};
let gameOver = false; // stops further input when true
positions.red[0] = 15;
positions.blue[23] = 15;
let bearedOff = {
    red: 0,
    blue: 0
};
let turnHistory = []; // Stack for storing moves made in the current turn

// FLAGS
let mustPlayAllDice = false;        // true when a full sequence (both dice or all 4) is possible
let tiePlayLargestOnly = false;     // true ONLY when both dice are playable individually but cannot be combined -> must use higher
let onlyOneDiePlayable = false;     // exactly one die has any legal move -> must use that specific die
let forcedPlayableDie = null;       // the die that must be played when onlyOneDiePlayable is true

function rollDice(instant = false) {
    if (gameOver) return; // no rolls after game end

    const diceResultEl = document.getElementById('dice-result');

    if (!instant) {
        const duration = 600;
        const interval = 60;
        const timer = setInterval(() => {
            const a = Math.floor(Math.random() * 6) + 1;
            const b = Math.floor(Math.random() * 6) + 1;
            diceResultEl.textContent = `Rolling... ${a}, ${b}`;
        }, interval);

        setTimeout(() => {
            clearInterval(timer);
            rollDice(true);
        }, duration);

        return;
    }

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;

    dice = [die1, die2];
    if (die1 === die2) {
        dice = [die1, die1, die1, die1];
    }

    diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a, b) => a + b)}) - ${currentTurn} to move. Click on a checker column to move.`;

    turnHistory = [];

    // determine play policy ---
    mustPlayAllDice = false;
    tiePlayLargestOnly = false;
    onlyOneDiePlayable = false;
    forcedPlayableDie = null;

    const fullSequences = getAllValidMoveSequences(); // sequences that use ALL dice (original or swapped order for non-doubles)

    if (fullSequences.length > 0) {
        // At least one way to use every die -> must play them all
        mustPlayAllDice = true;
        diceResultEl.textContent += ` You must play all ${dice.length} dice before validating.`;
    } else {
        // No full sequence exists
        if (dice.length === 2 && dice[0] !== dice[1]) {
            const dA = dice[0], dB = dice[1];
            const playableA = validMoveExists(currentTurn, dA);
            const playableB = validMoveExists(currentTurn, dB);

            if (!playableA && !playableB) {
                // No moves at all -> may validate immediately (KEEP DICE SHOWN)
                diceResultEl.textContent += ` No valid moves. You may validate.`;
            } else if (playableA && playableB) {
                // Both dice individually playable but cannot be combined -> must play higher
                tiePlayLargestOnly = true;
                const largest = Math.max(dA, dB);
                if (dice[0] !== largest) dice.reverse(); // put largest first
                diceResultEl.textContent += ` Only one die may be played; must play the higher (${largest}) then you may validate.`;
            } else {
                // Exactly one die playable -> force that die
                onlyOneDiePlayable = true;
                forcedPlayableDie = playableA ? dA : dB;
                if (dice[0] !== forcedPlayableDie) dice.reverse();
                diceResultEl.textContent += ` Only one die can be played (${forcedPlayableDie}); after playing it you may validate.`;
            }
        } else if (dice.length === 4) {
            diceResultEl.textContent += ` No sequence uses all 4 dice; play as many as possible then validate.`;
        } else {
            // Single die fallback (KEEP DICE SHOWN)
            if (!validMoveExists(currentTurn, dice[0])) {
                diceResultEl.textContent += ` No valid move. You may validate or undo.`;
            }
        }
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
    if (gameOver) return;

    if (positions[currentTurn][pointIndex] > 0 && dice.length > 0) {
        // Enforce tie rule: both dice playable but only the higher must be used
        if (tiePlayLargestOnly && dice.length === 2) {
            const largest = Math.max(dice[0], dice[1]);
            const clickedDieNeeded = dice[0]; // the die that would be used (first in array)
            if (clickedDieNeeded !== largest) {
                alert(`You must play the larger die (${largest}) first. Use Swap Dice or undo.`);
                return;
            }
        }

        // Enforce "only one die is playable" rule
        if (onlyOneDiePlayable && dice.length === 2) {
            const clickedDieNeeded = dice[0];
            if (clickedDieNeeded !== forcedPlayableDie) {
                alert(`Only one die can be played (${forcedPlayableDie}). Use Swap Dice or undo.`);
                return;
            }
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

            const diceResultEl = document.getElementById('dice-result');
            if (diceResultEl) {
                // If we were in tiePlayLargestOnly mode, allow validation now after first move
                if (tiePlayLargestOnly) {
                    if (dice.length === 0 || !dice.some(d => validMoveExists(currentTurn, d))) {
                        diceResultEl.textContent = `Tie resolved. You may validate or undo.`;
                    } else {
                        diceResultEl.textContent += ` (You may validate now.)`;
                    }
                }
                // If exactly one die was playable, allow validation now after using it
                if (onlyOneDiePlayable) {
                    if (dice.length === 0 || !dice.some(d => validMoveExists(currentTurn, d))) {
                        diceResultEl.textContent = `Only playable die used. You may validate or undo.`;
                    } else {
                        diceResultEl.textContent += ` (You may validate now.)`;
                    }
                }
            }
        }
    }
}

function validMoveExists(player, step) {
    let opponent = player === 'red' ? 'blue' : 'red';
    const canBear = canBearOff(player);
    const maxNonZeroIndexRed = findMaxNonZeroIndex(positions.red);
    const minNonZeroIndexBlue = findMinNonZeroIndex(positions.blue);

    for (let fromIndex = 0; fromIndex < 24; fromIndex++) {
        if (positions[player][fromIndex] <= 0) continue;
        let toIndex = player === 'red' ? fromIndex + step : fromIndex - step;

        // regular on-board move
        if (toIndex >= 0 && toIndex < 24 &&
            positions[opponent][toIndex] < 2 && positions[player][toIndex] != -1) {
            return true;
        }

        // bearing off possibilities (allow exact or overshoot from the furthest checker)
        if (canBear) {
            if (player === 'red') {
                if (toIndex >= 24 || (fromIndex === maxNonZeroIndexRed && toIndex >= 24)) {
                    return true;
                }
            } else { // blue
                if (toIndex <= -1 || (fromIndex === minNonZeroIndexBlue && toIndex <= -1)) {
                    return true;
                }
            }
        }
    }

    return false;
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
        tiePlayLargestOnly: tiePlayLargestOnly,
        onlyOneDiePlayable: onlyOneDiePlayable,
        forcedPlayableDie: forcedPlayableDie
    };
    turnHistory.push(turnState);
}

function undoMove() {
    if (turnHistory.length > 0) {
        const lastTurnState = turnHistory.pop(); // Retrieve the last move in the current turn

        // Restore the game state from the last move
        positions.red = [...lastTurnState.positions.red];
        positions.blue = [...lastTurnState.positions.blue];
        bearedOff.red = lastTurnState.bearedOff.red;
        bearedOff.blue = lastTurnState.bearedOff.blue;
        dice = [...lastTurnState.dice];
        mustPlayAllDice = lastTurnState.mustPlayAllDice;
        tiePlayLargestOnly = lastTurnState.tiePlayLargestOnly;
        onlyOneDiePlayable = !!lastTurnState.onlyOneDiePlayable;
        forcedPlayableDie = lastTurnState.forcedPlayableDie ?? null;

        updateBoardDisplay(); // Update the board display
        updateDiceMessage(); // Update the dice message
    } else {
        alert('No moves to undo!');
    }
}

function validateMoves() {
    // Confirm the player's moves for this turn and switch to the next player
    if (
        dice.length === 0 ||
        !dice.some(d => validMoveExists(currentTurn, d)) ||
        (tiePlayLargestOnly && dice.length <= 1) ||
        (onlyOneDiePlayable && dice.length <= 1)
    ) {
        turnHistory = [];
        currentTurn = currentTurn === 'red' ? 'blue' : 'red';
        document.getElementById('dice-result').textContent = `${currentTurn}'s turn to roll the dice.`;
        setTimeout(() => rollDice(), 50);
    } else {
        alert('You still have moves left!');
    }
}

function canBearOff(player) {
    const homeStart = getHomeBoardStart(player);
    const homeEnd = homeStart + 5;
    const checkersInHome = positions[player].slice(homeStart, homeEnd + 1).reduce((a, b) => a + b);
    let offCheckers = player === 'red' ? bearedOff.red : bearedOff.blue;
    return (checkersInHome + offCheckers) === 15;
}

function getHomeBoardStart(player) {
    return player === 'red' ? 18 : 0;
}

function findMaxNonZeroIndex(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] > 0) {
            return i;
        }
    }
    return -1; // Indicates no non-zero elements found
}

function findMinNonZeroIndex(arr) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > 0) {
            return i;
        }
    }
    return -1; // Indicates no non-zero elements found
}

function swapDice() {
    if (dice.length <= 1) return; // Can't swap after a move

    // If only one die is playable, keep the playable die first
    if (onlyOneDiePlayable) {
        alert(`Swap disabled: only die ${forcedPlayableDie} can be played.`);
        return;
    }

    dice.reverse();
    updateDiceMessage();
}

function updateDiceMessage() {
    const diceResultEl = document.getElementById('dice-result');
    if (!diceResultEl || dice.length === 0) return;

    diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a, b) => a + b)}) - ${currentTurn} to move. Click on a checker column to move.`;

    if (mustPlayAllDice) {
        diceResultEl.textContent += ` You must play all ${dice.length} dice before validating.`;
    } else if (tiePlayLargestOnly) {
        if (dice.length === 2 && dice[0] !== dice[1]) {
            const dA = dice[0], dB = dice[1];
            const playableA = validMoveExists(currentTurn, dA);
            const playableB = validMoveExists(currentTurn, dB);

            if (!playableA && !playableB) {
                diceResultEl.textContent += ` No valid moves. You may validate or undo.`;
            } else if (playableA && playableB) {
                const largest = Math.max(dA, dB);
                diceResultEl.textContent += ` Only one die may be played; must play the higher (${largest}) then you may validate.`;
            } else {
                // This branch should not happen under tiePlayLargestOnly anymore
                const playableDie = playableA ? dA : dB;
                diceResultEl.textContent += ` Only one die can be played (${playableDie}); after playing it you may validate.`;
            }
        } else if (dice.length === 1) {
            diceResultEl.textContent += ` (You may validate now.)`;
        }
    } else if (onlyOneDiePlayable) {
        if (dice.length >= 1) {
            diceResultEl.textContent += ` Only one die can be played (${forcedPlayableDie}); after playing it you may validate.`;
            if (dice.length === 1) {
                diceResultEl.textContent += ` (You may validate now.)`;
            }
        }
    } else if (dice.length === 4) {
        diceResultEl.textContent += ` No sequence uses all 4 dice; play as many as possible then validate.`;
    } else if (!dice.some(d => validMoveExists(currentTurn, d))) {
        diceResultEl.textContent += ` No valid moves. You may validate or undo.`;
    }
}

function bearOff(player, fromIndex, steps) {
    let toIndex = player === 'red' ? fromIndex + steps : fromIndex - steps;
    const minNonZeroIndexRed = findMinNonZeroIndex(positions.red);
    const maxNonZeroIndexBlue = findMaxNonZeroIndex(positions.blue);

    if (player === 'red' && (toIndex == 24 || (fromIndex == minNonZeroIndexRed && toIndex >= 24))) {
        positions[player][fromIndex]--;
        bearedOff.red += 1;

        // If the player emptied the point and opponent had a plakwma (-1), free it to 1
        const opponent = 'blue';
        if (positions[opponent][fromIndex] === -1 && positions[player][fromIndex] === 0) {
            positions[opponent][fromIndex] = 1;
        }

        checkForWinner(); // <-- check after bearing off
        return true;
    }
    else if (player === 'blue' && (toIndex == -1 || (fromIndex == maxNonZeroIndexBlue && toIndex <= -1))) {
        positions[player][fromIndex]--;
        bearedOff.blue += 1;

        // If the player emptied the point and opponent had a plakwma (-1), free it to 1
        const opponent = 'red';
        if (positions[opponent][fromIndex] === -1 && positions[player][fromIndex] === 0) {
            positions[opponent][fromIndex] = 1;
        }

        checkForWinner(); // <-- check after bearing off
        return true;
    }
    else
        return false;
}

function moveChecker(player, fromIndex, steps) {
    let opponent = player === 'red' ? 'blue' : 'red';
    let toIndex = player === 'red' ? fromIndex + steps : fromIndex - steps;

    if (toIndex > 23 || toIndex < 0) return false; // Move out of bounds

    if (positions[opponent][toIndex] >= 2) 
        return false; //porta
    else if (positions[player][toIndex] == -1)
        return false; // plakwmeno
    else if (positions[opponent][toIndex] == 1 && positions[player][toIndex] == 0)
        positions[opponent][toIndex] = -1; // plakwse

    // Move the player's checker
    positions[player][fromIndex]--;
    positions[player][toIndex]++;

    // If the move emptied the origin point and opponent had a plakwma (-1) there, free the opponent checker to 1
    if (positions[opponent][fromIndex] === -1 && positions[player][fromIndex] === 0) {
        positions[opponent][fromIndex] = 1;
    }

    return true;
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
// Auto-roll at the beginning of the game (shows rolling effect)
setTimeout(() => rollDice(), 200);

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore shortcuts with modifiers
    const target = e.target;
    const tag = target && target.tagName;
    // don't trigger while typing in inputs or editable elements
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;

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

// New helper: announce winner and disable further input
function checkForWinner() {
    if (bearedOff.red === 15 || bearedOff.blue === 15) {
        gameOver = true;
        const winner = bearedOff.red === 15 ? 'red' : 'blue';
        alert(`Game over — ${winner.toUpperCase()} wins!`);
    }
}

// --- Save / Load helpers and UI buttons ---
function saveGameToFile() {
    const state = {
        positions: {
            red: [...positions.red],
            blue: [...positions.blue]
        },
        bearedOff: { ...bearedOff },
        dice: [...dice],
        currentTurn: currentTurn,
        gameOver: !!gameOver
    };

    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plakoto-save.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerLoadFromFile() {
    let input = document.getElementById('plakoto-load-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'plakoto-load-input';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        input.addEventListener('change', handleLoadFileInput);
        document.body.appendChild(input);
    }
    input.value = ''; // reset so same file can be selected again
    input.click();
}

function handleLoadFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const obj = JSON.parse(ev.target.result);

            // Basic validation
            if (!obj.positions || !Array.isArray(obj.positions.red) || !Array.isArray(obj.positions.blue)) {
                alert('Invalid save file (positions).');
                return;
            }
            if (!('dice' in obj) || !('currentTurn' in obj)) {
                alert('Invalid save file (missing dice or turn).');
                return;
            }

            // Apply loaded state
            positions.red = obj.positions.red.slice(0, 24).concat(Array(Math.max(0, 24 - obj.positions.red.length)).fill(0)).slice(0,24);
            positions.blue = obj.positions.blue.slice(0, 24).concat(Array(Math.max(0, 24 - obj.positions.blue.length)).fill(0)).slice(0,24);
            bearedOff.red = obj.bearedOff && typeof obj.bearedOff.red === 'number' ? obj.bearedOff.red : 0;
            bearedOff.blue = obj.bearedOff && typeof obj.bearedOff.blue === 'number' ? obj.bearedOff.blue : 0;
            dice = Array.isArray(obj.dice) ? obj.dice.slice() : [];
            currentTurn = obj.currentTurn === 'blue' ? 'blue' : 'red';
            gameOver = !!obj.gameOver;

            // Clear history (loaded state becomes base)
            turnHistory = [];

            updateBoardDisplay();

            // Update dice-result text and button states
            const diceResultEl = document.getElementById('dice-result');
            if (gameOver) {
                checkForWinner(); // will set UI appropriately
            } else if (dice && dice.length > 0) {
                diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a,b)=>a+b)}) - ${currentTurn} to move. Click on a checker column to move.`;
            } else {
                diceResultEl.textContent = `${currentTurn}'s turn to roll the dice.`;
            }


        } catch (err) {
            alert('Failed to load save file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

/**
 * Returns an array of all full-length valid move sequences for the current dice.
 * Each sequence is an array of point indices (0-23), length == dice.length (2 or 4).
 * The k-th element is the point the player would click to perform the k-th die move
 * in the current dice order (does NOT try swapped order).
 * If a full sequence cannot be completed (e.g. second die becomes unusable),
 * that partial path is discarded (so sequences are only those that use every die).
 * Global state (positions, bearedOff) is NOT mutated.
 */
function getAllValidMoveSequences() {
    if (!dice || dice.length === 0) return [];
    const player = currentTurn;

    // Helpers (local copies to avoid mutating global state)
    function canBearOffLocal(p, pos, off) {
        const homeStart = p === 'red' ? 18 : 0;
        const homeEnd = homeStart + 5;
        const inHome = pos[p].slice(homeStart, homeEnd + 1).reduce((a, b) => a + b, 0);
        return (inHome + off[p]) === 15;
    }
    function findMaxNonZeroIndexLocal(arr) {
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i] > 0) return i;
        return -1;
    }
    function findMinNonZeroIndexLocal(arr) {
        for (let i = 0; i < arr.length; i++) if (arr[i] > 0) return i;
        return -1;
    }
    function tryApplyLocal(pos, off, p, fromIndex, die) {
        if (fromIndex < 0 || fromIndex > 23) return false;
        if (pos[p][fromIndex] <= 0) return false;
        const opp = p === 'red' ? 'blue' : 'red';
        const dir = p === 'red' ? +1 : -1;
        const toIndex = fromIndex + dir * die;

        // Bearing off
        if (toIndex < 0 || toIndex > 23) {
            if (!canBearOffLocal(p, pos, off)) return false;
            if (p === 'red') {
                const minIdx = findMinNonZeroIndexLocal(pos.red);
                if (toIndex === 24 || (fromIndex === minIdx && toIndex > 23)) {
                    pos[p][fromIndex]--;
                    off.red += 1;
                    if (pos[opp][fromIndex] === -1 && pos[p][fromIndex] === 0) pos[opp][fromIndex] = 1;
                    return true;
                }
                return false;
            } else {
                const maxIdx = findMaxNonZeroIndexLocal(pos.blue);
                if (toIndex === -1 || (fromIndex === maxIdx && toIndex < 0)) {
                    pos[p][fromIndex]--;
                    off.blue += 1;
                    if (pos[opp][fromIndex] === -1 && pos[p][fromIndex] === 0) pos[opp][fromIndex] = 1;
                    return true;
                }
                return false;
            }
        }

        // Normal move
        if (pos[opp][toIndex] >= 2) return false;
        if (pos[p][toIndex] === -1) return false;
        if (pos[opp][toIndex] === 1 && pos[p][toIndex] === 0) pos[opp][toIndex] = -1; // trap opponent
        pos[p][fromIndex]--;
        pos[p][toIndex]++;
        if (pos[opp][fromIndex] === -1 && pos[p][fromIndex] === 0) pos[opp][fromIndex] = 1;
        return true;
    }

    function generateSequencesForOrder(diceOrder) {
        const basePos = { red: positions.red.slice(), blue: positions.blue.slice() };
        const baseOff = { red: bearedOff.red, blue: bearedOff.blue };
        const out = [];

        function dfs(depth, pos, off, seq) {
            if (depth === diceOrder.length) {
                out.push(seq.slice());
                return;
            }
            const die = diceOrder[depth];
            let found = false;
            for (let from = 0; from < 24; from++) {
                if (pos[player][from] <= 0) continue;
                const posClone = { red: pos.red.slice(), blue: pos.blue.slice() };
                const offClone = { red: off.red, blue: off.blue };
                if (tryApplyLocal(posClone, offClone, player, from, die)) {
                    found = true;
                    seq.push(from);
                    dfs(depth + 1, posClone, offClone, seq);
                    seq.pop();
                }
            }
            if (!found) return; // dead end
        }
        dfs(0, basePos, baseOff, []);
        return out;
    }

    // Original order
    const originalSequences = generateSequencesForOrder(dice);

    // Swapped order (only if non-doubles of length 2)
    let swappedSequences = [];
    if (dice.length === 2 && dice[0] !== dice[1]) {
        const swapped = [dice[1], dice[0]];
        swappedSequences = generateSequencesForOrder(swapped);
    }

    // Combine (could contain duplicates)
    return originalSequences.concat(swappedSequences);
}

function setCustomDice() {
    if (gameOver) return;

    const diceResultEl = document.getElementById('dice-result');
    const input = window.prompt("Enter custom dice (e.g. '6 5', '4,4', '3'):");
    if (input == null) return;

    const parts = input.trim().split(/[\s,;]+/).filter(Boolean);
    if (parts.length === 0 || parts.length > 2) {
        alert('Enter one value (for doubles) or two values (1-6).');
        return;
    }

    const nums = parts.map(p => parseInt(p, 10)).filter(n => Number.isInteger(n));
    if (nums.length !== parts.length || nums.some(n => n < 1 || n > 6)) {
        alert('Values must be integers 1..6.');
        return;
    }

    if (nums.length === 1) {
        const d = nums[0];
        dice = [d, d, d, d];
    } else {
        const [a, b] = nums;
        dice = (a === b) ? [a, a, a, a] : [a, b];
    }

    // Reset per-roll state
    turnHistory = [];
    mustPlayAllDice = false;
    tiePlayLargestOnly = false;
    onlyOneDiePlayable = false;
    forcedPlayableDie = null;

    diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((s,x)=>s+x,0)}) - ${currentTurn} to move. Click on a checker column to move.`;

    // Apply same policy logic as rollDice
    const fullSequences = getAllValidMoveSequences();
    if (fullSequences.length > 0) {
        mustPlayAllDice = true;
        diceResultEl.textContent += ` You must play all ${dice.length} dice before validating.`;
        return;
    }

    if (dice.length === 2 && dice[0] !== dice[1]) {
        const dA = dice[0], dB = dice[1];
        const playableA = validMoveExists(currentTurn, dA);
        const playableB = validMoveExists(currentTurn, dB);

        if (!playableA && !playableB) {
            diceResultEl.textContent += ` No valid moves. You may validate or undo.`;
        } else if (playableA && playableB) {
            tiePlayLargestOnly = true;
            const largest = Math.max(dA, dB);
            if (dice[0] !== largest) dice.reverse();
            diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((s,x)=>s+x,0)}) - ${currentTurn} to move. Click on a checker column to move. Only one die may be played; must play the higher (${largest}) then you may validate.`;
        } else {
            onlyOneDiePlayable = true;
            forcedPlayableDie = playableA ? dA : dB;
            if (dice[0] !== forcedPlayableDie) dice.reverse();
            diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((s,x)=>s+x,0)}) - ${currentTurn} to move. Click on a checker column to move. Only one die can be played (${forcedPlayableDie}); after playing it you may validate.`;
        }
    } else if (dice.length === 4) {
        diceResultEl.textContent += ` No sequence uses all 4 dice; play as many as possible then validate.`;
    } else if (dice.length === 1) {
        if (!validMoveExists(currentTurn, dice[0])) {
            diceResultEl.textContent += ` No valid move. You may validate or undo.`;
        }
    }
}