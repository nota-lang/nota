# Nota — orientation for Claude

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) that lowers to **hyperscript**
(`h`/`Fragment`/`decode` calls, NOT JSX) for any JSX framework (React, Solid), with a Pollen-style
`decode` pass that runs during SSG.

## Read first
**Most tasks do NOT need a full read of `design/*.md`** — the facts below + the package map are what
sessions kept re-deriving. Read the specs for emit-surface / runtime-semantics work:
- **`design/notation.md`** — surface syntax → emit, including the authoritative hyperscript emit
  table (§Emit reference; the JSX forms in the doc are a declared readability view).
- **`design/decode.md`** — runtime semantics: the emit surface, the decode pipeline
  (normalize → doc-state → struct → serialize), islands + replay hydration, the registry/config,
  and SSG integration.
Reader architecture lives with the code: `oxc/NOTA_READER.md`.

## Repo layout
- **`oxc/`** — a fork of oxc (branch `nota`) hosting the Nota *reader*, wired in as a **git submodule**
  (`.gitmodules`, url `nota-lang/oxc`). Commit inside `oxc/`, then bump the submodule pointer in the
  main repo. Architecture notes: `oxc/NOTA_READER.md` (pipeline, fork seam, invariants, testing map).
- **`packages/*`** — the `@nota-lang/*` TypeScript packages, a **Depot** + pnpm workspace:
  - **runtime** — framework-agnostic core: `h`/`Fragment`/`raw`, `decode`, HTML `serialize`,
    list/section coalescing (`struct.ts`), island slot recovery, and the component registry
    (`slot`/`registerComponents` — decode.md §The registry). The adapters build on it.
  - **prelude** — the standard ambient prelude: `Tex` (KaTeX→MathML) +
    `CodeInline`/`CodeBlock` (sync shiki, armed parts→decorations) as registry slots, plus
    `lstset`/`mathset` config (doc-global, reset per render, bakeable baseline).
  - **compiler** — sync shim (`src/lib.ts`) that shells out to the Rust reader binary:
    `compile` (emit) / `compileVirtual` (Volar `.tsx`) / `parseVirtualJson`.
  - **react** / **solid** — adapter bindings (`h`/Fragment/decode/hydrate/SSR). **solid has no own
    tests**; both adapters are driven by the conformance matrix in `packages/react/tests/`.
  - **vite** — `.nota` transform plugin + island registry (`registry.ts:generateClientEntry`).
  - **cli** — `nota build`: compile → SSR → SSG HTML + island manifest + client bundle (`build.ts`).
  - **language-server** — Volar server: virtual `.tsx` + `CodeMapping`s back to `.nota`.
  - **vscode-nota** — LSP client + TextMate grammar (`syntaxes/nota.tmLanguage.json`, a conservative
    **"never lie" grammar**: single-line `match` rules + line-anchored fences only, the
    honest first paint before the LSP semantic tokens arrive). **No depot/vitest**; tests run via
    `pnpm run test:all` = `vscode-tmgrammar-test` caret fixtures (`tests/*.test.nota`) **plus** a node
    subset-correctness conformance test (`tests/conformance.ts` → `pnpm run test:conformance`) that
    runs the compiled grammar over `integration/*.nota` and asserts every Nota-scoped token agrees
    with the reader's `highlightSpans` kind (needs the node wasm `pkg-node` + `@nota-lang/compiler`).
  - **codemirror** — CM6 language support for Nota (no CM grammar exists — reader-driven:
    `notaHighlighting()` paints the wasm `highlight()` spans as decorations, embedded code/math/`@style`
    interiors sub-tokenize via CM's own parsers, one shared Catppuccin `HighlightStyle`; see
    `oxc/NOTA_READER.md` §Highlighting). Wasm **init is consumer-side** (`init(url|bytes)` before
    installing). Consumed by the playground; later the website.
  - **playground** — browser editor (CM6 via `@nota-lang/codemirror`); consumes the **wasm** reader,
    not the binary.
- `references/` — external reference repos (mdx, typst, scribble, pollen, oxc); gitignored.

## Tooling

### Depot / JS tests
- **Per-package only:** `cd packages/<pkg> && depot test` (= type-check + biome lint + vitest). Do NOT
  run bare `depot test` from the repo root — a biome 2.x root-config conflict fails whole-workspace
  runs. `--no-fullscreen` (pipeable output) is a **global** flag: `depot --no-fullscreen test`, not
  `depot test --no-fullscreen`. Run packages **serially** (they race on shared `dist/`).
