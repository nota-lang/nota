/**
 * `@nota-lang/runtime` — the public entry (implementation.md §2.1).
 *
 * One flat package, one entry point. The reader (Part 1) emits
 * `import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime"`,
 * and the SSG machinery (`struct`/`serialize`/`island`/`render`) lives in the same module.
 *
 * Wave scope (Phases G + H): the static `▸ = false` builders (`h`/`Fragment`), `decode`, the
 * component constructors, and the structural pass `struct` (with `groupLists`/`groupParas`/
 * `groupSections`). `serialize`/`island`/`render`/`bootIslands` are type stubs (Phases I/K) and
 * the `▸ = true` adapter paths throw "no adapter injected" until adapters land (Phase J).
 */

export type { Adapter } from "./adapter";
// --- adapter contract (impl §2.3; implementations in @nota-lang/{react,solid}) ---
export { clearAdapter, getAdapter, setAdapter } from "./adapter";
// --- component types ---
export type { CompBody, CompFn, CompProps } from "./component";
export {
  blockComponent,
  inlineComponent,
  isComp,
  nameOf
} from "./component";
// --- the `▸` mechanism ---
export { flag, withFlag } from "./flag";
// --- the emitted-code surface (contract §1) ---
export { decode, Fragment, h } from "./h";
// --- the pre-rendered-HTML marker (adapters import isRaw to inject innerHTML) ---
export { isRaw, type RawHtml, raw } from "./raw";
// --- serialize + islands + the SSG driver ---
export {
  bootIslands,
  escape,
  getManifest,
  island,
  type Manifest,
  type RenderResult,
  render,
  reset,
  serialize
} from "./serialize";

// --- the SSG machinery (struct is real this wave; the rest are Phase I/K stubs) ---
export {
  groupLists,
  groupParas,
  groupSections,
  HOST_BLOCK_TAGS,
  HOST_FLOW_TAGS,
  struct
} from "./struct";
// --- vnode data model ---
export {
  type ChildArg,
  type ElementVNode,
  FRAG,
  type Frag,
  flatten,
  isElement,
  isFragment,
  type VNode
} from "./vnode";
