# Nota full-codebase review — 2026-08-17

> **Status (same day, late):** all ten behavioral bugs in §Suggested-order items 1–2 are FIXED
> and committed (oxc 03af7eb81; main ae1d0d2..e40cf9d), each red-green verified with regression
> tests. Corrections found during fixing: the Footnote half of the C-HIGH stale-capture finding
> was WRONG — Solid wraps JSX prop expressions in live getters, so only Heading's plain
> `const i` capture was real (FootnoteSup refactored to handle-based anyway, for robustness);
> and the playground fix deliberately widened default-import handling (resolves `mod.default`
> instead of the old pointed error — worth a second look). The `unified-references` merge
> (663c742) then superseded the prelude doc-state fixes with its by-`pos` model (immune to the
> whole re-sequencing bug class; wave-2's regression tests kept and passing) and its paper
> rewrite (figures as anchors, derived ordinals) addresses the paper Caption duplication note.
> Items 3–5 (prose sweep, debt burn-down, product calls) remain open; re-check §G's CLAUDE.md
> items against the post-merge tree before acting.

Seven parallel review passes over the post-Solid-landing tree: oxc parser tier, oxc
lowering/API tier, core+prelude, compiler/vite/cli/astro, language-server,
codemirror/playground/emacs, and a cross-cutting duplication/staleness sweep. This file is
the complete findings record; the conversation summary is the curated version.

Verdict in one line: the live code is in good shape and the 2026-08 single-sourcing audit
genuinely held; the debt is concentrated in (a) ~10 real behavioral bugs found along the
way, (b) three half-finished consolidations, and (c) a thick layer of decode-era prose —
comments and orientation docs describing the deleted architecture, including CLAUDE.md
itself.

---

## A. oxc — parser tier (lexer, parser, highlighter, AST)

- [med] [stale comment] `oxc/crates/oxc_ast/src/ast/nota.rs:3-7` — module doc still says nodes are
  "lowered to hyperscript `h`/`Fragment`/`decode` calls" and cites design/decode.md as the runtime
  spec. Same claim in `oxc_ast/src/ast/js.rs:167` and `oxc_parser/src/nota/mod.rs:5-6`.
- [med] [stale comment] `oxc_ast/src/ast/nota.rs:522,590-597` — emit-table docs contradict the current
  emit: `NotaListKind` documents `nota-ul-li`/`nota-ol-li` custom elements (now `<UlLi>`/`<OlLi>`),
  and every `NotaDocStateKind` variant documents a hyperscript emit (`h(Label, …)` etc.).
- [med] [stale comment] `oxc_ast/src/ast/nota.rs:575` — docstate label charset doc claims
  `[A-Za-z_][A-Za-z0-9_.:-]*`; the implementation allows digit-start and excludes `.`
  (`lexer/nota.rs:475-484`, test-pinned "Typst minus period").
- [med] [stale comment] `oxc_parser/src/nota/mod.rs:1152-1155` — banner says "the runtime `struct`
  pass does list/paragraph/section grouping"; that's the mothballed decode runtime, grouping is
  Reforest now.
- [med] [stale doc] `oxc/NOTA_READER.md` fork-seam item 2 — claims a `nota_markup` bool on
  `ParserImpl` is "the entire @-vs-decorator disambiguation"; no such field exists (the hook is
  `Kind::At if self.source_type.is_nota()` in `js/expression.rs:244`). The seam doc misdescribes the
  seam it tells maintainers to preserve.
- [med] [code smell] `oxc_parser/src/nota/mod.rs:369-420` — `parse_element` threads three mutually
  exclusive continuation states as separate flags (`self_closing_end`, `verbatim_start`,
  `colon_body`); a `Continuation` enum would make exclusivity type-enforced.
- [med] [leaky abstraction] `oxc_parser/src/nota/highlight.rs` — the AST records no delimiter/trigger
  geometry, so the highlighter re-derives it from raw bytes with parser-coupled invariants enforced
  only by comment (`find_verbatim_open:226-237`, the `else`/`of` scans at 539-541/555-557 re-deriving
  `else_peek` minus its rules, escape reconstruction at 413-419, the `@(` back-scan at 513-519).
  Sound today; silent drift risk; delimiter spans on the AST would kill the class and the planned
  formatter wants them anyway.
- [low] [incomplete consolidation] `oxc_parser/src/lexer/nota.rs:793-803` — `line_classifier_sources()`
  covers only the 7 regex classifiers; the thematic break (`thematic_break_at:818`) is invisible to
  it, so editor line tiers can't transliterate `---` without hand-copying.
- [low] [duplication] `lexer/nota.rs` — the code/math scan mirror pair
  (`find_backtick_close:1231`/`find_dollar_close:1343`, `scan_fenced_code:1250`/`scan_dollar_fence:1367`)
  is ~120 structurally identical lines diverging in two documented rules; mirror held by comments +
  tests only. Smaller clones: `parse_label_sugar`/`parse_ref_sugar` (mod.rs:1294-1330),
  `parse_code_or_literal`/`parse_math_or_literal` (mod.rs:1554-1594), classify-push-clamp ×4 in
  `highlight.rs:758-806`.
- [low] [dead code] `mod.rs:138` — `finish_nota<T>` generic with one call site passing `()`.
- [low] [stale comment] `highlight.rs:968` — cites "TODO.md bug 7"; TODO.md no longer exists.
- [low] [stale comment] `mod.rs:588` — "so `parse_body` can consume it" (function is
  `parse_braced_body`); stray trailing "x" at 526.
- [low] [code smell] `mod.rs:1078` — `assert!(self.eat(Kind::If))` where file convention is
  `debug_assert!`.

Seam verdict: upstream footprint checked and genuinely minimal (one match arm, five cursor methods,
six seek/bound entries, six Kinds, three lib.rs entries + recovery struct, six diagnostics, one
state field, standard oxc_ast add-a-variant set). No Nota logic leaks into upstream parse paths.

## B. oxc — lowering/API tier (transformer, compile entry, wasm, examples, integration tests)

- [HIGH] [broken tooling] `crates/oxc/examples/nota_inspect.rs:101` — `check_validity` re-parses the
  emit without `.with_jsx(true)`/`.with_typescript(true)`; verified live: reports "✗ did NOT
  re-parse" for `@p{hi}`. The fuzzing microscope's validity stage says ✗ for essentially every
  document. Fix before the next fuzz pass.
- [HIGH] [stale docs] `crates/oxc/src/nota.rs:6,38-40,96,374-378` — compile-entry docs narrate the
  hyperscript emit: `free_names` doc claims `h`/`decode`/`Fragment` "always appears" (directly
  contradicted by the test at 831-836 asserting absence); `compile_virtual` instructs Volar to
  prepend an import from the deleted `@nota-lang/runtime`.
- [med] [stale docs] `oxc_transformer/src/nota/mapping.rs:6-8,31,38-40` — module doc describes the
  retired emit end-to-end; `PropsAnchor` doc says "inside the props object literal `{ | }`" but the
  join now targets JSX attribute position (nota.rs:603-612).
- [med] [dead code] `crates/oxc/src/nota.rs:193-197,248-255` — `CompileConfig.lenient_diagnostics`
  never changes behavior (only read when `!recover`; callers pass lenient=recover always).
- [med] [dead code / product call] `crates/oxc/src/nota.rs:405-545` — the `--virtual` JSON subprocess
  protocol (~140 lines of hand-rolled JSON writers + tests) has no production consumer (shim is
  wasm-in-process); NOTA_READER.md:224-232 still frames it as the LS contract; the JSON writer is
  duplicated a third time in `nota_inspect.rs:432` with a wrong attribution comment.
- [med] [stale docs] `nota_inspect.rs:10,13,28-29,130` — header cites a nonexistent
  `packages/cli/scripts/inspect.ts` consumer, the deleted runtime + islands, and claims "parse as
  plain mjs / embedded TS out of scope" (false: `SourceType::nota()` is TS-aware).
- [med] [stringly sentinel] `oxc_transformer/src/nota/lower.rs:538-540` + `build.rs:301-313` — list
  items lower via magic strings `"nota-ul-li"`/`"nota-ol-li"` that `build_element` matches back into
  `UL_LI`/`OL_LI`; no shared constant; vestigial indirection. Side effect: a user's literal
  `@nota-ul-li{x}` silently lowers to `<UlLi>`.
- [med] [wasm doc drift] `napi/nota/src/lib.rs:73,243-247` — `compileVirtual` JS-signature doc omits
  the `errors` field the recovery path exists for; `NotaMappedResult` doc claims it serves
  compileVirtual (different struct).
- [med] [native↔wasm drift] sourcemap channel never crosses the boundary: native
  `compile_with_mappings` takes `source_map_path`/returns `map`; both wasm wrappers hardcode `None`
  (napi lib.rs:191,235). Deliberate future surface or dead plumbing — make the call explicit.
- [med] [test smell] `oxc_codegen/tests/integration/nota.rs` — triplicated no-validity harness
  (1492, 2386, 2548); `reparses` (2397,2559) omits `.with_typescript(true)` that `assert_valid_js`
  (124) has — two definitions of "valid"; `doc_parses_tsx` (2588) byte-identical to `doc_parses`;
  `nota_expr_tsx` near-duplicates `nota_expr_raw`.
- [low] [dead param] `build.rs:479` — `raw_quasi`'s `tail: bool` always `true`.
- [low] [passthrough] `build.rs:618-624` — `jsx_string_safe` is a one-liner over `is_jsx_attr_inert`.
- [low] [stale comments] `lower.rs:168` ("return Fragment(...rest)"), `lower.rs:33` ("the runtime
  imports"), `scribble.rs:33` ("decode.md §struct"), integration comments at 1009/1023-24/2574.
- [low] [stale comments] integration nota.rs:2372,2536-37 point at `packages/solid/tests/…` (now
  core); banner at 2530 ("currently-FAILING") contradicts mod doc ("suite stays green").
- [low] [anchor breach] `build.rs:443-449` + `lower.rs:390-391,406` — `Span::empty(0)` anchors
  despite build.rs:77-80's "anchored at the source construct" rule; their sourcemap entries point at
  byte 0.
- [low] [stringly re-key] `napi/nota/src/lib.rs:401-418` — `line_classifiers()` re-keys the parser's
  array via `get("percentLine").expect(...)` string lookups; a struct-shaped source would make
  renames a compile error, not a wasm runtime panic.
- [low] [near-vacuous test] integration nota.rs:2994 — asserts emit contains `"ZZZ"` (the user's own
  literal); the guarded-against shape isn't asserted absent.
- [low] [stale doc] `NOTA_READER.md:43,184,224` — wasm path listed as `napi/nota_wasm` (actual
  `napi/nota`); reserved-name list omits `Show`/`Attrs`/`Heading`/prelude group; `--virtual`
  framing stale. Also nondescript test module name `mod h1_h2` (nota.rs:914).

## C. core + prelude

- [HIGH] [bug] `packages/prelude/src/doc-state.tsx:198` — `Heading` captures `const i = handle.seq-1`
  once, but `unregister()` re-sequences `handle.seq` on unmount (core doc-state.ts:144-147), so after
  an earlier heading unmounts, `id()`/`num()` read a neighbor's slot — every later heading renders
  wrong id/number. Same stale capture in `Footnote`/`FootnoteMark` (`index={handle.seq-1}` evaluated
  once, doc-state.tsx:480,497). Contradicts the design's live-renumbering headline; no prelude test
  exercises unmount-before-later-consumer. Fix: read `handle.seq` lazily.
- [HIGH] [bug] `packages/prelude/src/def.tsx:139` — tooltip handler resolves the bank with
  `document.querySelector(".nota-def-tooltips")` — first bank on the page wins; on multi-document
  (Astro islands) pages every doc after the first silently loses tooltips. Fix:
  `anchor.closest("article.nota-doc")?.querySelector(...)`.
- [med] [duplication + bug] five divergent SSR opening-tag sniffers: `core/src/reforest.tsx:136`
  (`categorize` — `([^>]*)` breaks on `>` inside quoted attrs; `includes(ATTRS_MARKER)` can
  false-positive on text), reforest.tsx:167 (`extractAttrs`, quote-aware), `core/src/smart.ts:205`
  (quote-aware), `prelude/src/code.tsx:137` (double-quote-only), `prelude/src/doc-state.tsx:72`
  (class sniff). One shared `parseOpeningTag(chunk) → {tag, attrs}` in core fixes the drift and the
  categorize truncation bug.
- [med] [duplication] `prelude/src/doc-state.tsx` — heading-model triple
  (`read("heading")` + `headingIds` + `headingNumbers`) copy-pasted in Heading (199-201), Toc
  (240-242), Ref (354-356); O(n²) across headings per version bump; `Ref.target()` called 4× per
  render (380-391) re-running the duplicate-definition check each time; `footnoteNumbers` likewise
  recomputed per FootnoteSup and again in FootnotesList. Extract a memoized `headingModel(state)`.
- [med] [stale comment] `prelude/src/lib.ts:13-14` — claims CodeBlock "decorations are a flagged v0
  regression"; code.tsx:8-13 implements restored decorations and tests pin them.
- [med] [smell] `prelude/src/doc-state.tsx:100` — `FACT_KINDS` advertises "one named copy… import
  instead of re-typing" but the defining module registers/reads with raw strings everywhere
  ("heading" 193/199/354, "label" 296/341, "footnote" 444/477/496, "footnote-text" 515/534, "cite"
  673/676/732); only `.definition` uses the constant.
- [med] [dead code] `prelude/src/doc-state.tsx:758` — `counters` primitive has zero non-test
  consumers; its intended consumer (paper's Caption) reimplements the count inline
  (scaffold.tsx:131-139). Use it there or delete. Doc also references renamed param `resetOn`.
- [low] [stale terms] `core/src/render-reset.ts:11-13`, `core/src/render.tsx:143`,
  `core/tests/hydrate.test.tsx:238` — "replay"/"island" used for ordinary Solid hydration and
  Astro-hosted docs; `reforest.tsx:215` cites "decode.md's producer contract" (now solid.md).
- [low] [module state, verified benign] `code.tsx:85` highlighter cache keyed by grammar/theme names
  only (re-registered same-named grammar serves stale compile); `code.tsx:108` `warned`;
  `def.tsx:111` `handlersInstalled`. None affects rendered bytes; config.ts is correctly registered.
- [low] [asymmetry] `core/src/render.tsx:96-104` — `DOC_STATE_ID` fixed; multi-doc pages embed
  duplicate `id="nota-doc-state"` scripts and default `readPageSeed` grabs the first; no per-renderId
  state-script analogue (Astro passes seed explicitly, so latent).
- [low] [duplication] `doc-state.tsx:59-89` — `titleTextOf` re-implements `textOf` dispatch and
  open-codes the chunk probe instead of core's `isSSRChunk`; the string/number/chunk/Node dispatch is
  re-implemented ~6× across reforest/smart/text/code/doc-state — a core `matchResolved` visitor would
  centralize it.
- [low] [smell] `doc-state.tsx:542,564` — destructure-then-`void numOf`; `Fact =
  Record<string, unknown>` (core doc-state.ts:24) forces ~15 casts — a `read<T>` generic would
  delete them.
- [low] [dead exports] `reforest.tsx:62` `ATTRS_MARKER`, `:154` `ExtractedAttrs`, `smart.ts:55`
  `NOSMART_ATTR` — no consumers outside their modules.

## D. compiler / vite / cli / astro

- [HIGH] [bug] `packages/astro/src/lib.ts` — the one build pipeline with no NODE_ENV pinning
  (CLAUDE.md's own rule). Astro fills NODE_ENV only when unset, so an ambient value ships dev
  solid-js. Demonstrated: the e2e's built fixture bundle
  `tests/fixtures/site/dist/_astro/lib.DldCf2Vv.js` contains the "multiple instances of Solid"
  dev-marker string (built under vitest's NODE_ENV=test). The astro e2e has no production-artifact
  assertion (cli's does: build.test.ts:128-149), so the suite can't see it. Fix: pin like
  cli/src/build.ts:520-521 + add the assertion.
- [med] [coupling] `cli/src/build.ts:279-290` — `rethrowBuildError` unwraps rolldown's chain by
  regexing `/failed to compile/i` against message text, textually coupled to compiler lib.ts:536
  wording; the compiler attaches `.diagnostics` for exactly this — key on that.
- [med] [stale comments] `cli/src/build.ts:66-68,145-146` + `cli/vite.config.ts:14` — pinned set
  documented as `@nota-lang/{solid,prelude}` (pre-rename); actual `FRAMEWORK_PACKAGES` is core,
  prelude, solid-js. Same rename family that caused the resolver-regex bug.
- [med] [guard gap] `compiler/src/lib.ts:96` — module-load `reader.emitSurface()` with no stale-wasm
  guard; a pre-emitSurface vendored build kills every import with a bare TypeError, while `freeNames`
  gets a pointed "stale src/generated wasm build?" error (258-265). Same treatment.
- [low] [emit coupling] `vite/src/lib.ts:147` — hardcodes `Doc.isNotaDoc = true` on the emitted name
  `Doc`; derivable from `emitSurface().reserved`; a reader rename fails only at consumer runtime.
- [low] [stale comments] jsxify residue: `vite/src/lib.ts:7`, `compiler/src/lib.ts:197`
  (`{@link jsxify}` → nonexistent symbol), `vite/tests/e2e.test.ts:2`; `compiler/src/lib.ts:238`
  references nonexistent `RUNTIME_IMPORT`; `astro/vitest.config.ts:6` "mirrors packages/solid".
- [low] [vestigial + known product call] `cli/src/build.ts:71-75` — `BuildOptions.dev` has zero
  consumers (bin.test.ts:227-234 pins that `--dev` is swallowed as the input positional); the minify
  branch at 361 is never exercised.
- [low] [implicit list] `vite/src/lib.ts:75-78` — `DEDUPED_PACKAGES` = FRAMEWORK_PACKAGES +
  hand-appended `"@nota-lang/paper"`; astro prefix-filters it for its JSX-dist list (astro
  lib.ts:38-40); "ships JSX dist" membership lives implicitly in a dedupe list in a package that
  doesn't depend on paper.
- [low] [brittle rewrite] `cli/src/build.ts:399` — CSS `url(/assets/…)` textual repair rests on the
  assetFileNames scheme; silently stops matching if it changes; worth a test pin.
- [low] [metadata] compiler/vite/cli/astro package.json: no description/keywords/README on any
  publishable (blank npm pages). (Cross-cut confirmed: all 8 publishables + no root README.)
- [low] [test duplication] the `clean()` hydration-marker stripper is copy-pasted in five test files
  (vite e2e ×2, cli ×3); one shared helper.

Checked and clean: the three vite-config assembly sites are not copy-paste — cli and astro consume
the `nota()` preset and layer host-specific config; error handling careful; invariant tests
(one-solid-js, byte-offset contracts) strong.

## E. language-server

- [HIGH] [bug] `src/semantic-tokens.ts:413` — `Buffer.from(source, "utf8")` in the shared token
  pipeline; browser Web Worker has no Buffer, throw is swallowed by the last-good-cache catch
  (server-core.ts:133), so the browser flavor serves permanently-empty semantic tokens. The browser
  e2e runs under node where Buffer exists, so it structurally cannot catch this. Fix: TextEncoder.
- [HIGH] [bug/drift] `src/semantic-tokens.ts:324,337` — `delegatedLines` consumes `lineClassifiers()`
  for the `%` family but the backtick-fence tier is a hand mirror that has drifted from the reader's
  `scan_fenced_code` (local: exact tick count, ticks-only close line, ticks-at-line-start open;
  reader: ≥ fence_len, trailing content allowed, indented open). After such a fence the mode machine
  desyncs for the rest of the document. The comment at 289-292 claims the mirror "can no longer
  diverge" — true only for `%` rules.
- [HIGH] [bug/leaky offsets] `src/language-plugin.ts:56-71` — reader CodeMappings are UTF-8 byte
  offsets (compiler lib.ts:304-318; napi passes raw u32s) but are handed to Volar Mappings, which
  index by UTF-16 offsets. Any non-ASCII character before a mapped segment desyncs
  hover/completion/diagnostics/navigation. Only semantic-tokens converts (makeByteToPosition);
  nothing converts at the mapping boundary; every fixture is ASCII so no test can see it.
  `PREAMBLE_LENGTH` is UTF-16 `.length` documented as "byte length" — works only because the
  preamble is ASCII, unasserted.
- [med] [bug + contradicting doc] `src/diagnostics.ts:34-45` — `offsetToPosition` treats the byte
  offset as a UTF-16 index (clamps against source.length, walks charCodeAt); docstring claims the
  opposite. Third hand-rolled position conversion in the package — consolidate.
- [med] [dead code duplicating live code] semantic-tokens.ts:507-525, completions.ts:178-199,
  diagnostics.ts:87-96 — the three service-plugin `create()` handlers are unreachable (Volar never
  offers the .nota doc; live path is the connection-level overrides), yet each carries a full
  duplicate implementation (the last-good cache exists twice verbatim). completions.test.ts:94-151
  still unit-tests the dead plugin path — the exact trap server-e2e.test.ts:9 warns about.
- [med] [stale comments] bin.ts:3 ("the binary the vscode-nota client launches"),
  semantic-tokens.ts:30 + module doc 23-33 (delegation rationale written against the deleted
  TextMate grammar/conformance test; nearest live analogue is the emacs tier — re-justify or note),
  test names in semantic-tokens-nota.test.ts:77, server-e2e.test.ts:155.
- [med] [stale count] semantic-tokens.ts:13-15,180-182 — "four under-layer kinds"; there are five
  since emphasis-strike (a092d3d); lines 76 and `UNDER_LAYERS` already say five. Same in
  tests/semantic-tokens-nota.test.ts:5-6.
- [med] [doc contradicts code] semantic-tokens.ts:498-499 — "full only — no delta, no range in v1";
  server-core.ts:162-186 implements onRange and Volar advertises range:true.
- [med] [half-done consolidation + inconsistency] completions.ts:139 — `headContext` hand-rolls
  `/^\s*%/` instead of the imported `LINE_CLASSIFIERS.percentLine`; suppresses `@`-heads on `%`
  lines (where markup re-entry makes them legal — the token path deliberately paints them) while NOT
  suppressing in true literal contexts (```/`%%%` fence interiors) because it only sees a line
  prefix though `delegatedLines` has the classification. `scanComponents` (:125) requires leading
  `%`, so bindings inside `%%%` fences are never offered.
- [low] [stale pre-Solid test comments] hover-completion.test.ts:89-90, semantic-tokens.test.ts:91
  ("h(\"p\", …)"), mapping.test.ts:87 ("h/decode/Fragment"), diagnostics.test.ts:126 (filter regex
  still greps `'h'|'decode'|'Fragment'` — vacuous alternates).
- [low] [stale pointers] semantic-tokens.ts:451, diagnostics.ts:75 — "see … in `server.ts`"; both
  targets live in server-core.ts since the browser split.
- [low] [vestigial complexity/perf] semantic-tokens.ts:363-398 — makeByteToPosition builds a
  checkpoint object per code point then binary-searches + "interpolates" (dead under dense
  checkpoints); `flattenSpans` (196-239) is O(boundaries × spans), called per refresh.
- [low] [fixture duplication] three near-identical ~40-line LanguageServiceHost builds
  (feature-harness.ts:66-108, diagnostics.test.ts:35-113, typed-surface.test.ts:34-98) with three
  divergent `jsx` settings vs shipped `"preserve"` (browser.ts:67); feature-harness doc says
  ReactJSX, code sets Preserve. Two spawn-e2e boilerplates with acknowledged overlap.
- [low] [leak] server-core.ts:126, semantic-tokens.ts:509 — last-good caches keyed by URI, never
  evicted on didClose.

Drift-test verdict: genuine, not vacuous — preamble-sync re-runs the generator and string-compares;
kind-coverage loops the reader's `highlightKindNames()` (this caught comment/emphasis-strike);
ambient-signatures has an anti-vacuity `=== "any"` filter and a stale-dist check.

## F. codemirror / playground / emacs

- [med] [fragile logic] `playground/src/solid-eval.ts:88-190` — hand-rolled ESM surgery with
  `gm`-anchored regexes over babel output; template literals and `%`-statement strings contain real
  newlines, so document content with a line starting `import`/`export` gets rewritten mid-string
  (throws or silently strips). ~60 lines of parser-shaped regex work.
- [med] [stale API docs] `codemirror/src/nota-mode.ts:179,374-375` — "Requires `nota_wasm` to be
  initialized… the consumer awaits its `init`" contradicts lib.ts:8-9 ("instantiates when the module
  graph loads — no init step"); the generated surface exports no `init` at all. Vestige of the
  consumer-side init design; misleading API guidance (also stale in the project CLAUDE.md package
  map).
- [med] [dead code] `playground/src/html-mode.ts` (whole file), CodePane.tsx:20 html entry,
  format.ts:28 prettier-html branch — no caller passes `mode="html"`; vestige of the removed SSG
  HTML pane. Related dead bits: `src/bindings/assets.d.ts:2-5` (`*.wasm?url` declaration),
  Editor.tsx:64's compartment-swap rationale.
- [med] [triple hand-copy in a blind spot] `editors/emacs/nota-mode.el:121-131,230-234,247-248` —
  the fence-line grammar is written three times in one file and never checked against the reader's
  `lineClassifiers()` (whose doc names emacs as a consumer). Fence-regex drift paints `nota-raw`,
  the one face conformance.el:20-23 exempts — invisible to the P4 harness.
- [med] [test smell] `editors/emacs/tests/conformance.el:96-107` — no positive floor: zero `nota-*`
  faces (or zero matched files) prints "OK". The embedded-JS delegation tier (standard font-lock
  faces) is entirely outside the conformance contract.
- [med] [drifting mirror] `playground/scripts/dump-tokens.ts:57-81` — `TOK_COLORS` hand-mirrors
  highlight-style.ts hexes, contradicting palette.ts:1-5 ("the one copy of the palette") and its own
  comment admitting the previous copy "once drifted two kinds behind"; derive from
  `catppuccinLatte.specs` + `PALETTE`.
- [low] [same-name hazard] compiler lib.ts:512 vs codemirror nota-mode.ts:188 — two exported
  `highlightSpans` decoding the same wasm triples in different units/shapes (UTF-8 `{start,end}` vs
  UTF-16 `{from,to}`).
- [low] [kind-table drift risk] codemirror's `KIND_STYLES` is hardcoded but bidirectionally
  drift-tested (tests/nota-highlight.test.ts:466-475); emacs's face→kind vocabulary
  (conformance.el:24-39) has no vocabulary check — a typo'd allowed-kind is silently inert.
- [low] [file structure] `editors/emacs/tests/nota-mode-test.el:268-296` — four list-audit tests
  pasted after `(provide …)` and the `;;; …ends here` footer.
- [low] [stale comments] emacs README.md:6 (grammar "transliteration of the vscode-nota TextMate
  grammar" with no "deleted"; nota-mode.el:11 was updated, README wasn't); nota-mode.el:303-307
  (claims strike matcher fires "only on UNCLAIMED text"; `nota--match-strike` delegates to
  `nota--match-emphasis` which has no claimed-check); playground format.ts:2-6 (React
  renderToString / SSG pane / nonexistent parity tests), lsp/client.ts:10-11 ("React re-mounts"),
  codemirror highlight-style.ts:45 ("`h(...)`, `decode(...)`" as examples), solid-eval.ts:26,39
  (`notaSolid` alias carrying the old name).
- [low] [test smells] playground golden.ts:8-16 — hand-inlined duplicate of integration/golden.nota,
  sync unchecked, stated fs.allow reason doesn't apply to vitest; tests/lsp.test.ts:16-19 duplicates
  worker-server.ts's `import.meta.glob` string.
- Clean: LSP worker bridging (one transport adapter, one bootstrap queue, no copy-paste); all
  playground imports are sanctioned subpaths; only path reach-around is
  editors/emacs/tests/dump-spans.mjs:16 (defensible — no package.json there).

## G. cross-cutting / repo hygiene

- [HIGH] [stale orientation doc] `CLAUDE.md` — documents pre-Solid master as current now that solid
  IS main: react/solid adapter + conformance-matrix claims (react deleted; core has its own suites),
  react-router/runtime/vscode-nota entries (all deleted), "lowers to hyperscript", decode.md
  declared authoritative, the pre-existing biome-failure note (file gone), decode-model gotcha, the
  releasing section's package set + vsix path. core and astro missing as first-class entries.
  Actively misleading as an orientation file — rewrite.
- [HIGH] [dead fossil] `pack/` + `example/` — 5.5 MB of committed tarballs of the deleted
  architecture (react/runtime/solid/wasm tgz; vite tgz depends on `@nota-lang/runtime`; example
  asserts the hyperscript contract `const Doc: () => string`). CI never runs it. Delete or rebuild
  against the Solid pipeline.
- [med] [stale spec] `design/decode.md:17` — no superseded banner; still opens "authoritative spec
  for the runtime (`@nota-lang/runtime`)". notation.md's banner exists but its "documents master"
  framing is itself stale post-landing.
- [med] [broken config] `typedoc.json:8` — entryPoints includes `packages/solid` (gone; renamed
  core); cli absent while other publishables are listed.
- [med] [unused dep] `packages/paper/package.json` — `katex` (+ `@types/katex`) unused; all TeX goes
  through prelude's Tex.
- [med] [ci-vs-docs] `.github/workflows/ci.yml:21` runs bare root `depot test`, which CLAUDE.md says
  must never be done. Likely the CLAUDE.md warning is stale (the cited failure file died with
  packages/react) — resolve one or the other.
- [low] [stale] design/solid.md:321 — "`@nota-lang/core` (one file)" — core is 8 source files.
- [low] [duplication, borderline] codemirror `byteToUtf16` (nota-mode.ts:53) vs language-server
  `makeByteToPosition` (semantic-tokens.ts:360) — two independent UTF-8→UTF-16 walks; both packages
  depend on compiler, which could host one converter (also relevant to the offset-space bug in E).
- [low] [duplication, benign] vitest ssr/dom two-project pattern ×4; core vs astro doc.tsx fixtures
  (deliberately diverged); emacs elisp classifier transliteration (conformance-guarded by design).
- [low] [paper nits] `Figure` numbers via `handle.seq` while `Caption` re-derives by counting
  preceding facts (scaffold.tsx:104 vs 135-138) — two derivations of one number; inline
  `"figure"`/`"figure-caption"` kind strings vs the blessed FACT_KINDS pattern.

Checked and clean: FRAMEWORK_MODULES/PACKAGES single-sourced and consumed by vite+cli;
CORE_RUNTIME_NAMES/emitSurface feed the LSP preamble (drift-tested) and core's emit-surface test;
lineClassifiers feeds semantic-tokens; emacs mirror conformance-guarded; no live-code imports of any
dead package; release workflows current; private flags exactly match the release story
(language-server + playground private, 8 publishables).

---

## Suggested order of attack

1. **Behavioral bugs** (each small): astro NODE_ENV pin + production-artifact assertion in its e2e;
   prelude stale-seq capture (Heading/Footnote) + a regression test; def-tooltip bank scoping;
   LS `Buffer`→`TextEncoder`; LS backtick-fence mirror → consume the reader's rule (or export a
   fence classifier from the reader); byte→UTF-16 conversion at the Volar mapping boundary + one
   non-ASCII fixture (this also subsumes diagnostics.ts's offsetToPosition).
2. **Tooling**: nota_inspect validity source type (before any fuzzing).
3. **One prose sweep**: CLAUDE.md rewrite; NOTA_READER.md seam item + wasm path + reserved list;
   oxc AST/compile-entry/mapping hyperscript docs; decode.md superseded banner; the
   jsxify/rename/vscode-nota comment residue (files enumerated above); typedoc.json.
4. **Debt burn-down** (mechanical, medium): core `parseOpeningTag` + memoized `headingModel`;
   finish the lineClassifiers consolidation (completions.ts, emacs fence tier, thematic break
   export); delete pack/+example/ and the playground html pane; nota-ul-li sentinel → direct
   `build_named_element`; shared integration-test harness in oxc; shared `clean()` test helper.
5. **Product calls to make explicitly**: `--virtual` protocol keep/cut; wasm sourcemap channel;
   `counters` adopt-in-paper or delete; `BuildOptions.dev` (already an open call in the 2026-08
   testing-pass memory); FACT_KINDS — use it or drop the claim.
