let currentTurn = 'red'; // Start with the red player
let dice = [];
let positions = {
    red: Array(24).fill(0),
    blue: Array(24).fill(0)
};
let gameOver = false; // <-- new: stops further input when true
positions.red[0] = 15;
positions.blue[23] = 15;
let bearedOff = {
    red: 0,
    blue: 0
};
let moveHistory = []; // Stack for saving the state before each turn
let turnHistory = []; // Stack for storing moves made in the current turn

function rollDice(instant = false) {
    if (gameOver) return; // no rolls after game end

    const diceResultEl = document.getElementById('dice-result');

    // Show a short "rolling" effect before producing the final dice result
    if (!instant) {
        const duration = 600; // ms
        const interval = 60;  // ms between temporary random displays
        const timer = setInterval(() => {
            const a = Math.floor(Math.random() * 6) + 1;
            const b = Math.floor(Math.random() * 6) + 1;
            diceResultEl.textContent = `Rolling... ${a}, ${b}`;
        }, interval);

        setTimeout(() => {
            clearInterval(timer);
            rollDice(true); // produce the actual roll
        }, duration);

        return;
    }

    // Actual roll
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;

    dice = [die1, die2];
    if (die1 === die2) {
        dice = [die1, die1, die1, die1];
    }

    diceResultEl.textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a, b) => a + b)}) - ${currentTurn} to move. Click on a checker column to move.`;

    turnHistory = []; // Clear turn history for new dice roll
    saveGameState(); // Save the state at the start of the turn
}

function initializeBoard() {
    for (let i = 0; i < 24; i++) {
        const point = document.getElementById(`point-${i}`);
        point.addEventListener('click', () => handlePointClick(i));
    }
    updateBoardDisplay();
}

function handlePointClick(pointIndex) {
    if (gameOver) return; // ignore clicks after game end

    if (positions[currentTurn][pointIndex] > 0 && dice.length > 0) {
        saveTurnState(); // Save the state before making each move within a turn

        const steps = dice[0]; // peek the die, don't shift yet
        let validBearOff = false;
        let validMove = false;

        // Try to perform move from the clicked point
        if (canBearOff(currentTurn)) {
            validBearOff = bearOff(currentTurn, pointIndex, steps);
        }
        if (!validBearOff) {
            validMove = moveChecker(currentTurn, pointIndex, steps);
        }

        if (validBearOff || validMove) {
            updateBoardDisplay();
            dice.shift(); // Remove the used die
        } 
        else {
            // Check if any move exists with any available die; if none, enable validate
            const anyValid = dice.some(d => validMoveExists(currentTurn, d));
            if (!anyValid) {
                document.getElementById('dice-result').textContent = `No valid move left. You may validate or undo.`;
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

function saveGameState() {
    // Save the game state at the start of the player's turn (before any moves)
    const state = {
        positions: {
            red: [...positions.red],
            blue: [...positions.blue]
        },
        bearedOff: { ...bearedOff },
        dice: [...dice],
        currentTurn: currentTurn
    };
    moveHistory.push(state);
}

function saveTurnState() {
    // Save the state of the board after each move within the player's turn
    const turnState = {
        positions: {
            red: [...positions.red],
            blue: [...positions.blue]
        },
        bearedOff: { ...bearedOff },
        dice: [...dice]
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

        updateBoardDisplay(); // Update the board display
    } else {
        alert('No moves to undo!');
    }
}

function validateMoves() {
    // Confirm the player's moves for this turn and switch to the next player
    if (dice.length === 0 || !dice.some(d => validMoveExists(currentTurn, d))) {
        turnHistory = []; // Clear the turn history after validation
        currentTurn = currentTurn === 'red' ? 'blue' : 'red'; // Switch turns
        document.getElementById('dice-result').textContent = `${currentTurn}'s turn to roll the dice.`;

        // auto-roll for next player (shows rolling effect briefly)
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

    dice.reverse();
    document.getElementById('dice-result').textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a, b) => a + b)})`;
    document.getElementById('dice-result').textContent += ` - ${currentTurn} to move. Click on a checker column to move.`;
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
        document.getElementById('dice-result').textContent = `Game over — ${winner.toUpperCase()} wins!`;
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

            // Clear histories (loaded state becomes base)
            moveHistory = [];
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