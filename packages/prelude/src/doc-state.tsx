/**
 * The prelude doc-state constructs over the **unified reference registry**
 * (design/references.md): headings + numbering + a table of contents, `@Label`, the one `@Ref`
 * (every reference kind is a dispatch arm), footnotes, `@Cite`/`@Bibliography` — plain Solid
 * components over the `@nota-lang/core` doc-state store. Everything referenceable registers an
 * `anchor` fact; every use registers a `ref` fact; numbering/resolution/backlinks are the pure
 * derivations in ./refs.
 *
 * ## Resolution-error policy
 * A *missing target* (`@Ref` to nothing) throws **only when the store is seeded** — i.e. when
 * resolution runs against a complete document (SSG pass 2, hydration). Unseeded renders (SSG
 * pass 1, pure CSR) see the document *so far*, where a forward target legitimately hasn't
 * registered yet, so they render a visible `?` placeholder instead; in CSR it self-heals
 * reactively when the target mounts. *Duplicates* throw wherever detected — more facts never
 * fix a duplicate.
 *
 * ## Ordering
 * Facts carry the store's cross-kind `pos` (registration = mount order), which stands in for
 * the old global DFS `pos`: "nearest preceding heading" and first-use numbering key on it.
 * Components find their own fact by `pos` (never by captured `seq`, which the store
 * re-sequences on unmount). A construct rendered inside a trailer thunk (a cite in a footnote
 * body) registers at the trailer's position — an approximation of the old index-at-parent
 * semantics, flagged in the design doc.
 */

import {
  Reforest,
  type ResolvedChild,
  textOf,
  useDocState
} from "@nota-lang/core";
import {
  children,
  type JSX,
  type ParentProps,
  Show,
  splitProps
} from "solid-js";
import { Dynamic } from "solid-js/web";

import { config } from "./config";
import {
  ANCHOR_KINDS,
  type AnchorFact,
  anchorOrdinals,
  anchorsOf,
  FACT_KINDS,
  headingIds,
  headingNumbers,
  type RefFact,
  type ResolvedAnchor,
  refTargetKey,
  resolveAnchors,
  useNumbers
} from "./refs";

// =============================================================================================
// Shared helpers
// =============================================================================================

/**
 * Title text of resolved heading/cite children, skipping the prelude's own meta elements
 * (footnote `<sup class="nota-fnref">`, cite links) so a footnote inside a heading doesn't leak
 * its number into the slug/Toc entry — the analogue of the old textContent's mark/query skip.
 */
function titleTextOf(parts: ResolvedChild[]): string {
  const META_CLASS = /\bnota-(fnref|cite|secnum)\b/;
  let out = "";
  for (const part of parts) {
    if (part === null || part === undefined || typeof part === "boolean") {
      continue;
    }
    if (typeof part === "string" || typeof part === "number") {
      out += textOf(part);
      continue;
    }
    if (typeof (part as { t?: string }).t === "string") {
      const chunk = (part as { t: string }).t;
      const cls = /^<[a-zA-Z][^>]*\bclass="([^"]*)"/.exec(chunk);
      if (cls && META_CLASS.test(cls[1])) {
        continue;
      }
      out += textOf(part);
      continue;
    }
    const el = part as Node;
    if (
      el.nodeType === 1 &&
      META_CLASS.test((el as Element).getAttribute("class") ?? "")
    ) {
      continue;
    }
    out += textOf(part);
  }
  return out;
}

/** The visible unresolved-forward-reference placeholder (unseeded renders only; see module docs). */
const PENDING = "?";

/** The unresolved-forward placeholder link: `?` (or the authored text) with an inert href. */
function PendingRef(props: { children?: JSX.Element }): JSX.Element {
  return (
    // biome-ignore lint/a11y/useValidAnchor: pending refs keep the inert legacy "#" href — CSR self-heals it into the real target.
    <a href="#" class="nota-ref">
      {props.children ?? PENDING}
    </a>
  );
}

/** The store's anchor facts (resolved view — seed-pinned during SSG pass 2 / hydration). */
function readAnchors(state: ReturnType<typeof useDocState>): AnchorFact[] {
  return state.read(FACT_KINDS.anchor) as AnchorFact[];
}

/** The store's ref facts (resolved view). */
function readRefs(state: ReturnType<typeof useDocState>): RefFact[] {
  return state.read(FACT_KINDS.ref) as RefFact[];
}

