/**
 * Serialization + islands + the SSG driver.
 *
 * After {@link "./struct".struct}, a vnode tree contains only host nodes, fragments, text leaves,
 * and *boundary* `CompFn` nodes. {@link serialize} stringifies it to static HTML, rendering each
 * boundary as a hydration {@link island}: a fresh id, the component's shell SSR'd with `▸ = true`,
 * and a manifest entry the client later reads to hydrate.
 *
 * ## The hydration-id placement decision
 *
 * The natural design is to pass `"hydration-id"` as a *prop* to the component and let it land on the
 * rendered root. But neither React nor Solid forwards an unknown prop onto a component's rendered
 * root unless the component *spreads* it onto a host element — a component that renders
 * `h("span", {onClick, style}, children)` does not, so the id would simply vanish. We therefore land
 * the id on a **marker wrapper element** instead: each island's SSR output is wrapped in
 * `<nota-island data-hydration-id="N">…</nota-island>`. {@link bootIslands} selects on
 * `[data-hydration-id]` and hydrates the framework element *into* that wrapper (its children are the
 * SSR'd shell — exactly what React `hydrateRoot` / Solid `hydrate` expect to attach over). This is
 * framework-agnostic, requires no cooperation from the component, and never risks an "unknown DOM
 * attribute" warning from spreading the id onto a host. The integration test asserts this form.
 */

import { getAdapter } from "./adapter";
import { type CompFn, isComp, nameOf } from "./component";
import { withFlag } from "./flag";
import { raw } from "./raw";
import { struct } from "./struct";
import { type ElementVNode, FRAG, isElement, type VNode } from "./vnode";

// ---------------------------------------------------------------------------------------------
// Manifest / result types
// ---------------------------------------------------------------------------------------------

/** The island manifest emitted alongside the HTML: `id → { comp, props }`. */
export type Manifest = Record<
  string,
  { comp: string; props: Record<string, unknown> }
>;

/** Result of the SSG `render` driver. */
export interface RenderResult {
  html: string;
  manifest: Manifest;
}

// ---------------------------------------------------------------------------------------------
// Module state (the SSG driver's per-render id counter and manifest)
// ---------------------------------------------------------------------------------------------

/** Monotonic hydration-id counter; minted by {@link island} as ids `"1"`, `"2"`, … */
let ids = 0;
/** The manifest accumulated across one {@link render} pass. */
let manifest: Manifest = {};

/**
 * Reset the per-render SSG state: id counter to `0` and a fresh empty manifest.
 * Called by {@link render} before serializing a document, so ids are
 * deterministic and manifests do not bleed between renders. (The `▸` flag is *not* reset here: the
 * only writer is {@link island}'s `withFlag`, which always restores, so `▸` is already `false`
 * outside any render.) Exposed for tests that drive `serialize`/`island` directly.
 */
export function reset(): void {
  ids = 0;
  manifest = {};
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
    // `struct` expands plain-function templates (R10) and `isComp` handled boundaries above, so a
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
 * Detect a non-JSON-serializable island prop and throw a pointed error (island props cross the
 * server→client boundary as the manifest, so they must round-trip through JSON). Mirrors what
 * `JSON.stringify` *loses or rejects*: functions, symbols, `bigint`, and `undefined` *values* are
 * lossy (silently dropped/nulled by `JSON.stringify`); circular references throw. We surface all of
 * these as a build error naming the component and the offending prop path, rather than letting a
 * prop silently disappear from the client. (Plain objects/arrays/strings/finite numbers/booleans/
 * `null` are fine; `Date` etc. serialize to a string — lossy but tolerated, the standard islands
 * footgun.)
 */
function assertJsonSerializable(
  props: Record<string, unknown>,
  comp: string
): void {
  const seen = new WeakSet<object>();
  const check = (value: unknown, path: string): void => {
    const t = typeof value;
    if (
      t === "function" ||
      t === "symbol" ||
      t === "bigint" ||
      value === undefined
    ) {
      throw new Error(
        `island prop ${path} of <${comp}> is not JSON-serializable (got ${t === "function" ? "a function" : t === "symbol" ? "a symbol" : t === "bigint" ? "a bigint" : "undefined"}). Island props cross to the client via the manifest and must be JSON; define handlers inside the component body instead of passing them in.`
      );
    }
    if (value !== null && t === "object") {
      const obj = value as object;
      if (seen.has(obj)) {
        throw new Error(
          `island prop ${path} of <${comp}> is circular and cannot be JSON-serialized.`
        );
      }
      seen.add(obj);
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          check(value[i], `${path}[${i}]`);
        }
      } else {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          check(v, `${path}.${k}`);
        }
      }
      seen.delete(obj);
    }
  };
  for (const [k, v] of Object.entries(props)) {
    check(v, k);
  }
}

