/**
 * A formatted + syntax-highlighted output pane. Prettier-formats its `code` for the chosen
 * `mode` ({@link formatCode}) and shows the result in a read-only CM6 {@link CodeView} with that
 * mode's language. Formatting is async (Prettier lazy-loads + returns a promise), so it runs in
 * an effect into a signal, showing the raw `code` until the first format lands.
 *
 * `mode` drives both halves: `"js"` → babel parser + JS highlight (the JSX/compiled tabs);
 * `"html"` → html parser + HTML highlight. `fill` makes the view fill its container and scroll
 * internally; without it the view grows to its content.
 */

import { createEffect, createSignal, onCleanup } from "solid-js";
import { CodeView } from "./CodeView";
import { formatCode } from "./format";
import { htmlLanguage } from "./html-mode";
import { jsLanguage } from "./js-mode";

const MODES = {
  js: { parser: "babel", language: jsLanguage },
  html: { parser: "html", language: htmlLanguage }
} as const;

export interface CodePaneProps {
  code: string;
  mode: keyof typeof MODES;
  testid: string;
  /** Fill the container and scroll internally (vs. grow to content). */
  fill?: boolean;
}

export function CodePane(props: CodePaneProps) {
  const { parser, language } = MODES[props.mode];
  const lang = language();
  const [pretty, setPretty] = createSignal(props.code);

  createEffect(() => {
    const code = props.code;
    let live = true;
    setPretty(code);
    formatCode(code, parser).then(out => {
      // Drop a stale format if `code` changed while we were awaiting.
      if (live) setPretty(out);
    });
    onCleanup(() => {
      live = false;
    });
  });

  return (
    <div
      class={props.fill ? "code-pane code-pane-fill" : "code-pane"}
      data-testid={props.testid}
    >
      <CodeView value={pretty()} language={lang} />
    </div>
  );
}
