/**
 * `@nota-lang/react-router` — the React Router integrator (design/decode.md §SSG integration).
 *
 * A React Router site (SPA mode + prerender, or full SSR) renders a Nota document by making a
 * route module of it:
 *
 * ```tsx
 * import Doc, { metadata } from "./post.nota";
 * import { NotaDoc, docMeta } from "@nota-lang/react-router";
 *
 * export const meta = docMeta(metadata);
 * export default function Page() {
 *   return <NotaDoc doc={Doc} />;
 * }
 * ```
 *
 * {@link NotaDoc} is the bridge: the document self-renders through `render(Doc)` — in Node at
 * prerender/SSR time, and **identically in the browser** so React hydration matches (the render
 * is memoized per document module, so it runs once per session and exactly once per prerender) —
 * and after mount its islands hydrate through the standard replay pipeline
 * (decode.md §Replay hydration), scoped to the container. React owns the container node but
 * never diffs inside it (`dangerouslySetInnerHTML`), so the islands' own React roots coexist
 * with the router's tree; on route unmount the islands tear down before the container is
 * released.
 *
 * The React adapter is installed at module load (one adapter per app — importing this package
 * IS choosing React). Site-wide registry/config policy stays the integrator's: run your
 * `registerComponents`/`lstset`/`mathset` calls and `bakeConfigBaseline()` in a setup module
 * imported before the first route renders (e.g. from `root.tsx`), mirroring the CLI's `--setup`
 * seam.
 */

import adapter from "@nota-lang/react";
import {
  hydrateDocument,
  type Manifest,
  render,
  setAdapter
} from "@nota-lang/runtime";
import { useEffect, useRef } from "react";
import type { MetaDescriptor } from "react-router";

setAdapter(adapter);

/** A compiled `.nota` module's default export (kept permissive — see the ambient typing story). */
export type DocFn = () => unknown;
type RenderDocFn = Parameters<typeof render>[0];

/** A document's `%export let metadata` surface, as this package understands it. */
export interface DocMetadata {
  title?: string;
  [key: string]: unknown;
}

/** One document's memoized static render. */
export interface RenderedDoc {
  html: string;
  manifest: Manifest;
}

// Memoized per document module: route remounts (SPA navigations) must not re-render the
// document, both for speed and because hydration requires the exact prerendered bytes.
const cache = new Map<DocFn, RenderedDoc>();

/**
 * The document's static render (`render(Doc)`), memoized per document module. Exposed for
 * integrations that need the HTML or manifest outside {@link NotaDoc} (e.g. an RSS feed route).
 */
export function renderDoc(doc: DocFn): RenderedDoc {
  let hit = cache.get(doc);
  if (!hit) {
    hit = render(doc as RenderDocFn) as RenderedDoc;
    cache.set(doc, hit);
  }
  return hit;
}

/**
 * A route `meta` export for a Nota page: the document's `%export let metadata` title, mirrored
 * onto `og:title`.
 */
export function docMeta(metadata: DocMetadata): () => MetaDescriptor[] {
  const title = metadata.title ?? "Nota";
  return () => [{ title }, { property: "og:title", content: title }];
}

export interface NotaDocProps {
  /** The compiled `.nota` module's default export. */
  doc: DocFn;
  /** Class of the container element (default `"nota-document"`). */
  className?: string;
}

/**
 * The React Router ⇄ Nota bridge component (see the module docs).
 *
 * Hook order is load-bearing: `renderDoc` may SSR the document's islands via a **nested**
 * `renderToString`, which leaves React's hook dispatcher unset for the remainder of the outer
 * component's render. Every hook therefore runs *before* the document render (the effect
 * re-reads the by-then-warm cache), so the nested render can never break them.
 */
export function NotaDoc({
  doc,
  className = "nota-document"
}: NotaDocProps): React.ReactElement {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const { manifest } = renderDoc(doc);
    if (!el || Object.keys(manifest).length === 0) return;
    let unmounts: Array<() => void> = [];
    try {
      unmounts = hydrateDocument(doc as RenderDocFn, { root: el });
    } catch (err) {
      console.error("[nota] island hydration failed:", err);
    }
    return () => {
      for (const unmount of unmounts) {
        try {
          unmount();
        } catch (err) {
          console.error("[nota] island teardown failed:", err);
        }
      }
    };
  }, [doc]);

  const { html } = renderDoc(doc);
  return (
    <main
      className={className}
      ref={ref}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the document's own static render.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