/** Resolve the id namespace over the given anchors + the `bibset` source keys. */
function resolution(anchors: AnchorFact[]): Map<string, ResolvedAnchor> {
  return resolveAnchors(anchors, Object.keys(config().bibSrc));
}

/** Is `key` (a ref target key) a `kind`-anchor under `res` (anonymous keys check `anchors`)? */
function targetsKind(
  key: string,
  kind: string,
  res: Map<string, ResolvedAnchor>,
  anchors: AnchorFact[]
): boolean {
  if (key.startsWith("#")) {
    const pos = Number(key.slice(1));
    return anchors.some(a => a.pos === pos && a.kind === kind);
  }
  return res.get(key)?.fact.kind === kind;
}

// =============================================================================================
// Heading + numbering
// =============================================================================================

/** Clamp a rank prop to 1–6 (defaults to 1). */
function clampRank(rank: unknown): number {
  const n = Math.round(Number(rank));
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(6, Math.max(1, n));
}

/**
 * The default `Heading` (the `#` sugar target). Props: `rank` (1–6), optional `id`; any other
 * props (a hoisted `# Title [class: "x"]` attrs group — notation.md §Attrs) spread onto the
 * rendered `<hN>`. Registers a `heading` anchor and renders `<hN id>` with a
 * `<span class="nota-secnum">` prefix when `rank ≤ secset({numberDepth})`. Effective id =
 * explicit prop ?? deduped slug of the title text; an explicit id is a **strong** anchor
 * (`&intro` resolves it), a slug is weak (resolvable until shadowed).
 */
export function Heading(
  props: ParentProps & { rank?: number; id?: string } & Record<string, unknown>
): JSX.Element {
  const state = useDocState();
  const [, rest] = splitProps(props, ["rank", "id", "children"]);
  const resolved = children(() => props.children);
  const rank = clampRank(props.rank);
  const explicitId = typeof props.id === "string" ? props.id : undefined;
  const handle = state.register(FACT_KINDS.anchor, {
    kind: ANCHOR_KINDS.heading,
    rank,
    title: titleTextOf(resolved.toArray()),
    explicitId
  } satisfies Omit<AnchorFact, "pos">);
  const myPos = handle.fact.pos as number;
  const headings = () => anchorsOf(readAnchors(state), ANCHOR_KINDS.heading);
  const myIndex = () => headings().findIndex(f => f.pos === myPos);
  const id = () => headingIds(headings())[myIndex()];
  const num = () => headingNumbers(headings(), config().numberDepth)[myIndex()];
  return (
    <Dynamic component={`h${rank}`} id={id()} {...rest}>
      <Show when={num() !== undefined}>
        <span class="nota-secnum">{num()}</span>{" "}
      </Show>
      {resolved()}
    </Dynamic>
  );
}

/**
 * The default `Title`: the document title — an `<h1 class="nota-title">`, deliberately **not**
 * a heading anchor (no number, no TOC entry, no section nesting). Section headings start at
 * `#` (rank 1) below it, mirroring `\title` + `\section`.
 */
export function Title(props: ParentProps): JSX.Element {
  return <h1 class="nota-title">{props.children}</h1>;
}

// =============================================================================================
// Toc
// =============================================================================================

interface TocEntry {
  rank: number;
  id: string;
  label: string;
}

/**
 * The default `Toc`: a `<nav class="nota-toc">` of nested heading links, from the resolved
 * heading anchors — correct above its headings (the store's seed) and reactive below them.
 * Optional `depth` prop caps the ranks shown. Renders nothing for a heading-less document.
 */
export function Toc(props: { depth?: number }): JSX.Element {
  const state = useDocState();
  const depth = typeof props.depth === "number" ? props.depth : 6;
  const entries = (): TocEntry[] => {
    const facts = anchorsOf(readAnchors(state), ANCHOR_KINDS.heading);
    const ids = headingIds(facts);
    const nums = headingNumbers(facts, config().numberDepth);
    return facts
      .map((f, i) => ({
        rank: f.rank ?? 1,
        id: ids[i],
        label:
          nums[i] !== undefined
            ? `${nums[i]} ${f.title ?? ""}`
            : (f.title ?? "")
      }))
      .filter(e => e.rank <= depth);
  };
  // Recursive descent over ranks: deeper followers nest as a sublist inside their leader's item.
  const build = (
    es: TocEntry[],
    at: { i: number },
    parentRank: number
  ): JSX.Element[] => {
    const items: JSX.Element[] = [];
    while (at.i < es.length && es[at.i].rank > parentRank) {
      const e = es[at.i];
      at.i += 1;
      const sub = build(es, at, e.rank);
      items.push(
        <li>
          <a href={`#${e.id}`}>{e.label}</a>
          {sub.length > 0 && <ul>{sub}</ul>}
        </li>
      );
    }
    return items;
  };
  return (
    <Show when={entries().length > 0}>
      <nav class="nota-toc">
        <ul>{build(entries(), { i: 0 }, 0)}</ul>
      </nav>
    </Show>
  );
}

