/**
 * `jsxify` — the h-call emit → Solid JSX bridge (design/solid.md §The pipeline).
 *
 * The reader still emits the h-call surface (`h`/`Fragment`/`decode` over a bare module); Solid
 * can only SSR/hydrate **compiled JSX** (vite-plugin-solid per-target compilation), so this pass
 * deserializes the emit back into syntax. The emit is mechanically regular — reader-generated
 * calls with user `%`-code interleaved — so the rewrite is a faithful, local transformation:
 *
 * | emit                                            | JSX                                       |
 * |-------------------------------------------------|-------------------------------------------|
 * | `decode(X)` (Doc body wrap)                     | `<NotaDoc>{X′}</NotaDoc>`                 |
 * | `h("p", {…}, kids)`                             | `<p …>{kids′}</p>`                        |
 * | `h("nota-ul-li"/"nota-ol-li", …)`               | `<UlLi>…</UlLi>` / `<OlLi>…</OlLi>`       |
 * | `h(flowTag, …)`                                 | `<flowTag><Reforest>…</Reforest></flowTag>` |
 * | `h(Comp, {…}, kids)`                            | `<Comp …>{kids′}</Comp>`                  |
 * | `Fragment(props?, …kids)`                       | `<>{kids′}</>` (props/key dropped)        |
 * | `xs.map((x,_i) => Fragment({key:_i}, …))`       | `<For each={xs}>{(x,_i) => <>…</>}</For>` |
 * | adjacent string children                        | coalesced into one `{"…"}`                |
 * | `inlineComponent`/`blockComponent`              | untouched (compat shims in @nota-lang/solid) |
 * | everything else (user `%`-code)                 | untouched (h-calls inside it recurse)     |
 *
 * Three rows carry semantics (see the design doc): text coalescing makes a blank source line
 * surface as `"\n\n"` *within one string child* (Reforest's paragraph-break contract);
 * flow-container tags get their interior `<Reforest>` at emit time (the runtime tag tables are
 * gone — restructuring inside an already-rendered element is impossible, so the wrap moves to
 * where the tag is statically known); and the `@for` shape recovers `<For>` (Solid has no `key`;
 * keyed reconciliation is a control-flow component).
 *
 * This pass is the **executable spec for reader vNext's native JSX emit** — when the reader
 * emits JSX directly, this file is deleted.
 */

import generateModule from "@babel/generator";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

// CJS default-export interop (babel ships CJS; the named callable is the default).
const traverse: typeof traverseModule =
  // biome-ignore lint/suspicious/noExplicitAny: CJS interop shape probe.
  ((traverseModule as any).default ?? traverseModule) as typeof traverseModule;
const generate: typeof generateModule =
  // biome-ignore lint/suspicious/noExplicitAny: CJS interop shape probe.
  ((generateModule as any).default ?? generateModule) as typeof generateModule;

/** decode.md's HOST_FLOW_TAGS — the containers whose interior decodes as flow. */
const FLOW_TAGS = new Set([
  "section",
  "article",
  "aside",
  "nav",
  "header",
  "footer",
  "main",
  "div",
  "blockquote",
  "figure",
  "td",
  "th"
]);

/** The reader's list-item sentinels → the Solid runtime's item components. */
const SENTINELS: Record<string, "UlLi" | "OlLi"> = {
  "nota-ul-li": "UlLi",
  "nota-ol-li": "OlLi"
};

/** Which `@nota-lang/solid` / `solid-js` names the rewrite introduced (drives the imports). */
export interface JsxifyUsed {
  NotaDoc: boolean;
  Reforest: boolean;
  UlLi: boolean;
  OlLi: boolean;
  For: boolean;
}

export interface JsxifyResult {
  code: string;
  used: JsxifyUsed;
}

const JSX_ATTR_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Rewrite a reader emit (bare module, h-call surface) into a Solid JSX module. Throws on an emit
 * shape the bridge does not recognize (e.g. a computed `h` tag) — those indicate a reader
 * change this executable spec must learn about, not user error.
 */
