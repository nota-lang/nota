/**
 * `@nota-lang/react` — the React framework {@link Adapter} for the Nota runtime (implementation.md
 * §2.3 E3; decode.md §"Serialize + islands").
 *
 * The runtime is framework-agnostic: under `▸ = true` (inside a component body during island SSR /
 * client hydration) `h`/`Fragment` dispatch through whichever adapter was `setAdapter`'d, and
 * `island` renders/hydrates through it. This module maps the four-method `Adapter` surface onto
 * React:
 *
 * | Adapter method        | React                                                   |
 * |-----------------------|---------------------------------------------------------|
 * | `h(tag, props, kids)` | `React.createElement(tag, props, …kids)`                |
 * | `Fragment(kids)`      | `React.createElement(React.Fragment, null, …kids)`      |
 * | `renderToString(el)`  | `react-dom/server`'s `renderToString` (synchronous)     |
 * | `hydrate(el, node)`   | `react-dom/client`'s `hydrateRoot(node, el)`            |
 *
 * **The raw slot.** A boundary's pre-serialized static children arrive as a {@link RawHtml} marker
 * (via the runtime's `raw(slot)`). When it appears among an element's children, the element is
 * rendered with `dangerouslySetInnerHTML` and no React children — so the slot HTML is injected
 * verbatim rather than re-parsed/escaped (decode.md §"Component slots").
 */

import type { Adapter } from "@nota-lang/runtime";
import { isRaw, type RawHtml } from "@nota-lang/runtime";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

/**
 * Normalize the heterogeneous `children` the runtime hands `h` into `{ raw?, kids }`:
 *
 * - `raw` — the HTML of a {@link RawHtml} slot, if one is present (from `island`'s `adapter.h(…,
 *   raw(slot))`, or a component forwarding its slot via `h(host, …, children)` →
 *   `flatten([raw])` → `[RawHtml]`). A slot is exclusive.
 * - `kids` — the ordinary React children otherwise (strings / nested React elements).
 *
 * The host-vs-component decision (innerHTML vs pass-through child) is made by the caller, since
 * `dangerouslySetInnerHTML` is only valid on a host element — see {@link adapter.h}.
 */
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
    if (raw !== undefined) {
      if (typeof tag === "string") {
        // host element: inject the pre-rendered slot as innerHTML, no React children.
        return React.createElement(tag as React.ElementType, {
          ...base,
          dangerouslySetInnerHTML: { __html: raw.html }
        });
      }
      // component: the slot is the component's `children` — it forwards it via `@children` onto a
      // host element, where the host branch above turns it into innerHTML. Pass it through as a child.
      return React.createElement(
        tag as React.ElementType,
        props as React.Attributes | null,
        raw as unknown as React.ReactNode
      );
    }
    return React.createElement(
      tag as React.ElementType,
      props as React.Attributes | null,
      ...(kids as React.ReactNode[])
    );
  },

  Fragment(children) {
    const { kids } = splitChildren(children);
    return React.createElement(
      React.Fragment,
      null,
      ...(kids as React.ReactNode[])
    );
  },

  renderToString(el) {
    return renderToString(el as React.ReactElement);
  },

  hydrate(el, container) {
    // React 18+ argument order is (container, element).
    hydrateRoot(container as Element | Document, el as React.ReactNode);
  }
};

export default adapter;
