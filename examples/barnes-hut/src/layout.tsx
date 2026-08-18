/**
 * Layout helpers for explorable explanations: keeping a figure in view while the prose that
 * drives it scrolls.
 */

import type { JSX, ParentProps } from "solid-js";

/**
 * A sticky, zero-height panel: its content stays pinned at `top` (default `2rem`) while the
 * rest of the document scrolls past, without occupying flow space — place it once, early in
 * the document, and let the document's own CSS decide the horizontal geometry (e.g. shift it
 * into a margin column). `explorable.css` supplies the sticky mechanics.
 */
export function Sticky(props: ParentProps & { top?: string }): JSX.Element {
  return (
    <div class="nota-sticky" style={{ "--nota-sticky-top": props.top }}>
      {props.children}
    </div>
  );
}
