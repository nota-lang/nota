/**
 * **Completions.**
 *
 * - `@|` head completions ({@link headContext}/{@link headCompletions}, called directly from
 *   `registerNotaConnectionFeatures` in `server-core.ts` — the live path; `notaCompletionsPlugin`'s
 *   own `create()` is a capability-only stub, see its doc): tags + prelude slots + in-scope
 *   components; NOT suppressed on a bare `%` statement line (markup re-entry is legal there — see
 *   `headContext`'s doc) but suppressed inside a literal fence interior (`%%%`/delegated code fence)
 *   via `shouldOfferHeadCompletions`, since only the full-document call site can see one.
 * - `@tag[|` prop completions: served by TS through the EOF-recovery anchor + the preamble's
 *   `JSX.IntrinsicElements` — asserted end-to-end via the feature harness (`@a[|` recovers to
 *   `<a />`, the anchor maps the cursor into the JSX attribute position, TS offers `<a>`'s
 *   attributes).
 *
 * The real merged behaviour over the wire (TS items + `@|` items, through the actual connection
 * handler) is asserted end-to-end in `server-e2e.test.ts`; this file unit-tests the pure functions
 * the live path calls.
 */

import { describe, expect, test } from "vitest";
import {
  headCompletions,
  headContext,
  NOTA_HOST_TAGS,
  NOTA_PRELUDE_SLOTS,
  notaCompletionsPlugin,
  scanComponents
} from "../src/completions";
import { completionsAt, createFeatureHarness } from "./feature-harness";

describe("member completion after a trailing dot (segment extension)", () => {
  // The reader's segments are byte-exact leaf tokens; `extendMappings` widens them across
  // member-access bytes so the `x.|` position translates into the virtual `.tsx`.
  test("`%let y = x.|` offers number members", () => {
    const src = "%let x = 1\n%let y = x.\n";
    const h = createFeatureHarness(src);
    const names = completionsAt(h, src.indexOf("x.\n") + 2);
    expect(names.has("toFixed")).toBe(true);
    expect(names.has("toString")).toBe(true);
  });
  test("`@(x.|)` interpolation offers number members", () => {
    const src = "%let x = 1\nvalue: @(x.)\n";
    const h = createFeatureHarness(src);
    const names = completionsAt(h, src.indexOf("x.)") + 2);
    expect(names.has("toFixed")).toBe(true);
  });
  // NOTE: an incomplete optional chain (`s?.|`) does NOT complete today — the reader's error
  // recovery collapses the initializer to `null` (`let t = null;`), so the virtual has no `s?.`
  // to map into. That is a reader-recovery limitation (plain `x.` recovers structurally as
  // `x.;`); the `?.` byte-extension in `extendMappings` is covered by its unit tests and will
  // light up when recovery preserves the chain.
});

describe("headContext (the `@|` line-prefix classifier)", () => {
  test("matches a bare `@` and a partial head at end of prefix", () => {
    expect(headContext("hello @")).toBe("");
    expect(headContext("hello @em")).toBe("em");
    expect(headContext("@my-wid")).toBe("my-wid");
  });
  test("does not match after a space, an `@(expr)` head, or a `[` prop trigger", () => {
    // In Nota markup `@` is ALWAYS a form trigger (even glued to preceding text: `a@x` = "a" + an
    // `@x` form), so a mid-text `@x` legitimately offers completions — the regex is deliberately loose.
    expect(headContext("email@x")).toBe("x");
    expect(headContext("@em ")).toBeNull(); // trailing space — the head already ended
    expect(headContext("@(")).toBeNull(); // dynamic-tag head, TS handles the expr
    expect(headContext("@a[")).toBeNull(); // `[` prop trigger — TS serves props via the mapping
  });
  test("is NOT suppressed on a bare `%` statement line — `@` genuinely re-enters markup there", () => {
    // Was suppressed here in a prior design; fixed to align with the semantic-token tier, which
    // paints `@div[…]` on a `%` line for the same underlying reason: the reader's statement parser
    // re-enters markup at `@` on a `%` line for real (design/solid.md; `line-context.ts`'s module
    // doc goes into the grammar detail). A literal fence interior is a DIFFERENT, full-document
    // check this line-prefix-only function can't make — see `shouldOfferHeadCompletions` in
    // `server-core.ts` and `tests/line-context.test.ts`.
    expect(headContext("% const x = @")).toBe("");
    expect(headContext("%let a = @div")).toBe("div");
  });
});

