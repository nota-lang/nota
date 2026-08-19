/**
 * Solid components over the unified anchor/reference registry. Missing targets remain pending
 * in unseeded renders and throw once a complete seed is available. Cross-kind `pos` values drive
 * ordering and stable self-lookups. See `design/references.md`.
 */

import {
  type DocState,
  isSSRChunk,
  parseOpeningTag,
  Reforest,
  type ResolvedChild,
  textOf,
  useDocState
} from "@nota-lang/core";
import {
  children,
  createMemo,
  createRoot,
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

// Shared helpers

/** Extract title text while omitting reference metadata such as footnote numbers. */
function titleTextOf(parts: ResolvedChild[]): string {
  const META_CLASS = /\bnota-(fnref|cite|secnum)\b/;
  const metaClass = (part: ResolvedChild): boolean => {
    if (part === null || part === undefined || typeof part !== "object") {
      return false;
    }
    if (isSSRChunk(part)) {
      return META_CLASS.test(parseOpeningTag(part.t)?.attrs.class ?? "");
    }
    return (
      part.nodeType === 1 &&
      META_CLASS.test((part as Element).getAttribute("class") ?? "")
    );
  };
  let out = "";
  for (const part of parts) {
    if (!metaClass(part)) {
      out += textOf(part);
    }
  }
  return out;
}

/** Placeholder used before an unseeded forward reference resolves. */
const PENDING = "?";

/** The unresolved-forward placeholder link: `?` (or the authored text) with an inert href. */
function PendingRef(props: { children?: JSX.Element }): JSX.Element {
  return (
    // biome-ignore lint/a11y/useValidAnchor: the target will update reactively in CSR.
    <a href="#" class="nota-ref">
      {props.children ?? PENDING}
    </a>
  );
}

/** The store's anchor facts (resolved view — seed-pinned during SSG pass 2 / hydration). */
function readAnchors(state: DocState): AnchorFact[] {
  return state.read(FACT_KINDS.anchor) as AnchorFact[];
}

/** The store's ref facts (resolved view). */
function readRefs(state: DocState): RefFact[] {
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

// Shared reference model

/** Memoized derivations shared by every reference component in a document. */
interface ReferenceModel {
  anchors: () => AnchorFact[];
  refs: () => RefFact[];
  headings: () => AnchorFact[];
  /** `pos` → index into {@link headings} — a heading's own O(1) self-lookup. */
  headingIndex: () => Map<number, number>;
  ids: () => string[];
  numbers: () => (string | undefined)[];
  resolved: () => Map<string, ResolvedAnchor>;
  ordinalMaps: () => Map<string, Map<number, number>>;
  footnoteNumbering: () => {
    numOf: Map<string, number>;
    firstRefPos: Map<string, number>;
  };
  bibNumbering: () => {
    labels: Map<string, number>;
    firstRefPos: Map<string, number>;
  };
}

const referenceModels = new WeakMap<DocState, ReferenceModel>();

/**
 * Build the model in a detached root so unmounting the first consumer cannot dispose shared
 * memos. The WeakMap gives the model the same lifetime as its store.
 */
function referenceModel(state: DocState): ReferenceModel {
  const cached = referenceModels.get(state);
  if (cached !== undefined) {
    return cached;
  }
  const model = createRoot((): ReferenceModel => {
    const anchors = createMemo(() => readAnchors(state));
    const refs = createMemo(() => readRefs(state));
    const headings = createMemo(() =>
      anchorsOf(anchors(), ANCHOR_KINDS.heading)
    );
    const headingIndex = createMemo(
      () => new Map(headings().map((f, i) => [f.pos as number, i]))
    );
    const ids = createMemo(() => headingIds(headings()));
    const numbers = createMemo(() =>
      headingNumbers(headings(), config().numberDepth)
    );
    const resolved = createMemo(() => resolution(anchors()));
    const ordinalMaps = createMemo(() => {
      const maps = new Map<string, Map<number, number>>();
      for (const anchor of anchors()) {
        let map = maps.get(anchor.kind);
        if (map === undefined) {
          map = new Map();
          maps.set(anchor.kind, map);
        }
        map.set(anchor.pos as number, map.size + 1);
      }
      return maps;
    });
    const footnoteNumbering = createMemo(() => {
      const res = resolved();
      const as = anchors();
      return useNumbers(refs(), key =>
        targetsKind(key, ANCHOR_KINDS.footnote, res, as)
      );
    });
    const bibNumbering = createMemo(() => {
      const res = resolved();
      const rs = refs();
      const labels = bibLabels(rs, res);
      const { firstRefPos } = useNumbers(rs, key =>
        targetsKind(key, ANCHOR_KINDS.bib, res, anchors())
      );
      return { labels, firstRefPos };
    });
    return {
      anchors,
      refs,
      headings,
      headingIndex,
      ids,
      numbers,
      resolved,
      ordinalMaps,
      footnoteNumbering,
      bibNumbering
    };
  });
  referenceModels.set(state, model);
  return model;
}

// Headings

/** Clamp a rank prop to 1–6 (defaults to 1). */
function clampRank(rank: unknown): number {
  const n = Math.round(Number(rank));
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(6, Math.max(1, n));
}

/** Register and render a heading, with an authored id or a deduplicated title slug. */
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
  const model = referenceModel(state);
  const myIndex = () => model.headingIndex().get(myPos) ?? -1;
  const id = () => model.ids()[myIndex()];
  const num = () => model.numbers()[myIndex()];
  return (
    <Dynamic component={`h${rank}`} id={id()} {...rest}>
      <Show when={num() !== undefined}>
        <span class="nota-secnum">{num()}</span>{" "}
      </Show>
      {resolved()}
    </Dynamic>
  );
}

/** Render the unnumbered document title. */
export function Title(props: ParentProps): JSX.Element {
  return <h1 class="nota-title">{props.children}</h1>;
}

// Table of contents

interface TocEntry {
  rank: number;
  id: string;
  label: string;
}

/** Render a nested heading list, optionally capped by rank. */
export function Toc(props: { depth?: number }): JSX.Element {
  const state = useDocState();
  const model = referenceModel(state);
  const depth = typeof props.depth === "number" ? props.depth : 6;
  const entries = createMemo((): TocEntry[] => {
    const facts = model.headings();
    const ids = model.ids();
    const nums = model.numbers();
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
  });
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

// Labels and references

/** Register a strong label at the current position. */
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
  model: ReferenceModel,
  pos: number
): [string, string] | null {
  const headings = model.headings();
  const ids = model.ids();
  const nums = model.numbers();
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
  const model = referenceModel(state);
  const num = () => model.footnoteNumbering().numOf.get(props.targetKey);
  const first = () =>
    model.footnoteNumbering().firstRefPos.get(props.targetKey) === props.refPos;
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
  const model = referenceModel(state);
  const num = () => model.bibNumbering().labels.get(props.key_);
  const first = () =>
    model.bibNumbering().firstRefPos.get(props.key_) === props.refPos;
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
 * Register and render a unified reference. Built-in anchor kinds select their specialized
 * markup; extension kinds use `href`, `refPrefix`, ordinal, and optional tooltip metadata.
 */
export function Ref(
  props: ParentProps & { id?: string; page?: string }
): JSX.Element {
  const state = useDocState();
  const model = referenceModel(state);
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
    const t = model.resolved().get(key);
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
            const h = precedingHeading(model, t.fact.pos as number);
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
            const i = model.headingIndex().get(t.fact.pos as number) ?? -1;
            const num = model.numbers()[i];
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
            const n = model
              .ordinalMaps()
              .get(t.fact.kind)
              ?.get(t.fact.pos as number);
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

// Footnotes

/** Register the auto-append trailer (idempotent): the footnote list at document end unless an
 * explicit `@Footnotes` placement set the flag. */
function ensureFootnotesTrailer(state: DocState): void {
  state.trailer("footnotes", () => (
    <Show when={!state.hasFlag("footnotes-placed")}>
      <FootnotesList />
    </Show>
  ));
}

/** Register a labeled footnote definition or render an anonymous inline footnote. */
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

/** Render the footnotes referenced so far from live facts. */
export function FootnotesList(): JSX.Element {
  const state = useDocState();
  const entries = createMemo(() => {
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
  });
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

/** Place footnotes explicitly and suppress the automatic trailer. */
export function Footnotes(): JSX.Element {
  const state = useDocState();
  state.flag("footnotes-placed");
  return <FootnotesList />;
}

// Citations

/** Render one or more comma-separated bibliography references as a citation group. */
export function Cite(props: ParentProps): JSX.Element {
  const state = useDocState();
  const model = referenceModel(state);
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
    const res = model.resolved();
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

/** Render cited bibliography entries in label order. */
export function Bibliography(): JSX.Element {
  const state = useDocState();
  const model = referenceModel(state);
  const ordered = createMemo(() => {
    const labels = model.bibNumbering().labels;
    return [...labels.entries()].sort((a, b) => a[1] - b[1]);
  });
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
