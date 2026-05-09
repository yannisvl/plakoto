const humanPlayer = 'red';
const computerPlayer = 'blue';
const AI_MOVE_DELAY_MS = 700;

let currentTurn = humanPlayer; // Start with the red player
let dice = [];
let rolledDiceDisplay = [];
let positions = {
    red: Array(24).fill(0),
    blue: Array(24).fill(0)
};
let gameOver = false; // stops further input when true
positions.red[0] = 15;
positions.blue[23] = 15;
let bearedOff = {
    red: 0,
    blue: 0
};
let turnHistory = []; // Stack for storing moves made in the current turn
let aiPlaying = false;

// FLAGS
let mustPlayAllDice = false;        // full sequence must be used
let singleDieMode = false;          // true => only one die may be played this turn
let singleDieReason = null;         // 'mustUseHigher' | 'onlyOnePlayable' | null
let enforcedDie = null;             // die value that must be used when singleDieMode
let diceRolling = false;
let diceRolledThisTurn = false;
