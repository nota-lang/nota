/**
 * Browser stand-in for the node builtin `assert`, wired in via `resolve.alias` in
 * vite.config.ts. `babel-preset-solid`'s plugin chain (`@babel/helper-module-imports`) does
 * `require("assert")` and calls the module value directly; without this alias vite externalizes
 * the builtin to a non-callable stub, and compiling any document throws
 * "_assert is not a function" the first time the preset injects a `solid-js/web` import.
 *
 * CJS on purpose: the consumer is CJS, and `require()` of an ESM shim would hand it a
 * non-callable namespace object. Only the surface helper-module-imports touches is implemented
 * (call + `.fail`), plus `.ok`/`.default` for interop completeness.
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
