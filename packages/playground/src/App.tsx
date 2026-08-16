/**
 * The Nota playground: the **entire pipeline client-side** (wasm reader + babel-preset-solid +
 * Solid, no server), visualized live. A CM6 editor on the left; an output pane on the right
 * whose four tabs each show one artifact of the pipeline:
 *
 *   | Tab          | Shows                          | Source                                  |
 *   | AST          | the post-parse Nota AST        | `parseAst(src).ast` (wasm)              |
 *   | JSX          | the emitted Solid JSX module   | `compile(src).code` (wasm + shim)       |
 *   | Compiled JS  | the babel-preset-solid output  | `babelCompile` (in-page babel)          |
 *   | Rendered     | the live document (pure CSR)   | `render(<Doc/>)` — reactive doc-state   |
 */

import { notaHighlighting } from "@nota-lang/codemirror";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { AstPane } from "./AstPane";
import { CodePane } from "./CodePane";
import { DEFAULT_SNIPPET } from "./default-snippet";
import { Editor } from "./Editor";
import { notaLsp } from "./lsp/client";
import { EMPTY, type PipelineResult, runPipeline } from "./pipeline";
import { RenderedPane } from "./RenderedPane";
import { loadSource, saveSource } from "./storage";

type Tab = "ast" | "jsx" | "js" | "rendered";

// The wasm reader instantiates when the module graph loads, so the reader-driven highlighting is
// available synchronously.
const language = notaHighlighting();

// The language server: a Web Worker running the browser flavor of @nota-lang/language-server,
// connected over postMessage. TS diagnostics/hover/completion arrive through this; highlighting
// stays reader-driven (above). `[]` in worker-less environments (jsdom tests).
const lsp = notaLsp();

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "ast", label: "AST", hint: "parsed tree" },
  { id: "jsx", label: "JSX", hint: "emitted Solid module" },
  { id: "js", label: "Compiled JS", hint: "babel-preset-solid output" },
  { id: "rendered", label: "Rendered", hint: "live document" }
];

export function App() {
  // Seed from the last-saved source (persisted in localStorage), falling back to the seed doc.
  const [source, setSource] = createSignal(loadSource() ?? DEFAULT_SNIPPET);
  const [tab, setTab] = createSignal<Tab>("jsx");
  const [result, setResult] = createSignal<PipelineResult>(EMPTY);

  // Persist the source (debounced) so edits survive a refresh, and re-run the pipeline.
  createEffect(() => {
    const value = source();
    const save = setTimeout(() => saveSource(value), 150);
    const run = setTimeout(() => {
      setResult(prev => runPipeline(value, prev));
    }, 150);
    onCleanup(() => {
      clearTimeout(save);
      clearTimeout(run);
    });
  });

  return (
    <div class="playground">
      <header class="toolbar">
        <span class="title">Nota playground</span>
        <span class="subtitle">a live pipeline visualizer</span>
      </header>

      <div class="columns">
        <section class="pane editor-pane">
          <div class="pane-head">source</div>
          <Editor
            value={source()}
            onChange={setSource}
            language={language}
            extensions={lsp}
          />
        </section>

        <section class="pane output-pane">
          <nav class="tabs">
            {TABS.map(t => (
              <button
                type="button"
                class={tab() === t.id ? "tab active" : "tab"}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <em>{t.hint}</em>
              </button>
            ))}
          </nav>

          <Show when={result().error}>
            <pre class="error" data-testid="error">
              {result().error}
            </pre>
          </Show>

          <div class="tab-body">
            <Show when={tab() === "ast"}>
              <AstPane ast={result().ast} source={result().astSource} />
            </Show>
            <Show when={tab() === "jsx"}>
              <CodePane code={result().jsx} mode="js" testid="pane-jsx" fill />
            </Show>
            <Show when={tab() === "js"}>
              <CodePane
                code={result().compiled}
                mode="js"
                testid="pane-js"
                fill
              />
            </Show>
            <div
              class="rendered-host"
              style={{ display: tab() === "rendered" ? "contents" : "none" }}
            >
              <RenderedPane
                Doc={result().Doc}
                docVersion={result().docVersion}
                active={tab() === "rendered"}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
