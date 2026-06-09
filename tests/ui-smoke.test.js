const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const elements = new Map();

function elementFor(id) {
    if (!elements.has(id)) {
        elements.set(id, {
            id,
            value: id === 'ai-mode' ? 'random' : '',
            innerHTML: '',
            textContent: '',
            addEventListener() {},
        });
    }
    return elements.get(id);
}

const context = {
    console,
    Math,
    Array,
    Object,
    JSON,
    Date,
    Promise,
    document: {
        getElementById: elementFor,
        querySelector() {
            return null;
        },
    },
    alert(message) {
        context.alerts.push(message);
    },
    alerts: [],
    fetch: async () => ({
        ok: true,
        json: async () => ({ choice: null }),
    }),
    setTimeout() {
        return 0;
    },
    setInterval() {
        return 0;
    },
    clearInterval() {},
};
context.window = context;
context.self = context;
context.window.addEventListener = function addEventListener() {};

vm.createContext(context);

for (const file of ['js/state.js', 'js/engine.js', 'js/rules.js', 'js/ai.js', 'js/ui.js']) {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
}

context.updateBoardDisplay();
context.setDiceMessage();

assert.strictEqual(elements.get('point-0').innerHTML.includes('checker red'), true);
assert.strictEqual(elements.get('point-23').innerHTML.includes('checker blue'), true);
assert.strictEqual(elements.get('dice-result').textContent, 'Red roll.');

console.log('ui smoke test passed');
