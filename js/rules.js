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

function finishGame(winner) {
    if (!winner || gameOver) return;

    gameOver = true;
    if (typeof reportGameResult === 'function') {
        reportGameResult(winner);
    }

    if (winner === 'draw') {
        alert('Game over - draw.');
    } else {
        alert(`Game over - ${winner.toUpperCase()} wins!`);
    }
}

function validMoveExists(player, step) {
    return Engine.validMoveExists(getEngineState(), player, step);
}

function bearOff(player, fromIndex, steps) {
    const state = getEngineState();
    const moved = Engine.bearOff(state, player, fromIndex, steps);
    if (moved) {
        finishGame(Engine.checkForWinner(state));
    }
    return moved;
}

function moveChecker(player, fromIndex, steps) {
    const state = getEngineState();
    const moved = Engine.moveChecker(state, player, fromIndex, steps);
    if (moved) {
        finishGame(Engine.checkForWinner(state));
    }
    return moved;
}

function checkForWinner() {
    finishGame(Engine.checkForWinner(getEngineState()));
}

function getAllValidMoveSequences() {
    return Engine.getAllValidMoveSequences(getEngineState(), dice);
}

function getValidMoveSequencesWithOrder(diceValues, requireFull) {
    return Engine.getValidMoveSequencesWithOrder(getEngineState(), diceValues, requireFull);
}

function getLegalMoveSequencesForCurrentTurn() {
    return Engine.getLegalSequences(getEngineState(), dice).sequences;
}

function computeMovePolicy(diceValues) {
    return Engine.computeMovePolicy(getEngineState(), diceValues);
}
