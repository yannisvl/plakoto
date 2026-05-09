(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PlakotoEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

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

    function canBearOff(state, player) {
        const homeStart = getHomeBoardStart(player);
        const homeEnd = homeStart + 5;
        const checkersInHome = state.positions[player].slice(homeStart, homeEnd + 1).reduce((a, b) => a + b, 0);
        const offCheckers = player === 'red' ? state.bearedOff.red : state.bearedOff.blue;
        return (checkersInHome + offCheckers) === 15;
    }

    function validMoveExists(state, player, step) {
        const opponent = player === 'red' ? 'blue' : 'red';
        const canBear = canBearOff(state, player);
        const maxNonZeroIndexRed = findMaxNonZeroIndex(state.positions.red);
        const minNonZeroIndexBlue = findMinNonZeroIndex(state.positions.blue);

        for (let fromIndex = 0; fromIndex < 24; fromIndex++) {
            if (state.positions[player][fromIndex] <= 0) continue;
            const toIndex = player === 'red' ? fromIndex + step : fromIndex - step;

            // regular on-board move
            if (toIndex >= 0 && toIndex < 24 &&
                state.positions[opponent][toIndex] < 2 && state.positions[player][toIndex] !== -1) {
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

    function checkForWinner(state) {
        if (state.bearedOff.red === 15) return 'red';
        if (state.bearedOff.blue === 15) return 'blue';
        return null;
    }

    function bearOff(state, player, fromIndex, steps) {
        const toIndex = player === 'red' ? fromIndex + steps : fromIndex - steps;
        const minNonZeroIndexRed = findMinNonZeroIndex(state.positions.red);
        const maxNonZeroIndexBlue = findMaxNonZeroIndex(state.positions.blue);

        if (player === 'red' && (toIndex === 24 || (fromIndex === minNonZeroIndexRed && toIndex >= 24))) {
            state.positions[player][fromIndex]--;
            state.bearedOff.red += 1;

            const opponent = 'blue';
            if (state.positions[opponent][fromIndex] === -1 && state.positions[player][fromIndex] === 0) {
                state.positions[opponent][fromIndex] = 1;
            }
            return true;
        }
        if (player === 'blue' && (toIndex === -1 || (fromIndex === maxNonZeroIndexBlue && toIndex <= -1))) {
            state.positions[player][fromIndex]--;
            state.bearedOff.blue += 1;

            const opponent = 'red';
            if (state.positions[opponent][fromIndex] === -1 && state.positions[player][fromIndex] === 0) {
                state.positions[opponent][fromIndex] = 1;
            }
            return true;
        }
        return false;
    }

    function moveChecker(state, player, fromIndex, steps) {
        const opponent = player === 'red' ? 'blue' : 'red';
        const toIndex = player === 'red' ? fromIndex + steps : fromIndex - steps;

        if (toIndex > 23 || toIndex < 0) return false; // Move out of bounds

        if (state.positions[opponent][toIndex] >= 2)
            return false; // porta
        if (state.positions[player][toIndex] === -1)
            return false; // plakwmeno
        if (state.positions[opponent][toIndex] === 1 && state.positions[player][toIndex] === 0)
            state.positions[opponent][toIndex] = -1; // plakwse

        // Move the player's checker
        state.positions[player][fromIndex]--;
        state.positions[player][toIndex]++;

        // If the move emptied the origin point and opponent had a plakwma (-1) there, free the opponent checker to 1
        if (state.positions[opponent][fromIndex] === -1 && state.positions[player][fromIndex] === 0) {
            state.positions[opponent][fromIndex] = 1;
        }

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

    function computeMovePolicy(state, dice) {
        const policy = {
            mustPlayAllDice: false,
            singleDieMode: false,
            singleDieReason: null,
            enforcedDie: null
        };

        if (!dice || dice.length === 0) return policy;

        const fullSequences = getAllValidMoveSequences(state, dice);
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

        const moveCount = Math.min(sequence.length, diceOrder.length);
        for (let i = 0; i < moveCount; i++) {
            const fromIndex = sequence[i];
            const steps = diceOrder[i];
            let moved = false;

            if (canBearOff(nextState, player)) {
                moved = bearOff(nextState, player, fromIndex, steps);
            }
            if (!moved) {
                moved = moveChecker(nextState, player, fromIndex, steps);
            }
            if (!moved) {
                return { state: nextState, valid: false, winner: checkForWinner(nextState), usedDice: i };
            }

            const winner = checkForWinner(nextState);
            if (winner) {
                return { state: nextState, valid: true, winner: winner, usedDice: i + 1 };
            }
        }

        return { state: nextState, valid: true, winner: checkForWinner(nextState), usedDice: moveCount };
    }

    /**
     * Returns an array of all full-length valid move sequences for the given dice.
     * Each sequence is an array of point indices (0-23), length == dice.length (2 or 4).
     * The k-th element is the point the player would click to perform the k-th die move
     * in the given dice order (does NOT try swapped order).
     * If a full sequence cannot be completed (e.g. second die becomes unusable),
     * that partial path is discarded (so sequences are only those that use every die).
     */
    function getAllValidMoveSequences(state, dice) {
        if (!dice || dice.length === 0) return [];
        const player = state.currentTurn || 'red';

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
                }
                const maxIdx = findMaxNonZeroIndexLocal(pos.blue);
                if (toIndex === -1 || (fromIndex === maxIdx && toIndex < 0)) {
                    pos[p][fromIndex]--;
                    off.blue += 1;
                    if (pos[opp][fromIndex] === -1 && pos[p][fromIndex] === 0) pos[opp][fromIndex] = 1;
                    return true;
                }
                return false;
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
            const basePos = { red: state.positions.red.slice(), blue: state.positions.blue.slice() };
            const baseOff = { red: state.bearedOff.red, blue: state.bearedOff.blue };
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

        const originalSequences = generateSequencesForOrder(dice);

        let swappedSequences = [];
        if (dice.length === 2 && dice[0] !== dice[1]) {
            const swapped = [dice[1], dice[0]];
            swappedSequences = generateSequencesForOrder(swapped);
        }

        return originalSequences.concat(swappedSequences);
    }

    function getValidMoveSequencesWithOrder(state, diceValues, requireFull) {
        if (!diceValues || diceValues.length === 0) return [];
        const player = state.currentTurn || 'red';

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
                }
                const maxIdx = findMaxNonZeroIndexLocal(pos.blue);
                if (toIndex === -1 || (fromIndex === maxIdx && toIndex < 0)) {
                    pos[p][fromIndex]--;
                    off.blue += 1;
                    if (pos[opp][fromIndex] === -1 && pos[p][fromIndex] === 0) pos[opp][fromIndex] = 1;
                    return true;
                }
                return false;
            }

            if (pos[opp][toIndex] >= 2) return false;
            if (pos[p][toIndex] === -1) return false;
            if (pos[opp][toIndex] === 1 && pos[p][toIndex] === 0) pos[opp][toIndex] = -1;
            pos[p][fromIndex]--;
            pos[p][toIndex]++;
            if (pos[opp][fromIndex] === -1 && pos[p][fromIndex] === 0) pos[opp][fromIndex] = 1;
            return true;
        }

        function generateSequencesForOrder(diceOrder) {
            const basePos = { red: state.positions.red.slice(), blue: state.positions.blue.slice() };
            const baseOff = { red: state.bearedOff.red, blue: state.bearedOff.blue };
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
                if (!found && !requireFull && seq.length > 0) {
                    out.push(seq.slice());
                }
            }
            dfs(0, basePos, baseOff, []);
            return out;
        }

        const sequences = [];
        const baseSequences = generateSequencesForOrder(diceValues);
        for (const seq of baseSequences) {
            sequences.push({ order: diceValues.slice(), sequence: seq });
        }

        if (diceValues.length === 2 && diceValues[0] !== diceValues[1]) {
            const swapped = [diceValues[1], diceValues[0]];
            const swappedSequences = generateSequencesForOrder(swapped);
            for (const seq of swappedSequences) {
                sequences.push({ order: swapped.slice(), sequence: seq });
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
