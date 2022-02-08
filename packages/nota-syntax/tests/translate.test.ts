import { res_unwrap } from "@nota-lang/nota-common";
import { try_parse, translate } from "@nota-lang/nota-syntax";

test("translate", () => {
  let input = "@h1{Hello world!}";
  let tree = res_unwrap(try_parse(input));
  let js = translate(input, tree);
  let expected = `
import { createElement as el, Fragment } from "react";
import { observer } from "mobx-react";
import { Document } from "@nota-lang/nota-components";
export default observer(doc_props => el(Document, { ...doc_props
}, el("h1", {}, "Hello world!")));
  `;
  expect(js).toBe(expected.trim());
});
