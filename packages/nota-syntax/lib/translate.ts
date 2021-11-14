import { SyntaxNode } from "@lezer/common";
//@ts-ignore
import * as terms from "./nota.terms";

const assert = console.assert;

let string_literal = (s: string): string => `r\`${s}\``;

let to_react = (name: string, props: { [key: string]: any }, children: string[]): string => {
  return `React.createElement(${name}, ${JSON.stringify(props)}, ${children.join(", ")})`;
};

let input: string;
export let set_input = (inp: string) => {
  input = inp;
};

let text = (cursor: SyntaxNode): string => input.slice(cursor.from, cursor.to);

export let translate_textbody = (node: SyntaxNode): string => {
  assert(node.name == "TextBody");

  let children = node.getChildren(terms.TextToken).map(token => {
    let node = token.firstChild!;
    if (node.type.id == terms.Command) {
      return translate_command(node);
    } else if (node.type.id == terms.Text) {
      return string_literal(text(node));
    } else if (node.type.id == terms.Newline) {
      return string_literal("\n");
    } else {
      throw `Unhandled child type ${node.name}`;
    }
  });

  return to_react("React.Fragment", {}, children);
};

let translate_command = (node: SyntaxNode): string => {
  let sigil = text(node.getChild(terms.CommandSigil)!);
  let ident = text(node.getChild(terms.Ident)!);
  let named_args = node.getChild(terms.CommandNamedArgs);
  let anon_args = node
    .getChildren(terms.CommandAnonArg)
    .map(node => translate_textbody(node.firstChild!));

  if (sigil == "@") {
    return to_react(ident, {}, anon_args);
  } else {
    throw `Unhandled sigil ${sigil}`;
  }
};

// import { Text, AtExpr, AtBody } from "./ast";
// import _ from "lodash";

// const assert = console.assert;

// export let translate_text = (text: Text, toplevel: boolean = true): string => {
//   let commands: string[] = [];
//   let blocks: { contains_atexpr: boolean; children: string[] }[] = [
//     { contains_atexpr: false, children: [] },
//   ];

//   text.forEach(token => {
//     let cur_block = blocks[blocks.length - 1];
//     if (token.type == "TokenAtExpr") {
//       let at_expr = token.value;
//       if (at_expr.sigil == "%") {
//         commands.push(translate_command(at_expr));
//       } else {
//         cur_block.contains_atexpr = true;
//         cur_block.children.push(translate_atexpr(token.value));
//       }
//     } else {
//       let body_text = token.value;
//       if (body_text.type == "BodyTextString") {
//         cur_block.children.push(string_literal(body_text.value));
//       } else if (body_text.type == "BodyTextLine") {
//         if (cur_block.children.length > 0) {
//           blocks.push({ contains_atexpr: false, children: [] });
//         }
//       } else {
//         assert(false);
//       }
//     }
//   });

//   let react_blocks = blocks.map(block => {
//     if (block.children.length == 1 && !(toplevel && !block.contains_atexpr)) {
//       return block.children[0];
//     } else {
//       return to_react(toplevel ? string_literal("p") : "React.Fragment", {}, block.children);
//     }
//   });

//   let el = react_blocks.length > 1 ? to_react("React.Fragment", {}, react_blocks) : react_blocks[0];

//   if (commands.length > 0) {
//     return `(() => {${commands.join("\n")}\nreturn ${el};})()`;
//   } else {
//     return el;
//   }
// };

// let translate_atexpr = (at_expr: AtExpr): string => {
//   assert(at_expr.sigil != "%");

//   if (at_expr.sigil == "@") {
//     let func = at_expr.func.value;
//     if (INTRINSIC_ELEMENTS.includes(func)) {
//       func = string_literal(func);
//     }

//     let props = at_expr.args ? _.fromPairs(at_expr.args.map(({ key, value }) => [key, value])) : {};
//     let children = at_expr.body ? [translate_atbody(at_expr.body)] : [];
//     return to_react(func, props, children);
//   } else {
//     let func = at_expr.func.value;
//     if (at_expr.body) {
//       let args = translate_atbody(at_expr.body);
//       return `${func}(${args})`;
//     } else {
//       return func;
//     }
//   }
// };

