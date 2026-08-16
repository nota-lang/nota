/**
 * The prelude doc-state constructs, Solid-native (design/solid.md §The prelude): headings +
 * numbering + a table of contents, `@Label`/`@Ref`, footnotes, `@Cite`/`@Bibliography` — plain
 * Solid components over the `@nota-lang/solid` doc-state store. Registrations ≙ the old marks;
 * the pure derivations below ≙ the old queries; the store ≙ `DocIndex`.
 *
 * ## Resolution-error policy
 * A *missing target* (a `@Ref` to nothing, a footnote label with no definition, an unknown cite
 * key) throws **only when the store is seeded** — i.e. when resolution runs against a complete
 * document (SSG pass 2, hydration). Unseeded renders (SSG pass 1, pure CSR) see the document
 * *so far*, where a forward target legitimately hasn't registered yet, so they render a visible
 * `?` placeholder instead; in CSR it self-heals reactively when the target mounts. *Duplicates*
 * throw wherever detected — more facts never fix a duplicate.
 *
 * ## Ordering
 * Facts carry the store's cross-kind `pos` (registration = mount order), which stands in for
 * the old global DFS `pos`: "nearest preceding heading" and first-appearance numbering key on
 * it. A construct rendered inside a trailer thunk (a cite in a footnote body) registers at the
 * trailer's position — an approximation of the old index-at-parent semantics, flagged in the
 * design doc.
 */

import {
  type Fact,
  Reforest,
  type ResolvedChild,
  textOf,
  useDocState
} from "@nota-lang/solid";
import {
  children,
  type JSX,
  type ParentProps,
  Show,
  splitProps
} from "solid-js";
import { Dynamic } from "solid-js/web";

import { config } from "./config";

// =============================================================================================
// Shared helpers
// =============================================================================================

/** Slugify title text: lowercase, non-alphanumeric runs → `-`, trim edge `-`; empty → `"section"`. */
function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s === "" ? "section" : s;
}

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

// =============================================================================================
// Heading + numbering
// =============================================================================================

interface HeadingFact extends Fact {
  rank: number;
  title: string;
  explicitId?: string;
  pos?: number;
}

/** Deduplicated ids for the heading facts, in document order (explicit id ?? slug; `-N` dedup). */
export function headingIds(facts: HeadingFact[]): string[] {
  const ids: string[] = [];
  const seen = new Map<string, number>();
  for (const f of facts) {
    const base = f.explicitId ?? slugify(f.title);
    const n = seen.get(base);
    if (n === undefined) {
      seen.set(base, 1);
      ids.push(base);
    } else {
      seen.set(base, n + 1);
      ids.push(`${base}-${n + 1}`);
    }
  }
  return ids;
}

/**
 * Hierarchical section numbers for headings of rank ≤ `depth` (`undefined` beyond it; all
 * `undefined` when depth = 0). The standard outline algorithm over a rank-stack: a deeper
 * heading opens a level, an equal-rank one increments, a shallower one pops — skipped ranks
 * collapse gracefully (`# / ###` → `1 / 1.1`).
 */
export function headingNumbers(
  facts: HeadingFact[],
  depth: number
): (string | undefined)[] {
  const nums: (string | undefined)[] = [];
  const stack: { rank: number; count: number }[] = [];
  for (const f of facts) {
    if (depth <= 0 || f.rank > depth) {
      nums.push(undefined);
      continue;
    }
    while (stack.length > 0 && stack[stack.length - 1].rank > f.rank) {
      stack.pop();
    }
    const top = stack[stack.length - 1];
    if (top !== undefined && top.rank === f.rank) {
      top.count += 1;
    } else {
      stack.push({ rank: f.rank, count: 1 });
    }
    nums.push(stack.map(s => s.count).join("."));
  }
  return nums;
}

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
 * rendered `<hN>`. Registers a heading fact and renders `<hN id>` with a
 * `<span class="nota-secnum">` prefix when `rank ≤ secset({numberDepth})`. `id` = explicit prop
 * ?? deduped slug of the title text.
 */
