/** Asynchronously format and display a read-only code pane. */

import { createEffect, createSignal, untrack } from "solid-js";
import { CodeView } from "./CodeView";
import { formatCode } from "./format";
import { jsLanguage } from "./js-mode";

const MODES = {
  js: { parser: "babel", language: jsLanguage }
} as const;

export interface CodePaneProps {
  code: string;
  mode: keyof typeof MODES;
  testid: string;
  fill?: boolean;
}

export function CodePane(props: CodePaneProps) {
  // Mode is fixed for the pane; the effect below tracks later code changes.
  const { parser, language } = MODES[untrack(() => props.mode)];
  const lang = language();
  const [pretty, setPretty] = createSignal(untrack(() => props.code));

  createEffect(
    () => props.code,
    code => {
      let live = true;
      setPretty(code);
      formatCode(code, parser).then(out => {
        if (live) setPretty(out);
      });
      return () => {
        live = false;
      };
    }
  );

  return (
    <div
      class={props.fill ? "code-pane code-pane-fill" : "code-pane"}
      data-testid={props.testid}
    >
      <CodeView value={pretty()} language={lang} />
    </div>
  );
}
