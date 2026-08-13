/**
 * Serialization + islands + the SSG driver.
 *
 * After {@link struct}, a vnode tree contains only host nodes, fragments, text leaves,
 * and *boundary* `CompFn` nodes. {@link serialize} stringifies it to static HTML, rendering each
 * boundary as a hydration {@link island}: a fresh id, the component's shell SSR'd with `▸ = true`,
 * and a debug manifest entry. The client hydrates by *replaying* the document
 * ({@link hydrateDocument}, replay hydration) — no per-island data crosses the wire.
 *
 * ## The hydration-id placement decision
 *
 * The natural design is to pass `"hydration-id"` as a *prop* to the component and let it land on the
 * rendered root. But neither React nor Solid forwards an unknown prop onto a component's rendered
 * root unless the component *spreads* it onto a host element — a component that renders
 * `h("span", {onClick, style}, children)` does not, so the id would simply vanish. We therefore land
 * the id on a **marker wrapper element** instead: each island's SSR output is wrapped in
 * `<nota-island data-hydration-id="N">…</nota-island>`. {@link hydrateDocument} selects
 * on `[data-hydration-id]` and hydrates the framework element *into* that wrapper (its children are
 * the SSR'd shell — exactly what React `hydrateRoot` / Solid `hydrate` expect to attach over). This
 * is framework-agnostic, requires no cooperation from the component, and never risks an "unknown DOM
 * attribute" warning from spreading the id onto a host. The integration test asserts this form.
 */

import { getAdapter } from "./adapter.js";
import { type CompFn, isComp, nameOf } from "./component.js";
import {
  force,
  hasTrailers,
  indexDoc,
  isMark,
  isQuery,
  runTrailers
} from "./doc.js";
import { withFlag } from "./flag.js";
import { isRaw, raw } from "./raw.js";
import { normalize, struct } from "./struct.js";
import {
  type ChildArg,
  type ElementVNode,
  FRAG,
  flatten,
  isElement,
  type VNode
} from "./vnode.js";

// ---------------------------------------------------------------------------------------------
// Manifest / result types
// ---------------------------------------------------------------------------------------------

/**
 * The island manifest emitted alongside the HTML: `id → { comp }`. **Debug metadata only**:
 * hydration replays the document and never reads it; it names each island for
 * inspection (`comp` may be `"anonymous"` for a nameless boundary) and gates `hasIslands` in the
 * integrators. Props are NOT carried — they may hold non-JSON values (functions, class instances)
 * and cross server→client by replay, not by transport.
 */
export type Manifest = Record<string, { comp: string }>;

/** Result of the SSG `render` driver. */
export interface RenderResult {
  html: string;
  manifest: Manifest;
}

/**
 * A captured island boundary (replay hydration). Recorded by {@link island} while
 * {@link captureRender} re-executes the document on the client: the **live** `CompFn`
 * (closure intact), the live `props` (may be non-JSON — functions and class instances are legal),
 * and the recomputed `slotHtml` (the boundary's static `@children`, serialized exactly as SSG did).
 * The driver hydrates each into its `[data-hydration-id]` node.
 */
export interface CapturedIsland {
  tag: CompFn;
  props: Record<string, unknown>;
  slotHtml: string;
}

// ---------------------------------------------------------------------------------------------
// Module state (the SSG driver's per-render id counter and manifest)
// ---------------------------------------------------------------------------------------------

/** Monotonic hydration-id counter; minted by {@link island} as ids `"1"`, `"2"`, … */
let ids = 0;
/** The manifest accumulated across one {@link render} pass. */
let manifest: Manifest = {};

// ---------------------------------------------------------------------------------------------
// Capture mode (replay hydration)
// ---------------------------------------------------------------------------------------------

