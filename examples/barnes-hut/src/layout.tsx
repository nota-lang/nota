/** Layout helpers for explorable explanations. */

import type { JSX } from "@solidjs/web";
import type { ParentProps } from "solid-js";

/** Sticky panel whose horizontal layout is supplied by the document stylesheet. */
export function Sticky(props: ParentProps & { top?: string }): JSX.Element {
  return (
    <div class="nota-sticky" style={{ "--nota-sticky-top": props.top }}>
      {props.children}
    </div>
  );
}