// =============================================================================================
// Label / Ref — the unified reference
// =============================================================================================

/**
 * The default `Label`: a position marker that renders nothing — a **strong** `label` anchor.
 * A reference to it binds to the nearest *preceding* heading (LaTeX semantics). The key is the
 * authored `id` prop (the `<sec:intro>` sugar sets it); children are ignored.
 */
export function Label(props: { id?: string }): JSX.Element {
  const state = useDocState();
  const id = typeof props.id === "string" ? props.id.trim() : "";
  if (id === "") {
    throw new Error(
      '@Label: missing id (e.g. @Label[id: "sec:intro"]{}, or the <sec:intro> sugar)'
    );
  }
  state.register(FACT_KINDS.anchor, { kind: ANCHOR_KINDS.label, id });
  return null;
}

/** Nearest preceding heading of `pos`: its `[id, numberOrTitle]`, or null when none. */
function precedingHeading(
  anchors: AnchorFact[],
  pos: number
): [string, string] | null {
  const headings = anchorsOf(anchors, ANCHOR_KINDS.heading);
  const ids = headingIds(headings);
  const nums = headingNumbers(headings, config().numberDepth);
  let t = -1;
  for (let i = 0; i < headings.length; i++) {
    if ((headings[i].pos as number) < pos) {
      t = i;
    }
  }
  if (t < 0) {
    return null;
  }
  return [
    ids[t],
    nums[t] !== undefined ? (nums[t] as string) : (headings[t].title ?? "")
  ];
}

/** The citation label map: distinct cited `bib` keys → 1-based label, by first-citation order
 * (`bibset({style: "alpha"})` re-sorts by author/title). */
function bibLabels(
  refs: RefFact[],
  res: Map<string, ResolvedAnchor>
): Map<string, number> {
  const { bibSrc, bibStyle } = config();
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    const key = refTargetKey(r);
    if (!seen.has(key) && res.get(key)?.fact.kind === ANCHOR_KINDS.bib) {
      seen.add(key);
      order.push(key);
    }
  }
  const ordered =
    bibStyle === "alpha"
      ? [...order].sort((a, b) => {
          const ea = bibSrc[a] ?? {};
          const eb = bibSrc[b] ?? {};
          const aa = ea.author ?? "";
          const ab = eb.author ?? "";
          if (aa !== ab) {
            return aa < ab ? -1 : 1;
          }
          const ta = ea.title ?? "";
          const tb = eb.title ?? "";
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        })
      : order;
  return new Map(ordered.map((key, i) => [key, i + 1]));
}

/** The footnote-use numbering model over the resolved facts (shared by marks and the list). */
function footnoteModel(anchors: AnchorFact[], refs: RefFact[]) {
  const res = resolveAnchors(anchors, Object.keys(config().bibSrc));
  return useNumbers(refs, key =>
    targetsKind(key, ANCHOR_KINDS.footnote, res, anchors)
  );
}

/** The reference `<sup>` for the footnote use at `refPos` targeting `targetKey`. Only the
 * target's *first* use carries the `fnref-N` backlink id. */
function FootnoteSup(props: {
  targetKey: string;
  refPos: number;
}): JSX.Element {
  const state = useDocState();
  const model = () => footnoteModel(readAnchors(state), readRefs(state));
  const num = () => model().numOf.get(props.targetKey);
  const first = () => model().firstRefPos.get(props.targetKey) === props.refPos;
  return (
    <sup class="nota-fnref">
      <a
        id={num() !== undefined && first() ? `fnref-${num()}` : undefined}
        href={`#fn-${num() ?? ""}`}
      >
        {num() !== undefined ? String(num()) : PENDING}
      </a>
    </sup>
  );
}

/** The citation `<a>` for one bib key (shared by `Ref`'s bib arm and `Cite`). `bare` renders
 * the number alone (`Cite`'s multi-key grouping); otherwise `[N]` / `[N, p. 33]`. The key's
 * first citing use carries the `citeref-N` backlink id. */