- Fix biome issues with `node_modules/.bin/biome check --write src tests`. One pre-existing biome
  failure (`react/tests/fixtures/golden.compiled.ts`) is **not yours** — don't chase it.
- True exit codes: **redirect, don't pipe** — `cmd >/tmp/o 2>&1; echo $?`. `| tail`/`| grep` reports
  the *filter's* exit, masking the real one.

### The Rust reader (`oxc/`)
- Reader entry: **`oxc/crates/oxc_parser/src/nota/mod.rs`** (highlight pass: sibling `highlight.rs`).
  AST node: `oxc_ast/src/ast/nota.rs`;
  parse+lower entry: `oxc/crates/oxc/src/nota.rs`; e2e fixtures: `oxc/crates/oxc_codegen/tests/integration/nota.rs`.
- Compile one file: `cd oxc && cargo run -q -p oxc --example nota_compile --features codegen -- ../<f>.nota`.
- Reader tests: `cd oxc && cargo test -p oxc_codegen --test integration nota` (e2e golden, exact
  emit + validity), `cargo test -p oxc_transformer --lib nota` (Scribble whitespace + mapping
  units), and `cargo test -p oxc_parser --lib nota` (lexer scan units: boundaries, line
  classifiers, string-aware skips; highlight-span units). **`cargo test -p oxc` runs ZERO tests**
  (`[lib] test=false`); the compile-entry + CodeMapping/virtual-emit tests need
  `cargo test -p oxc --features codegen nota`.
- `just ast` (regenerate `#[ast]` code) **always exits 101 here** — it panics at the end on a missing
  `oxfmt` (JS formatter), but the Rust regen is complete and correct. Verify with `cargo build -p
  oxc_ast`, not the exit code. (Adding an AST variant: see memory `nota-oxc-add-expression-variant.md`.)

### Build artifacts — the stale-output trap (this repeatedly cost hours)
A reader change is invisible to JS until you rebuild the artifact that consumes it:
- **Native binary** (compiler/vite/cli/language-server):
  `cd oxc && cargo build --release -p oxc --example nota_compile --features codegen`
  → `oxc/target/release/examples/nota_compile`. Stale/missing → `nota: failed to compile … [exit unknown]`.
- **wasm — web** (playground): `cd oxc && wasm-pack build napi/nota_wasm --target web --out-dir pkg --out-name nota_wasm`.
  Missing `pkg/` → pnpm-install ENOENT (it's a `file:` dep).
- **wasm — node** (language-server semantic tokens, `@nota-lang/compiler`'s `highlightSpans`):
  `cd oxc && wasm-pack build napi/nota_wasm --target nodejs --out-dir pkg-node --out-name nota_wasm`
  → `oxc/napi/nota_wasm/pkg-node/nota_wasm.js` (CommonJS, sync init). The compiler shim `require`s it
  package-relative (override with `NOTA_WASM_NODE`); missing → `highlightSpans` throws / the
  `highlight.test.ts` suite self-skips. Rebuild BOTH wasm targets after a reader change — the web
  `pkg/` and the node `pkg-node/` are independent artifacts. Both are gitignored (wasm-pack writes a
  `.gitignore: *` in each out-dir).
- JS packages consume each other's **built `dist/`, not `src/`** — after editing pkg A,
  `cd packages/A && depot build` before pkg B / a cross-package test sees the change.

## Gotchas & domain facts
- **Known reader bugs** live in **`TODO.md`** + `#[ignore]`'d tests in `integration/nota.rs` — check
  there before re-fuzzing/repro'ing. Feature mega-test: `integration/mega.nota`.
- **decode model:** `h`/`Fragment`/`decode` branch on a runtime flag (`▸` = inside a `component`?).
  SSG builds a vnode tree (marked components deferred, not invoked; a *plain* function tag is a
  **static template** `struct` expands eagerly); `decode` runs the pipeline ending in
  `serialize(struct(…))`, coalescing `nota-ul-li`/`nota-ol-li` → lists, grouping paras/sections,
  stopping at component boundaries. Only reactive islands hydrate client-side (by **replay
  hydration** — the client re-executes the document; see decode.md).
- **macOS zsh:** `noclobber` (`>` fails on existing files — use `>|`); backticks in `git commit -m` run
  command substitution (use `-F`); Bash cwd resets each call (use absolute paths).

## Build method
Packages are built in dependency order (reader → runtime/adapters → vite → cli/playground → IDE);
every feature ships with tests, green before the next lands.
