/**
 * The raw wasm reader surface, re-exported verbatim.
 *
 * `src/generated/` is the wasm-bindgen output of the Rust reader (`oxc/target/js`, copied in by
 * `build.mjs` — gitignored, rebuilt by `just nota-build` in `oxc/`). It is a **bundler-target**
 * build: `nota.js` imports `./nota_bg.wasm` as an ESM module, so every consumer needs a bundler
 * that understands wasm imports (`vite-plugin-wasm` in this repo's vite/vitest configs).
 *
 * {@link ./lib.ts} is the shim over this: `compile` there prepends imports, `highlightSpans`
 * decodes the flat triples. Import *this* module when you want the unwrapped entries — the
 * playground's `parseAst`, the CodeMirror mode's flat `highlight` array — via
 * `@nota-lang/compiler/reader`. It exists so nothing outside this package has to depend on the
 * generated code directly.
 */

export * from "./generated/nota.js";
