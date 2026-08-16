/**
 * `@nota-lang/solid` — the Nota runtime, specialized to Solid (design/solid.md).
 *
 * A `.nota` document compiles to a plain Solid component whose body is wrapped in {@link NotaDoc}:
 * a document-state provider around a {@link Reforest} pass plus a trailer outlet. Everything the
 * old `@nota-lang/runtime` did with a parallel vnode tree (struct/serialize/islands/replay) is
 * done here with Solid's own primitives:
 *
 * - **Restructuring** ({@link Reforest}): Solid's `children()` helper resolves descendants
 *   *through* component boundaries to real DOM nodes (client) or serialized SSR chunks (server).
 *   Because Solid binds reactivity to node identity rather than tree position, re-parenting those
 *   nodes — wrapping inline runs in `<p>`, coalescing list items, nesting heading-led sections —
 *   is semantically transparent, and the deterministic pass derives the same forest on both
 *   sides, which is what makes hydration of a reforested document work (proven by the reforest
 *   spike: build-time-reforested HTML hydrates with zero mutations).
 * - **Doc-state** ({@link createDocState}): the LaTeX `.aux` model in process. Components
 *   register facts (headings, footnotes, definitions, cites) during render and read derived
 *   facts through memos. {@link renderDocument} renders twice — pass 2 seeded with pass 1's
 *   snapshot so forward references are correct in static HTML — and checks convergence.
 *   {@link hydrateDocument} seeds the store from the page's embedded snapshot so claiming
 *   matches server bytes, then releases the seed and lets reactivity own the numbers.
 *
 * Vendored from the `reforest` spike (`~/Code/reforest`, our own code) with two Nota-specific
 * divergences: sections **nest** (a heading owns following siblings until the next heading of
 * rank ≤ its own — decode.md §struct semantics; the spike was flat by design) and wrapper classes
 * are `nota-para`/`nota-list`/`nota-section`.
 */

import {
  children,
  createContext,
  createMemo,
  createSignal,
  getOwner,
  type JSX,
  onCleanup,
  type ParentProps,
  useContext
} from "solid-js";
import {
  isServer,
  renderToString,
  hydrate as solidHydrate
} from "solid-js/web";

// ===================================================================================================
// Reforest — categorize → parse → rewrap
// ===================================================================================================

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

const isSSRChunk = (c: ResolvedChild): c is SSRChunk =>
  typeof c === "object" && c !== null && typeof (c as SSRChunk).t === "string";

export type ListKind = "ul" | "ol";

/** Syntactic category of a resolved child. */
export type Category =
  | { kind: "inline" }
  | { kind: "block" }
  | { kind: "heading"; level: number }
  | { kind: "item"; list: ListKind }
  | { kind: "skip" };

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
    const dataList = /\bdata-list="(ul|ol)"/.exec(m[2]);
    return categorizeElement(m[1].toLowerCase(), dataList ? dataList[1] : null);
  }
  if (c.nodeType === TEXT_NODE) return { kind: "inline" };
  if (c.nodeType === ELEMENT_NODE) {
    const el = c as Element;
    return categorizeElement(
      el.tagName.toLowerCase(),
      el.getAttribute("data-list")
    );
  }
  return { kind: "skip" }; // comments, etc.
}

/**
 * The forest: Doc ::= (Para | Bare | Block | List | Section)*
 * `bare` occurs only in tight mode — an inline run passed through unwrapped.
 */
export type Item =
  | { kind: "para"; nodes: ResolvedChild[] }
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

  const target = () =>
    stack.length > 0 ? stack[stack.length - 1].items : root;
  const flush = () => {
    if (run.some(c => !isWsOnly(c))) {
      target().push({ kind: tight ? "bare" : "para", nodes: run });
    }
    run = [];
  };

  for (const c of cs) {
    const cat = categorize(c);
    switch (cat.kind) {
      case "skip":
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
    case "para":
      return <p class="nota-para">{it.nodes as unknown as JSX.Element}</p>;
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
};

/**
 * The restructuring pass: resolve children through component boundaries, parse the forest,
 * rewrap. Reactive — a child flipping between inline and block re-parses, and the resolved
 * nodes keep their identity (and therefore their state) across the move.
 */
export function Reforest(props: ReforestProps): JSX.Element {
  const resolved = children(() => props.children);
  const view = createMemo(() =>
    renderItems(parse(resolved.toArray(), { tight: props.tight === true }))
  );
  return <>{view()}</>;
}

/**
 * An unordered list item (the reader's `-` marker); runs of these coalesce into a `<ul>`.
 * Its interior is a tight container: nested item runs coalesce, inline content passes bare.
 */
export function UlLi(props: ParentProps): JSX.Element {
  return (
    <li data-list="ul">
      <Reforest tight>{props.children}</Reforest>
    </li>
  );
}

/** An ordered list item (the reader's `+` marker); runs of these coalesce into an `<ol>`. */
export function OlLi(props: ParentProps): JSX.Element {
  return (
    <li data-list="ol">
      <Reforest tight>{props.children}</Reforest>
    </li>
  );
}

// ===================================================================================================
// textOf — see-through text extraction
// ===================================================================================================

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'"
};

