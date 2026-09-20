# Nota — orientation for Claude

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) whose Rust *reader*
compiles `.nota` files **directly to Solid JSX** — a document is a Solid component. Grouping
(paragraphs/lists/sections) happens at runtime in core's `<Reforest>` pass over the rendered
tree; cross-references resolve through the **unified anchor/ref registry** (one doc-state store;
headings/labels/figures/notes/cites are anchors and uses are refs). Facts have opaque, stable
locations assigned in registration order; their snapshot order is separate from identity. SSG
runs a **two-pass render** so forward references converge in the static bytes; interactive pages
hydrate through ordinary Solid hydration. The runtime is **Solid 2** (`solid-js` +
`@solidjs/web`; the `solid-js/web` and `solid-js/store` subpaths no longer exist — importing
them is a hard resolution failure, and the JSX types live in `@solidjs/web`). The pre-Solid
architecture (hyperscript `h`/`decode`, islands/replay, the react packages) is deleted;
`design/decode.md` is its archived spec.

## Read first
Most tasks need only this file + the package map. For architecture/emit work:
- **`design/solid.md`** — the current architecture spec (reforest tiers, doc-state, two-pass
  drivers, hydration, the host seam and start-mode SSG).
- **`design/references.md`** — the unified anchor/ref model (`&id` across kinds, note defs
  via `@Note[id]`, resolution-error policy).
- **`design/notation.md`** — surface syntax; its banner scopes the archived emit forms.
- Reader internals live with the code: **`oxc/NOTA_READER.md`**.

## Repo layout
- **`oxc/`** — fork of oxc (branch `nota`) hosting the reader, a **git submodule**. Commit inside
  `oxc/`, then bump the pointer in the main repo. Architecture: `oxc/NOTA_READER.md`.
