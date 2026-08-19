/** Client-side Nota pipeline playground. */

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

const language = notaHighlighting();

const lsp = notaLsp();

const TAB_INFO: Record<Tab, { label: string; hint: string }> = {
  ast: { label: "AST", hint: "parsed tree" },
  jsx: { label: "JSX", hint: "emitted Solid module" },
  js: { label: "Compiled JS", hint: "babel-preset-solid output" },
  rendered: { label: "Rendered", hint: "live document" }
};
const TABS = (Object.keys(TAB_INFO) as Tab[]).map(id => ({
  id,
  ...TAB_INFO[id]
}));

export function App() {
  const [source, setSource] = createSignal(loadSource() ?? DEFAULT_SNIPPET);
  const [tab, setTab] = createSignal<Tab>("jsx");
  const [result, setResult] = createSignal<PipelineResult>(EMPTY);

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