/**
 * Render a boundary node as a hydration island:
 *
 * 1. mint a fresh `id`;
 * 2. pre-serialize the boundary's *static* `children` to an HTML slot (they were authored outside
 *    the component, so they are ordinary nota vnodes — already `struct`'d);
 * 3. record `manifest[id] = { comp: nameOf(v.tag), props: v.props }` (props validated JSON-serializable);
 * 4. SSR the component shell with `▸ = true` — its `h`→`adapter.h`, its `decode`→identity, and a
 *    hook like `useState("red")` bakes its initial state into the markup (the golden's `style:red`);
 * 5. wrap that markup in `<nota-island data-hydration-id="id">…</nota-island>` (see module docs).
 *
 * The slot is handed to the framework as `raw(slot)`: the component forwards it via `@children` onto
 * a host element, whose adapter `h` injects it as innerHTML (no re-escape, no re-parse).
 */
export function island(v: ElementVNode & { tag: CompFn }): string {
  // Validate first — a bad prop fails fast, before minting an id or serializing children (so a
  // throw has no side effects: no orphaned id, no partial manifest entry, no nested-island ids).
  const comp = nameOf(v.tag);
  assertJsonSerializable(v.props, comp);

  const id = freshId();
  const slot = v.children.map(serialize).join("");
  manifest[id] = { comp, props: v.props };

  const adapter = getAdapter();
  // SSR the shell with ▸=true so the component body runs against the framework.
  const shell = withFlag(true, () =>
    adapter.renderToString(adapter.h(v.tag, { ...v.props }, raw(slot)))
  );
  return `<nota-island data-hydration-id="${id}">${shell}</nota-island>`;
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
 * `▸ = false`, `decode = serialize ∘ struct`. So a real emitted `Doc()` **already returns the decoded
 * HTML string**; applying `serialize(struct(...))` to it again would `escape` the whole document
 * (`<ul>` → `&lt;ul&gt;`) and re-run `island`. `render` therefore decodes **once**: if `Doc()` already
 * produced a string (the emitted, self-decoding `Doc`) it is the HTML as is; if `Doc()` returned a
 * raw vnode *tree* (a hand-built `Doc` that does not self-decode) we apply `serialize(struct(...))`.
 * Either way the document is decoded exactly once.
 *
 * The caller must have `setAdapter`'d a framework adapter first (islands SSR through it). The
 * returned `manifest` is a fresh snapshot, so a later `render` cannot mutate it.
 */
export function render(Doc: () => VNode): RenderResult {
  reset();
  const out = Doc();
  const html = typeof out === "string" ? out : serialize(struct(out));
  return { html, manifest: { ...manifest } };
}

// ---------------------------------------------------------------------------------------------
// bootIslands (client)
// ---------------------------------------------------------------------------------------------

/**
 * Client island boot. For each manifest entry, find the island's marker node
 * (`[data-hydration-id="id"]`) and `adapter.hydrate` the registered component — constructed with the
 * manifest props — *into* that node, attaching over the server-rendered shell already in the DOM.
 * `registry` maps a manifest `comp` name to the client component constructor (the build tooling
 * builds it; this module just fixes the boot contract).
 *
 * Missing nodes / missing registry entries are skipped (an island present in one but not the other
 * is a misconfiguration the integrator surfaces) — kept lenient so a partial registry boots what it can.
 *
 * @param root optional DOM subtree to search within (defaults to `document`); injectable for tests.
 */
export function bootIslands(
  manifest: Manifest,
  registry: Record<string, (props: Record<string, unknown>) => unknown>,
  root: { querySelector(s: string): unknown } = globalThisDocument()
): void {
  const adapter = getAdapter();
  for (const [id, entry] of Object.entries(manifest)) {
    const node = root.querySelector(`[data-hydration-id="${id}"]`);
    if (node == null) {
      continue; // no DOM for this island (e.g. pruned) — skip
    }
    const ctor = registry[entry.comp];
    if (ctor == null) {
      continue; // not in this build's registry — skip
    }
    adapter.hydrate(ctor(entry.props), node);
  }
}

/** Resolve the ambient `document` (client), or throw a pointed error if there is none (e.g. Node). */
function globalThisDocument(): { querySelector(s: string): unknown } {
  const doc = (
    globalThis as { document?: { querySelector(s: string): unknown } }
  ).document;
  if (doc == null) {
    throw new Error(
      "bootIslands: no `document` in scope. Call it in a browser/jsdom context, or pass an explicit root element."
    );
  }
  return doc;
}