/**
 * Replay-capture flag. `true` while {@link captureRender} re-executes the document on
 * the client: {@link island} then **records** every boundary (see {@link captured}) — and, at depth
 * 0, skips its SSR rather than stringifying it. Managed only by {@link beginCapture}/{@link endCapture}
 * (save/restore, like the `▸` flag), so it is already `false` outside any capture — {@link reset}
 * deliberately does not touch it.
 */
let capturing = false;
/** The islands recorded during a {@link captureRender} pass: `id → live boundary`. */
let captured: Map<string, CapturedIsland> = new Map();
/**
 * Depth of nested-island *slot* serialization. {@link island} increments it around the serialize of
 * a boundary's static children, so a nested island encountered inside a parent's slot sees
 * `slotDepth > 0`. Capture records at **every** depth — each `[data-hydration-id]` marker in the
 * DOM is independently hydrated, matching the old boot's every-manifest-id behavior — the depth
 * only decides whether the SSR is *also* performed: a nested-in-slot island still SSRs into its
 * parent's slot bytes (byte-parity — the parent re-injects that slot via `raw`/innerHTML on any
 * re-render), whereas a depth-0 island's SSR is skipped (its output is discarded anyway). Solid
 * caveat (a replay-hydration v1 limit): the client build forbids `renderToString`, so a depth>0 capture is a
 * pointed error there — nested-in-slot islands are v1-unsupported under Solid.
 */
let slotDepth = 0;

/** Enter capture mode: flag on, fresh recording. Paired with {@link endCapture} (try/finally). */
export function beginCapture(): void {
  capturing = true;
  captured = new Map();
  slotDepth = 0;
}

/** Leave capture mode (flag off). The recorded map is left intact for {@link getCaptured}. */
export function endCapture(): void {
  capturing = false;
}

/** A snapshot of the islands captured in the current/just-finished capture pass. */
export function getCaptured(): Map<string, CapturedIsland> {
  return new Map(captured);
}

/**
 * Hooks run by {@link reset} — the seam for per-render *document* state owned outside the runtime
 * (doc-global config: the prelude's `lstset` restores its baseline here, so config set inside
 * one document does not leak into the next). Returns an unsubscribe. Distinct from the component
 * registry, which is global-persistent and deliberately NOT reset.
 */
const resetHooks = new Set<() => void>();
export function onRenderReset(hook: () => void): () => void {
  resetHooks.add(hook);
  return () => resetHooks.delete(hook);
}

/**
 * Reset the per-render SSG state: id counter to `0`, a fresh empty manifest, the capture recording
 * + slot depth, and any {@link onRenderReset} hooks (per-document config like the prelude's
 * `lstset`). Called by {@link render} before serializing a document, so ids are
 * deterministic and manifests do not bleed between renders. (Neither the `▸` flag nor the
 * `capturing` flag is reset here: both are managed by their own save/restore
 * (`withFlag` / {@link beginCapture}·{@link endCapture}), so both are already `false` outside any
 * render.) Exposed for tests that drive `serialize`/`island` directly.
 */
export function reset(): void {
  ids = 0;
  manifest = {};
  captured = new Map();
  slotDepth = 0;
  for (const hook of resetHooks) {
    hook();
  }
}

/** Mint the next hydration id (string, monotonic from 1). */
function freshId(): string {
  ids += 1;
  return String(ids);
}

/** The current manifest (test/driver hook; {@link render} returns a snapshot of this). */
export function getManifest(): Manifest {
  return manifest;
}

// ---------------------------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------------------------

/**
 * HTML-escape a text/attribute string. Escapes the five characters that are unsafe in PCDATA *or*
 * in a double-quoted attribute value (`& < > " '`). Conservative and context-free: a single escaper
 * is correct for both positions (over-escaping `>`/`'` in text is harmless), which keeps callers
 * from having to track context. (Intentionally shadows the legacy global `escape`, which this
 * never uses.)
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the intended export name.
export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------------------------
// Void elements + attribute serialization
// ---------------------------------------------------------------------------------------------

/**
 * The HTML void elements: they have no children and self-close (`<br/>`). Serializing one emits the
 * open tag only (with a trailing `/`), never a close tag — even if the vnode carries stray children.
 */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

