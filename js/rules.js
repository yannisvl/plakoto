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

function canBearOff(player) {
    const homeStart = getHomeBoardStart(player);
    const homeEnd = homeStart + 5;
    const checkersInHome = positions[player].slice(homeStart, homeEnd + 1).reduce((a, b) => a + b);
    let offCheckers = player === 'red' ? bearedOff.red : bearedOff.blue;
    return (checkersInHome + offCheckers) === 15;
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

        checkForWinner();
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

        checkForWinner();
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
        return false; // porta
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

function checkForWinner() {
    if (bearedOff.red === 15 || bearedOff.blue === 15) {
        gameOver = true;
        const winner = bearedOff.red === 15 ? 'red' : 'blue';
        alert(`Game over - ${winner.toUpperCase()} wins!`);
    }
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

function getValidMoveSequencesWithOrder(diceValues, requireFull) {
    if (!diceValues || diceValues.length === 0) return [];
    const player = currentTurn;

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

        if (pos[opp][toIndex] >= 2) return false;
        if (pos[p][toIndex] === -1) return false;
        if (pos[opp][toIndex] === 1 && pos[p][toIndex] === 0) pos[opp][toIndex] = -1;
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
