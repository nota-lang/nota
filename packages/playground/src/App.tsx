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

import { notaHighlighting } from "@nota-lang/codemirror";
import { useEffect, useState } from "react";
import { AstPane } from "./AstPane";
import { CodePane } from "./CodePane";
import { DEFAULT_SNIPPET } from "./default-snippet";
import { Editor } from "./Editor";
import { notaLsp } from "./lsp/client";
import { EMPTY, type PipelineResult, runPipeline } from "./pipeline";
import { RenderedPane } from "./RenderedPane";
import { SsgPane } from "./SsgPane";
import { loadSource, saveSource } from "./storage";

type Tab = "ast" | "js" | "ssg" | "rendered";

// The wasm reader instantiates when the module graph loads, so the reader-driven highlighting is
// available synchronously.
const language = notaHighlighting();

// The language server: a Web Worker running the browser flavor of @nota-lang/language-server,
// connected over postMessage. TS diagnostics/hover/completion arrive through this; highlighting
// stays reader-driven (above). `[]` in worker-less environments (jsdom tests).
const lsp = notaLsp();

export function App() {
  // Seed from the last-saved source (persisted in localStorage), falling back to the seed document.
  const [source, setSource] = useState(() => loadSource() ?? DEFAULT_SNIPPET);
  const [tab, setTab] = useState<Tab>("js");
  const [result, setResult] = useState<PipelineResult>(EMPTY);

  // Persist the source to localStorage (debounced) so edits survive a refresh.
  useEffect(() => {
    const handle = setTimeout(() => saveSource(source), 150);
    return () => clearTimeout(handle);
  }, [source]);

  // Re-run the pipeline (compile → SSG) whenever the source changes, debounced.
  useEffect(() => {
    const handle = setTimeout(() => {
      setResult(prev => runPipeline(source, prev));
    }, 150);
    return () => clearTimeout(handle);
  }, [source]);

  return (
    <div className="playground">
      <header className="toolbar">
        <span className="title">Nota playground</span>
        <span className="subtitle">a live pipeline visualizer</span>
      </header>

      <div className="columns">
        <section className="pane editor-pane">
          <div className="pane-head">source</div>
          <Editor
            value={source}
            onChange={setSource}
            language={language}
            extensions={lsp}
          />
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
              <SsgPane
                html={result.html}
                compiledJs={result.full}
                clientJs={result.clientJs}
              />
            )}
            {tab === "rendered" && (
              <RenderedPane
                html={result.html}
                manifest={result.manifest}
                Doc={result.Doc}
                active={tab === "rendered"}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