- **`packages/*`** — the `@nota-lang/*` TypeScript packages, a **Depot** + pnpm workspace:
  - **core** — the Solid runtime: `<Reforest>` (SSR-chunk/DOM tree reconstruction + grouping),
    the doc-state store (opaque fact locations + an ordered snapshot), `render`/`hydrate` two-pass
    drivers, `NotaDoc`, smart punctuation, entities. The **host seam** for frameworks that own
    the render loop is `NotaDoc` **itself** — `notaRoute` is deleted, and a `.nota` default export
    is host-ready with no wrapper and no host cooperation. Four modes, chosen by what it finds:
    (1) an outer store in context — a driver (`renderDocument`/`hydrateDocument`) or an enclosing
    document — use it; (2) **server, no outer store** — prove its own fixpoint first
    (`proveDocFixpoint` over a thunk that re-instantiates `props.children`), so a document that
    never settles throws out of the host's `renderToString` instead of shipping seedless with exit
    0, then ship the converged seed through Solid 2's ambient head registry (`useHead`) and render
    against it; (3) **client, hydrating** — read the page's seed and re-register the identical tag
    so the registry *adopts* the server's element rather than inserting a second one; (4)
    otherwise (CSR, a client-side navigation) — a live unseeded store, since the page's snapshot
    describes another document. Hydration is detected with `sharedConfig.hydrating`. A page may
    hold several documents, so the head key and the element id carry the component's
    `getHydrationKey()`: `nota-doc-state:<hk>` and `<script type="application/json"
    id="nota-doc-state-<hk>">`. The unsuffixed `DOC_STATE_ID` remains the cli's
    (`docStateScript` writes it, `hydrateDocument` reads it). Budgets reach a document by two
    paths that do not overlap: `renderDocument` reads `Doc.notaRenderOptions` off the component,
    and the self-hosted path reads `setDocRenderDefaults({ maxPasses?, smart? })` — a
    **module-global** the vite transform emits, so the last compiled document to evaluate wins;
    explicit `<NotaDoc maxPasses= smart=>` props beat both. Cost: one render more than the
    document's fixpoint depth, worst case. `NotaDocState`, `shell.ts`, `route.ts` and the
    `doc-pass*` request channel are **gone**. `DocStateContext` has a `null` default (a
    default-less v2 context throws `ContextNotFoundError`) and `useOptionalDocState()` is safe
    with no owner at all. None of it imports a server framework.
  - **prelude** — the ambient stdlib: `Tex` (KaTeX→MathML), `CodeInline`/`CodeBlock` (sync
    shiki, armed parts→decorations), the reference family (`Heading`/`Toc`/`Ref`/`Label`,
    notes as anchors+refs, `Cite`/`Bibliography`, `Figure`/`Subfigure`/`Caption` as
    figure-kind anchors with derived ordinals, `Smallcaps`), the definition-tooltip system
    (per-doc banks; Floating UI places the open tooltip), and session-owned
    `lstset`/`mathset`/`secset`/`bibset` config.
  - **compiler** — sync shim over the in-process wasm reader, which **lives in this package**:
    `build.mjs` copies `oxc/target/js` → `src/generated/` (gitignored) and re-exports it raw as
    `@nota-lang/compiler/reader`. Also the single-sourced emit-surface constants
    (`CORE_RUNTIME_NAMES`, `FRAMEWORK_MODULES`/`FRAMEWORK_PACKAGES`, `DOC_EXPORT_NAME`,
    `LINE_CLASSIFIERS`) every other package derives its name-lists from. No subprocess backend,
    no separate wasm package.
  - **vite** — the `.nota` transform + `nota()` preset, which bundles its own
    `@solidjs/vite-plugin` instance (`{ extensions: [".nota"], ssr: true, solid: { hydratable: true } }`
    — v2 extensions carry the **dot**, and `hydratable` is restated because the plugin forces it
    off under vitest). Plus `@nota-lang/vite/start`: `notaStart({ nota?, start?, solid? })`
    composes `nota({ solid: false })` with `solid({ start, ssr: true, extensions })`. SolidStart
    is gone — its serving layer now lives in `@solidjs/vite-plugin`'s **start mode**, which has to
    be *the* JSX instance (it configures the environments and generates the entries), since
    exactly one may claim `.nota`. `maxPasses` is emitted twice into every compiled document, once
    per core seam: `Doc.notaRenderOptions = {…}` (read by `renderDocument`) and
    `setDocRenderDefaults({…})` imported from `CORE_RUNTIME_MODULE` (read by a self-hosting
    `<NotaDoc>`; module-global, last module to evaluate wins).
    **`@nota-lang/vite/file-routes`** makes `.nota` files route modules: `notaFileRoutes()`
    configures `filesystem-routing`'s standard `fileRoutes()` with document extensions and a
    `toRoute` callback. Documents are pages by extension; other files delegate to a fresh
    `PageFileSystemRouter` with the callback cleared, preserving built-in export analysis.
    The base plugin owns root-relative directories and scanning. Explicit module conventions
    and routers retain precedence. `filesystem-routing` is an **optional peer** — only that
    subpath imports it. Order it *after* `notaStart()`: its export-pruning transform is
    `enforce: "pre"` and must see compiled JS. Chrome around a document is a layout route
    (`routes/lectures.tsx` wrapping `routes/lectures/`), not a wrapper module. A **static** site
    adds the crawler itself — `prerender({ mode: "static" })` from `prerender-crawler/vite`;
    neither it nor `@solidjs/prerender` is a dependency here, because SSG is the site's policy,
    not the preset's. **Crawl serially** (`concurrency: 1`): `sharedConfig.context` is
    module-global in `@solidjs/web` and a lazy route's continuation resumes under whichever
    concurrent render installed it last, so `useHead` tags (a document's seed, but equally a plain
    `<Title>`) silently land in another page's `<head>`.
    Under a Vite `base`, seed the crawler with explicit base-prefixed `pages` carrying `filename`s
    (and `crawlLinks: false`) or the pages land under `dist/client/<base>/`; `announceRoutes` from
    `@solidjs/prerender` seeds routes nothing links to.
    Owns the **one-`solid-js`-per-page invariant** via `resolve.dedupe` (`DEDUPED_PACKAGES` = framework set +
    `SOLID_JSX_DIST_PACKAGES`). A new package that ships Solid-compiled JSX in its dist (like
    the retired paper/explorable) MUST join `SOLID_JSX_DIST_PACKAGES` — currently empty — or a
    host's derived `noExternal`/`optimizeDeps` lists silently miss it.
    It owns the **host's** singletons too (`dedupedPackages()`): every `@codemirror/*`,
    `@lezer/*`, `@solidjs/*` and `style-mod` found in the host's own `node_modules`, discovered per project
    rather than listed, since deduping a name the root cannot resolve turns a working import
    into an unresolved one (Vite sets the basedir to the root and does not fall back). The
    scopes are taken whole — a `Language`, a parser and a `Tag` are all compared by reference,
    so there is no line to draw inside them. `@solidjs` joined `SINGLETON_SCOPES` for the same
    reason (v2 split the framework across it: `@solidjs/signals` is the graph, `@solidjs/router`
    keys its navigation singleton by module identity, `@solidjs/meta` shares `@solidjs/web`'s head
    registry), but only `@solidjs/web` is deduped *unconditionally* — `@solidjs/signals` is a
    transitive dep nothing declares, and under pnpm the root often cannot resolve it. What dedupe cannot reach — a singleton nothing
    depends on *directly*, dragged in twice by two `lang-*` from different stores —
    `duplicateSingletons()` reports as a `buildEnd` warning naming both paths; the fix is for
    the host to make it a direct dependency. `@nota-lang/codemirror` peers the four it imports
    (`@codemirror/state|view|language`, `@lezer/highlight`) so the app owns that copy; a
    `link:`ed checkout still resolves from its own store, which is what the dedupe is for.
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
  - **playground** — browser editor; runs the language server in a Web Worker. Three
    load-bearing gotchas: repeat `vite-plugin-wasm` under `worker.plugins`; the worker entry must
    stay the bootstrap-queue in `src/lsp/worker.ts` (top-level-await module graphs drop early
    `initialize` messages otherwise); and `RenderedPane` must `queueMicrotask` its nested
    `render()` — `render` ends in a `flush()`, and flushing from inside an effect callback is a
    warning-and-no-op (`[FLUSH_IN_EFFECT_CALLBACK]`), so the preview is deliberately one microtask
    behind its input. The `assert` **alias** in `vite.config.ts` (→ `src/assert-shim.cjs`) is still
    required: `babel-preset-solid` 2 → `@dom-expressions/babel-plugin-jsx` →
    `@babel/helper-module-imports` does `require("assert")` and calls the module value. An
    identity test guards it; vitest alone cannot catch its removal (only the browser bundle does).
