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

function rollDice() {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    dice = [die1, die2];
    if (die1 === die2) {
        dice = [die1, die1, die1, die1];
    }
    document.getElementById('dice-result').textContent = `Dice: ${dice.join(', ')} (Total: ${dice.reduce((a, b) => a + b)})`;
    document.getElementById('dice-result').textContent += ` - ${currentTurn} to move. Click on a checker column to move.`;
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
        const steps = dice.shift();
        validBearOff = false;
        if (canBearOff(currentTurn))
            validBearOff = bearOff(currentTurn, pointIndex, steps);
        
        if (!validBearOff)
            validMove = moveChecker(currentTurn, pointIndex, steps);
        
        if (validBearOff || validMove){
            updateBoardDisplay();
            if (dice.length === 0) {
                currentTurn = currentTurn === 'red' ? 'blue' : 'red';
            }
        }
    }
}

function canBearOff(player) {
    const homeStart = getHomeBoardStart(player);
    const homeEnd = homeStart + 5;
    const checkersInHome = positions[player].slice(homeStart, homeEnd + 1).reduce((a, b) => a + b);
    let offCheckers = player === 'red' ? bearedOff.red : bearedOff.blue;
    return  (checkersInHome + offCheckers) === 15;
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

    // Check if the destination has 2 or more checkers from the opponent
    if (positions[opponent][toIndex] >= 2 || positions[player][fromIndex] == -1 || positions[player][toIndex] == -1) 
        return false;
    else if (positions[opponent][toIndex] == 1 && positions[player][toIndex] == 0)
        positions[opponent][toIndex] = -1;
    else if (positions[opponent][fromIndex] == -1 && positions[player][fromIndex] == 1)
        positions[opponent][fromIndex] = 1;

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