/** `fontSize` → `font-size`. CSS property names are kebab-case; authored style objects camelCase. */
function camelToKebab(k: string): string {
  return k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

/** True for an event-handler prop key: `onClick`, `onMouseDown`, … (`on` + an uppercase letter). */
function isEventHandlerKey(k: string): boolean {
  return /^on[A-Z]/.test(k);
}

/**
 * Serialize a `style` value to a CSS string. An object `{ color: "red", fontSize: 12 }` →
 * `"color: red; font-size: 12"` (keys kebab-cased; nullish entries dropped). A string passes through
 * verbatim (already CSS).
 */
function serializeStyle(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v == null) {
        continue;
      }
      parts.push(`${camelToKebab(k)}: ${String(v)}`);
    }
    return parts.join("; ");
  }
  return String(value);
}

/**
 * Serialize one `props` object to an attribute string (leading space per attribute, so the caller
 * can splice it straight after the tag name). The attribute rules:
 *
 * - **`style` object** → a `"k: v; …"` CSS string (camelCase keys kebab-cased).
 * - **boolean `true`** → a bare attribute (`disabled`); **`false`/nullish** → the attribute is omitted.
 * - **event handlers / functions** → omitted (no behavior in static HTML; it ships in the island JS).
 * - everything else → `key="escape(String(value))"`.
 *
 * `children` is never a prop here (it is the vnode's `children`), but a stray `children` key is
 * dropped defensively. Keys are emitted verbatim (the reader already authored valid attribute names).
 */
function serializeAttrs(props: Record<string, unknown>): string {
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") {
      continue;
    }
    // event handlers + any function value → no static HTML
    if (isEventHandlerKey(key) || typeof value === "function") {
      continue;
    }
    if (value == null || value === false) {
      continue; // nullish / false → omit
    }
    if (value === true) {
      out += ` ${key}`; // boolean true → bare attribute
      continue;
    }
    if (key === "style") {
      const css = serializeStyle(value);
      if (css !== "") {
        out += ` style="${escape(css)}"`;
      }
      continue;
    }
    out += ` ${key}="${escape(String(value))}"`;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------------------------

/**
 * Stringify a `struct`'d vnode to static HTML, rendering each component boundary as a hydration
 * {@link island}:
 *
 * ```
 * serialize(v):
 *   string         → escape(v)
 *   isComp(v.tag)  → island(v)
 *   FRAG           → children serialized & joined        // transparent: no wrapper element
 *   void host      → `<t …attrs/>`                        // self-closing, no children/close tag
 *   host           → `<t …attrs>` + children… + `</t>`
 * ```
 */
export function serialize(v: VNode): string {
  if (typeof v === "string") {
    return escape(v);
  }
  // A RawHtml leaf is already-serialized HTML: emit verbatim, never re-escape.
  if (isRaw(v)) {
    return v.html;
  }
  // A doc-state mark/query leaf must have been resolved by the decode pipeline's
  // `force` pass before reaching here. Fail pointedly (mirror of the function-tag guard below)
  // rather than silently dropping it via the defensive `!isElement` branch.
  if (isMark(v) || isQuery(v)) {
    throw new Error(
      "serialize: a doc-state leaf (mark/query) reached serialize — run the decode pipeline first (decode/render resolve marks and queries via force before serializing)"
    );
  }
  if (!isElement(v)) {
    // unreachable for well-formed vnodes; be defensive rather than emit `undefined`
    return "";
  }
  if (isComp(v.tag)) {
    return island(v as ElementVNode & { tag: CompFn });
  }
  if (v.tag === FRAG) {
    // fragment: transparent grouping, no wrapper element
    return v.children.map(serialize).join("");
  }
  if (typeof v.tag === "function") {
    // `struct` expands plain-function templates and `isComp` handled boundaries above, so a
    // function tag here means serialize was called on an un-struct'd tree. Fail pointedly rather
    // than stringify the function into the HTML as a tag name.
    throw new Error(
      `serialize: <${v.tag.name || "anonymous"}> is a function tag — run struct() first (plain functions are static templates it expands; island components come from inlineComponent/blockComponent)`
    );
  }
  // host element (tag is a string here)
  const tag = v.tag as string;
  const open = `<${tag}${serializeAttrs(v.props)}`;
  if (VOID_ELEMENTS.has(tag)) {
    return `${open} />`;
  }
  const inner = v.children.map(serialize).join("");
  return `${open}>${inner}</${tag}>`;
}

