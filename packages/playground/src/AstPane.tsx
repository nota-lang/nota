/**
 * The AST output pane: an **interactive tree** over the post-parse Nota AST. The reader hands
 * back ESTree JSON (`parseAst` → a string we `JSON.parse`); this renders it as a collapsible
 * tree where each row shows only the node's `type` and a one-line source preview, and a click on
 * the disclosure arrow drills into its children.
 *
 * The walk is generic — it assumes nothing about specific Nota node shapes:
 *   - a **node** is any object with a string `type` field;
 *   - a node's **children** are its node-valued fields, descending into arrays (label = path);
 *   - the **preview** is the first line of the source the node spans, so it works for every node
 *     kind without per-type code.
 *
 * `source` is the text that produced this AST (the pipeline keeps them paired), so node offsets
 * index the right characters even when the editor has raced ahead after a parse error.
 */

import { createMemo, createSignal, For, Show } from "solid-js";

/** An AST node: a JSON object with a string `type`. Other fields are children or scalar props. */
interface AstNodeValue {
  type: string;
  start?: number;
  end?: number;
  [key: string]: unknown;
}

/** Fields that describe the node itself rather than its children/props. */
const META_KEYS = new Set(["type", "start", "end", "range"]);

/** How deep the tree auto-expands. The Nota document sits under a fixed wrapper chain
 * (`Program → ExpressionStatement → NotaMarkup → NotaDocument`), so opening the first four
 * levels reveals the document's top-level items collapsed, ready to drill into. */
const DEFAULT_OPEN_DEPTH = 4;

const isNode = (value: unknown): value is AstNodeValue =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { type?: unknown }).type === "string";

/** A node's child nodes, in field order, descending into arrays. Label is the field path. */
function childEntries(
  node: AstNodeValue
): { label: string; node: AstNodeValue }[] {
  const out: { label: string; node: AstNodeValue }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (META_KEYS.has(key)) continue;
    if (isNode(value)) {
      out.push({ label: key, node: value });
    } else if (Array.isArray(value)) {
      value.forEach((el, i) => {
        if (isNode(el)) out.push({ label: `${key}[${i}]`, node: el });
      });
    }
  }
  return out;
}

/** A node's scalar (non-node) fields, shown as dim leaf rows when the node is expanded. */
function scalarProps(node: AstNodeValue): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (META_KEYS.has(key)) continue;
    if (isNode(value)) continue;
    if (Array.isArray(value)) {
      if (value.some(isNode)) continue; // arrays of nodes are children, not props
      out.push({ key, value: JSON.stringify(value) });
    } else if (typeof value !== "object") {
      out.push({ key, value: JSON.stringify(value) });
    }
  }
  return out;
}

/** First line of the source the node spans, trimmed + truncated; falls back to a `value`/`name`. */
function preview(node: AstNodeValue, source: string): string {
  const { start, end } = node;
  if (typeof start === "number" && typeof end === "number" && end > start) {
    const firstLine = source.slice(start, end).split("\n", 1)[0].trim();
    return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
  }
  const text = node.value ?? node.name;
  return typeof text === "string" ? JSON.stringify(text) : "";
}

interface AstNodeProps {
  node: AstNodeValue;
  /** The field path that reached this node from its parent (`null` for the root). */
  label: string | null;
  source: string;
  depth: number;
}

function AstNode(props: AstNodeProps) {
  const children = createMemo(() => childEntries(props.node));
  const scalars = createMemo(() => scalarProps(props.node));
  const hasBody = () => children().length > 0 || scalars().length > 0;
  const [open, setOpen] = createSignal(props.depth < DEFAULT_OPEN_DEPTH);

  const indent = { "padding-left": `${props.depth * 0.85 + 0.4}rem` };
  const Head = () => (
    <>
      <span class="ast-toggle">{hasBody() ? (open() ? "▾" : "▸") : "·"}</span>
      <Show when={props.label !== null}>
        <span class="ast-field">{props.label}</span>
      </Show>
      <span class="ast-type">{props.node.type}</span>
      <span class="ast-preview">{preview(props.node, props.source)}</span>
    </>
  );

  return (
    <div class="ast-node">
      <Show
        when={hasBody()}
        fallback={
          <div class="ast-row ast-leaf" style={indent}>
            <Head />
          </div>
        }
      >
        <button
          type="button"
          class="ast-row"
          style={indent}
          aria-expanded={open()}
          onClick={() => setOpen(o => !o)}
        >
          <Head />
        </button>
      </Show>

      <Show when={open() && hasBody()}>
        <div class="ast-children">
          <For each={scalars()}>
            {p => (
              <div
                class="ast-row ast-prop"
                style={{
                  "padding-left": `${(props.depth + 1) * 0.85 + 0.4}rem`
                }}
              >
                <span class="ast-toggle">·</span>
                <span class="ast-field">{p.key}</span>
                <span class="ast-scalar">{p.value}</span>
              </div>
            )}
          </For>
          <For each={children()}>
            {c => (
              <AstNode
                node={c.node}
                label={c.label}
                source={props.source}
                depth={props.depth + 1}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export interface AstPaneProps {
  /** The ESTree JSON string from `parseAst` (empty before the first successful parse). */
  ast: string;
  /** The source text that produced `ast`, for slicing per-node previews. */
  source: string;
}

export function AstPane(props: AstPaneProps) {
  // Parse once per AST string; a malformed/empty string yields no tree (a placeholder shows).
  const root = createMemo<AstNodeValue | null>(() => {
    if (!props.ast) return null;
    try {
      const value = JSON.parse(props.ast);
      return isNode(value) ? value : null;
    } catch {
      return null;
    }
  });

  return (
    <div class="ast-tree" data-testid="pane-ast">
      <Show when={root()} fallback={<div class="ast-empty">No AST yet.</div>}>
        {r => (
          <AstNode node={r()} label={null} source={props.source} depth={0} />
        )}
      </Show>
    </div>
  );
}
