/**
 * The in-browser Nota compiler (decode.md **stage 3**: `.nota` → emitted JS module).
 *
 * Wraps the wasm-bindgen backend (`oxc/napi/nota_wasm/pkg`, README "JS API") so the playground runs
 * the reader **client-side, no server**. `init(input)` must be called once to fetch + instantiate the
 * `.wasm`; we resolve the `.wasm` URL through Vite's `?url` import (works in dev *and* build, where
 * the asset is content-hashed) and pass that URL straight to the default `init` export (the
 * wasm-bindgen `target web` default `init` accepts a `RequestInfo | URL | BufferSource | Module`).
 *
 * {@link compileNota} returns the emitted module **with the `@nota-lang/runtime` import prepended** —
 * the reader deliberately omits it (contract §1; the integrator supplies it). That matches what the
 * Post-SSG pane evaluates and what `@nota-lang/compiler` does on the Node side.
 */

import init, { compile, type InitInput } from "nota_wasm";
// Vite resolves this to a served URL for the `.wasm` asset (hashed in build output).
import wasmUrl from "nota_wasm/nota_wasm_bg.wasm?url";

/** The runtime import the reader omits (contract §1) — prepended onto every emit. */
export const RUNTIME_IMPORT =
  'import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";\n';

let initialized: Promise<void> | null = null;

/**
 * Idempotently load + instantiate the wasm compiler. Safe to call many times.
 *
 * @param input optional wasm source override. The browser default is the Vite-resolved `.wasm` URL;
 *   Node tests (jsdom has no `file://` `fetch`) pass the `.wasm` **bytes** (`BufferSource`), which the
 *   default `init` instantiates directly. Only the first call's `input` takes effect.
 */
export function ensureCompiler(input?: InitInput): Promise<void> {
  if (!initialized) {
    initialized = init(input ?? wasmUrl).then(() => undefined);
  }
  return initialized;
}

/**
 * Compile a `.nota` source to its emitted JS module (stage 3), runtime import prepended.
 * Assumes {@link ensureCompiler} has resolved. Throws a normal `Error` on a Nota parse error
 * (the wasm backend rejects with a `JsError` whose `.message` is the rendered diagnostics).
 */
export function compileNota(source: string): string {
  const { code } = compile(source);
  return RUNTIME_IMPORT + code;
}

/** The bare emitted code (no runtime import), for the Generated-JS pane / parity tests. */
export function compileNotaRaw(source: string): string {
  return compile(source).code;
}
