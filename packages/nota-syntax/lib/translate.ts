import { SyntaxNode, Tree } from "@lezer/common";
//@ts-ignore
import * as terms from "./nota.terms";
import _ from "lodash";

const assert = console.assert;

let string_literal = (s: string): string => `String.raw\`${s}\``;
let symbol = (s: string): string => {
  global.symbols.add(s);
  return s;
};

let global = {
  input: "",
  symbols: new Set(),
};

export let translate = (input: string, tree: Tree): string => {
  let node = tree.topNode;
  assert(node.type.id == terms.Top);
  global = {
    input,
    symbols: new Set(),
  };

  let body = translate_toplevel(node.firstChild!);
  let doc = to_react(symbol("Document"), {}, [body]);
  let used_imports = Array.from(global.symbols).join(",");

  return `function(imports) {
    const {${used_imports}} = imports;
    return ${doc};
  }`;
};

let translate_toplevel = (node: SyntaxNode) => {
  let tokens = node.getChildren(terms.TextToken);

  interface Section {
    title: SyntaxNode;
    children: (SyntaxNode | Section)[];
  }

  let processed_sections: Section[] = [];
  let section_stack: Section[] = [];
  let body = [];
  tokens.forEach(token => {
    let node = token.firstChild!;

    if (node.type.id == terms.Command) {
      let ident = text(node.getChild(terms.Ident)!).toLowerCase();
      if (ident.endsWith("section")) {
        let depth = Array.from(ident.matchAll(/sub/g)).length;

        let popped = section_stack.splice(depth);
        if (section_stack.length == 0 && popped.length > 0) {
          processed_sections.push(popped[0]);
        }

        let section: Section = {
          title: node.getChild(terms.CommandAnonArg)!.firstChild,
          children: [],
        };

        if (section_stack.length > 0) {
          _.last(section_stack)!.children.push(section);
        }

        section_stack.push(section);
        return;
      }
    } else if (node.type.id == terms.Multinewline) {
      return;
    }

    if (section_stack.length == 0) {
      body.push(token);
    } else {
      _.last(section_stack)!.children.push(token);
    }
  });

  if (section_stack.length > 0) {
    processed_sections.push(section_stack[0]);
  }

  let translate_section = (section: Section) => {
    let children = section.children.map(child =>
      child.title ? translate_section(child) : translate_token(child)
    );

    children.unshift(to_react(symbol("SectionTitle"), {}, [translate_textbody(section.title)]));

    return to_react(symbol("Section"), {}, children);
  };

  let new_body = body.map(translate_token).concat(processed_sections.map(translate_section));

  // let paragraphs = blocks.map(block =>
  //   to_react(block.has_text ? string_literal("p") : "React.Fragment", {}, block.children)
  // );
  return to_react("React.Fragment", {}, new_body);
};

let to_react = (name: string, props: { [key: string]: any }, children: string[]): string => {
  return `${symbol("React")}.createElement(${name}, ${JSON.stringify(props)}, ${children.join(
    ", "
  )})`;
};

let text = (cursor: SyntaxNode): string => global.input.slice(cursor.from, cursor.to);

let translate_token = (node: SyntaxNode): string => {
  let child = node.firstChild!;
  if (child.type.id == terms.Command) {
    return translate_command(child);
  } else if (child.type.id == terms.Text) {
    return string_literal(text(child));
  } else if (child.type.id == terms.Newline || child.type.id == terms.Multinewline) {
    return string_literal("\n");
  } else {
    throw `Unhandled child type ${child.name}`;
  }
};

let translate_textbody = (node: SyntaxNode): string => {
  assert(node.name == "TextBody");

  let children = node.getChildren(terms.TextToken).map(translate_token);
  return to_react(`${symbol("React")}.Fragment`, {}, children);
};

let translate_command = (node: SyntaxNode): string => {
  let sigil = text(node.getChild(terms.CommandSigil)!);
  let ident = text(node.getChild(terms.Ident)!);
  let named_args = node.getChild(terms.CommandNamedArgs);
  let anon_args = node
    .getChildren(terms.CommandAnonArg)
    .map(node => translate_textbody(node.firstChild!));

  if (sigil == "@") {
    return to_react(symbol(ident), {}, anon_args);
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
