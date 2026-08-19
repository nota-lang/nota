/** Asynchronously format and display a read-only code pane. */

import { createEffect, createSignal, onCleanup } from "solid-js";
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
  const { parser, language } = MODES[props.mode];
  const lang = language();
  const [pretty, setPretty] = createSignal(props.code);

  createEffect(() => {
    const code = props.code;
    let live = true;
    setPretty(code);
    formatCode(code, parser).then(out => {
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
