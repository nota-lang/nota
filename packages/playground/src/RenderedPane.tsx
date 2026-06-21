/**
 * Phase S (placeholder until filled below): the live **Rendered** pane — boots the Post-SSG HTML in
 * a sandboxed iframe via blob-ESM + import map + `bootIslands`. Stubbed in phase R so `App` compiles.
 */
export interface RenderedPaneProps {
  /** The bare emitted module (stage 3). */
  code: string;
  /** The island manifest from `render` (stage 5). */
  manifest: unknown;
  /** Whether this tab is currently shown (avoid work when hidden). */
  active: boolean;
}

export function RenderedPane(_props: RenderedPaneProps) {
  return (
    <div className="rendered" data-testid="pane-rendered">
      <p className="placeholder">Live preview (phase S).</p>
    </div>
  );
}