const decodeEntities = (s: string): string =>
  s.replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);

/**
 * The plain text of resolved children — `textContent` on the client, tag-strip + entity-decode
 * on SSR chunks. The same see-through-the-boundary trick {@link categorize} uses, applied to
 * text: this is how `Heading` recovers its title for slugs/Toc entries and how `Tex`/`CodeBlock`
 * recover their source.
 */
export function textOf(cs: ResolvedChild[] | ResolvedChild): string {
  if (Array.isArray(cs)) {
    return cs.map(textOf).join("");
  }
  const c = cs;
  if (c === null || c === undefined || typeof c === "boolean") {
    return "";
  }
  if (typeof c === "string") {
    return c;
  }
  if (typeof c === "number") {
    return String(c);
  }
  if (isSSRChunk(c)) {
    return decodeEntities(c.t.replace(/<[^>]*>/g, ""));
  }
  return c.textContent ?? "";
}

// ===================================================================================================
// Doc-state — the LaTeX .aux model, in process
// ===================================================================================================

/** One registered fact. JSON-serializable fields survive {@link DocState.snapshot}; function-
 * valued fields (e.g. a definition's tooltip thunk) are for same-pass readers and are dropped. */
export type Fact = Record<string, unknown>;

/** A doc-state snapshot: kind → ordered JSON-safe facts. The wire format of the `.aux` model. */
export type Snapshot = Record<string, Fact[]>;

/** The handle {@link DocState.register} returns: the fact plus its 1-based per-kind sequence. */
export interface FactHandle {
  kind: string;
  seq: number;
  fact: Fact;
}

export interface DocState {
  /**
   * Register a fact during render. The stored fact is `{...fact, pos}` where `pos` is a
   * store-global 1-based sequence — cross-kind document order, what "nearest preceding heading"
   * style queries key on. Returns its handle (`seq` is 1-based per kind). On the client the
   * registration auto-unregisters when the owning computation is disposed, so doc-state is
   * reactive under `<Show>`/`<For>`.
   */
  register(kind: string, fact: Fact): FactHandle;
  /** Remove a registration (rarely needed directly — see {@link register}). */
  unregister(h: FactHandle): void;
  /**
   * The **resolved** facts of a kind: the seed snapshot while one is pinned (SSG pass 2,
   * hydration), else the live registrations (reactive). This is what forward-referencing
   * readers (`Toc`, `Ref`) consume.
   */
  read(kind: string): Fact[];
  /**
   * The **live** registrations of a kind (reactive, never seed-pinned). For readers positioned
   * after all registrations — trailers — which need same-pass non-JSON fields (tooltip thunks).
   */
  live(kind: string): Fact[];
  /**
   * Unpin the seed — silently. Readers keep their current (seed-derived, converged-equal)
   * values; the next live registration re-runs them against the live facts. Called after
   * hydration completes.
   */
  release(): void;
  /** The JSON-safe snapshot of live registrations (function-valued fields dropped). */
  snapshot(): Snapshot;
  /** Register a document-end trailer thunk, idempotent by name (first registration wins). */
  trailer(name: string, thunk: () => JSX.Element): void;
  /** The registered trailer thunks, in registration order (reactive). */
  trailers(): (() => JSX.Element)[];
  /** Set a positional flag (e.g. "footnotes-placed" — explicit placement overrides a trailer). */
  flag(name: string): void;
  /** Read a flag (reactive). Positional: set-before-read holds by tree order. */
  hasFlag(name: string): boolean;
  /** Was this store created with a seed (SSG pass 2 / hydration)? */
  readonly seeded: boolean;
}

