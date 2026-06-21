/**
 * `@nota-lang/runtime` — the public entry (implementation.md §2.1).
 *
 * One flat package, one entry point. The reader (Part 1) emits
 * `import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime"`,
 * and the SSG machinery (`struct`/`serialize`/`island`/`render`) lives in the same module.
 *
 * Phases G–K are implemented and green: the static `▸ = false` builders (`h`/`Fragment`, the latter
 * with the E5 optional leading-props arg — contract §4), `decode`, the component constructors, the
 * structural pass `struct` (`groupLists`/`groupParas`/`groupSections`), and the SSG machinery
 * `serialize`/`island`/`render`/`bootIslands`. The `▸ = true` paths dispatch through an injected
 * `@nota-lang/{react,solid}` adapter (Phase J); with **no** adapter set, `getAdapter()` throws a
 * pointed "no adapter injected" error rather than a cryptic `undefined is not a function`.
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

// --- the SSG machinery (struct + serialize/island/render, all implemented) ---
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
