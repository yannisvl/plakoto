const http = require('http');
const PlakotoEngine = require('./js/engine.js');

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end(body);
}

function parseBody(req, callback) {
    let data = '';
    req.on('data', chunk => {
        data += chunk;
    });
    req.on('end', () => {
        if (!data) return callback(null, {});
        try {
            callback(null, JSON.parse(data));
        } catch (err) {
            callback(err);
        }
    });
}

function normalizeState(raw) {
    const positions = raw.positions || { red: [], blue: [] };
    return {
        positions: {
            red: (positions.red || []).slice(0, 24).concat(Array(24).fill(0)).slice(0, 24),
            blue: (positions.blue || []).slice(0, 24).concat(Array(24).fill(0)).slice(0, 24)
        },
        bearedOff: {
            red: raw.bearedOff && typeof raw.bearedOff.red === 'number' ? raw.bearedOff.red : 0,
            blue: raw.bearedOff && typeof raw.bearedOff.blue === 'number' ? raw.bearedOff.blue : 0
        },
        currentTurn: raw.currentTurn === 'blue' ? 'blue' : 'red'
    };
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, {});
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (req.url === '/legal_moves') {
        return parseBody(req, (err, payload) => {
            if (err) return sendJson(res, 400, { error: 'invalid_json' });
            const state = normalizeState(payload.state || {});
            const dice = Array.isArray(payload.dice) ? payload.dice.slice() : [];
            const result = PlakotoEngine.getLegalSequences(state, dice);
            return sendJson(res, 200, result);
        });
    }

    if (req.url === '/apply') {
        return parseBody(req, (err, payload) => {
            if (err) return sendJson(res, 400, { error: 'invalid_json' });
            const state = normalizeState(payload.state || {});
            const sequence = Array.isArray(payload.sequence) ? payload.sequence.slice() : [];
            const diceOrder = Array.isArray(payload.diceOrder) ? payload.diceOrder.slice() : [];
            const result = PlakotoEngine.applySequence(state, sequence, diceOrder);
            return sendJson(res, 200, result);
        });
    }

    return sendJson(res, 404, { error: 'not_found' });
});

const host = '127.0.0.1';
const port = 9000;
server.listen(port, host, () => {
    console.log(`Env server running at http://${host}:${port}`);
});