- **`examples/barnes-hut`** — a full explorable document (d3-math quadtree, Solid SVG plots)
  built by the cli, and the owner of its own interaction primitives (`src/inputs.tsx`,
  `src/layout.tsx` — formerly `@nota-lang/explorable`). **Not depot-managed**: `pnpm run check` +
  `pnpm test` (plain tsc/vitest); its document test builds through the cli's installed dist —
  rebuild `packages/cli` first. Its `.nota` setup block is the reference idiom for document-owned
  state under Solid 2: one `createStore` plus a draft-based `patch(fields)` helper (`createMutable`
  is gone). `createStore` and `omit` are **ambient**, so the setup block imports no Solid.
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

### Module strings and the generated preamble
- `@nota-lang/compiler` is the source of truth for the framework module strings:
  `SOLID_WEB_MODULE` (`"@solidjs/web"`) and `FRAMEWORK_MODULES`/`FRAMEWORK_PACKAGES`. Assert
  against those constants, never a literal — vite's dedupe/fallbacks, the cli's pinned-resolver
  regex and the language-server's ambient-signature test all derive from them, which is what made
  Solid 2's package split a one-line change in three places.
- The preamble generator (`src/preamble-gen.ts`) derives only the **name list** from the compiler;
  the *type declarations* are hand-written. A Solid **shape** change (two-phase `createEffect`, a
  new option bag, a changed return type) therefore needs a hand edit there — regeneration alone
  will not notice. The `ambient-signatures` snapshot is what flags it (it normalizes pnpm
  virtual-store paths, since e.g. `onCleanup` comes from `@solidjs/signals`, not a direct dep),
  and `buildPreamble` now fails on **extra** declarations as well as missing ones — the reverse
  direction was unchecked, which is how nine 1.x names survived a migration inside the preamble.

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
- **One `solid-js` per page is a correctness invariant** — and under Solid 2 that means one
  each of `solid-js`, `@solidjs/web` and `@solidjs/signals` (the reactive graph both observe
  through). A second bundled copy leaves `enableHydration()` uncalled in one of them, so
  hydration-context nesting is silently OFF. Symptoms: `TypeError: template is not a function`
  inside `Dynamic` (prod solid) or `Hydration Mismatch … <shallow key>` (dev solid). The
  production-artifact markers were re-cut for v2: `_$DX_DELEGATE` is **gone** (delegation is
  module-local now); the pins are `_$SOLID_EVENT_OWNER` (`@solidjs/web`) and `NoHydrateContext`
  (`solid-js`), each exactly once. Hydration keys are `_hk=…`, **unquoted** (1.x: `data-hk="…"`);
  every test normalizer strips the v2 form.
