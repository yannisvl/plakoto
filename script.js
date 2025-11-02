let currentTurn = 'red'; // Start with the red player
let dice = [];
let positions = {
    red: Array(24).fill(0),
    blue: Array(24).fill(0)
};
let hasRolledThisTurn = false; // <- added flag
positions.red[0] = 15;
positions.blue[23] = 15;
let bearedOff = {
    red: 0,
    blue: 0
};
let moveHistory = []; // Stack for saving the state before each turn
let turnHistory = []; // Stack for storing moves made in the current turn

function rollDice() {
    const rollButton = document.querySelector("button[onclick='rollDice()']");
    rollButton.disabled = true; // Disable the roll button

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;

    dice = [die1, die2];
    if (die1 === die2) {
        dice = [die1, die1, die1, die1];
    }
    document.getElementById('dice-result').textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a, b) => a + b)})`;
    document.getElementById('dice-result').textContent += ` - ${currentTurn} to move. Click on a checker column to move.`;

    turnHistory = []; // Clear turn history for new dice roll
    saveGameState(); // Save the state at the start of the turn

    hasRolledThisTurn = true; // <- mark that the player rolled this turn
}

function initializeBoard() {
    for (let i = 0; i < 24; i++) {
        const point = document.getElementById(`point-${i}`);
        point.addEventListener('click', () => handlePointClick(i));
    }
    updateBoardDisplay();
}

function handlePointClick(pointIndex) {
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
    // Prevent validating before the player has rolled
    if (!hasRolledThisTurn) {
        alert('Please roll the dice before validating your turn.');
        return;
    }

    // Confirm the player's moves for this turn and switch to the next player
    if (dice.length === 0 || !dice.some(d => validMoveExists(currentTurn, d))) {
        turnHistory = []; // Clear the turn history after validation
        currentTurn = currentTurn === 'red' ? 'blue' : 'red'; // Switch turns
        document.getElementById('dice-result').textContent = `${currentTurn}'s turn to roll the dice.`;

        // Enable roll button again
        document.querySelector("button[onclick='rollDice()']").disabled = false;

        hasRolledThisTurn = false; // <- reset for next player
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
    const maxNonZeroIndexRed = findMaxNonZeroIndex(positions.red);
    const minNonZeroIndexBlue = findMinNonZeroIndex(positions.blue);

    if (player === 'red' && (toIndex == 24 || (fromIndex == maxNonZeroIndexRed && toIndex >= 24))) {
        positions[player][fromIndex]--;
        bearedOff.red += 1;

        // If the player emptied the point and opponent had a plakwma (-1), free it to 1
        const opponent = 'blue';
        if (positions[opponent][fromIndex] === -1 && positions[player][fromIndex] === 0) {
            positions[opponent][fromIndex] = 1;
        }

        return true;
    }
    else if (player === 'blue' && (toIndex == -1 || (fromIndex == minNonZeroIndexBlue && toIndex <= -1))) {
        positions[player][fromIndex]--;
        bearedOff.blue += 1;

        // If the player emptied the point and opponent had a plakwma (-1), free it to 1
        const opponent = 'red';
        if (positions[opponent][fromIndex] === -1 && positions[player][fromIndex] === 0) {
            positions[opponent][fromIndex] = 1;
        }

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

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore shortcuts with modifiers
    const target = e.target;
    const tag = target && target.tagName;
    // don't trigger while typing in inputs or editable elements
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;

    const key = (e.key || '').toLowerCase();
    if (key === 'r') {
        const rollBtn = document.querySelector("button[onclick='rollDice()']");
        if (rollBtn && !rollBtn.disabled) rollDice();
    } else if (key === 'v') {
        const validateBtn = document.querySelector("button[onclick='validateMoves()']");
        if (validateBtn && !validateBtn.disabled) validateMoves();
    } else if (key === 'u') {
        undoMove();
    } else if (key === 's') {
        const swapBtn = document.querySelector("button[onclick='swapDice()']");
        if (swapBtn && !swapBtn.disabled) swapDice();
    }
});