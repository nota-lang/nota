/**
 * The Nota playground (implementation.md §4.2): the **entire pipeline client-side** (wasm reader +
 * pure-JS runtime, no server) as a live decode.md visualizer. A CM6 editor on the left; an output
 * pane on the right whose three tabs map exactly onto decode.md's stages:
 *
 *   | Tab           | decode.md stage              | Source                                 |
 *   | Generated JS  | stage 3 (emitted module)     | `compile(src).code` (wasm)             |
 *   | Post-SSG      | stage 5 (HTML + manifest)    | `render(Doc)` run in-browser           |
 *   | Rendered      | the hydrated result          | the HTML booted live in an iframe      |
 */

import { useEffect, useMemo, useState } from "react";
import { CodePane } from "./CodePane";
import { compileNota, compileNotaRaw, ensureCompiler } from "./compiler";
import { Editor } from "./Editor";
import { GOLDEN_NOTA } from "./golden";
import { notaLanguage } from "./nota-mode";
import { RenderedPane } from "./RenderedPane";
import { SsgPane } from "./SsgPane";
import { type ManifestEntry, runSSG } from "./ssg";

type Tab = "js" | "ssg" | "rendered";

/** The result of running the pipeline over the current editor value. */
interface PipelineResult {
  /** The bare emitted module (stage 3), for the Generated-JS pane. */
  code: string;
  /** The emitted module with the runtime import prepended (fed to the SSG runner + iframe). */
  full: string;
  /** The Post-SSG HTML (stage 5). */
  html: string;
  /** The island manifest (stage 5). */
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
  const [source, setSource] = useState(GOLDEN_NOTA);
  const [tab, setTab] = useState<Tab>("js");
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<PipelineResult>(EMPTY);

  // The nota highlighting extension (phase T) — created once.
  const language = useMemo(() => notaLanguage(), []);

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
        <span className="subtitle">a live decode.md visualizer</span>
        {!ready && <span className="status">loading compiler…</span>}
      </header>

      <div className="columns">
        <section className="pane editor-pane">
          <div className="pane-head">decode.md stage 1–2 · source</div>
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
              <em>stage 3</em>
            </button>
            <button
              type="button"
              className={tab === "ssg" ? "tab active" : "tab"}
              onClick={() => setTab("ssg")}
            >
              Post-SSG
              <em>stage 5</em>
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