describe("scanComponents (document scan for capitalized bindings)", () => {
  test("finds %let/%const/%export component bindings, ignores lowercase", () => {
    const src =
      "%let Colorized = (props) => props.children\n%const Note = (props) => props.children\n%export let Aside = x\n% let helper = 1\n";
    const found = scanComponents(src);
    expect(found).toContain("Colorized");
    expect(found).toContain("Note");
    expect(found).toContain("Aside");
    expect(found).not.toContain("helper");
  });

  test("also finds a binding declared inside a `%%%` fence body (no leading `%` there)", () => {
    // The fence's own delimiter lines carry `%%%`, but its body lines don't — a body-line binding
    // like `export const Widget = …` is invisible to the `%+`-anchored regex alone.
    const src =
      "%%%\nexport const Widget = (props) => props.children;\nlet helper = 1;\n%%%\n";
    const found = scanComponents(src);
    expect(found).toContain("Widget");
    expect(found).not.toContain("helper"); // lowercase — not a component
  });

  test("does NOT scan bindings inside a backtick code fence (opaque example text)", () => {
    const src = "```ts\nexport const NotAComponent = 1;\n```\n";
    expect(scanComponents(src)).not.toContain("NotAComponent");
  });
});

describe("headCompletions (the merged `@|` item set)", () => {
  test("includes host tags, prelude slots, and in-scope components; de-duped", () => {
    const src = "%let Widget = (props) => props.children\n@p{x}\n";
    const items = headCompletions(src);
    const labels = items.map(i => i.label);
    expect(labels).toContain("p"); // host tag
    expect(labels).toContain("Tex"); // prelude slot
    expect(labels).toContain("Widget"); // in-scope component
    // De-duped (no label appears twice).
    expect(new Set(labels).size).toBe(labels.length);
    // Every prelude slot is offered.
    for (const slot of NOTA_PRELUDE_SLOTS) {
      expect(labels).toContain(slot);
    }
  });
});

describe("shouldOfferHeadCompletions (the live connection-level decision, server-core.ts)", () => {
  test("true at a bare `@|` on an ordinary markup line", async () => {
    const { shouldOfferHeadCompletions } = await import("../src/server-core");
    const text = "# Title\n\n@\n";
    expect(shouldOfferHeadCompletions(text, { line: 2, character: 1 })).toBe(
      true
    );
  });

  test("true at `@|` on a bare `%` statement line — markup re-entry", async () => {
    const { shouldOfferHeadCompletions } = await import("../src/server-core");
    const text = "%let a = @\n";
    expect(shouldOfferHeadCompletions(text, { line: 0, character: 10 })).toBe(
      true
    );
  });

  test("false at `@|` inside a `%%%` fence body — literal interior, even though headContext alone would accept it", async () => {
    const { shouldOfferHeadCompletions } = await import("../src/server-core");
    const text = "%%%\nconst x = @\n%%%\n";
    expect(shouldOfferHeadCompletions(text, { line: 1, character: 11 })).toBe(
      false
    );
  });

  test("false at `@|` inside a delegated backtick code fence", async () => {
    const { shouldOfferHeadCompletions } = await import("../src/server-core");
    const text = "```ts\nconst x = @\n```\n";
    expect(shouldOfferHeadCompletions(text, { line: 1, character: 11 })).toBe(
      false
    );
  });

  test("false where headContext itself already declines (e.g. a `[` prop trigger)", async () => {
    const { shouldOfferHeadCompletions } = await import("../src/server-core");
    const text = "@a[\n";
    expect(shouldOfferHeadCompletions(text, { line: 0, character: 3 })).toBe(
      false
    );
  });
});

// `notaCompletionsPlugin`'s `create()` is a capability-advertisement-only stub (see its doc in
// `../src/completions`) — Volar never routes the `.nota` source doc to a service plugin, so there is
// no `provideCompletionItems` path left to unit-test here. What it advertises is real (merged into
// the server's `initialize` capabilities) and is worth pinning directly; the actual `@|` completion
// behaviour over the wire — the connection-level merge of these trigger characters firing a request
// that `headContext`/`headCompletions` (tested above) then answer — is asserted end-to-end in
// `server-e2e.test.ts`.
describe("notaCompletionsPlugin (capability advertisement)", () => {
  test("registers `@` and `[` as trigger characters", () => {
    expect(
      notaCompletionsPlugin.capabilities.completionProvider?.triggerCharacters
    ).toEqual(["@", "["]);
  });
});

describe("`@tag[|` prop completions via TS (recovery anchor + typed overload)", () => {
  test("`@a[` proposes <a> attributes (href, target, …) with no Nota-specific code", () => {
    const h = createFeatureHarness("@a[");
    const items = completionsAt(h, 3); // just after `[` — the recovery anchor
    expect(items.has("href")).toBe(true);
    expect(items.has("target")).toBe(true);
  });
});

describe("host-tag list ↔ typed intrinsics table", () => {
  test("every seeded intrinsic tag is also offered by NOTA_HOST_TAGS", async () => {
    // The intrinsics table types props for a tag; the host-tag list offers the tag name at `@|`.
    // A tag typed-but-not-offered would value-check yet never complete.
    const { SEEDED_INTRINSICS } = await import("../src/preamble-gen");
    const missing = Object.keys(SEEDED_INTRINSICS).filter(
      tag => !NOTA_HOST_TAGS.includes(tag)
    );
    expect(missing).toEqual([]);
  });
});
