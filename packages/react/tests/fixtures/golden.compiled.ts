// @ts-nocheck
// AUTO-CAPTURED from integration/golden.nota via the oxc reader (`oxc::nota::compile`) — the literal
// emit, unmodified. The runtime import + `useState` (React, for the island body) are prepended; the
// reader emits neither (the shim/integrator supplies them). Regenerate with:
//   cargo run -q -p oxc --example nota_compile --features codegen -- integration/golden.nota
// R15 shape: the component binding is document-local (inside Doc, name-attached, no export, no body
// decode-wrap); Doc's own body keeps its decode(...) wrap.
import { decode, Fragment, h, inlineComponent } from "@nota-lang/runtime";
import { useState } from "react";

export default function Doc() {
  let Colorized = inlineComponent(children => {
    let [color, setColor] = useState("red");
    return h(
      "span",
      {
        onClick: () => setColor("green"),
        style: { color }
      },
      [children]
    );
  }, "Colorized");
  return decode(
    Fragment(
      ["a", "b"].map((x, _i) =>
        Fragment({ key: _i }, h("nota-ul-li", {}, [h(Colorized, {}, [x])]))
      )
    )
  );
}
