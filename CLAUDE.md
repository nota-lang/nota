# Nota — orientation for Claude

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) that lowers to **hyperscript**
(`h`/`Fragment`/`decode` calls, NOT JSX) for any JSX framework (React, Solid), with a Pollen-style
`decode` pass that runs during SSG.

## Read first
**Most tasks do NOT need a full read of `design/*.md`** — the facts below + the package map are what
sessions kept re-deriving. Read the specs for emit-surface / runtime-semantics work:
- **`design/contract.md`** — the authoritative, reconciled cross-stream spec. It pins the emit surface,
  the runtime semantics, and all locked cross-cutting decisions, and supersedes the design docs where
  they conflict.
- `design/notation.md` (surface syntax → emit), `design/decode.md` (runtime decode/SSG model),
  `design/implementation.md` (the phased build plan). Authority: implementation.md → contract.md →
  notation/decode.

## Repo layout
- **`oxc/`** — a fork of oxc (branch `nota`) hosting the Nota *reader*, wired in as a **git submodule**
  (`.gitmodules`, url `nota-lang/oxc`). Commit inside `oxc/`, then bump the submodule pointer in the
  main repo. Architecture notes: `oxc/NOTA_READER.md` (pipeline, fork seam, invariants, testing map).
- **`packages/*`** — the `@nota-lang/*` TypeScript packages, a **Depot** + pnpm workspace:
  - **runtime** — framework-agnostic core: `h`/`Fragment`/`raw`, `decode`, HTML `serialize`,
    list/section coalescing (`struct.ts`), island slot recovery. The adapters build on it.
  - **compiler** — sync shim (`src/lib.ts`) that shells out to the Rust reader binary:
    `compile` (emit) / `compileVirtual` (Volar `.tsx`) / `parseVirtualJson`.
  - **react** / **solid** — adapter bindings (`h`/Fragment/decode/hydrate/SSR). **solid has no own
    tests**; both adapters are driven by the conformance matrix in `packages/react/tests/`.
  - **vite** — `.nota` transform plugin + island registry (`registry.ts:generateClientEntry`).
  - **cli** — `nota build`: compile → SSR → SSG HTML + island manifest + client bundle (`build.ts`).
  - **language-server** — Volar server: virtual `.tsx` + `CodeMapping`s back to `.nota`.
  - **vscode-nota** — LSP client + TextMate grammar (`syntaxes/nota.tmLanguage.json`). **No depot/
    vitest**; grammar tests run via `vscode-tmgrammar-test` (`pnpm run test:all`).
  - **playground** — browser editor (CM6 + Shiki); consumes the **wasm** reader, not the binary.
- `references/` — external reference repos (mdx, typst, scribble, pollen, oxc); gitignored.

## Tooling

### Depot / JS tests
- **Per-package only:** `cd packages/<pkg> && depot test` (= type-check + biome lint + vitest). Do NOT
  run bare `depot test` from the repo root — a biome 2.x root-config conflict fails whole-workspace
  runs. Add `--no-fullscreen` for pipeable output; run packages **serially** (they race on shared
  `dist/`).
- Fix biome issues with `node_modules/.bin/biome check --write src tests`. Two pre-existing biome
  failures (`react/tests/fixtures/golden.compiled.ts`, `vscode-nota/tests/tokenize.smoke.ts`) are
  **not yours** — don't chase them.
- True exit codes: **redirect, don't pipe** — `cmd >/tmp/o 2>&1; echo $?`. `| tail`/`| grep` reports
  the *filter's* exit, masking the real one.

### The Rust reader (`oxc/`)
- Reader entry: **`oxc/crates/oxc_parser/src/nota/mod.rs`**. AST node: `oxc_ast/src/ast/nota.rs`;
  parse+lower entry: `oxc/crates/oxc/src/nota.rs`; e2e fixtures: `oxc/crates/oxc_codegen/tests/integration/nota.rs`.
- Compile one file: `cd oxc && cargo run -q -p oxc --example nota_compile --features codegen -- ../<f>.nota`.
- Reader tests: `cd oxc && cargo test -p oxc_codegen --test integration nota` (e2e golden, exact
  emit + validity) and `cargo test -p oxc_transformer --lib nota` (Scribble whitespace + mapping
  units; there are no parser-lib nota tests). **`cargo test -p oxc` runs ZERO tests**
  (`[lib] test=false`); the compile-entry + H1/H2 tests need `cargo test -p oxc --features codegen nota`.
- `just ast` (regenerate `#[ast]` code) **always exits 101 here** — it panics at the end on a missing
  `oxfmt` (JS formatter), but the Rust regen is complete and correct. Verify with `cargo build -p
  oxc_ast`, not the exit code. (Adding an AST variant: see memory `nota-oxc-add-expression-variant.md`.)

### Build artifacts — the stale-output trap (this repeatedly cost hours)
A reader change is invisible to JS until you rebuild the artifact that consumes it:
- **Native binary** (compiler/vite/cli/language-server):
  `cd oxc && cargo build --release -p oxc --example nota_compile --features codegen`
  → `oxc/target/release/examples/nota_compile`. Stale/missing → `nota: failed to compile … [exit unknown]`.
- **wasm** (playground): `cd oxc && wasm-pack build napi/nota_wasm --target web --out-dir pkg --out-name nota_wasm`.
  Missing `pkg/` → pnpm-install ENOENT (it's a `file:` dep).
- JS packages consume each other's **built `dist/`, not `src/`** — after editing pkg A,
  `cd packages/A && depot build` before pkg B / a cross-package test sees the change.

## Gotchas & domain facts
- **Known reader bugs** live in **`TODO.md`** + `#[ignore]`'d tests in `integration/nota.rs` — check
  there before re-fuzzing/repro'ing. Feature mega-test: `integration/mega.nota`.
- **decode model:** `h`/`Fragment`/`decode` branch on a runtime flag (`▸` = inside a `component`?).
  SSG builds a vnode tree (components deferred, not invoked); `decode` = `serialize(struct(v))`,
  coalescing `nota-ul-li`/`nota-ol-li` → lists, grouping paras/sections, stopping at component
  boundaries. Only reactive islands hydrate client-side.
- **macOS zsh:** `noclobber` (`>` fails on existing files — use `>|`); backticks in `git commit -m` run
  command substitution (use `-F`); Bash cwd resets each call (use absolute paths).

## Build status & method
The build is orchestrated wave-by-wave per `design/implementation.md` (Parts 1–5: reader, runtime,
vite plugin, cli/playground, IDE). Each feature ships with tests, green before the next phase.
