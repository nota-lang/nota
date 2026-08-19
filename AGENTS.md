# Nota — orientation for Claude

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) whose Rust *reader*
compiles `.nota` files **directly to Solid JSX** — a document is a Solid component. Grouping
(paragraphs/lists/sections) happens at runtime in core's `<Reforest>` pass over the rendered
tree; cross-references resolve through the **unified anchor/ref registry** (one doc-state store;
headings/labels/figures/footnotes/cites are anchors and uses are refs). Facts have opaque, stable
locations; their snapshot order is separate from identity. SSG runs a **two-pass render** so
forward references converge in the static bytes; interactive pages hydrate through ordinary
Solid hydration. The pre-Solid
architecture (hyperscript `h`/`decode`, islands/replay, the react packages) is deleted;
`design/decode.md` is its archived spec.

## Read first
Most tasks need only this file + the package map. For architecture/emit work:
- **`design/solid.md`** — the current architecture spec (reforest tiers, doc-state, two-pass
  drivers, hydration, the Astro integration).
- **`design/references.md`** — the unified anchor/ref model (`&id` across kinds, footnote defs
  via `@Footnote[id]`, resolution-error policy).
- **`design/notation.md`** — surface syntax; its banner scopes the archived emit forms.
- Reader internals live with the code: **`oxc/NOTA_READER.md`**.

## Repo layout
- **`oxc/`** — fork of oxc (branch `nota`) hosting the reader, a **git submodule**. Commit inside
  `oxc/`, then bump the pointer in the main repo. Architecture: `oxc/NOTA_READER.md`.