// ---------------------------------------------------------------------------------------------
// island
// ---------------------------------------------------------------------------------------------

/**
 * Render a boundary node as a hydration island:
 *
 * 1. mint a fresh `id`;
 * 2. pre-serialize the boundary's *static* `children` to an HTML slot (they were authored outside
 *    the component, so they are ordinary nota vnodes — already `struct`'d);
 * 3. record `manifest[id] = { comp: nameOf(v.tag) }` (debug metadata; props are NOT carried
 *    and may hold non-JSON values like functions, which cross by replay);
 * 4. SSR the component shell with `▸ = true` — its `h`→`adapter.h`, its `decode`→identity, and a
 *    hook like `useState("red")` bakes its initial state into the markup (the worked example's `style:red`);
 * 5. wrap that markup in `<nota-island data-hydration-id="id">…</nota-island>` (see module docs).
 *
 * The slot is handed to the framework as `raw(slot)`: the component forwards it via `@children` onto
 * a host element, whose adapter `h` injects it as innerHTML (no re-escape, no re-parse).
 *
 * **Capture mode (replay hydration).** While {@link captureRender} replays the document on
 * the client (`capturing` `= true`), **every** boundary is **recorded** into `captured`
 * — the live `CompFn`, live props, recomputed slot — because every marker in the DOM is
 * independently hydrated (as the old boot hydrated every manifest id). The statement order is
 * identical to the SSR path (`freshId` *before* the slot serialize), so ids match the server by
 * construction. Depth decides only the SSR: a depth-0 boundary skips it (the returned empty shell
 * is discarded), while a nested-in-slot boundary (`slotDepth > 0`) is still SSR'd for byte-parity
 * of its parent's slot (the parent re-injects that slot via `raw`/innerHTML on any re-render).
 */
export function island(v: ElementVNode & { tag: CompFn }): string {
  const comp = nameOf(v.tag);
  const id = freshId();
  // Serialize the boundary's static children to its slot, tracking nesting so a nested island knows
  // it is inside a parent's slot (slotDepth > 0) and must also SSR for the parent's slot bytes.
  slotDepth += 1;
  const slot = v.children.map(serialize).join("");
  slotDepth -= 1;
  manifest[id] = { comp };

  if (capturing) {
    // Replay capture: record the live boundary at EVERY depth (each marker hydrates independently;
    // the id already matches the server — same freshId-before-slot traversal). Note a nested
    // boundary records *during* its parent's slot serialize, so Map insertion order is inner-first;
    // the driver hydrates in ascending id order (outer-first, the old boot's manifest order).
    captured.set(id, { tag: v.tag, props: v.props, slotHtml: slot });
    if (slotDepth === 0) {
      // Depth 0: skip SSR — the whole replay HTML is discarded, only the recording matters.
      return `<nota-island data-hydration-id="${id}"></nota-island>`;
    }
    // Depth > 0: fall through to SSR — the parent's captured slotHtml must be byte-identical to
    // the server's (the parent re-injects it as innerHTML on re-render). Solid's client build
    // forbids renderToString, so this is a pointed error there (a replay-hydration v1 limit).
  }

  const adapter = getAdapter();
  // SSR the shell with ▸=true so the component body runs against the framework.
  const shell = withFlag(true, () =>
    adapter.renderToString(adapter.h(v.tag, { ...v.props }, raw(slot)))
  );
  return `<nota-island data-hydration-id="${id}">${shell}</nota-island>`;
}

