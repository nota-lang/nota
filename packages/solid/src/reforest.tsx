/**
 * Reforest — the restructuring pass: categorize → parse → rewrap (design/solid.md §Reforest).
 *
 * Solid's `children()` helper resolves descendants *through* component boundaries to real DOM
 * nodes (client) or serialized SSR chunks (server). Because Solid binds reactivity to node
 * identity rather than tree position, re-parenting those nodes — wrapping inline runs in `<p>`,
 * coalescing list items, nesting heading-led sections — is semantically transparent, and the
 * deterministic pass derives the same forest on both sides, which is what makes hydration of a
 * reforested document work (proven by the reforest spike: build-time-reforested HTML hydrates
 * with zero mutations).
 *
 * Vendored from the `reforest` spike (`~/Code/reforest`, our own code) with two Nota-specific
 * divergences: sections **nest** (a heading owns following siblings until the next heading of
 * rank ≤ its own — decode.md §struct semantics; the spike was flat by design) and wrapper classes
 * are `nota-para`/`nota-list`/`nota-section`.
 */

import {
  children,
  createMemo,
  type JSX,
  type ParentProps,
  splitProps,
  useContext
} from "solid-js";
import { NoHydration } from "solid-js/web";
import { DocStateContext } from "./doc-state";
import { type SmartOptions, smarten } from "./smart";

/**
 * A serialized SSR output chunk, as produced by solid-js/web's server `ssr()` runtime. On the
 * server, `children()` resolves to these instead of Nodes.
 */
export type SSRChunk = { t: string };

/** A child as resolved by Solid's `children()` helper (client or server). */
export type ResolvedChild =
  | Node
  | SSRChunk
  | string
  | number
  | boolean
  | null
  | undefined;

export const isSSRChunk = (c: ResolvedChild): c is SSRChunk =>
  typeof c === "object" && c !== null && typeof (c as SSRChunk).t === "string";

export type ListKind = "ul" | "ol";

/** Syntactic category of a resolved child. */
export type Category =
  | { kind: "inline" }
  | { kind: "block" }
  | { kind: "heading"; level: number }
  | { kind: "item"; list: ListKind }
  | { kind: "attrs" }
  | { kind: "skip" };

/** The attrs-marker attribute the {@link Attrs} component renders (notation.md §Attrs). */
const ATTRS_MARKER = "data-nota-attrs";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Phrasing-content tags per the HTML content model (abridged). */
const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "button",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "img",
  "input",
  "kbd",
  "label",
  "mark",
  "math",
  "q",
  "ruby",
  "s",
  "samp",
  "select",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "svg",
  "textarea",
  "time",
  "u",
  "var",
  "wbr"
]);

const HEADING_RE = /^h([1-6])$/;

const categorizeElement = (tag: string, dataList: string | null): Category => {
  const heading = HEADING_RE.exec(tag);
  if (heading) return { kind: "heading", level: Number(heading[1]) };
  if (tag === "li") {
    return { kind: "item", list: dataList === "ol" ? "ol" : "ul" };
  }
  return INLINE_TAGS.has(tag) ? { kind: "inline" } : { kind: "block" };
};

export function categorize(c: ResolvedChild): Category {
  if (c === null || c === undefined || typeof c === "boolean") {
    return { kind: "skip" };
  }
  if (typeof c === "string" || typeof c === "number") {
    return { kind: "inline" };
  }
  if (isSSRChunk(c)) {
    // Server: recover the root tag (and list kind) by sniffing the serialized chunk. The chunk
    // is a component's already-rendered output, so this sees through component boundaries the
    // same way node inspection does on the client.
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/.exec(c.t);
    if (!m) return { kind: "inline" }; // marker-led or bare-text chunk
    if (m[2].includes(ATTRS_MARKER)) return { kind: "attrs" };
    const dataList = /\bdata-list="(ul|ol)"/.exec(m[2]);
    return categorizeElement(m[1].toLowerCase(), dataList ? dataList[1] : null);
  }
  if (c.nodeType === TEXT_NODE) return { kind: "inline" };
  if (c.nodeType === ELEMENT_NODE) {
    const el = c as Element;
    if (el.hasAttribute(ATTRS_MARKER)) return { kind: "attrs" };
    return categorizeElement(
      el.tagName.toLowerCase(),
      el.getAttribute("data-list")
    );
  }
  return { kind: "skip" }; // comments, etc.
}