- **`packages/*`** — the `@nota-lang/*` TypeScript packages, a **Depot** + pnpm workspace:
  - **core** — the Solid runtime: `<Reforest>` (SSR-chunk/DOM tree reconstruction + grouping),
    the doc-state store (opaque fact locations + an ordered snapshot), `render`/`hydrate` two-pass
    drivers, `NotaDoc`, smart punctuation, entities. Plus the **host seam** for frameworks that
    own the render loop (`route.ts`/`shell.ts`/`doc-pass.ts`): `notaRoute(Doc)` runs
    `collectDocState` and renders against that seed from *inside* the host's `renderToString`,
    parking the converged pass on a request-scoped channel for `NotaDocState` — placed after the
    app in the host's shell — to emit and convergence-check. None of it imports SolidStart.
  - **prelude** — the ambient stdlib: `Tex` (KaTeX→MathML), `CodeInline`/`CodeBlock` (sync
    shiki, armed parts→decorations), the reference family (`Heading`/`Toc`/`Ref`/`Label`,
    footnotes as anchors+refs, `Cite`/`Bibliography`, `Figure`/`Subfigure`/`Caption` as
    figure-kind anchors with derived ordinals, `Smallcaps`), the definition-tooltip system
    (per-doc banks, zero framework JS), and session-owned
    `lstset`/`mathset`/`secset`/`bibset` config.
  - **compiler** — sync shim over the in-process wasm reader, which **lives in this package**:
    `build.mjs` copies `oxc/target/js` → `src/generated/` (gitignored) and re-exports it raw as
    `@nota-lang/compiler/reader`. Also the single-sourced emit-surface constants
    (`CORE_RUNTIME_NAMES`, `FRAMEWORK_MODULES`/`FRAMEWORK_PACKAGES`, `DOC_EXPORT_NAME`,
    `LINE_CLASSIFIERS`) every other package derives its name-lists from. No subprocess backend,
    no separate wasm package.
  - **vite** — the `.nota` transform + `nota()` preset, plus `@nota-lang/vite/solid-start`
    (`notaStart()`: the SolidStart v2 preset, an optional peer — it composes `nota({solid:false})`
    with `solidStart({extensions:["nota"]})`, since exactly one vite-plugin-solid may claim
    `.nota`). That preset does NOT offer file-system routing over `.nota`: SolidStart's router
    parses route files as TSX to find their exports, so a `.nota` under `routeDir` is dropped.
    Owns the **one-`solid-js`-per-page invariant** via `resolve.dedupe` (`DEDUPED_PACKAGES` = framework set +
    `SOLID_JSX_DIST_PACKAGES`). A new package that ships Solid-compiled JSX in its dist (like
    the retired paper/explorable) MUST join `SOLID_JSX_DIST_PACKAGES` — currently empty — or a
    host's derived `noExternal`/`optimizeDeps` lists silently miss it.
  - **cli** — `nota build doc.nota → doc/`: two programmatic vite builds (SSR render, then
    client) with NODE_ENV pinned; pins `FRAMEWORK_PACKAGES` resolution so a doc builds anywhere;
    links CSS in hydrating builds; zero-JS output for island-free docs.
  - **language-server** — Volar server: virtual `.tsx` + CodeMappings back to `.nota`. The
    reader's offsets are UTF-8 **bytes**; `src/byte-offsets.ts` is the one byte→UTF-16
    converter, applied at the Volar mapping boundary, diagnostics, and semantic tokens. The
    typing preamble is generated (`npx tsx scripts/gen-preamble.ts`) — **regenerate after any
    emit-surface or prelude-surface change**; the `preamble-sync` test catches drift (and a
    merge of `preamble.generated.ts` is ALWAYS suspect — regenerate, don't hand-resolve). Two
    flavors over `server-core.ts`: node/stdio (eglot launches this) and a browser worker
    (playground).
  - **codemirror** — CM6 support, reader-driven: paints shared `analyze()` spans as decorations;
    embedded code/math sub-tokenize via CM's parsers. The wasm module instantiates when the
    module graph loads — there is no consumer `init` step.
  - **playground** — browser editor; runs the language server in a Web Worker. Two load-bearing
    worker gotchas: repeat `vite-plugin-wasm` under `worker.plugins`, and the worker entry must
    stay the bootstrap-queue in `src/lsp/worker.ts` (top-level-await module graphs drop early
    `initialize` messages otherwise).
- **`examples/barnes-hut`** — a full explorable document (d3-math quadtree, Solid SVG plots)
  built by the cli, and the owner of its own interaction primitives (`src/inputs.tsx`,
  `src/layout.tsx` — formerly `@nota-lang/explorable`). **Not depot-managed**: `pnpm run check` +
  `pnpm test` (plain tsc/vitest); its document test builds through the cli's installed dist —
  rebuild `packages/cli` first.
- **`editors/emacs/`** — `nota-mode.el`: conservative "never lie" font-lock tier + native
  embedded JS/TS fontification + eglot wiring. Tests (ERT, batch): `nota-mode-test.el`,
  `eglot-smoke.el`, and `conformance.el` (every `nota-*` face must be justified by a reader
  highlight span; needs the built `@nota-lang/compiler`).
- `references/` — external reference repos; gitignored.

## Tooling

### Depot / JS tests
- Per-package: `cd packages/<pkg> && depot test` (= type-check + biome lint + vitest).
  `--no-fullscreen` (pipeable output) is a **global** flag: `depot --no-fullscreen test`.
  Whole-workspace `depot test` from the repo root works and is what CI runs (verified
  2026-08-17); prefer per-package runs while iterating. Never run two packages' suites
  concurrently yourself — they consume each other's `dist/` and race on rebuilds.
- Fix biome issues with `node_modules/.bin/biome check --write src tests` from the package dir.
  Depot can exit 0 while still printing format errors — read the output, not just the code.
- True exit codes: **redirect, don't pipe** — `cmd >/tmp/o 2>&1; echo $?`.

### The Rust reader (`oxc/`)
- Reader entry: `oxc/crates/oxc_parser/src/nota/mod.rs` (highlight pass: sibling
  `highlight.rs`; lexer scans: `../lexer/nota.rs`). AST: `oxc_ast/src/ast/nota.rs`; lowering:
  `oxc_transformer/src/nota/`; parse+lower entry: `oxc/crates/oxc/src/nota.rs`; e2e goldens:
  `oxc_codegen/tests/integration/nota.rs`.
- Compile one file: `cd oxc && cargo run -q -p oxc --example nota_compile --features codegen --
  ../<f>.nota` (debug microscope: `--example nota_inspect`).
- Reader tests: `cargo test -p oxc_codegen --test integration nota` (exact emit + validity),
  `cargo test -p oxc_transformer --lib nota`, `cargo test -p oxc_parser --lib nota`, and
  `cargo test -p oxc --features codegen nota` (**without `--features codegen` that package runs
  ZERO tests**).
- `just ast` (regenerate `#[ast]` code) **always exits 101 here** — it panics on a missing
  `oxfmt`, but the Rust regen is complete. Verify with `cargo build -p oxc_ast`. (Adding an AST
  variant: memory `nota-oxc-add-expression-variant.md`.)

### Build artifacts — the stale-output trap (this repeatedly cost hours)
A reader change is invisible to JS until the artifact chain rebuilds. Canonical:
**`cd oxc && just nota-build`** → `oxc/target/js`, then **`cd packages/compiler && depot
build`** (the copy into `src/generated/` happens only at compiler build time). JS packages
consume each other's **built `dist/`, not `src/`** — after editing pkg A, `depot build` it
before pkg B's tests can see the change. Symptoms of forgetting: a fix that "doesn't take", or
an example/e2e asserting features the stale dist predates.

## Gotchas & domain facts
- **Known reader bugs** live in the `#[ignore]`'d tests in `integration/nota.rs` — check there
  before re-fuzzing. Feature mega-test: `integration/mega.nota`.
- **One `solid-js` per page is a correctness invariant** — a second bundled copy leaves
  `enableHydration()` uncalled in one of them, so hydration-context nesting is silently OFF.
  Symptoms: `TypeError: template is not a function` inside `Dynamic` (prod solid) or
  `Hydration Mismatch … <shallow key>` (dev solid).
- **Vite's "is production" follows `process.env.NODE_ENV`; the mode only fills it when UNSET.**
  An ambient value (vitest's `"test"`, a CI stage's) ships solid-js's `development` export
  condition into production bundles — the cli pins NODE_ENV around builds; **any new build
  pipeline must too**. Failure marker: solid's "multiple instances of Solid" banner string in a
  built bundle (a production-artifact test pins its absence in cli). Under SolidStart the
  inverse also bites: `NODE_ENV=development` makes the Nitro prerender emit ZERO routes and
  still exit 0.
- **Markup must parse back to the tree it describes.** HTML tree construction is not a no-op:
  text in table structure is foster-parented out, and bare `<tr>`s gain an implicit `<tbody>`.
  The reader's lowering compensates for both (`oxc_transformer/src/nota/lower.rs`) — a document
  that emits markup the parser rearranges hydrates into a torn page.
- **macOS zsh:** `noclobber` (`>` fails on existing files — use `>|`); backticks in
  `git commit -m` run command substitution (use `-F`); Bash cwd can reset between calls (use
  absolute paths).

## Releasing
Distribution is **npm** (`@nota-lang/*`). The ritual: file a PR titled `vX.Y.Z` labeled
**`release`** → `pre-release.yml` dry-runs the publish → merging triggers `release.yml`
(`pnpm -r publish --access public`). Version is stamped in CI from the PR title — no bump
commits; in-repo versions are placeholders. `pnpm publish` rewrites `workspace:*` deps at pack
time. Publishes the **6 non-private packages** (cli, codemirror, compiler, core, prelude, vite
— the wasm reader ships *inside* `@nota-lang/compiler`'s
`dist/generated/`); language-server and playground are private; `examples/` are never
published.

## Build method
Packages are built in dependency order (reader → core/prelude → vite → cli/playground →
IDE tiers); every feature ships with tests, green before the next lands.
