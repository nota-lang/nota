/**
 * The Nota playground: the **entire pipeline client-side** (wasm reader + pure-JS runtime, no server),
 * visualized live. A CM6 editor on the left; an output pane on the right whose three tabs each show
 * one artifact of the pipeline:
 *
 *   | Tab           | Shows                        | Source                                 |
 *   | Generated JS  | the emitted JS module        | `compile(src).code` (wasm)             |
 *   | SSG output    | the SSG HTML + manifest      | `render(Doc)` run in-browser           |
 *   | Rendered      | the hydrated result          | the HTML booted live in an iframe      |
 */

import type { Extension } from "@codemirror/state";
import { useEffect, useState } from "react";
import { CodePane } from "./CodePane";
import { compileNota, compileNotaRaw, ensureCompiler } from "./compiler";
import { DEFAULT_SNIPPET } from "./default-snippet";
import { Editor } from "./Editor";
import { createNotaHighlight } from "./nota-mode";
import { RenderedPane } from "./RenderedPane";
import { SsgPane } from "./SsgPane";
import { type ManifestEntry, runSSG } from "./ssg";
import { loadSource, saveSource } from "./storage";

type Tab = "js" | "ssg" | "rendered";

/** The result of running the pipeline over the current editor value. */
interface PipelineResult {
  /** The bare emitted module, for the Generated-JS pane. */
  code: string;
  /** The emitted module with the runtime import prepended (fed to the SSG runner + iframe). */
  full: string;
  /** The SSG HTML. */
  html: string;
  /** The island manifest. */
  manifest: Record<string, ManifestEntry>;
  /** The island components, keyed by name (for the Rendered pane to hydrate). */
  registry: Record<string, unknown>;
  /** A compile/render error, if the pipeline threw. */
  error: string | null;
}

const EMPTY: PipelineResult = {
  code: "",
  full: "",
  html: "",
  manifest: {},
  registry: {},
  error: null
};

export function App() {
  // Seed from the last-saved source (persisted in localStorage), falling back to the seed document.
  const [source, setSource] = useState(() => loadSource() ?? DEFAULT_SNIPPET);
  const [tab, setTab] = useState<Tab>("js");
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<PipelineResult>(EMPTY);

  // The Nota highlighting extension loads asynchronously (Shiki + onig-wasm + grammars); until it
  // resolves the editor shows plain text. Highlighting is best-effort — a load failure is ignored.
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
      try {
        const code = compileNotaRaw(source);
        const full = compileNota(source);
        const { html, manifest, registry } = runSSG(full);
        setResult({ code, full, html, manifest, registry, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setResult(prev => ({ ...prev, error: message }));
      }
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