export function jsxify(source: string): JsxifyResult {
  const ast = parse(source, { sourceType: "module" });
  const used: JsxifyUsed = {
    NotaDoc: false,
    Reforest: false,
    UlLi: false,
    OlLi: false,
    For: false
  };
  // `.map` calls whose callback body was a reader-keyed Fragment — rewritten to <For> on exit.
  const forMaps = new WeakSet<t.CallExpression>();

  // Plain boolean, NOT a type predicate: the visitor's `node` is already a CallExpression, and a
  // predicate would narrow the false branch of each successive check to `never`.
  const isCallTo = (node: t.CallExpression, name: string): boolean =>
    t.isIdentifier(node.callee) && node.callee.name === name;

  /** JSX children from expression-position nodes, coalescing adjacent string literals. */
  const toChildren = (
    exprs: (t.Expression | t.SpreadElement)[]
  ): (t.JSXElement | t.JSXFragment | t.JSXExpressionContainer)[] => {
    const out: (t.JSXElement | t.JSXFragment | t.JSXExpressionContainer)[] = [];
    let text: string | null = null;
    const flushText = () => {
      if (text !== null) {
        out.push(t.jsxExpressionContainer(t.stringLiteral(text)));
        text = null;
      }
    };
    for (const e of exprs) {
      if (t.isStringLiteral(e)) {
        text = (text ?? "") + e.value;
        continue;
      }
      flushText();
      if (t.isJSXElement(e) || t.isJSXFragment(e)) {
        out.push(e);
      } else if (t.isSpreadElement(e)) {
        // A spread child (never reader-emitted); keep it as a spliced array expression.
        out.push(t.jsxExpressionContainer(t.arrayExpression([e])));
      } else {
        out.push(t.jsxExpressionContainer(e));
      }
    }
    flushText();
    return out;
  };

  /** The child expressions of an h/Fragment call: splice array args, keep the rest. */
  const childExprs = (
    args: (t.Expression | t.SpreadElement | t.ArgumentPlaceholder)[]
  ): (t.Expression | t.SpreadElement)[] => {
    const out: (t.Expression | t.SpreadElement)[] = [];
    for (const a of args) {
      if (t.isArrayExpression(a)) {
        for (const el of a.elements) {
          if (el === null) continue;
          out.push(el);
        }
      } else if (t.isExpression(a) || t.isSpreadElement(a)) {
        out.push(a);
      }
    }
    return out;
  };

  /** JSX attributes from the emit's props object (`null`/`{}` → none). */
  const propsToAttrs = (
    props: t.Expression | undefined
  ): (t.JSXAttribute | t.JSXSpreadAttribute)[] => {
    if (
      props === undefined ||
      t.isNullLiteral(props) ||
      (t.isObjectExpression(props) && props.properties.length === 0)
    ) {
      return [];
    }
    if (!t.isObjectExpression(props)) {
      // A dynamic props expression — spread it.
      return [t.jsxSpreadAttribute(props)];
    }
    const attrs: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];
    for (const p of props.properties) {
      if (t.isSpreadElement(p)) {
        attrs.push(t.jsxSpreadAttribute(p.argument));
        continue;
      }
      if (
        t.isObjectProperty(p) &&
        !p.computed &&
        (t.isIdentifier(p.key) || t.isStringLiteral(p.key)) &&
        t.isExpression(p.value)
      ) {
        const name = t.isIdentifier(p.key) ? p.key.name : p.key.value;
        if (JSX_ATTR_NAME.test(name)) {
          const value = t.isStringLiteral(p.value)
            ? p.value
            : t.jsxExpressionContainer(p.value);
          attrs.push(t.jsxAttribute(t.jsxIdentifier(name), value));
          continue;
        }
      }
      // Computed keys / methods / exotic names: preserve via a one-property spread.
      attrs.push(
        t.jsxSpreadAttribute(t.objectExpression([p as t.ObjectProperty]))
      );
    }
    return attrs;
  };

  const mkElement = (
    name: string,
    attrs: (t.JSXAttribute | t.JSXSpreadAttribute)[],
    children: (t.JSXElement | t.JSXFragment | t.JSXExpressionContainer)[]
  ): t.JSXElement =>
    t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier(name), attrs, children.length === 0),
      children.length === 0 ? null : t.jsxClosingElement(t.jsxIdentifier(name)),
      children,
      children.length === 0
    );

  /** decode(X): X′ as NotaDoc children (a fragment's children splice in). */
  const unwrapDocChildren = (
    x: t.Expression
  ): (t.JSXElement | t.JSXFragment | t.JSXExpressionContainer)[] => {
    if (t.isJSXFragment(x)) {
      return x.children.filter(
        (c): c is t.JSXElement | t.JSXFragment | t.JSXExpressionContainer =>
          t.isJSXElement(c) ||
          t.isJSXFragment(c) ||
          t.isJSXExpressionContainer(c)
      );
    }
    if (t.isArrayExpression(x)) {
      return toChildren(childExprs([x]));
    }
    return toChildren([x]);
  };

  traverse(ast, {
    CallExpression: {
      exit(path) {
        const node = path.node;

        // --- decode(X) → <NotaDoc>{X′}</NotaDoc> ---
        if (isCallTo(node, "decode") && node.arguments.length === 1) {
          const arg = node.arguments[0];
          if (!t.isExpression(arg)) return;
          used.NotaDoc = true;
          path.replaceWith(mkElement("NotaDoc", [], unwrapDocChildren(arg)));
          return;
        }

        // --- Fragment(props?, …kids) → <>…</> (reader-keyed @for shape tags the .map) ---
        if (isCallTo(node, "Fragment")) {
          const args = [...node.arguments];
          let keyed = false;
          if (args.length > 0 && t.isObjectExpression(args[0])) {
            const props = args[0];
            args.shift(); // props (a @for key, or empty) — Solid has no key; drop.
            const arrow = path.parentPath?.node;
            const mapCall = path.parentPath?.parentPath?.node;
            keyed =
              props.properties.length === 1 &&
              t.isObjectProperty(props.properties[0]) &&
              t.isIdentifier(props.properties[0].key, { name: "key" }) &&
              t.isArrowFunctionExpression(arrow) &&
              arrow.body === node &&
              arrow.params.length === 2 &&
              t.isIdentifier(arrow.params[1]) &&
              t.isIdentifier(props.properties[0].value, {
                name: arrow.params[1].name
              }) &&
              t.isCallExpression(mapCall) &&
              t.isMemberExpression(mapCall.callee) &&
              t.isIdentifier(mapCall.callee.property, { name: "map" }) &&
              mapCall.arguments[0] === arrow;
          }
          const children = toChildren(childExprs(args));
          if (keyed) {
            forMaps.add(path.parentPath?.parentPath?.node as t.CallExpression);
          }
          path.replaceWith(
            t.jsxFragment(
              t.jsxOpeningFragment(),
              t.jsxClosingFragment(),
              children
            )
          );
          return;
        }

        // --- h(tag, props?, …kids) → JSX element ---
        if (isCallTo(node, "h") && node.arguments.length >= 1) {
          const [tag, props] = node.arguments;
          const kids = toChildren(childExprs(node.arguments.slice(2)));
          if (t.isStringLiteral(tag)) {
            const sentinel = SENTINELS[tag.value];
            if (sentinel) {
              used[sentinel] = true;
              path.replaceWith(mkElement(sentinel, [], kids));
              return;
            }
            const attrs = propsToAttrs(
              t.isExpression(props) ? props : undefined
            );
            let children = kids;
            if (FLOW_TAGS.has(tag.value) && kids.length > 0) {
              used.Reforest = true;
              children = [mkElement("Reforest", [], kids)];
            }
            path.replaceWith(mkElement(tag.value, attrs, children));
            return;
          }
          if (t.isIdentifier(tag)) {
            const attrs = propsToAttrs(
              t.isExpression(props) ? props : undefined
            );
            path.replaceWith(mkElement(tag.name, attrs, kids));
            return;
          }
          throw new Error(
            `nota jsxify: unsupported h() tag expression (${tag.type}) — the reader emits only string or identifier tags`
          );
        }

        // --- the tagged @for .map → <For each={xs}>{(x,_i) => <>…</>}</For> ---
        if (forMaps.has(node)) {
          const callee = node.callee as t.MemberExpression;
          const arrow = node.arguments[0] as t.ArrowFunctionExpression;
          if (!t.isExpression(callee.object)) return;
          used.For = true;
          path.replaceWith(
            mkElement(
              "For",
              [
                t.jsxAttribute(
                  t.jsxIdentifier("each"),
                  t.jsxExpressionContainer(callee.object)
                )
              ],
              [t.jsxExpressionContainer(arrow)]
            )
          );
        }
      }
    }
  });

  const { code } = generate(ast, {
    retainLines: false,
    comments: true,
    // Keep non-ASCII source text verbatim (the reader's whitespace/text contract is byte-level;
    // an em-dash must not become —).
    jsescOption: { minimal: true }
  });
  return { code, used };
}
