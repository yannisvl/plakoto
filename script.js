let currentTurn = 'red'; // Start with the red player
let dice = [];
let positions = {
    red: Array(24).fill(0),
    blue: Array(24).fill(0)
};
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

        const steps = dice.shift();
        validBearOff = false;
        let validMove = false;
        while (!validMove && validMoveExists(currentTurn, steps)){
            if (canBearOff(currentTurn))
                validBearOff = bearOff(currentTurn, pointIndex, steps);
            
            if (!validBearOff)
                validMove = moveChecker(currentTurn, pointIndex, steps);
            
            if (validBearOff || validMove) {
                updateBoardDisplay();
            }
        }
    }
}

function validMoveExists(player, step) {
    let opponent = player === 'red' ? 'blue' : 'red';

    for (let fromIndex = 0; fromIndex < 24; fromIndex++) {
        if (positions[player][fromIndex] <= 0) continue;
        let toIndex = player === 'red' ? fromIndex + step : fromIndex - step;

        if (toIndex >= 0 && toIndex < 24 && 
            positions[opponent][toIndex] < 2 && positions[player][toIndex] != -1) 
            return true;
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
    if (dice.length === 0) {
        turnHistory = []; // Clear the turn history after validation
        currentTurn = currentTurn === 'red' ? 'blue' : 'red'; // Switch turns
        document.getElementById('dice-result').textContent = `${currentTurn}'s turn to roll the dice.`;

        // Enable roll button again
        document.querySelector("button[onclick='rollDice()']").disabled = false;
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

function bearOff(player, fromIndex, steps) {
    let toIndex = player === 'red' ? fromIndex + steps : fromIndex - steps;
    const maxNonZeroIndexRed = findMaxNonZeroIndex(positions.red);
    const minNonZeroIndexBlue = findMinNonZeroIndex(positions.blue);

    if (player === 'red' && (toIndex == 24 || (fromIndex == maxNonZeroIndexRed && toIndex >= 24))) {
        positions[player][fromIndex]--;
        bearedOff.red += 1;
        return true;
    }
    else if (player === 'blue' && (toIndex == -1 || (fromIndex == minNonZeroIndexBlue && toIndex <= -1))) {
        positions[player][fromIndex]--;
        bearedOff.blue += 1;
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