- **Vite's "is production" follows `process.env.NODE_ENV`; the mode only fills it when UNSET.**
  An ambient value (vitest's `"test"`, a CI stage's) ships solid-js's `development` export
  condition into production bundles — the cli pins NODE_ENV around builds; **any new build
  pipeline must too**. Failure marker: solid's "multiple instances of Solid" banner string in a
  built bundle (a production-artifact test pins its absence in cli), alongside
  `"reactivity-diagnostics"`.
- **Solid 2 rules** (each one cost a debugging session; all are reproduced by tests):
  - *Hydration-id parity.* Lifecycle primitives consume child ids on **both** sides — the server
    `onSettled` is a no-op that still burns one. Call it on one side only and every later id
    desyncs; the client tree detaches silently instead of erroring. (`useHead` costs no id.)
  - *No signal writes on the server.* They emit `[SERVER_WRITE]` ("deprecated, will become an
    error"); doc-state guards its `bump()` behind `isServer`.
  - *Batching is microtask-based.* `flush()` after a write before asserting in tests; `await` a
    microtask after events dispatched against a separately-built bundle. A write is **invisible to
    a same-turn read** — bypass the memo (`untrack` the underlying computation), do not `flush()`
    inside an effect (it throws / no-ops in dev).
  - *Effects sharing a trigger must be merged.* One write dirties both in one flush, so two
    effects that undo each other race; 1.x's sequential writes ordered them for free.
  - *Readers that `.map` to JSX need `<For>` or an `equals` memo.* `live()` is never
    identity-stable, and `trailers()` is a **shared** array — read it, never mutate it.
  - *Detached roots* (`runWithOwner(null, () => createRoot(…))`, prelude's `referenceModel`) need
    `createMemo(fn, { transparent: true })` during hydration, else "Cannot get child id from owner
    without an id".
  - *`useContext` throws `NoOwnerError` without an owner*, and a default-less context throws
    `ContextNotFoundError` — hence `createContext<T | null>(null)` everywhere it is read optionally.
  - *Component bodies are strict-read scopes.* `untrack` deliberate one-shot `children()`/props
    reads or they emit `STRICT_READ_UNTRACKED`.
  - *`createSignal(fn)` is a writable derived*, not function-valued state — box it.
  - *Nested `render()` inside an effect* → `[FLUSH_IN_EFFECT_CALLBACK]`; defer with `queueMicrotask`.
  - *ARIA attributes are string-typed* (`aria-hidden="true"`, not `{true}`).
  - *Hydration inserts empty text placeholders* into server-empty dynamic ranges — filter them out
    of zero-mutation assertions.
  - *`_$HY.done` flips via `setTimeout`* just after hydration, so `delete globalThis._$HY` between
    boots is load-bearing in tests.
  - *`vite preview` under start mode SSRs every request* (it boots `dist/server/server.js`) — it is
    not a static-host simulation; serve `dist/client` statically for byte-level smoke tests.
  - *The start-mode dev server answers only `Accept: text/html`*; a bare `curl` gets Vite's 404.
  - *Two `buildApp()` runs in one Node process* re-import a stale `dist/server/server.js` (ESM
    cache), so the crawler silently prerenders the first build. One build per process.
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
published. Published `peerDependencies` are `solid-js ^2.0.0-rc.8` + `@solidjs/web ^2.0.0-rc.8`
(exact pins stay in devDependencies; RCs move).

**Open decision — `@shikijs/langs`.** The cli's emit imports `@shikijs/langs/<lang>` for fenced
code, but the package is only a *devDependency* of `@nota-lang/cli`, so a consumer must install it
themselves or fenced code does not highlight. Found by `packaging.test.ts`; deliberately left as
is pending a call on promote-to-dependency vs. document-as-a-peer. (The same test also works
around pnpm 11 **ignoring `pnpm.overrides` in `package.json`** — the consumer fixture now puts its
overrides in a scratch `pnpm-workspace.yaml`, without which it was silently resolving published
1.x `@nota-lang/*` from the registry.)

## Build method
Packages are built in dependency order (reader → core/prelude → vite → cli/playground →
IDE tiers); every feature ships with tests, green before the next lands.
