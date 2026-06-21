/**
 * `@nota-lang/solid` — the Solid framework {@link Adapter} for the Nota runtime (implementation.md
 * §2.3 E3; decode.md §"Serialize + islands").
 *
 * Mirror of `@nota-lang/react`, mapping the four-method `Adapter` surface onto Solid. **Solid has no
 * single hyperscript that works in both environments** — `solid-js/h` builds *DOM* (client only;
 * needs `document`), while SSR string rendering uses the compiler's `ssr*` primitives. So this
 * adapter branches on Solid's `isServer`:
 *
 * | Adapter method        | Server (`isServer`)                              | Client                       |
 * |-----------------------|--------------------------------------------------|------------------------------|
 * | `h(host, …)`          | `ssrElement(tag, props, kids, needsId=true)`     | `solid-js/h`'s `h(tag, …)`   |
 * | `h(Component, …)`     | `createComponent(comp, props)`                   | `createComponent` / `h`      |
 * | `Fragment(kids)`      | the children array (Solid fragment)              | the children array           |
 * | `renderToString(el)`  | `solid-js/web` `renderToString(() => el)` (sync) | (client build forbids it)    |
 * | `hydrate(el, node)`   | —                                                | `solid-js/web` `hydrate`     |
 *
 * `ssrElement` emits Solid's hydration keys (`needsId`) so a client `hydrate` aligns with the SSR'd
 * markup, and itself handles attributes / style objects / boolean attrs / event-handler stripping /
 * the `innerHTML` slot — the same concerns the runtime's static `serialize` covers for host nodes.
 *
 * **The raw slot.** A boundary's pre-serialized static children arrive as a {@link RawHtml} marker
 * (the runtime's `raw(slot)`). On a *host* element it becomes the `innerHTML` prop (server:
 * `ssrElement` leaves `innerHTML` unescaped; client: Solid's `innerHTML` prop). On a *component* it
 * is forwarded as the component's child (it re-emerges on a host via `@children`), since `innerHTML`
 * is only valid on a host element.
 */

import type { Adapter } from "@nota-lang/runtime";
import { isRaw, type RawHtml } from "@nota-lang/runtime";
import clientH from "solid-js/h";
import {
  createComponent,
  hydrate,
  isServer,
  renderToString,
  ssrElement
} from "solid-js/web";

/** Separate a raw-HTML slot from ordinary children (host-vs-component decision made by the caller). */
function splitChildren(children: unknown): {
  raw?: RawHtml;
  kids: unknown[];
} {
  if (isRaw(children)) {
    return { raw: children, kids: [] };
  }
  if (Array.isArray(children)) {
    const rawChild = children.find(isRaw) as RawHtml | undefined;
    if (rawChild) {
      return { raw: rawChild, kids: [] };
    }
    return { kids: children };
  }
  if (children == null) {
    return { kids: [] };
  }
  return { kids: [children] };
}

export const adapter: Adapter = {
  h(tag, props, children) {
    const { raw, kids } = splitChildren(children);
    const base = (props ?? {}) as Record<string, unknown>;

    // --- component tag: createComponent in both environments ---
    if (typeof tag !== "string") {
      const compProps: Record<string, unknown> = { ...base };
      if (raw !== undefined) {
        compProps.children = raw; // forwarded; re-emerges as innerHTML on a host via @children
      } else if (kids.length > 0) {
        compProps.children = kids.length === 1 ? kids[0] : kids;
      }
      // biome-ignore lint/suspicious/noExplicitAny: Solid's component-tag typing is structural.
      return createComponent(tag as any, compProps as any);
    }

    // --- host tag with a raw slot: innerHTML ---
    if (raw !== undefined) {
      if (isServer) {
        return ssrElement(
          tag,
          { ...base, innerHTML: raw.html },
          undefined,
          true
        );
      }
      return clientH(tag, { ...base, innerHTML: raw.html });
    }

    // --- ordinary host element ---
    if (isServer) {
      const kid =
        kids.length === 1 ? kids[0] : kids.length === 0 ? undefined : kids;
      return ssrElement(tag, base, kid, true);
    }
    return clientH(tag, base, ...kids);
  },

  Fragment(children) {
    const { kids } = splitChildren(children);
    // Solid treats an array of nodes as a fragment in both environments.
    return kids;
  },

  renderToString(el) {
    return renderToString(() => el as never);
  },

  hydrate(el, container) {
    hydrate(() => el as never, container as Element);
  }
};

export default adapter;
