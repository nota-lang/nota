# Nota — orientation for Claude

> **Branch `solid`:** this branch runs the Solid-only specialization —
> **`design/solid.md` supersedes decode.md here.** The reader (oxc branch `solid`) emits Solid
> JSX natively; `<Reforest>` + the doc-state store replace decode/islands/replay;
> runtime/react/react-router are deleted; paper + playground are ported. The description below
> documents master. Solid-branch additions (2026-08-16):
>
> - **`packages/astro` — `@nota-lang/astro`**, the site-builder integration (Astro chosen over
>   SolidStart/vike: its renderer API is exactly the (renderToString, hydrate) delegation the
>   two-pass driver needs — a framework-owned single-pass render would ship pass-1 HTML). The
>   server entry runs `renderDocument({renderId})` per island, snapshot rides an island
>   attribute; client entry `hydrateDocument({renderId, seed, root})`; a directive-less `<Doc/>`
>   renders through `NoHydration` → zero-JS. `check()` dispatches on the vite transform's
>   `Doc.isNotaDoc` brand (exact, no try-render). Its e2e runs a real `astro build`; the live
>   consumer is nota-lang.org branch `astro` (see that repo's AGENTS.md — linked-checkout dev
>   has its own gotcha list there).
> - **One `solid-js` per page is a correctness invariant** — the vite preset's `resolve.dedupe`
>   enforces it. A second bundled copy leaves `enableHydration()` uncalled in one of them, so
>   hydration-context nesting is silently OFF and claiming misses. The cryptic symptoms to
>   recognize: `TypeError: template is not a function` inside `Dynamic` (prod solid) or
>   `Hydration Mismatch. Unable to find DOM nodes for hydration key: <shallow key>` (dev solid).
> - **Vite's "is production" follows `process.env.NODE_ENV`; `mode` only fills it when UNSET.**
>   An ambient value (vitest's `"test"`, a CI stage's) flips solid-js's `development` export
>   condition into shipped bundles — the CLI pins NODE_ENV around its builds for this reason;
>   any new build pipeline must too. (Marker of the failure: solid's "multiple instances of
>   Solid" banner string present in a production bundle.)
> - **Astro's `dev`/`preview` are managed daemons.** After rebuilding dists here, run `npx astro
>   dev stop` in the consumer — a daemon started earlier keeps serving the old integration/dists
>   (symptom: a bug you just fixed persists). Logs live in the consumer's `.astro/dev.log`.

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
  - **prelude** — the standard ambient prelude: `Tex` (KaTeX→MathML; `mathset({output:"html"})`
    opts into HTML output) + `CodeInline`/`CodeBlock` (sync shiki, armed parts→decorations) as
    registry slots, the doc-state family (`Heading`/`Toc`/`Label`/`Ref`/footnotes/`Cite`/
    `Bibliography`), the **definition-tooltip system** (`Definition`/def-aware `Ref`/`texRef` +
    a vanilla-JS tooltip trailer — zero framework JS; `src/def.ts`), plus
    `lstset`/`mathset`/`secset`/`bibset` config (doc-global, reset per render, bakeable baseline).
  - **compiler** — sync shim (`src/lib.ts`) over the in-process wasm reader, which **lives in this
    package**: `build.mjs` copies the wasm-bindgen build (`oxc/target/js`) into `src/generated/`
    (gitignored) and `src/reader.ts` re-exports it raw as `@nota-lang/compiler/reader`. No subprocess
    backend, no env-var overrides, and **no separate wasm package** — every other package that wants
    the reader (codemirror's `highlight`, the playground's `parseAst`) imports that subpath.
    Entries: `compile` (emit) / `compileVirtual` (Volar `.tsx`) / `highlightSpans`.
  - **react** / **solid** — adapter bindings (`h`/Fragment/decode/hydrate/SSR). **solid has no own
    tests**; both adapters are driven by the conformance matrix in `packages/react/tests/`.
  - **react-router** — the React Router integrator: `NotaDoc` (route component bridging
    `render(Doc)` + scoped replay hydration; hook order is load-bearing — the doc render nests a
    `renderToString` that clears the hook dispatcher), `docMeta`, and the
    `@nota-lang/react-router/vite` `notaRouteModules` transform (a `.nota` under `/pages/`
    becomes a route module — rewrites the emit's `export default function Doc(` and appends the
    NotaDoc default + derived `meta`). Consumed by nota-lang.org.
  - **vite** — `.nota` transform plugin + island registry (`registry.ts:generateClientEntry`).
  - **cli** — `nota build doc.nota → doc/` (`index.html` + `assets/`): two programmatic **vite**
    builds under a default config — SSR render, then a client island build — so doc-relative
    imports/`?url`/CSS work; zero-JS for island-free docs (`build.ts`).
  - **language-server** — Volar server: virtual `.tsx` + `CodeMapping`s back to `.nota`. Two
    flavors over one transport-agnostic core (`server-core.ts`): **node/stdio** (`server.ts` →
    `bin.ts`; eglot/vscode launch this) and **browser worker** (`browser.ts`: postMessage
    connection, in-memory fs serving `/tsconfig.json` + TS default libs *by basename* — the typing
    preamble already made resolution disk-free). The browser flavor is e2e-tested from node over
    `globalThis.MessageChannel` (`tests/browser-server.test.ts`) and consumed by the playground.
  - **vscode-nota** — LSP client + TextMate grammar (`syntaxes/nota.tmLanguage.json`, a conservative
    **"never lie" grammar**: single-line `match` rules + line-anchored fences only, the
    honest first paint before the LSP semantic tokens arrive). **No depot/vitest**; tests run via
    `pnpm run test:all` = `vscode-tmgrammar-test` caret fixtures (`tests/*.test.nota`) **plus** a node
    subset-correctness conformance test (`tests/conformance.ts` → `pnpm run test:conformance`) that
    runs the compiled grammar over `integration/*.nota` and asserts every Nota-scoped token agrees
    with the reader's `highlightSpans` kind (needs the node wasm `pkg-node` + `@nota-lang/compiler`).
  - **paper** — components for academic writing: the `language()`/`Bnf` grammar DSL (per-kind
    `Definition` anchors, `texRef`-wired handles), `inferRule`/`IR` inference rules, and paper
    scaffolding (`Title`/`Authors`/`Abstract`/`Figure`+auto-numbered `Caption`/`Smallcaps`/`Wrap`)
    + `paper.css`. Consumed by nota-lang.org's example documents.
  - **codemirror** — CM6 language support for Nota (no CM grammar exists — reader-driven:
    `notaHighlighting()` paints the wasm `highlight()` spans as decorations, embedded code/math/`@style`
    interiors sub-tokenize via CM's own parsers, one shared Catppuccin `HighlightStyle`; see
    `oxc/NOTA_READER.md` §Highlighting). Wasm **init is consumer-side** (`init(url|bytes)` before
    installing). Consumed by the playground; later the website.
  - **playground** — browser editor (CM6 via `@nota-lang/codemirror`); consumes the **wasm** reader,
    not the binary. Runs the **language server in a Web Worker** (`src/lsp/worker.ts` boots
    `@nota-lang/language-server/browser`; `src/lsp/client.ts` bridges it to `@codemirror/lsp-client`
    over a string⇄structured-clone postMessage transport) — TS diagnostics/hover/completion in the
    editor; highlighting stays reader-driven. Two worker gotchas, both load-bearing: the worker
    bundle needs `vite-plugin-wasm` repeated under `worker.plugins` (workers get a separate plugin
    pipeline), and the worker entry MUST be the tiny bootstrap-queue in `src/lsp/worker.ts` — the
    wasm ESM import makes the module graph top-level-await, the browser enables message delivery at
    the first suspension, and a client's early `initialize` is silently dropped before Volar's
    `listen()` attaches `onmessage` (symptom: every LSP request times out).
- **`editors/emacs/`** — `nota-mode.el`: conservative "never lie" font-lock tier (transliteration of
  the old tmLanguage; fences suppressed via `syntax-propertize` string-quotes), native embedded
  JS/TS fontification for `%`-lines and `%%%`/```ts fences (org-src-style hidden-buffer face copy —
  the Emacs analogue of the tmLanguage's source.ts delegation), + eglot wiring for the
  language server. Not an npm package. Tests: `emacs -Q --batch -L editors/emacs -l
  editors/emacs/tests/nota-mode-test.el -f ert-run-tests-batch-and-exit` (ERT),
  `... -l editors/emacs/tests/eglot-smoke.el` (e2e against the built server), and
  `... -l editors/emacs/tests/conformance.el` (never-lie subset-correctness: every nota-* face
  over `integration/*.nota` must be justified by a reader highlight span — needs the built
  `@nota-lang/compiler` + node).
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
A reader change is invisible to JS until you rebuild the artifact that consumes it. Canonical wasm
build: **`cd oxc && just nota-build`** → `oxc/target/js` (one **bundler-target** wasm-bindgen build,
isomorphic; consumers need `vite-plugin-wasm` for its `.wasm` ESM import).
- That out-dir is **vendored into `@nota-lang/compiler`**, not a workspace member: `depot build` in
  packages/compiler runs `build.mjs`, which `cpSync`s `oxc/target/js` → `packages/compiler/src/generated/`
  (gitignored via the package's own `.gitignore`; excluded from biome; copied to `dist/generated/`
  because depot ships `.wasm` as an asset). So after a reader change: `just nota-build`, **then**
  `cd packages/compiler && depot build` — the copy only happens at compiler build time.
- JS packages consume each other's **built `dist/`, not `src/`** — after editing pkg A,
  `cd packages/A && depot build` before pkg B / a cross-package test sees the change.

## Gotchas & domain facts
- **Known reader bugs** live in the `#[ignore]`'d tests in `integration/nota.rs` — check
  there before re-fuzzing/repro'ing. Feature mega-test: `integration/mega.nota`.
- **decode model:** `h`/`Fragment`/`decode` branch on a runtime flag (`▸` = inside a `component`?).
  SSG builds a vnode tree (marked components deferred, not invoked; a *plain* function tag is a
  **static template** `struct` expands eagerly); `decode` runs the pipeline ending in
  `serialize(struct(…))`, coalescing `nota-ul-li`/`nota-ol-li` → lists, grouping paras/sections,
  stopping at component boundaries. Only reactive islands hydrate client-side (by **replay
  hydration** — the client re-executes the document; see decode.md).
- **macOS zsh:** `noclobber` (`>` fails on existing files — use `>|`); backticks in `git commit -m` run
  command substitution (use `-F`); Bash cwd resets each call (use absolute paths).

## Releasing
Distribution is **npm** (`@nota-lang/*`). The ritual: file a PR titled `vX.Y.Z` labeled
**`release`** → `pre-release.yml` dry-runs the publish (build + stamp + `pnpm -r publish
--dry-run`) → merging triggers `release.yml`, which publishes for real (`pnpm -r publish --access
public`, `NPM_TOKEN` secret). Version is stamped in CI from the PR title (`pnpm -r exec npm pkg
set version=…`) — no bump commits; the in-repo versions are placeholders. `pnpm publish` rewrites
`workspace:*` deps to the stamped version at pack time, so there are no pack/rewrite scripts.
Publishes every non-private workspace package: the 8 `packages/*` libs (the wasm reader ships
*inside* `@nota-lang/compiler`'s `dist/generated/`; language-server/playground/vscode-nota are
private). The vsix is **not** part of the
release pipeline for now — `packages/vscode-nota/scripts/package-vsix.mjs` still builds one
locally (esbuild-bundles client + server with the wasm reader JS inlined and its `.wasm` bytes
next to the bundle, LSP-handshakes it, `vsce package --no-dependencies`).

## Build method
Packages are built in dependency order (reader → runtime/adapters → vite → cli/playground → IDE);
every feature ships with tests, green before the next lands.
