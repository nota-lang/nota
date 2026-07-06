/**
 * The **Nota-owned** per-tag HTML attribute map — the type surface `h("tag", props, …)` checks
 * `props` against (contract R22, the typed emit surface).
 *
 * This is deliberately *not* React's `JSX.IntrinsicElements`: the reader lowers markup to `h(...)`
 * *calls*, not JSX, and emits framework-neutral HTML attribute names (`class`, not `className`;
 * `for`, not `htmlFor`) plus reader-synthesised host tags (`nota-ul-li`). We seed a representative
 * set of common elements with their distinctive attributes and let every other tag — custom
 * elements, the `nota-*` sentinels, anything — fall through the string index signature so it stays
 * legal (contract: unknown tags never error; that is the "never lie" surface).
 *
 * Each element type intersects {@link NotaGlobalAttributes} (which carries a permissive
 * `[attr: string]: unknown` index) with its element-specific attributes, so:
 * - known attributes get **completion** and **value checking** (`h("a", { href: 123 })` errors —
 *   `href` is `string`), while
 * - unknown attributes are **allowed** (`h("a", { "data-x": 1, whatever: true })` is fine).
 */

/**
 * Attributes valid on every host element: the HTML global attributes, the reader's `key` (a
 * reconciliation hint that rides through props), and a permissive index signature so an element
 * never rejects an attribute it does not explicitly list (custom `data-*`, framework props, ARIA).
 * Named members are checked against their declared types; everything else is `unknown`.
 */
export interface NotaGlobalAttributes {
  /** Element id. */
  id?: string;
  /** Space-separated class list (HTML `class`, not React's `className`). */
  class?: string;
  /** Inline style — a CSS string, or a property map (the reader passes `{ color }`-style objects). */
  style?: string | Record<string, string | number>;
  /** Advisory title (tooltip). */
  title?: string;
  /** ARIA role. */
  role?: string;
  /** Whether the element is hidden. */
  hidden?: boolean;
  /** Tab order. */
  tabindex?: number;
  /** Text directionality. */
  dir?: "ltr" | "rtl" | "auto";
  /** Language tag. */
  lang?: string;
  /** The reader's list/`@for` reconciliation key (rides through props; ignored by static serialize). */
  key?: string | number;
  /** Anything else — custom attributes, `data-*`/`aria-*`, event handlers — stays legal. */
  [attr: string]: unknown;
}

/** `<a>` — hyperlink. */
export interface NotaAnchorAttributes extends NotaGlobalAttributes {
  href?: string;
  target?: "_self" | "_blank" | "_parent" | "_top" | (string & {});
  rel?: string;
  download?: string | boolean;
}

/** `<img>` — image. */
export interface NotaImgAttributes extends NotaGlobalAttributes {
  src?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async" | "auto";
}

/** `<input>` — form control. */
export interface NotaInputAttributes extends NotaGlobalAttributes {
  type?: string;
  name?: string;
  value?: string | number;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  required?: boolean;
  readonly?: boolean;
}

/** `<label>` — form label. */
export interface NotaLabelAttributes extends NotaGlobalAttributes {
  /** HTML `for` (not React's `htmlFor`). */
  for?: string;
}

/** `<td>`/`<th>` — table cells. */
export interface NotaTableCellAttributes extends NotaGlobalAttributes {
  colspan?: number;
  rowspan?: number;
  headers?: string;
  scope?: "row" | "col" | "rowgroup" | "colgroup";
}

/** `<ol>` — ordered list. */
export interface NotaOlAttributes extends NotaGlobalAttributes {
  start?: number;
  reversed?: boolean;
  type?: "1" | "a" | "A" | "i" | "I";
}

/**
 * The per-tag attribute map. Explicit entries give the distinctive attributes of common elements;
 * the string index signature is the fallback for every other tag (custom elements, `nota-*`
 * sentinels, anything the reader emits) — permissive, so unknown tags never error.
 *
 * A generic host element (`<p>`, `<div>`, `<span>`, `<h1>`…) resolves through the index signature to
 * {@link NotaGlobalAttributes}. `<a>`/`<img>`/`<input>`/… resolve to their specific attributes.
 */
export interface NotaIntrinsicElements {
  a: NotaAnchorAttributes;
  img: NotaImgAttributes;
  input: NotaInputAttributes;
  label: NotaLabelAttributes;
  td: NotaTableCellAttributes;
  th: NotaTableCellAttributes;
  ol: NotaOlAttributes;
  /** Fallback: any other tag string is legal and gets the global attributes. */
  [tag: string]: NotaGlobalAttributes;
}

/**
 * The props type for `h(tag, props, …)` when `tag` is a **string literal** `K`: the specific
 * attributes for a known `K`, or the permissive {@link NotaGlobalAttributes} for any other string.
 */
export type NotaHostProps<K extends string> =
  K extends keyof NotaIntrinsicElements
    ? NotaIntrinsicElements[K]
    : NotaGlobalAttributes;