export function Heading(
  props: ParentProps & { rank?: number; id?: string } & Record<string, unknown>
): JSX.Element {
  const state = useDocState();
  const [, rest] = splitProps(props, ["rank", "id", "children"]);
  const resolved = children(() => props.children);
  const rank = clampRank(props.rank);
  const explicitId = typeof props.id === "string" ? props.id : undefined;
  const handle = state.register("heading", {
    rank,
    title: titleTextOf(resolved.toArray()),
    explicitId
  } satisfies Omit<HeadingFact, "pos">);
  const i = handle.seq - 1;
  const facts = () => state.read("heading") as HeadingFact[];
  const id = () => headingIds(facts())[i];
  const num = () => headingNumbers(facts(), config().numberDepth)[i];
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
 * The default `Title`: the document title — an `<h1 class="nota-title">`, deliberately **not** a
 * heading fact (no number, no TOC entry, no section nesting). Section headings start at `#`
 * (rank 1) below it, mirroring `\title` + `\section`.
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
 * heading facts — correct above its headings (the store's seed) and reactive below them.
 * Optional `depth` prop caps the ranks shown. Renders nothing for a heading-less document.
 */
export function Toc(props: { depth?: number }): JSX.Element {
  const state = useDocState();
  const depth = typeof props.depth === "number" ? props.depth : 6;
  const entries = (): TocEntry[] => {
    const facts = state.read("heading") as HeadingFact[];
    const ids = headingIds(facts);
    const nums = headingNumbers(facts, config().numberDepth);
    return facts
      .map((f, i) => ({
        rank: f.rank,
        id: ids[i],
        label: nums[i] !== undefined ? `${nums[i]} ${f.title}` : f.title
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
// Label / Ref
// =============================================================================================

/**
 * The default `Label`: a position marker that renders nothing. The key is the authored `id`
 * prop (the `<sec:intro>` sugar sets it); children are ignored.
 */
export function Label(props: { id?: string }): JSX.Element {
  const state = useDocState();
  const id = typeof props.id === "string" ? props.id.trim() : "";
  if (id === "") {
    throw new Error(
      '@Label: missing id (e.g. @Label[id: "sec:intro"]{}, or the <sec:intro> sugar)'
    );
  }
  state.register("label", { key: id });
  return null;
}

interface DefFact extends Fact {
  key: string;
  labelText?: string;
  pos?: number;
}

/** The resolved target of a `Ref`, or `null` while pending (unseeded incomplete document). */
type RefTarget =
  | { kind: "def"; key: string; label: string }
  | { kind: "heading"; id: string; label: string }
  | null;

/**
 * The default `Ref` (the `&key` sugar): resolves `id` first against **definitions** (rendering a
 * tooltip-wired `<a data-nota-def>` whose no-JS fallback is the `#def-key` anchor jump), then
 * against `@Label`s — binding to the nearest **preceding** heading by `pos` (LaTeX semantics)
 * and linking to its id. Authored children override the link content on every path. Missing
 * targets: pointed error when seeded, `?` placeholder (reactive) otherwise; duplicates always
 * throw.
 */
export function Ref(props: ParentProps & { id?: string }): JSX.Element {
  const state = useDocState();
  const key = typeof props.id === "string" ? props.id.trim() : "";
  if (key === "") {
    throw new Error(
      '@Ref: missing id (e.g. @Ref[id: "sec:intro"]{}, or the &sec:intro sugar)'
    );
  }
  const resolved = children(() => props.children);
  const hasAuthored = () => resolved.toArray().some(c => c != null);

  const target = (): RefTarget => {
    const defs = (state.read("definition") as DefFact[]).filter(
      d => d.key === key
    );
    if (defs.length > 1) {
      throw new Error(`@Definition: duplicate definition for id "${key}"`);
    }
    if (defs.length === 1) {
      return { kind: "def", key, label: defs[0].labelText ?? key };
    }
    const labels = state.read("label").filter(l => l.key === key);
    if (labels.length > 1) {
      throw new Error(`@Ref: duplicate @Label for key "${key}"`);
    }
    if (labels.length === 0) {
      if (state.seeded) {
        throw new Error(
          `@Ref: no @Definition or @Label found for key "${key}"`
        );
      }
      return null;
    }
    const labelPos = labels[0].pos as number;
    const facts = state.read("heading") as HeadingFact[];
    const ids = headingIds(facts);
    const nums = headingNumbers(facts, config().numberDepth);
    let t = -1;
    for (let i = 0; i < facts.length; i++) {
      if ((facts[i].pos as number) < labelPos) {
        t = i;
      }
    }
    if (t < 0) {
      if (state.seeded) {
        throw new Error(
          `@Ref: no heading precedes @Label "${key}" (a ref binds to the nearest preceding heading)`
        );
      }
      return null;
    }
    return {
      kind: "heading",
      id: ids[t],
      label: nums[t] !== undefined ? (nums[t] as string) : facts[t].title
    };
  };

  return (
    <a
      href={(() => {
        const t = target();
        return t === null
          ? "#"
          : t.kind === "def"
            ? `#def-${t.key}`
            : `#${t.id}`;
      })()}
      class={target()?.kind === "def" ? "nota-ref nota-def-ref" : "nota-ref"}
      data-nota-def={target()?.kind === "def" ? key : undefined}
    >
      {hasAuthored() ? resolved() : (target()?.label ?? PENDING)}
    </a>
  );
}

// =============================================================================================
// Footnotes — labeled (Markdown) definitions/references + anonymous one-shots
// =============================================================================================

interface FootnoteFact extends Fact {
  label?: string;
  content?: () => JSX.Element;
  pos?: number;
}

interface FootnoteTextFact extends Fact {
  label: string;
  content: () => JSX.Element;
}

/**
 * The footnote numbering model over reference facts: **one number per distinct referenced
 * label**, by first-appearance order; an anonymous one-shot (no label) keys on its own `pos`,
 * so it always takes the next number.
 */
function footnoteNumbers(refs: FootnoteFact[]): {
  numOf: number[];
  firstIndex: Map<number, number>;
} {
  const numOf: number[] = [];
  const firstIndex = new Map<number, number>();
  const byKey = new Map<string, number>();
  let next = 1;
  refs.forEach((f, i) => {
    const key =
      typeof f.label === "string" && f.label !== ""
        ? `l:${f.label}`
        : `#${f.pos}`;
    let num = byKey.get(key);
    if (num === undefined) {
      num = next;
      next += 1;
      byKey.set(key, num);
      firstIndex.set(num, i);
    }
    numOf.push(num);
  });
  return { numOf, firstIndex };
}

/** The reference `<sup>` for the footnote fact at reference-list index `i`. */
function FootnoteSup(props: { index: number }): JSX.Element {
  const state = useDocState();
  const model = () => footnoteNumbers(state.read("footnote") as FootnoteFact[]);
  const num = () => model().numOf[props.index];
  const first = () => model().firstIndex.get(num()) === props.index;
  return (
    <sup class="nota-fnref">
      <a id={first() ? `fnref-${num()}` : undefined} href={`#fn-${num()}`}>
        {String(num())}
      </a>
    </sup>
  );
}

/** Register the auto-append trailer (idempotent): the footnote list at document end unless an
 * explicit `@Footnotes` placement set the flag. */
function ensureFootnotesTrailer(state: ReturnType<typeof useDocState>): void {
  state.trailer("footnotes", () => (
    <Show
      when={
        state.live("footnote").length > 0 && !state.hasFlag("footnotes-placed")
      }
    >
      <FootnotesList />
    </Show>
  ));
}

/**
 * The default `Footnote` (inline, anonymous one-shot): registers a reference fact carrying its
 * content thunk and renders the `<sup>` marker; the content renders in the footnote list.
 */
export function Footnote(props: ParentProps): JSX.Element {
  const state = useDocState();
  ensureFootnotesTrailer(state);
  const handle = state.register("footnote", {
    content: () => props.children
  });
  return <FootnoteSup index={handle.seq - 1} />;
}

/**
 * The default `FootnoteMark` (the `[^label]` sugar): a **labeled reference**. Repeated marks
 * with one label share a number/href; the first carries the `fnref-N` backlink id.
 */
export function FootnoteMark(props: { label?: string }): JSX.Element {
  const state = useDocState();
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (label === "") {
    throw new Error(
      '@FootnoteMark: missing label (e.g. @FootnoteMark[label: "n1"]{}, or the [^n1] sugar)'
    );
  }
  ensureFootnotesTrailer(state);
  const handle = state.register("footnote", { label });
  return <FootnoteSup index={handle.seq - 1} />;
}

/**
 * The default `FootnoteText` (the `[^label]: …` sugar): a **labeled definition** — registers
 * its content thunk and renders nothing in place. A duplicate definition for one label throws
 * (at list render); an unreferenced definition is dropped silently (drafts accumulate).
 */
export function FootnoteText(
  props: ParentProps & { label?: string }
): JSX.Element {
  const state = useDocState();
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (label === "") {
    throw new Error(
      '@FootnoteText: missing label (e.g. @FootnoteText[label: "n1"]: …, or the "[^n1]: …" sugar)'
    );
  }
  state.register("footnote-text", {
    label,
    content: () => props.children
  });
  return null;
}

/**
 * The default `FootnotesList`: the footnote section (`<ol>` of
 * `<li id="fn-N"><div>…content ↩</div></li>`), or nothing when no footnote precedes it. Reads
 * **live** facts — a placed list renders the footnotes accumulated *so far* (the document-end
 * trailer therefore sees all of them). Entry content decodes as flow (a `<Reforest>` inside the
 * `div`), with the backlink joining the final paragraph run.
 */
export function FootnotesList(): JSX.Element {
  const state = useDocState();
  const entries = () => {
    const refs = state.live("footnote") as FootnoteFact[];
    const defs = new Map<string, FootnoteTextFact>();
    for (const d of state.live("footnote-text") as FootnoteTextFact[]) {
      if (defs.has(d.label)) {
        throw new Error(
          `@FootnoteText: duplicate definition for footnote "${d.label}"`
        );
      }
      defs.set(d.label, d);
    }
    const { numOf, firstIndex } = footnoteNumbers(refs);
    const out: { num: number; content: () => JSX.Element }[] = [];
    for (const [num, i] of [...firstIndex.entries()].sort(
      (a, b) => a[0] - b[0]
    )) {
      const ref = refs[i];
      if (typeof ref.label === "string" && ref.label !== "") {
        const def = defs.get(ref.label);
        if (def === undefined) {
          if (state.seeded) {
            throw new Error(
              `@FootnoteMark: no @FootnoteText definition for footnote "${ref.label}"`
            );
          }
          out.push({ num, content: () => PENDING });
          continue;
        }
        out.push({ num, content: def.content });
      } else {
        out.push({ num, content: ref.content ?? (() => PENDING) });
      }
    }
    void numOf;
    return out;
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
 * accumulated so far).
 */
export function Footnotes(): JSX.Element {
  const state = useDocState();
  state.flag("footnotes-placed");
  return <FootnotesList />;
}

// =============================================================================================
// Cite / Bibliography
// =============================================================================================

interface CiteFact extends Fact {
  key: string;
  pos?: number;
}

/**
 * Assign each cited key a 1-based label, validating keys against the `bibset` source (missing
 * key: pointed error when seeded, pending otherwise). `"numeric"` labels by first-citation
 * order; `"alpha"` after sorting cited keys by (author, title).
 */
function citeLabels(
  facts: CiteFact[],
  seeded: boolean
): Map<string, number | undefined> {
  const { bibSrc, bibStyle } = config();
  const orderKeys: string[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    if (!seen.has(f.key)) {
      seen.add(f.key);
      orderKeys.push(f.key);
    }
  }
  for (const key of orderKeys) {
    if (!(key in bibSrc) && seeded) {
      throw new Error(
        `@Cite: no bibliography entry for key "${key}" (add it via bibset({ src: { "${key}": { … } } }))`
      );
    }
  }
  const ordered =
    bibStyle === "alpha"
      ? [...orderKeys].sort((a, b) => {
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
      : orderKeys;
  const labels = new Map<string, number | undefined>();
  ordered.forEach((key, i) => {
    labels.set(key, key in bibSrc ? i + 1 : undefined);
  });
  return labels;
}

/**
 * The default `Cite`: registers one cite fact per comma-separated key in its body and renders
 * `[N]` links to the bibliography (multi-key: `[1, 2]`).
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
  for (const key of keys) {
    state.register("cite", { key });
  }
  const labels = () =>
    citeLabels(state.read("cite") as CiteFact[], state.seeded);
  const labelOf = (key: string) => {
    const n = labels().get(key);
    return n === undefined ? PENDING : String(n);
  };
  if (keys.length === 1) {
    return (
      <a href={`#bib-${keys[0]}`} class="nota-cite">
        [{labelOf(keys[0])}]
      </a>
    );
  }
  return (
    <>
      {"["}
      {keys.map((key, i) => (
        <>
          {i > 0 && ", "}
          <a href={`#bib-${key}`} class="nota-cite">
            {labelOf(key)}
          </a>
        </>
      ))}
      {"]"}
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
 * The default `Bibliography`: the cited entries as an `<ol class="nota-bibliography">` in label
 * order (`<li id="bib-key">`). Uncited source entries are omitted; nothing renders when nothing
 * is cited.
 */
export function Bibliography(): JSX.Element {
  const state = useDocState();
  const orderedKeys = () => {
    const labels = citeLabels(state.read("cite") as CiteFact[], state.seeded);
    return [...labels.keys()].sort(
      (a, b) => (labels.get(a) ?? 0) - (labels.get(b) ?? 0)
    );
  };
  return (
    <Show when={orderedKeys().length > 0}>
      <ol class="nota-bibliography">
        {orderedKeys().map(key => (
          <li id={`bib-${key}`}>
            <BibEntryLine key_={key} />
          </li>
        ))}
      </ol>
    </Show>
  );
}

// =============================================================================================
// counters (generic helper — the future figure/theorem numbering primitive)
// =============================================================================================

/**
 * A 1-based count per fact of `kind` in document (`pos`) order, keyed by `pos`, optionally
 * resetting after each `resetOn`-kind fact.
 */
export function counters(
  facts: Fact[],
  resetFacts: Fact[] = []
): Map<number, number> {
  const events: { pos: number; count: boolean }[] = [
    ...facts.map(f => ({ pos: f.pos as number, count: true })),
    ...resetFacts.map(f => ({ pos: f.pos as number, count: false }))
  ].sort((a, b) => a.pos - b.pos);
  const map = new Map<number, number>();
  let n = 0;
  for (const ev of events) {
    if (!ev.count) {
      n = 0;
    } else {
      n += 1;
      map.set(ev.pos, n);
    }
  }
  return map;
}
