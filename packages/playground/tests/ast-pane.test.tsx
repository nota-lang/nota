import { parseAst } from "@nota-lang/compiler/reader";
import { render } from "solid-js/web";
import { expect, test } from "vitest";
import { AstPane } from "../src/AstPane";

test("AST previews convert reader byte offsets after non-ASCII text", () => {
  const source = "π prose\n\n@em{x}\n";
  const host = document.createElement("div");
  const dispose = render(
    () => <AstPane ast={parseAst(source).ast} source={source} />,
    host
  );

  const elementRow = Array.from(host.querySelectorAll(".ast-row")).find(
    row => row.querySelector(".ast-type")?.textContent === "NotaElement"
  );
  expect(elementRow?.querySelector(".ast-preview")?.textContent).toBe("@em{x}");

  dispose();
});