function BibRefLink(props: {
  key_: string;
  refPos: number;
  page?: string;
  bare?: boolean;
  children?: JSX.Element;
}): JSX.Element {
  const state = useDocState();
  const model = () => {
    const anchors = readAnchors(state);
    const refs = readRefs(state);
    const res = resolution(anchors);
    const labels = bibLabels(refs, res);
    const { firstRefPos } = useNumbers(refs, key =>
      targetsKind(key, ANCHOR_KINDS.bib, res, anchors)
    );
    return { labels, firstRefPos };
  };
  const num = () => model().labels.get(props.key_);
  const first = () => model().firstRefPos.get(props.key_) === props.refPos;
  const text = () => {
    const n = num() !== undefined ? String(num()) : PENDING;
    const page = props.page !== undefined ? `, p. ${props.page}` : "";
    return props.bare === true ? n : `[${n}${page}]`;
  };
  const hasAuthored = () => props.children != null;
  return (
    <a
      id={num() !== undefined && first() ? `citeref-${num()}` : undefined}
      href={`#bib-${props.key_}`}
      class="nota-cite"
    >
      {hasAuthored() ? props.children : text()}
    </a>
  );
}

/**
 * The default `Ref` (the `&id` sugar) — THE reference. Registers a `ref` fact and renders by
 * the resolved anchor's kind:
 * - `definition` → tooltip-wired `<a data-nota-def>` (no-JS fallback: the `#def-id` jump);
 * - `label` → nearest preceding heading's number-or-title (LaTeX semantics);
 * - `heading` → the heading itself (explicit id or unshadowed slug — no `@Label` needed);
 * - `footnote` → the `<sup>` mark, numbered by first-use order;
 * - `bib` → the citation `[N]` (a `page` prop renders `[N, p. 33]`);
 * - any other kind (paper's `figure`) → the generic arm: `<a href={anchor.href ?? "#id"}>`
 *   labeled `refPrefix + ordinal`, tooltip-wired when the anchor declares one.
 * Authored children override the rendered text on every arm. Missing targets: pointed error
 * when seeded, `?` placeholder (reactive) otherwise; duplicate ids always throw.
 */
export function Ref(
  props: ParentProps & { id?: string; page?: string }
): JSX.Element {
  const state = useDocState();
  const key = typeof props.id === "string" ? props.id.trim() : "";
  if (key === "") {
    throw new Error(
      '@Ref: missing id (e.g. @Ref[id: "sec:intro"]{}, or the &sec:intro sugar)'
    );
  }
  const page = typeof props.page === "string" ? props.page : undefined;
  const handle = state.register(FACT_KINDS.ref, { target: key, page });
  const myPos = handle.fact.pos as number;
  const resolved = children(() => props.children);
  const hasAuthored = () => resolved.toArray().some(c => c != null);
  const body = () => (hasAuthored() ? resolved() : undefined);

  const target = (): ResolvedAnchor | null => {
    const t = resolution(readAnchors(state)).get(key);
    if (t === undefined) {
      if (state.seeded) {
        throw new Error(
          `@Ref: no anchor for id "${key}" (no @Label, @Definition, @Footnote, heading id, or bibliography entry)`
        );
      }
      return null;
    }
    return t;
  };

  return (
    <>
      {() => {
        const t = target();
        if (t === null) {
          return <PendingRef>{body()}</PendingRef>;
        }
        const anchors = readAnchors(state);
        switch (t.fact.kind) {
          case ANCHOR_KINDS.definition:
            return (
              <a
                href={`#def-${t.id}`}
                class="nota-ref nota-def-ref"
                data-nota-def={t.id}
              >
                {body() ?? t.fact.labelText ?? t.id}
              </a>
            );
          case ANCHOR_KINDS.label: {
            const h = precedingHeading(anchors, t.fact.pos as number);
            if (h === null) {
              if (state.seeded) {
                throw new Error(
                  `@Ref: no heading precedes @Label "${key}" (a ref binds to the nearest preceding heading)`
                );
              }
              return <PendingRef>{body()}</PendingRef>;
            }
            return (
              <a href={`#${h[0]}`} class="nota-ref">
                {body() ?? h[1]}
              </a>
            );
          }
          case ANCHOR_KINDS.heading: {
            const headings = anchorsOf(anchors, ANCHOR_KINDS.heading);
            const i = headings.indexOf(t.fact);
            const num = headingNumbers(headings, config().numberDepth)[i];
            return (
              <a href={`#${t.id}`} class="nota-ref">
                {body() ?? (num !== undefined ? num : (t.fact.title ?? ""))}
              </a>
            );
          }
          case ANCHOR_KINDS.footnote:
            return <FootnoteSup targetKey={key} refPos={myPos} />;
          case ANCHOR_KINDS.bib:
            return (
              <BibRefLink key_={key} refPos={myPos} page={page}>
                {body()}
              </BibRefLink>
            );
          default: {
            // Generic arm: extension kinds (paper's `figure`) are JSON data, no renderer
            // registry — href + refPrefix + anchor-order ordinal (+ declared tooltip wiring).
            const n = anchorOrdinals(anchors, t.fact.kind).get(
              t.fact.pos as number
            );
            const tooltip = t.fact.tooltip === true;
            return (
              <a
                href={t.fact.href ?? `#${t.id}`}
                class={tooltip ? "nota-ref nota-def-ref" : "nota-ref"}
                data-nota-def={tooltip ? t.id : undefined}
              >
                {body() ??
                  `${t.fact.refPrefix ?? ""}${n !== undefined ? n : PENDING}`}
              </a>
            );
          }
        }
      }}
    </>
  );
}

