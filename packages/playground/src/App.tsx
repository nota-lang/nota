/**
 * The Nota playground: the **entire pipeline client-side** (wasm reader + pure-JS runtime, no server),
 * visualized live. A CM6 editor on the left; an output pane on the right whose four tabs each show
 * one artifact of the pipeline:
 *
 *   | Tab           | Shows                        | Source                                 |
 *   | AST           | the post-parse Nota AST      | `parseAst(src).ast` (wasm)             |
 *   | Generated JS  | the emitted JS module        | `compile(src).code` (wasm)             |
 *   | SSG output    | the SSG HTML + manifest      | `render(Doc)` run in-browser           |
 *   | Rendered      | the hydrated result          | the HTML booted live in an iframe      |
 */

import type { Extension } from "@codemirror/state";
import { useEffect, useState } from "react";
import { AstPane } from "./AstPane";
import { CodePane } from "./CodePane";
import { ensureCompiler } from "./compiler";
import { DEFAULT_SNIPPET } from "./default-snippet";
import { Editor } from "./Editor";
import { createNotaHighlight } from "./nota-mode";
import { EMPTY, type PipelineResult, runPipeline } from "./pipeline";
import { RenderedPane } from "./RenderedPane";
import { SsgPane } from "./SsgPane";
import { loadSource, saveSource } from "./storage";

type Tab = "ast" | "js" | "ssg" | "rendered";

export function App() {
  // Seed from the last-saved source (persisted in localStorage), falling back to the seed document.
  const [source, setSource] = useState(() => loadSource() ?? DEFAULT_SNIPPET);
  const [tab, setTab] = useState<Tab>("js");
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<PipelineResult>(EMPTY);

  // The Nota highlighting extension waits on the wasm compiler (the reader highlights the doc);
  // until it resolves the editor shows plain text. Highlighting is best-effort — a load failure
  // is ignored (the compile pipeline surfaces the real error).
  const [language, setLanguage] = useState<Extension>([]);
  useEffect(() => {
    let live = true;
    createNotaHighlight().then(
      ext => live && setLanguage(ext),
      () => {}
    );
    return () => {
      live = false;
    };
  }, []);

  // Load the wasm compiler once.
  useEffect(() => {
    let live = true;
    ensureCompiler().then(
      () => live && setReady(true),
      err => live && setResult({ ...EMPTY, error: String(err?.message ?? err) })
    );
    return () => {
      live = false;
    };
  }, []);

  // Persist the source to localStorage (debounced) so edits survive a refresh.
  useEffect(() => {
    const handle = setTimeout(() => saveSource(source), 150);
    return () => clearTimeout(handle);
  }, [source]);

  // Re-run the pipeline (compile → SSG) whenever the source changes, debounced.
  useEffect(() => {
    if (!ready) return;
    const handle = setTimeout(() => {
      setResult(prev => runPipeline(source, prev));
    }, 150);
    return () => clearTimeout(handle);
  }, [source, ready]);

  return (
    <div className="playground">
      <header className="toolbar">
        <span className="title">Nota playground</span>
        <span className="subtitle">a live pipeline visualizer</span>
        {!ready && <span className="status">loading compiler…</span>}
      </header>

      <div className="columns">
        <section className="pane editor-pane">
          <div className="pane-head">source</div>
          <Editor value={source} onChange={setSource} language={language} />
        </section>

        <section className="pane output-pane">
          <nav className="tabs">
            <button
              type="button"
              className={tab === "ast" ? "tab active" : "tab"}
              onClick={() => setTab("ast")}
            >
              AST
              <em>parsed tree</em>
            </button>
            <button
              type="button"
              className={tab === "js" ? "tab active" : "tab"}
              onClick={() => setTab("js")}
            >
              Generated JS
              <em>emitted JS module</em>
            </button>
            <button
              type="button"
              className={tab === "ssg" ? "tab active" : "tab"}
              onClick={() => setTab("ssg")}
            >
              SSG output
              <em>HTML + manifest</em>
            </button>
            <button
              type="button"
              className={tab === "rendered" ? "tab active" : "tab"}
              onClick={() => setTab("rendered")}
            >
              Rendered
              <em>hydrated</em>
            </button>
          </nav>

          {result.error && (
            <pre className="error" data-testid="error">
              {result.error}
            </pre>
          )}

          <div className="tab-body">
            {tab === "ast" && (
              <AstPane ast={result.ast} source={result.astSource} />
            )}
            {tab === "js" && (
              <CodePane code={result.code} mode="js" testid="pane-js" fill />
            )}
            {tab === "ssg" && (
              <SsgPane html={result.html} manifest={result.manifest} />
            )}
            {tab === "rendered" && (
              <RenderedPane
                html={result.html}
                manifest={result.manifest}
                registry={result.registry}
                active={tab === "rendered"}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
