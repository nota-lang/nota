import { codes } from "micromark-util-symbol/codes.js";
import type * as mm from "micromark-util-types";
import type * as fromMarkdown from "mdast-util-from-markdown";
import { MDXJsxTextElement, MDXJsxAttribute } from "mdast-util-mdx-jsx";
import type {Plugin} from "unified";

function ref_text(): mm.Construct {
  let tokenize: mm.Tokenizer = function (effects, ok, nok) {
    let state: "name" | "attrs" = "name";
    let start: mm.State = function (code) {
      effects.consume(code);
      return open_bracket;
    };

    let open_bracket: mm.State = function (code) {
      if (code == codes.leftSquareBracket) {
        effects.consume(code);
        effects.enter("ref");
        effects.enter("ref_name");
        return inner;
      } else {
        return nok(code);
      }
    };

    let inner: mm.State = function (code) {
      if (code === codes.eof) {
        return nok(code);
      }

      if (code === codes.rightSquareBracket) {
        effects.exit(`ref_${state}`);
        effects.exit("ref");
        effects.consume(code);
        return ok(code);
      }

      if (code === codes.semicolon) {
        effects.exit("ref_name");
        effects.consume(code);
        effects.enter("ref_attrs");
        state = "attrs";
        return inner;
      }

      effects.consume(code);
      return inner;
    };

    return start;
  };

  let resolve: mm.Resolver = function (events, _context) {
    return events;
  };

  let previous: mm.Previous = function (code) {
    return code !== codes.ampersand;
  };

  return {
    tokenize,
    resolve,
    previous,
  };
}

function ref_micromark(): mm.Extension {
  return {
    text: { [codes.atSign]: ref_text() },
  };
}

function ref_from_markdown(): fromMarkdown.Extension {
  let enter_ref: fromMarkdown.Handle = function (token) {
    let element: MDXJsxTextElement = {
      type: "mdxJsxTextElement",
      name: "Ref",
      attributes: [
        {
          type: "mdxJsxAttribute",
          name: "name",
          value: "",
        },
      ],
      children: [],
    };
    this.enter(element, token);
  };

  let exit_ref: fromMarkdown.Handle = function (token) {
    this.exit(token);
  };

  let exit_ref_name: fromMarkdown.Handle = function (token) {
    const data = this.sliceSerialize(token);
    const node = this.stack[this.stack.length - 1] as MDXJsxTextElement;
    node.attributes[0].value = data;
  };

  let exit_ref_attrs: fromMarkdown.Handle = function (token) {
    const data = this.sliceSerialize(token);
    const node = this.stack[this.stack.length - 1] as MDXJsxTextElement;
    const attrs: MDXJsxAttribute[] = data
      .trim()
      .split(" ")
      .map((name: string) => ({
        type: "mdxJsxAttribute",
        name,
        value: "true",
      }));
    node.attributes = node.attributes.concat(attrs);
  };

  return {
    enter: {
      ref: enter_ref,
    },
    exit: {
      ref: exit_ref,
      ref_name: exit_ref_name,
      ref_attrs: exit_ref_attrs,
    },
  };
}

export let ref_plugin: Plugin = function () {
  const data: Record<string, any> = this.data();
  data.micromarkExtensions.push(ref_micromark());
  data.fromMarkdownExtensions.push(ref_from_markdown());
}