/**
 * Create a per-document reactive store. With a `seed` (pass 1's snapshot during SSG pass 2; the
 * page-embedded snapshot during hydration), {@link DocState.read} serves the seed until
 * {@link DocState.release} — so forward references resolve to converged values while the live
 * registrations accumulate underneath.
 */
export function createDocState(seed?: Snapshot): DocState {
  const [version, setVersion] = createSignal(0);
  // Deliberately NOT a signal: release() must be silent. At release time live == seed (the
  // document converged), so notifying readers would re-run every doc-state consumer to produce
  // identical output — observable as DOM churn right after hydration. Instead readers keep
  // serving the (equal) seed until the next real registration bumps `version`, which re-runs
  // them under released = true.
  let released = seed === undefined;
  let nextPos = 0;
  const facts = new Map<string, FactHandle[]>();
  const trailerMap = new Map<string, () => JSX.Element>();
  const flags = new Set<string>();
  const bump = () => setVersion(v => v + 1);

  const liveOf = (kind: string): Fact[] => {
    version();
    return (facts.get(kind) ?? []).map(h => h.fact);
  };

  const state: DocState = {
    register(kind, fact) {
      const list = facts.get(kind) ?? [];
      facts.set(kind, list);
      nextPos += 1;
      const handle: FactHandle = {
        kind,
        seq: list.length + 1,
        fact: { ...fact, pos: nextPos }
      };
      list.push(handle);
      bump();
      // Client-side, tie the registration to the owning computation so conditional content
      // unregisters on unmount. Server-side renderToString disposes its root after rendering,
      // which would empty the store before snapshot() — so no cleanup there.
      if (!isServer && getOwner()) {
        onCleanup(() => state.unregister(handle));
      }
      return handle;
    },
    unregister(h) {
      const list = facts.get(h.kind);
      if (!list) return;
      const i = list.indexOf(h);
      if (i >= 0) {
        list.splice(i, 1);
        // Re-sequence: seq stays 1-based registration order.
        list.forEach((entry, k) => {
          entry.seq = k + 1;
        });
        bump();
      }
    },
    read(kind) {
      version(); // track ALWAYS — a pinned reader must still wake on post-release registrations
      if (!released && seed !== undefined) {
        return seed[kind] ?? [];
      }
      return (facts.get(kind) ?? []).map(h => h.fact);
    },
    live: liveOf,
    release() {
      released = true;
    },
    snapshot() {
      const out: Snapshot = {};
      for (const [kind, list] of facts) {
        out[kind] = list.map(h => h.fact);
      }
      // JSON round-trip: drops function-valued/undefined fields, proving the snapshot is wire-safe.
      return JSON.parse(JSON.stringify(out)) as Snapshot;
    },
    trailer(name, thunk) {
      if (!trailerMap.has(name)) {
        trailerMap.set(name, thunk);
        bump();
      }
    },
    trailers() {
      version();
      return [...trailerMap.values()];
    },
    flag(name) {
      flags.add(name);
      bump();
    },
    hasFlag(name) {
      version();
      return flags.has(name);
    },
    get seeded() {
      return seed !== undefined;
    }
  };
  return state;
}

const DocStateContext = createContext<DocState>();

/**
 * The current document's {@link DocState}. Pointed error outside a document — every doc-state
 * consumer (the prelude's `Heading`/`Ref`/`Footnote`/…) must render inside a {@link NotaDoc}.
 */
export function useDocState(): DocState {
  const state = useContext(DocStateContext);
  if (!state) {
    throw new Error(
      "nota: no document state in context — doc-state components must render inside <NotaDoc>"
    );
  }
  return state;
}

/** The context, exported for the render drivers; prefer {@link useDocState} in components. */
export { DocStateContext };

// ===================================================================================================
// NotaDoc — what a document desugars to
// ===================================================================================================

/** Renders the registered trailer thunks (footnote list, definition bank) at document end. */
function TrailerOutlet(): JSX.Element {
  const state = useDocState();
  return <>{state.trailers().map(thunk => thunk())}</>;
}

/**
 * The document wrapper every `.nota` emit returns: adopts an outer {@link DocState} when a
 * driver ({@link renderDocument}/{@link hydrateDocument}) provides one — else self-sufficient
 * with a fresh store (tests, pure CSR) — and renders the reforested children in an
 * `<article class="nota-doc">` followed by the trailers.
 */
export function NotaDoc(props: ParentProps): JSX.Element {
  const outer = useContext(DocStateContext);
  const state = outer ?? createDocState();
  return (
    <DocStateContext.Provider value={state}>
      <article class="nota-doc">
        <Reforest>{props.children}</Reforest>
        <TrailerOutlet />
      </article>
    </DocStateContext.Provider>
  );
}

