/**
 * Callable CJS assert for Babel's helper-module-imports. Without the Vite alias, browser
 * builds get a non-callable stub; Node tests alone cannot detect that failure.
 */
function assert(value, message) {
  if (!value) {
    throw new Error(message || "Assertion failed");
  }
}
assert.ok = assert;
assert.fail = message => {
  throw new Error(message || "Assertion failed");
};
assert.default = assert;
module.exports = assert;
