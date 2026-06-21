/**
 * A formatted + syntax-highlighted output pane. Prettier-formats its `code` for the chosen `mode`
 * ({@link formatCode}) and shows the result in a read-only CM6 {@link CodeView} with that mode's
 * language. Formatting is async (Prettier lazy-loads + returns a promise), so we run it in an effect
 * and hold the result in state, showing the raw `code` until the first format lands.
 *
 * `mode` drives both halves: `"js"` → babel parser + JS highlight (the Generated-JS tab); `"html"` →
 * html parser + HTML highlight (the Post-SSG tab). `fill` makes the view fill its container and
 * scroll internally (the JS tab); without it the view grows to its content (the stacked SSG blocks).
 */

import { useEffect, useMemo, useState } from "react";
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

export function CodePane({ code, mode, testid, fill }: CodePaneProps) {
  const { parser, language } = MODES[mode];
  // `language()`/`parser` are stable module refs, so these run once per mode.
  const lang = useMemo(() => language(), [language]);
  const [pretty, setPretty] = useState(code);

  useEffect(() => {
    let live = true;
    formatCode(code, parser).then(out => {
      // Drop a stale format if `code` changed while we were awaiting.
      if (live) setPretty(out);
    });
    return () => {
      live = false;
    };
  }, [code, parser]);

  return (
    <div
      className={fill ? "code-pane code-pane--fill" : "code-pane"}
      data-testid={testid}
    >
      <CodeView value={pretty} language={lang} />
    </div>
  );
}