// =============================================================================================
// Footnotes — definitions (labeled) + inline one-shots; uses are `Ref`s
// =============================================================================================

/** Register the auto-append trailer (idempotent): the footnote list at document end unless an
 * explicit `@Footnotes` placement set the flag. */
function ensureFootnotesTrailer(state: ReturnType<typeof useDocState>): void {
  state.trailer("footnotes", () => (
    <Show when={!state.hasFlag("footnotes-placed")}>
      <FootnotesList />
    </Show>
  ));
}

/**
 * The default `Footnote` — both footnote forms:
 * - `@Footnote[id: "x"]: body…` — a **definition**: a strong `footnote` anchor carrying the
 *   body; renders nothing in place. References (`&x`) render the numbered mark; repeats share
 *   the number (first-use order).
 * - `@Footnote{body}` (id-less) — the **inline one-shot**: registers an anonymous anchor and
 *   its own use, fused, and renders the mark itself.
 */
export function Footnote(props: ParentProps & { id?: string }): JSX.Element {
  const state = useDocState();
  ensureFootnotesTrailer(state);
  const id = typeof props.id === "string" ? props.id.trim() : "";
  if (id !== "") {
    state.register(FACT_KINDS.anchor, {
      kind: ANCHOR_KINDS.footnote,
      id,
      content: () => props.children
    });
    return null;
  }
  const anchor = state.register(FACT_KINDS.anchor, {
    kind: ANCHOR_KINDS.footnote,
    content: () => props.children
  });
  const use = state.register(FACT_KINDS.ref, {
    targetPos: anchor.fact.pos as number
  });
  return (
    <FootnoteSup
      targetKey={`#${anchor.fact.pos}`}
      refPos={use.fact.pos as number}
    />
  );
}

/** Compat shim while the reader still emits `[^label]` (removed with that sugar): a labeled
 * footnote use is a `Ref`. */
export function FootnoteMark(props: { label?: string }): JSX.Element {
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (label === "") {
    throw new Error(
      "@FootnoteMark: missing label — use &label (a @Ref) instead"
    );
  }
  return <Ref id={label} />;
}

/** Compat shim while the reader still emits `[^label]: …` (removed with that sugar): a labeled
 * footnote definition is `@Footnote[id]`. */
export function FootnoteText(
  props: ParentProps & { label?: string }
): JSX.Element {
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (label === "") {
    throw new Error(
      '@FootnoteText: missing label — use @Footnote[id: "…"]: … instead'
    );
  }
  return <Footnote id={label}>{props.children}</Footnote>;
}

/**
 * The default `FootnotesList`: the footnote section (`<ol>` of
 * `<li id="fn-N"><div>…content ↩</div></li>`), or nothing when no footnote use precedes it.
 * Reads **live** facts — a placed list renders the footnotes referenced *so far* (the
 * document-end trailer therefore sees all of them). Entry content decodes as flow (a
 * `<Reforest>` inside the `div`), with the backlink joining the final paragraph run.
 */