// let translate_atbody = (at_body: AtBody): string =>
//   at_body.type == "AtBodyText"
//     ? translate_text(at_body.value, false)
//     : string_literal(at_body.value);

// let translate_command = (cmd: AtExpr): string => {
//   switch (cmd.func.value) {
//     case "import":
//     case "import_default": {
//       let imports =
//         cmd.func.value == "import"
//           ? `{${cmd.args!.map(arg => arg.key).join(", ")}}`
//           : cmd.args![0].key;
//       return `const ${imports} = require("${cmd.body.value[0].value.value!}")`;
//     }

//     default: {
//       throw `Unimplemented command: ${cmd.func.value}`;
//     }
//   }
// };

// const INTRINSIC_ELEMENTS: string[] = [
//   "a",
//   "abbr",
//   "address",
//   "area",
//   "article",
//   "aside",
//   "audio",
//   "b",
//   "base",
//   "bdi",
//   "bdo",
//   "big",
//   "blockquote",
//   "body",
//   "br",
//   "button",
//   "canvas",
//   "caption",
//   "cite",
//   "code",
//   "col",
//   "colgroup",
//   "data",
//   "datalist",
//   "dd",
//   "del",
//   "details",
//   "dfn",
//   "dialog",
//   "div",
//   "dl",
//   "dt",
//   "em",
//   "embed",
//   "fieldset",
//   "figcaption",
//   "figure",
//   "footer",
//   "form",
//   "h1",
//   "h2",
//   "h3",
//   "h4",
//   "h5",
//   "h6",
//   "head",
//   "header",
//   "hgroup",
//   "hr",
//   "html",
//   "i",
//   "iframe",
//   "img",
//   "input",
//   "ins",
//   "kbd",
//   "keygen",
//   "label",
//   "legend",
//   "li",
//   "link",
//   "main",
//   "map",
//   "mark",
//   "menu",
//   "menuitem",
//   "meta",
//   "meter",
//   "nav",
//   "noindex",
//   "noscript",
//   "object",
//   "ol",
//   "optgroup",
//   "option",
//   "output",
//   "p",
//   "param",
//   "picture",
//   "pre",
//   "progress",
//   "q",
//   "rp",
//   "rt",
//   "ruby",
//   "s",
//   "samp",
//   "slot",
//   "script",
//   "section",
//   "select",
//   "small",
//   "source",
//   "span",
//   "strong",
//   "style",
//   "sub",
//   "summary",
//   "sup",
//   "table",
//   "template",
//   "tbody",
//   "td",
//   "textarea",
//   "tfoot",
//   "th",
//   "thead",
//   "time",
//   "title",
//   "tr",
//   "track",
//   "u",
//   "ul",
//   "",
//   "video",
//   "wbr",
//   "webview",
//   "svg",
//   "animate",
//   "TODO",
//   "animateMotion",
//   "animateTransform",
//   "TODO",
//   "circle",
//   "clipPath",
//   "defs",
//   "desc",
//   "ellipse",
//   "feBlend",
//   "feColorMatrix",
//   "feComponentTransfer",
//   "feComposite",
//   "feConvolveMatrix",
//   "feDiffuseLighting",
//   "feDisplacementMap",
//   "feDistantLight",
//   "feDropShadow",
//   "feFlood",
//   "feFuncA",
//   "feFuncB",
//   "feFuncG",
//   "feFuncR",
//   "feGaussianBlur",
//   "feImage",
//   "feMerge",
//   "feMergeNode",
//   "feMorphology",
//   "feOffset",
//   "fePointLight",
//   "feSpecularLighting",
//   "feSpotLight",
//   "feTile",
//   "feTurbulence",
//   "filter",
//   "foreignObject",
//   "g",
//   "image",
//   "line",
//   "linearGradient",
//   "marker",
//   "mask",
//   "metadata",
//   "mpath",
//   "path",
//   "pattern",
//   "polygon",
//   "polyline",
//   "radialGradient",
//   "rect",
//   "stop",
//   "switch",
//   "symbol",
//   "text",
//   "textPath",
//   "tspan",
//   "use",
//   "view",
// ];