// ---------------------------------------------------------------------------------------------
// decode pipeline
// ---------------------------------------------------------------------------------------------

/**
 * The `▸ = false` decode pipeline: `serialize ∘ struct ∘ force ∘ index ∘ normalize`
 * (design/decode.md §The decode pipeline), with the trailer auto-append seam in front.
 *
 * ```
 * decodeTree(v):
 *   if trailers registered: v = ⟨FRAG, {}, [v, ...flatten(trailer thunks)]⟩   // trailers, before index
 *   t  = normalize(v)          // template expansion + fragment splicing, whole-tree — exposes template marks
 *   ix = indexDoc(t)           // one DFS → DocIndex (all/get)
 *   t2 = force(t, ix)          // remove marks, splice query output (recursively) — BEFORE grouping
 *   return serialize(struct(t2))
 * ```
 *
 * Lives here (not in `doc.ts`) because it composes `struct` + `serialize`, and `doc.ts` must not
 * import either (import-cycle hygiene). For a tree with **no** marks/queries/trailers
 * the output is byte-identical to `serialize(struct(v))`: no trailer wrap, `normalize` reproduces
 * `struct`'s own expansion, the empty index makes `force` a structural identity, and `struct`'s
 * interleaved expansion is vacuous.
 */
export function decodeTree(v: VNode): string {
  // Trailers: append each registered trailer's children after the document content, wrapping in a
  // transparent fragment, BEFORE indexing — so trailer queries force against the full index.
  const withTrailers: VNode = hasTrailers()
    ? {
        tag: FRAG,
        props: {},
        children: [v, ...flatten(runTrailers() as ChildArg[])]
      }
    : v;
  const t = normalize(withTrailers);
  const ix = indexDoc(t);
  const t2 = force(t, ix);
  return serialize(struct(t2));
}

// ---------------------------------------------------------------------------------------------
// SSG driver
// ---------------------------------------------------------------------------------------------

/**
 * The programmatic SSG entry. Resets the per-render state, runs the document, and returns the HTML
 * plus the island manifest.
 *
 * ```
 * render(Doc):
 *   reset()
 *   html = decode( Doc() )                 // = serialize(struct(Doc()))
 *   return { html, manifest }
 * ```
 *
 * **Decoding exactly once.** An *emitted* `Doc` already wraps its body in `decode(...)` — and at
 * `▸ = false`, `decode` runs the full decode pipeline (`decodeTree`). So a real emitted `Doc()`
 * **already returns the decoded HTML string**; applying the pipeline to it again would `escape` the
 * whole document (`<ul>` → `&lt;ul&gt;`) and re-run `island`. `render` therefore decodes **once**: if
 * `Doc()` already produced a string (the emitted, self-decoding `Doc`) it is the HTML as is; if
 * `Doc()` returned a raw vnode *tree* (a hand-built `Doc` that does not self-decode) we run
 * `decodeTree` (the same `normalize ∘ index ∘ force ∘ struct ∘ serialize` path, so marks,
 * queries, and trailers resolve here too). Either way the document is decoded exactly once.
 *
 * The caller must have `setAdapter`'d a framework adapter first (islands SSR through it). The
 * returned `manifest` is a fresh snapshot, so a later `render` cannot mutate it.
 */
export function render(Doc: () => VNode): RenderResult {
  reset();
  const out = Doc();
  // A self-decoding emitted `Doc` already returned an HTML string (its body wraps `decode(...)`); a
  // hand-built `Doc` that returns a raw vnode tree is decoded here through the SAME pipeline as
  // `decode` (so marks/queries/trailers resolve in the raw-tree fallback too).
  const html = typeof out === "string" ? out : decodeTree(out);
  return { html, manifest: { ...manifest } };
}
