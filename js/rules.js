const Engine = window.PlakotoEngine;

function getEngineState() {
    return {
        positions: positions,
        bearedOff: bearedOff,
        currentTurn: currentTurn
    };
}

function getHomeBoardStart(player) {
    return Engine.getHomeBoardStart(player);
}

function findMaxNonZeroIndex(arr) {
    return Engine.findMaxNonZeroIndex(arr);
}

function findMinNonZeroIndex(arr) {
    return Engine.findMinNonZeroIndex(arr);
}

function canBearOff(player) {
    return Engine.canBearOff(getEngineState(), player);
}

function validMoveExists(player, step) {
    return Engine.validMoveExists(getEngineState(), player, step);
}

function bearOff(player, fromIndex, steps) {
    const state = getEngineState();
    const moved = Engine.bearOff(state, player, fromIndex, steps);
    if (moved) {
        const winner = Engine.checkForWinner(state);
        if (winner) {
            gameOver = true;
            alert(`Game over - ${winner.toUpperCase()} wins!`);
        }
    }
    return moved;
}

function moveChecker(player, fromIndex, steps) {
    return Engine.moveChecker(getEngineState(), player, fromIndex, steps);
}

function checkForWinner() {
    const winner = Engine.checkForWinner(getEngineState());
    if (winner) {
        gameOver = true;
        alert(`Game over - ${winner.toUpperCase()} wins!`);
    }
}

function getAllValidMoveSequences() {
    return Engine.getAllValidMoveSequences(getEngineState(), dice);
}

function getValidMoveSequencesWithOrder(diceValues, requireFull) {
    return Engine.getValidMoveSequencesWithOrder(getEngineState(), diceValues, requireFull);
}

function computeMovePolicy(diceValues) {
    return Engine.computeMovePolicy(getEngineState(), diceValues);
}
