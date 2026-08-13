/**
 * `@nota-lang/runtime` — the public entry.
 *
 * One flat package, one entry point. The reader emits
 * `import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime"`,
 * and the SSG machinery (`struct`/`serialize`/`island`/`render`) lives in the same module.
 *
 * Exposes the static `▸ = false` builders (`h`/`Fragment`, the latter with an optional leading-props
 * arg), `decode`, the component constructors, the structural pass `struct`
 * (`groupLists`/`groupParas`/`groupSections`), the SSG machinery
 * `serialize`/`island`/`render`, and the client replay-hydration driver `hydrateDocument`.
 * The `▸ = true` paths dispatch through an injected
 * `@nota-lang/{react,solid}` adapter; with **no** adapter set, `getAdapter()` throws a
 * pointed "no adapter injected" error rather than a cryptic `undefined is not a function`.
 */

export type { Adapter } from "./adapter.js";
// --- adapter contract (implementations in @nota-lang/{react,solid}) ---
export { clearAdapter, getAdapter, setAdapter } from "./adapter.js";
// --- component types ---
export type { CompBody, CompFn, CompProps } from "./component.js";
export {
  blockComponent,
  inlineComponent,
  isComp,
  nameOf
} from "./component.js";
// --- doc-state: marks & queries + trailer registry ---
export {
  clearTrailers,
  type DocIndex,
  force,
  type IndexedMark,
  indexDoc,
  isMark,
  isQuery,
  type MarkLeaf,
  mark,
  type QueryLeaf,
  query,
  registerTrailer
} from "./doc.js";
// --- the typed emit surface: the Nota-owned per-tag HTML attribute map ---
export type {
  NotaAnchorAttributes,
  NotaGlobalAttributes,
  NotaHostProps,
  NotaImgAttributes,
  NotaInputAttributes,
  NotaIntrinsicElements,
  NotaLabelAttributes,
  NotaOlAttributes,
  NotaTableCellAttributes
} from "./dom.js";
// --- the `▸` mechanism ---
export { flag, withFlag } from "./flag.js";
// --- the emitted-code surface ---
export { decode, Fragment, h, type OmitChildren } from "./h.js";
// --- replay hydration: the client driver + capture ---
export {
  captureRender,
  type HydrationNode,
  type HydrationRoot,
  hydrateDocument
} from "./hydrate.js";
// --- the pre-rendered-HTML marker (adapters import isRaw to inject innerHTML) ---
export { isRaw, type RawHtml, raw } from "./raw.js";
// --- the component registry (ambient-prelude slots + site-wide overrides) ---
export {
  clearRegisteredComponents,
  type RegisteredTag,
  registerComponents,
  registeredComponent,
  slot
} from "./registry.js";
// --- serialize + islands + the SSG driver ---
export {
  beginCapture,
  type CapturedIsland,
  endCapture,
  escape,
  getCaptured,
  getManifest,
  island,
  type Manifest,
  onRenderReset,
  type RenderResult,
  render,
  reset,
  serialize
} from "./serialize.js";

// --- the SSG machinery (struct + serialize/island/render, all implemented) ---
export {
  groupLists,
  groupParas,
  groupSections,
  HOST_BLOCK_TAGS,
  HOST_FLOW_TAGS,
  normalize,
  struct
} from "./struct.js";
// --- vnode data model ---
export {
  type ChildArg,
  type ElementVNode,
  FRAG,
  type Frag,
  flatten,
  isElement,
  isFragment,
  type TemplateFn,
  type VNode
} from "./vnode.js";