// ===================================================================================================
// Render drivers — SSG (two-pass) + hydration
// ===================================================================================================

/** A document component (the `.nota` emit's default export). */
export type DocComponent = () => JSX.Element;

/** The result of {@link renderDocument}. */
export interface RenderedDocument {
  /** The document HTML (pass 2 — forward references resolved). */
  html: string;
  /** The converged doc-state snapshot; embed via {@link docStateScript} for hydration. */
  state: Snapshot;
}

/**
 * SSG: render `Doc` twice. Pass 1 populates the store (forward reads see placeholders; its HTML
 * is discarded). Pass 2 renders with pass 1's snapshot pinned as the seed, so forward references
 * are correct in the static HTML. Pass 2's registrations must reproduce the seed — a mismatch
 * throws "did not converge" (a fact that depends on reading another fact cannot stabilize; the
 * old "query output may not introduce new marks" rule, now emergent).
 */
export function renderDocument(Doc: DocComponent): RenderedDocument {
  const pass1 = createDocState();
  renderToString(() => (
    <DocStateContext.Provider value={pass1}>
      <Doc />
    </DocStateContext.Provider>
  ));
  const seed = pass1.snapshot();

  const pass2 = createDocState(seed);
  const html = renderToString(() => (
    <DocStateContext.Provider value={pass2}>
      <Doc />
    </DocStateContext.Provider>
  ));
  const post = pass2.snapshot();
  if (JSON.stringify(post) !== JSON.stringify(seed)) {
    throw new Error(
      "nota: document did not converge — a registration changed between passes " +
        "(doc-state facts may not depend on reading other doc-state facts)\n" +
        `pass 1: ${JSON.stringify(seed)}\npass 2: ${JSON.stringify(post)}`
    );
  }
  return { html, state: seed };
}

/** The id of the embedded doc-state snapshot script. */
export const DOC_STATE_ID = "nota-doc-state";

/**
 * The embeddable snapshot: `<script type="application/json" id="nota-doc-state">…</script>`.
 * `<` is escaped so `</script>`-shaped content cannot break out of the element.
 */
export function docStateScript(state: Snapshot): string {
  const json = JSON.stringify(state).replace(/</g, "\\u003c");
  return `<script type="application/json" id="${DOC_STATE_ID}">${json}</script>`;
}

/** Options for {@link hydrateDocument}. */
export interface HydrateOptions {
  /** The container holding the server-rendered document. Default: `#nota-root`, else `<body>`. */
  root?: Element;
}

/**
 * Client boot: read the page's embedded snapshot ({@link docStateScript}), seed a store with it,
 * and `hydrate` — every doc-state read during claiming matches the server bytes. Once hydration
 * returns the seed is released: resolved reads switch to the (identical, converged) live facts
 * and reactivity owns the numbers from then on. Returns Solid's dispose function.
 */
export function hydrateDocument(
  Doc: DocComponent,
  opts: HydrateOptions = {}
): () => void {
  const root =
    opts.root ?? document.getElementById("nota-root") ?? document.body;
  const seedEl = document.getElementById(DOC_STATE_ID);
  const seed =
    seedEl?.textContent != null && seedEl.textContent !== ""
      ? (JSON.parse(seedEl.textContent) as Snapshot)
      : undefined;
  const state = createDocState(seed);
  const dispose = solidHydrate(
    () => (
      <DocStateContext.Provider value={state}>
        <Doc />
      </DocStateContext.Provider>
    ),
    root
  );
  state.release();
  return dispose;
}

// ===================================================================================================
// Compat shims — the marked-constructor surface, dissolved
// ===================================================================================================

/**
 * Compat sugar for the emit's `inlineComponent((children, props) => …)` calls. The inline/block
 * kind distinction is gone — {@link Reforest} categorizes a component by the root element it
 * actually renders, seen through the boundary — so both constructors reduce to props plumbing.
 * Reader vNext emits plain arrows and these disappear.
 */
export function inlineComponent<P extends { children?: JSX.Element }>(
  fn: (children: JSX.Element | undefined, props: P) => JSX.Element,
  _name?: string
): (props: P) => JSX.Element {
  return props => fn(props.children, props);
}

/** See {@link inlineComponent} — the kind distinction is dissolved. */
export const blockComponent = inlineComponent;
