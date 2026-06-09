(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PlakotoEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TOTAL_CHECKERS = 15;
    const POINT_COUNT = 24;
    const START_POINT = { red: 0, blue: 23 };

    function opponentOf(player) {
        return player === 'red' ? 'blue' : 'red';
    }

    function directionOf(player) {
        return player === 'red' ? 1 : -1;
    }

    function getHomeBoardStart(player) {
        return player === 'red' ? 18 : 0;
    }

    function checkerCount(value) {
        return value > 0 ? value : (value === -1 ? 1 : 0);
    }

    function countOwnedCheckers(arr, start, end) {
        let count = 0;
        for (let i = start; i <= end; i++) {
            count += checkerCount(arr[i]);
        }
        return count;
    }

    function findMaxNonZeroIndex(arr) {
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] !== 0) {
                return i;
            }
        }
        return -1;
    }

    function findMinNonZeroIndex(arr) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] !== 0) {
                return i;
            }
        }
        return -1;
    }

    function canBearOff(state, player) {
        const homeStart = getHomeBoardStart(player);
        const homeEnd = homeStart + 5;
        const inHome = countOwnedCheckers(state.positions[player], homeStart, homeEnd);
        const offCheckers = state.bearedOff[player] || 0;
        return (inHome + offCheckers) === TOTAL_CHECKERS;
    }

    function isBearingOffLegal(state, player, fromIndex, steps) {
        if (!canBearOff(state, player)) return false;
        if (fromIndex < 0 || fromIndex >= POINT_COUNT) return false;
        if (state.positions[player][fromIndex] <= 0) return false;

        const toIndex = fromIndex + directionOf(player) * steps;
        if (player === 'red') {
            if (toIndex === POINT_COUNT) return true;
            return toIndex > POINT_COUNT && fromIndex === findMinNonZeroIndex(state.positions.red);
        }

        if (toIndex === -1) return true;
        return toIndex < -1 && fromIndex === findMaxNonZeroIndex(state.positions.blue);
    }

    function canMoveToPoint(state, player, toIndex) {
        if (toIndex < 0 || toIndex >= POINT_COUNT) return false;
        const opponent = opponentOf(player);

        if (state.positions[opponent][toIndex] >= 2) return false;
        if (state.positions[player][toIndex] === -1) return false;

        return true;
    }

    function releasePinnedCheckerAt(state, player, fromIndex) {
        const opponent = opponentOf(player);
        if (state.positions[opponent][fromIndex] === -1 && state.positions[player][fromIndex] === 0) {
            state.positions[opponent][fromIndex] = 1;
        }
    }

    function validMoveExists(state, player, step) {
        for (let fromIndex = 0; fromIndex < POINT_COUNT; fromIndex++) {
            if (state.positions[player][fromIndex] <= 0) continue;

            const toIndex = fromIndex + directionOf(player) * step;
            if (canMoveToPoint(state, player, toIndex)) return true;
            if (isBearingOffLegal(state, player, fromIndex, step)) return true;
        }

        return false;
    }

    function motherPinned(state, player) {
        return state.positions[player][START_POINT[player]] === -1;
    }

    function motherStillAtStart(state, player) {
        return checkerCount(state.positions[player][START_POINT[player]]) > 0;
    }

    function checkMotherRule(state) {
        const redPinned = motherPinned(state, 'red');
        const bluePinned = motherPinned(state, 'blue');

        if (redPinned && bluePinned) return 'draw';
        if (redPinned && !motherStillAtStart(state, 'blue')) return 'blue';
        if (bluePinned && !motherStillAtStart(state, 'red')) return 'red';

        return null;
    }

    function checkForWinner(state) {
        const motherResult = checkMotherRule(state);
        if (motherResult) return motherResult;

        if (state.bearedOff.red === TOTAL_CHECKERS) return 'red';
        if (state.bearedOff.blue === TOTAL_CHECKERS) return 'blue';
        return null;
    }

    function bearOff(state, player, fromIndex, steps) {
        if (!isBearingOffLegal(state, player, fromIndex, steps)) return false;

        state.positions[player][fromIndex]--;
        state.bearedOff[player] += 1;
        releasePinnedCheckerAt(state, player, fromIndex);
        return true;
    }

    function moveChecker(state, player, fromIndex, steps) {
        if (fromIndex < 0 || fromIndex >= POINT_COUNT) return false;
        if (state.positions[player][fromIndex] <= 0) return false;

        const opponent = opponentOf(player);
        const toIndex = fromIndex + directionOf(player) * steps;
        if (!canMoveToPoint(state, player, toIndex)) return false;

        if (state.positions[opponent][toIndex] === 1 && state.positions[player][toIndex] === 0) {
            state.positions[opponent][toIndex] = -1;
        }

        state.positions[player][fromIndex]--;
        state.positions[player][toIndex]++;
        releasePinnedCheckerAt(state, player, fromIndex);

        return true;
    }

    function cloneState(state) {
        return {
            positions: {
                red: state.positions.red.slice(),
                blue: state.positions.blue.slice()
            },
            bearedOff: {
                red: state.bearedOff.red,
                blue: state.bearedOff.blue
            },
            currentTurn: state.currentTurn || 'red'
        };
    }

    function uniqueDiceOrders(dice) {
        if (!dice || dice.length === 0) return [];
        if (dice.length === 2 && dice[0] !== dice[1]) {
            return [dice.slice(), [dice[1], dice[0]]];
        }
        return [dice.slice()];
    }

    function applySingleMove(state, player, fromIndex, steps) {
        if (isBearingOffLegal(state, player, fromIndex, steps)) {
            return bearOff(state, player, fromIndex, steps);
        }
        return moveChecker(state, player, fromIndex, steps);
    }

    function generateSequencesForOrder(state, diceOrder, requireFull) {
        const player = state.currentTurn || 'red';
        const out = [];

        function dfs(depth, currentState, seq) {
            if (depth === diceOrder.length) {
                out.push(seq.slice());
                return;
            }

            const die = diceOrder[depth];
            let found = false;

            for (let from = 0; from < POINT_COUNT; from++) {
                if (currentState.positions[player][from] <= 0) continue;

                const nextState = cloneState(currentState);
                if (applySingleMove(nextState, player, from, die)) {
                    found = true;
                    seq.push(from);
                    dfs(depth + 1, nextState, seq);
                    seq.pop();
                }
            }

            if (!found && !requireFull && seq.length > 0) {
                out.push(seq.slice());
            }
        }

        dfs(0, cloneState(state), []);
        return out;
    }

    function computeMovePolicy(state, dice) {
        const policy = {
            mustPlayAllDice: false,
            singleDieMode: false,
            singleDieReason: null,
            enforcedDie: null
        };

        if (!dice || dice.length === 0) return policy;

        const fullSequences = getValidMoveSequencesWithOrder(state, dice, true);
        if (fullSequences.length > 0) {
            policy.mustPlayAllDice = true;
            return policy;
        }

        if (dice.length === 2 && dice[0] !== dice[1]) {
            const dA = dice[0];
            const dB = dice[1];
            const player = state.currentTurn || 'red';
            const playableA = validMoveExists(state, player, dA);
            const playableB = validMoveExists(state, player, dB);

            if (playableA && playableB) {
                policy.singleDieMode = true;
                policy.singleDieReason = 'mustUseHigher';
                policy.enforcedDie = Math.max(dA, dB);
            } else if (playableA || playableB) {
                policy.singleDieMode = true;
                policy.singleDieReason = 'onlyOnePlayable';
                policy.enforcedDie = playableA ? dA : dB;
            }
        }

        return policy;
    }

    function getLegalSequences(state, dice) {
        const policy = computeMovePolicy(state, dice);
        let sequences = [];

        if (policy.singleDieMode && typeof policy.enforcedDie === 'number') {
            sequences = getValidMoveSequencesWithOrder(state, [policy.enforcedDie], false);
        } else if (policy.mustPlayAllDice) {
            sequences = getValidMoveSequencesWithOrder(state, dice, true);
        } else {
            sequences = getValidMoveSequencesWithOrder(state, dice, false);
        }

        return { policy, sequences };
    }

    function applySequence(state, sequence, diceOrder) {
        const nextState = cloneState(state);
        const player = nextState.currentTurn || 'red';

        if (!Array.isArray(sequence) || !Array.isArray(diceOrder)) {
            return { state: nextState, valid: false, winner: checkForWinner(nextState), usedDice: 0 };
        }

        const legal = getLegalSequences(nextState, diceOrder).sequences;
        const matchesLegalSequence = legal.some(entry => {
            if (!entry || !Array.isArray(entry.sequence) || !Array.isArray(entry.order)) return false;
            if (entry.sequence.length !== sequence.length || entry.order.length !== diceOrder.length) return false;
            return entry.sequence.every((from, i) => from === sequence[i]) &&
                entry.order.every((die, i) => die === diceOrder[i]);
        });

        if (!matchesLegalSequence) {
            return { state: nextState, valid: false, winner: checkForWinner(nextState), usedDice: 0 };
        }

        for (let i = 0; i < sequence.length; i++) {
            const moved = applySingleMove(nextState, player, sequence[i], diceOrder[i]);
            if (!moved) {
                return { state: nextState, valid: false, winner: checkForWinner(nextState), usedDice: i };
            }

            const winner = checkForWinner(nextState);
            if (winner) {
                return { state: nextState, valid: true, winner: winner, usedDice: i + 1 };
            }
        }

        return { state: nextState, valid: true, winner: checkForWinner(nextState), usedDice: sequence.length };
    }

    function getAllValidMoveSequences(state, dice) {
        if (!dice || dice.length === 0) return [];
        return getValidMoveSequencesWithOrder(state, dice, true).map(entry => entry.sequence);
    }

    function getValidMoveSequencesWithOrder(state, diceValues, requireFull) {
        if (!diceValues || diceValues.length === 0) return [];

        const sequences = [];
        for (const order of uniqueDiceOrders(diceValues)) {
            for (const sequence of generateSequencesForOrder(state, order, requireFull)) {
                sequences.push({ order: order.slice(), sequence: sequence.slice() });
            }
        }

        if (requireFull) return sequences;

        const maxLen = sequences.reduce((m, s) => Math.max(m, s.sequence.length), 0);
        return sequences.filter(s => s.sequence.length === maxLen && s.sequence.length > 0);
    }

    return {
        getHomeBoardStart,
        findMaxNonZeroIndex,
        findMinNonZeroIndex,
        canBearOff,
        validMoveExists,
        checkForWinner,
        bearOff,
        moveChecker,
        getAllValidMoveSequences,
        getValidMoveSequencesWithOrder,
        computeMovePolicy,
        getLegalSequences,
        applySequence
    };
});
