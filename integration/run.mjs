// Cross-stream integration loop (the decode.md arc, end to end across both halves):
//   .nota  --[Part 1: oxc::nota::compile]-->  JS module
//          --[Part 2: @nota-lang/runtime render + @nota-lang/react adapter]-->  HTML + island manifest
//
// This is the Sync-2 milestone: it proves the reader's *actual* emit runs through the runtime,
// not just that each half matches the hand-written worked-example golden. Run from the repo root:
//   node integration/run.mjs
//
// STATUS: the Part-1 compile step works standalone (cargo example) and the reader's emit is verified
// + traced to the expected stage-5 output (design/decode.md §The worked example); Part 2's render of that shape is proven by
// @nota-lang/react's tests. Executing THIS script standalone is pending Wave-3 module resolution —
// the runtime `dist` uses bundler-style extensionless ESM imports, so run it under vite/vitest or
// once @nota-lang/compiler brings the emit into JS-land. The expected assertions are encoded below.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Harness detail: import the built dist/ directly (this dir isn't a workspace package). Node
// resolves @nota-lang/react's own bare "@nota-lang/runtime" import to the same real file, so the
// runtime's ▸/adapter singleton is shared. The real shim/CLI uses the bare "@nota-lang/runtime".
import adapter from "../packages/react/dist/lib.js";
import { render, setAdapter } from "../packages/runtime/dist/lib.js";

const here = dirname(fileURLToPath(import.meta.url));
const oxcDir = join(here, "..", "oxc");
const notaFile = join(here, "note.nota");

// --- Part 1: compile .nota -> JS (via the oxc reader) ---
const emittedCode = execFileSync(
  "cargo",
  ["run", "-q", "-p", "oxc", "--example", "nota_compile", "--features", "codegen", "--", notaFile],
  { cwd: oxcDir, encoding: "utf8" }
);

// The reader does not emit the runtime import (design/decode.md §The emit surface) — the shim/integrator prepends it.
// (Relative path here so the standalone .mjs resolves without this dir being a workspace package.)
const RUNTIME_IMPORT =
  'import { h, decode, Fragment, inlineComponent, blockComponent } from "../packages/runtime/dist/lib.js";\n';
const moduleSource = RUNTIME_IMPORT + emittedCode;
const emittedFile = join(here, ".note.emitted.mjs");
writeFileSync(emittedFile, moduleSource);

// --- Part 2: run the emitted module through the runtime + React adapter ---
setAdapter(adapter);
const { default: Doc } = await import(`${emittedFile}?t=${Date.now()}`);
const { html, manifest } = render(Doc);

console.log("=== emitted JS (Part 1) ===\n" + emittedCode.trim());
console.log("\n=== rendered HTML (Part 2) ===\n" + html);
console.log("\n=== island manifest ===\n" + JSON.stringify(manifest));

// --- assertions: the component boundary became an island, statics serialized, the attached component name in the manifest ---
const mustInclude = [
  '<nota-island data-hydration-id="1">',
  "<aside>",
  "<p>Hello <em>world</em></p>",
  "</aside>",
  "</nota-island>"
];
let ok = true;
for (const frag of mustInclude) {
  if (!html.includes(frag)) {
    console.error("  MISSING from HTML:", frag);
    ok = false;
  }
}
if (manifest["1"]?.comp !== "Note") {
  console.error('  manifest["1"].comp !== "Note":', JSON.stringify(manifest["1"]));
  ok = false;
}
console.log(ok ? "\n✅ INTEGRATION PASS" : "\n❌ INTEGRATION FAIL");
process.exit(ok ? 0 : 1);