/** String-valued attributes extracted from an attrs marker (Solid's own bookkeeping skipped). */
export type ExtractedAttrs = Record<string, string>;

const SKIPPED_MARKER_ATTRS = new Set([ATTRS_MARKER, "data-hk"]);

const unescapeHtml = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Pull the string attributes off an attrs marker (client: real attributes; server: the chunk's
 * opening tag). This is why attrs sugar carries **string-valued** props only — anything else
 * cannot round-trip through the rendered marker.
 */
function extractAttrs(c: Node | SSRChunk): ExtractedAttrs {
  const out: ExtractedAttrs = {};
  if (isSSRChunk(c)) {
    const m = /^<[a-zA-Z][a-zA-Z0-9-]*((?:"[^"]*"|'[^']*'|[^>"'])*)>/.exec(c.t);
    if (!m) return out;
    const attr = /([a-zA-Z_:][-\w:.]*)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
    for (const a of m[1].matchAll(attr)) {
      if (SKIPPED_MARKER_ATTRS.has(a[1])) continue;
      out[a[1]] = unescapeHtml(a[2] ?? a[3] ?? "");
    }
    return out;
  }
  for (const attr of (c as Element).attributes) {
    if (SKIPPED_MARKER_ATTRS.has(attr.name)) continue;
    out[attr.name] = attr.value;
  }
  return out;
}

/**
 * The forest: Doc ::= (Para | Bare | Block | List | Section)*
 * `bare` occurs only in tight mode — an inline run passed through unwrapped.
 */
export type Item =
  | { kind: "para"; nodes: ResolvedChild[]; attrs?: ExtractedAttrs }
  | { kind: "bare"; nodes: ResolvedChild[] }
  | { kind: "block"; node: Node | SSRChunk }
  | { kind: "list"; list: ListKind; items: (Node | SSRChunk)[] }
  | {
      kind: "section";
      level: number;
      heading: Node | SSRChunk;
      items: Item[];
    };

const isWsOnly = (c: ResolvedChild): boolean => {
  if (typeof c === "string") return !/\S/.test(c);
  if (
    !isSSRChunk(c) &&
    typeof Node !== "undefined" &&
    c instanceof Node &&
    c.nodeType === TEXT_NODE
  ) {
    return !/\S/.test(c.textContent ?? "");
  }
  return false;
};

/**
 * A blank line inside a string child acts as a paragraph break (the reader emits interior
 * newlines as text; the compiler coalesces adjacent text children, so a blank source line
 * arrives as `"\n\n"` within one string — decode.md's producer contract, consumed here).
 */
const PARA_BREAK = /[ \t]*\n\s*\n[ \t]*/;

/** Options for {@link parse}. */
export interface ParseOptions {
  /**
   * Tight mode (`<li>`, authored `@p{…}` interiors): coalesce list-item runs only — inline runs
   * pass through unwrapped (no `<p>`, no paragraph breaks) and headings/blocks pass through bare
   * (no sections). This is the old struct's "tight nodes get only groupLists".
   */
  tight?: boolean;
}

/**
 * Parse a flat run of categorized children into a forest:
 * - inline runs become paragraphs; a blank line inside a string child breaks the run into
 *   separate paragraphs (tight mode: runs pass through verbatim instead);
 * - blocks pass through, interrupting the current paragraph;
 * - a heading closes every open section of rank ≥ its own and opens a new one that absorbs
 *   subsequent items — sections **nest** (h3 under h2 nests; the next h2 closes both);
 * - runs of `<li data-list="ul|ol">` coalesce into a `<ul>`/`<ol>` per kind; whitespace-only
 *   siblings between same-kind items bridge the run (a paragraph break between items does not
 *   split a list — only real content does).
 */
export function parse(cs: ResolvedChild[], opts: ParseOptions = {}): Item[] {
  const tight = opts.tight === true;
  const root: Item[] = [];
  const stack: { level: number; items: Item[] }[] = [];
  let run: ResolvedChild[] = [];
  let runAttrs: ExtractedAttrs | undefined;

  const target = () =>
    stack.length > 0 ? stack[stack.length - 1].items : root;
  const flush = () => {
    const attrs = runAttrs;
    runAttrs = undefined;
    if (run.some(c => !isWsOnly(c))) {
      target().push(
        tight
          ? { kind: "bare", nodes: run }
          : { kind: "para", nodes: run, attrs }
      );
    } else if (attrs && !tight) {
      // A lone attrs marker (its own paragraph position) attaches to the preceding paragraph;
      // after any other item it has no target and is dropped (v0 — use native props there).
      const t = target();
      const last = t[t.length - 1];
      if (last?.kind === "para") {
        last.attrs = { ...(last.attrs ?? {}), ...attrs };
      }
    }
    run = [];
  };

  for (const c of cs) {
    const cat = categorize(c);
    switch (cat.kind) {
      case "skip":
        break;
      case "attrs":
        // The marker is stripped; its attributes decorate the paragraph being formed (tight
        // containers take no paragraph attrs — hoisted attrs arrive as real props instead).
        if (!tight) {
          runAttrs = {
            ...(runAttrs ?? {}),
            ...extractAttrs(c as Node | SSRChunk)
          };
        }
        break;
      case "inline":
        if (!tight && typeof c === "string" && PARA_BREAK.test(c)) {
          c.split(PARA_BREAK).forEach((segment, i) => {
            if (i > 0) flush();
            run.push(segment);
          });
        } else {
          run.push(c);
        }
        break;
      case "heading": {
        if (tight) {
          // No sections in tight containers; the heading passes through as a block sibling.
          flush();
          target().push({ kind: "block", node: c as Node | SSRChunk });
          break;
        }
        flush();
        while (stack.length > 0 && stack[stack.length - 1].level >= cat.level) {
          stack.pop();
        }
        const sec: Item = {
          kind: "section",
          level: cat.level,
          heading: c as Node | SSRChunk,
          items: []
        };
        target().push(sec);
        stack.push({ level: cat.level, items: sec.items });
        break;
      }
      case "item": {
        flush();
        const t = target();
        const last = t[t.length - 1];
        if (last && last.kind === "list" && last.list === cat.list) {
          last.items.push(c as Node | SSRChunk);
        } else {
          t.push({
            kind: "list",
            list: cat.list,
            items: [c as Node | SSRChunk]
          });
        }
        break;
      }
      case "block":
        flush();
        target().push({ kind: "block", node: c as Node | SSRChunk });
        break;
    }
  }
  flush();
  return root;
}

/**
 * Materialize the forest as ordinary Solid JSX, placing the already-resolved nodes into slots of
 * freshly created wrappers. The wrappers are stateless, so recreating them on re-parse is safe;
 * the resolved nodes are moved, not recreated, so their state survives.
 */
function renderItem(it: Item): JSX.Element {
  switch (it.kind) {
    case "para": {
      // Attr-less paragraphs (the common case) take the static path — the spread path routes
      // Solid through its class/classList join, whose serialization differs cosmetically.
      const attrs = it.attrs;
      if (!attrs || Object.keys(attrs).length === 0) {
        return <p class="nota-para">{it.nodes as unknown as JSX.Element}</p>;
      }
      const merged = {
        ...attrs,
        class: attrs.class ? `nota-para ${attrs.class}` : "nota-para"
      };
      return (
        <p {...(merged as JSX.HTMLAttributes<HTMLParagraphElement>)}>
          {it.nodes as unknown as JSX.Element}
        </p>
      );
    }
    case "bare":
      return it.nodes as unknown as JSX.Element;
    case "block":
      // On the server, SSR chunks pass through JSX slots untouched (resolveSSRNode emits
      // chunk.t verbatim), symmetric to Nodes on the client — hence the cast.
      return it.node as unknown as JSX.Element;
    case "list": {
      const items = it.items as unknown as JSX.Element;
      return it.list === "ul" ? (
        <ul class="nota-list">{items}</ul>
      ) : (
        <ol class="nota-list">{items}</ol>
      );
    }
    case "section":
      return (
        <section class="nota-section">
          {it.heading as unknown as JSX.Element}
          {renderItems(it.items)}
        </section>
      );
  }
}

function renderItems(items: Item[]): JSX.Element {
  return items.map(renderItem);
}

/** Props for {@link Reforest}. */
export type ReforestProps = ParentProps & {
  /** Tight mode — see {@link ParseOptions.tight}. */
  tight?: boolean;
  /**
   * Smart-punctuation override for this pass. Default: the document store's setting (threaded by
   * `renderDocument`/`hydrateDocument`), else all passes on. `false` disables the pass.
   */
  smart?: SmartOptions | false;
};

/**
 * The restructuring pass: resolve children through component boundaries, smarten punctuation
 * (Pollen's rules — `./smart.ts`), parse the forest, rewrap. Reactive — a child flipping between
 * inline and block re-parses, and the resolved nodes keep their identity (and therefore their
 * state) across the move.
 */
export function Reforest(props: ReforestProps): JSX.Element {
  const state = useContext(DocStateContext);
  const resolved = children(() => props.children);
  const view = createMemo(() =>
    renderItems(
      parse(smarten(resolved.toArray(), props.smart ?? state?.smart), {
        tight: props.tight === true
      })
    )
  );
  return <>{view()}</>;
}

/**
 * The attrs-group marker (notation.md §Attrs): a flow-position `[props]` group lowers to
 * `<Attrs …/>`, which renders this invisible marker; {@link parse} strips it and applies its
 * **string-valued** attributes to the paragraph it is forming. Rendered under `NoHydration`:
 * the marker never reaches the reforested output, so it must not claim a hydration key.
 */
export function Attrs(props: Record<string, unknown>): JSX.Element {
  return (
    <NoHydration>
      <span
        data-nota-attrs=""
        {...(props as JSX.HTMLAttributes<HTMLSpanElement>)}
      />
    </NoHydration>
  );
}

/** Extra list-item props (a hoisted `- item [class: "hot"]` attrs group) spread onto the `<li>`. */
type LiProps = ParentProps & Record<string, unknown>;

/**
 * An unordered list item (the reader's `-` marker); runs of these coalesce into a `<ul>`.
 * Its interior is a tight container: nested item runs coalesce, inline content passes bare.
 * Non-children props (a hoisted trailing attrs group) spread onto the rendered `<li>`.
 */
export function UlLi(props: LiProps): JSX.Element {
  const [own, rest] = splitProps(props, ["children"]);
  return (
    <li {...(rest as JSX.LiHTMLAttributes<HTMLLIElement>)} data-list="ul">
      <Reforest tight>{own.children}</Reforest>
    </li>
  );
}

/** An ordered list item (the reader's `+` marker); runs of these coalesce into an `<ol>`. */
export function OlLi(props: LiProps): JSX.Element {
  const [own, rest] = splitProps(props, ["children"]);
  return (
    <li {...(rest as JSX.LiHTMLAttributes<HTMLLIElement>)} data-list="ol">
      <Reforest tight>{own.children}</Reforest>
    </li>
  );
}
