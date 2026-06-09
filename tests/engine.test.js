const assert = require('assert');
const Engine = require('../js/engine.js');

function emptyState(turn = 'red') {
    return {
        positions: {
            red: Array(24).fill(0),
            blue: Array(24).fill(0),
        },
        bearedOff: {
            red: 0,
            blue: 0,
        },
        currentTurn: turn,
    };
}

function testBearingOffOvershootUsesPointNumbers() {
    const red = emptyState('red');
    red.positions.red[19] = 1;
    red.positions.red[20] = 1;
    red.positions.red[23] = 13;
    assert.strictEqual(Engine.bearOff(red, 'red', 20, 6), false);
    assert.strictEqual(Engine.bearOff(red, 'red', 19, 6), true);

    const blue = emptyState('blue');
    blue.positions.blue[3] = 1;
    blue.positions.blue[4] = 1;
    blue.positions.blue[0] = 13;
    assert.strictEqual(Engine.bearOff(blue, 'blue', 3, 6), false);
    assert.strictEqual(Engine.bearOff(blue, 'blue', 4, 6), true);
}

function testPinnedHomeCheckerCountsAsHome() {
    const state = emptyState('red');
    state.positions.red[18] = 14;
    state.positions.red[19] = -1;
    state.positions.blue[19] = 1;
    assert.strictEqual(Engine.canBearOff(state, 'red'), true);
}

function testMotherPieceRule() {
    const waived = emptyState('red');
    waived.positions.red[0] = -1;
    waived.positions.blue[0] = 1;
    waived.positions.blue[23] = 1;
    assert.strictEqual(Engine.checkForWinner(waived), null);

    const redLoses = emptyState('red');
    redLoses.positions.red[0] = -1;
    redLoses.positions.blue[0] = 1;
    assert.strictEqual(Engine.checkForWinner(redLoses), 'blue');

    const draw = emptyState('red');
    draw.positions.red[0] = -1;
    draw.positions.blue[0] = 1;
    draw.positions.blue[23] = -1;
    draw.positions.red[23] = 1;
    assert.strictEqual(Engine.checkForWinner(draw), 'draw');
}

function testApplySequenceRejectsPartialWhenFullTurnExists() {
    const state = emptyState('red');
    state.positions.red[0] = 15;
    state.positions.blue[23] = 15;
    const result = Engine.applySequence(state, [0], [1, 2]);
    assert.strictEqual(result.valid, false);
}

testBearingOffOvershootUsesPointNumbers();
testPinnedHomeCheckerCountsAsHome();
testMotherPieceRule();
testApplySequenceRejectsPartialWhenFullTurnExists();

console.log('engine tests passed');