export function FootnotesList(): JSX.Element {
  const state = useDocState();
  const entries = () => {
    const anchors = state.live(FACT_KINDS.anchor) as AnchorFact[];
    const refs = state.live(FACT_KINDS.ref) as RefFact[];
    const { numOf } = footnoteModel(anchors, refs);
    const contentOf = (key: string): (() => JSX.Element) => {
      const a = key.startsWith("#")
        ? anchors.find(x => x.pos === Number(key.slice(1)))
        : anchors.find(x => x.kind === ANCHOR_KINDS.footnote && x.id === key);
      return a?.content ?? (() => PENDING);
    };
    return [...numOf.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([key, num]) => ({ num, content: contentOf(key) }));
  };
  return (
    <Show when={entries().length > 0}>
      <section class="nota-footnotes">
        <ol>
          {entries().map(e => (
            <li id={`fn-${e.num}`}>
              <div class="nota-fn-content">
                <Reforest>
                  {e.content()}{" "}
                  <a href={`#fnref-${e.num}`} class="nota-fnbacklink">
                    ↩
                  </a>
                </Reforest>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Show>
  );
}

/**
 * The default `Footnotes`: explicit placement of the footnote list — sets the flag that
 * suppresses the auto-append trailer, and renders the list here (with the footnotes
 * referenced so far).
 */
export function Footnotes(): JSX.Element {
  const state = useDocState();
  state.flag("footnotes-placed");
  return <FootnotesList />;
}

// =============================================================================================
// Cite / Bibliography
// =============================================================================================

/**
 * The default `Cite`: the multi-key/options wrapper over `bib`-kind references — registers one
 * `ref` fact per comma-separated key in its body and renders `[N]` links to the bibliography
 * (multi-key: `[1, 2]`). `&key` is the plain single-citation short form.
 */
export function Cite(props: ParentProps): JSX.Element {
  const state = useDocState();
  const resolved = children(() => props.children);
  const keys = titleTextOf(resolved.toArray())
    .split(",")
    .map(s => s.trim())
    .filter(s => s !== "");
  if (keys.length === 0) {
    throw new Error(
      "@Cite: empty key (the cite's body is its key(s), e.g. @Cite{knuth84})"
    );
  }
  const uses = keys.map(key => {
    const handle = state.register(FACT_KINDS.ref, { target: key });
    return { key, refPos: handle.fact.pos as number };
  });
  // Validate resolution (pointed error when seeded; `?` labels render otherwise).
  const check = () => {
    if (!state.seeded) {
      return;
    }
    const res = resolution(readAnchors(state));
    for (const { key } of uses) {
      if (res.get(key) === undefined) {
        throw new Error(
          `@Cite: no bibliography entry for key "${key}" (add it via bibset({ src: { "${key}": { … } } }))`
        );
      }
    }
  };
  if (uses.length === 1) {
    return (
      <>
        {() => {
          check();
          return <BibRefLink key_={uses[0].key} refPos={uses[0].refPos} />;
        }}
      </>
    );
  }
  return (
    <>
      {() => {
        check();
        return (
          <>
            {"["}
            {uses.map((u, i) => (
              <>
                {i > 0 && ", "}
                <BibRefLink key_={u.key} refPos={u.refPos} bare />
              </>
            ))}
            {"]"}
          </>
        );
      }}
    </>
  );
}

/** One bibliography entry's text: `"Author. Title. Year."` from present fields, + url link. */
function BibEntryLine(props: { key_: string }): JSX.Element {
  const entry = config().bibSrc[props.key_] ?? {};
  const text = [entry.author, entry.title, entry.year]
    .filter(f => f != null && f !== "")
    .map(f => `${String(f)}.`)
    .join(" ");
  return (
    <>
      {text}
      {entry.url != null && entry.url !== "" && (
        <>
          {" "}
          <a href={entry.url}>{entry.url}</a>
        </>
      )}
    </>
  );
}

/**
 * The default `Bibliography`: the cited entries as an `<ol class="nota-bibliography">` in
 * label order (`<li id="bib-key">`), each entry ending with a ↩ backlink to its first citing
 * site (`#citeref-N`) — the citation counterpart of the footnote arrow. Uncited source entries
 * are omitted; nothing renders when nothing is cited.
 */
export function Bibliography(): JSX.Element {
  const state = useDocState();
  const ordered = () => {
    const labels = bibLabels(readRefs(state), resolution(readAnchors(state)));
    return [...labels.entries()].sort((a, b) => a[1] - b[1]);
  };
  return (
    <Show when={ordered().length > 0}>
      <ol class="nota-bibliography">
        {ordered().map(([key, num]) => (
          <li id={`bib-${key}`}>
            <BibEntryLine key_={key} />{" "}
            <a href={`#citeref-${num}`} class="nota-citebacklink">
              ↩
            </a>
          </li>
        ))}
      </ol>
    </Show>
  );
}
