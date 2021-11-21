import { SyntaxNode, Tree } from "@lezer/common";
//@ts-ignore
import * as terms from "./nota.terms";
import _ from "lodash";

const assert = console.assert;

let string_literal = (s: string): string => `r\`${s.replace(/`/g, "${bt}")}\``;
let symbol = (s: string): string => {
  global.symbols.add(s);
  return s;
};

let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;

let global: {
  input: string;
  imports: Set<string>;
  symbols: Set<string>;
} = {
  input: "",
  imports: new Set(),
  symbols: new Set(),
};

export type TranslatedFunction = (
  _symbols: { [key: string]: any },
  _imports: { [path: string]: any }
) => JSX.Element;

export interface Translation {
  js: string;
  imports: Set<string>;
}

export let translate = (input: string, tree: Tree): Translation => {
  let node = tree.topNode;
  assert(matches(node, terms.Top));
  global = {
    input,
    imports: new Set(),
    symbols: new Set(["React"]),
  };

  let body = translate_toplevel(node.firstChild!);
  let doc = to_react(symbol("Document"), {}, [body]);
  let used_symbols = Array.from(global.symbols).join(",");

  let js = `(function(globals, imports) {
  const {${used_symbols}} = globals;
  const el = React.createElement;
  const Fragment = React.Fragment;
  const r = String.raw;
  const bt = "\`";
  return ${doc};
})`;

  return { js, imports: global.imports };
};

let translate_toplevel = (node: SyntaxNode) => {
  let tokens = node.getChildren(terms.TextToken);

  interface Section {
    title: SyntaxNode;
    props: {[key: string]: string},
    children: (SyntaxNode | Section)[];
  }

  function is_section(obj: SyntaxNode | Section): obj is Section {
    return "title" in obj;
  }

  let commands: string[] = [];
  let processed_sections: Section[] = [];
  let section_stack: Section[] = [];
  let body: SyntaxNode[] = [];
  tokens.forEach(token => {
    let node = token.firstChild!;

    if (matches(node, terms.Command)) {
      let ident = text(node.getChild(terms.Ident)!).toLowerCase();
      if (ident.endsWith("section")) {
        let depth = Array.from(ident.matchAll(/sub/g)).length;

        let popped = section_stack.splice(depth);
        if (section_stack.length == 0 && popped.length > 0) {
          processed_sections.push(popped[0]);
        }

        let section: Section = {
          title: node.getChild(terms.CommandAnonArg)!.firstChild!,
          props: translate_named_args(node.getChildren(terms.CommandNamedArg)),
          children: [],
        };

        if (section_stack.length > 0) {
          _.last(section_stack)!.children.push(section);
        }

        section_stack.push(section);
        return;
      }

      let sigil = text(node.getChild(terms.CommandSigil)!).toLowerCase();
      if (sigil == "%") {
        let command;
        if (ident == "import") {
          let args = node.getChildren(terms.CommandAnonArg).map(child => child.firstChild!);
          if (args.length != 2) {
            throw `Incorrect number of arguments to %import`;
          }

          let [name, path] = args;
          global.imports.add(text(path));
          command = `const ${text(name)} = imports[${string_literal(text(path))}]`;
        } else {
          throw `Unknown percent-command ${ident}`;
        }

        commands.push(command);
        return;
      }
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
    let children = [to_react(symbol("SectionTitle"), {}, [translate_textbody(section.title)])];
    let paragraph: string[] = [];
    let contains_command = false;
    let add_para = () => {
      if (paragraph.length > 0) {
        if (paragraph.length == 1 && contains_command) {
          children.push(paragraph[0]);
        } else {
          children.push(to_react(symbol("Paragraph"), {}, _.clone(paragraph)));
        }
        paragraph = [];
        contains_command = false;
      }
    };

    for (let i = 0; i < section.children.length; ++i) {
      let child = section.children[i];
      if (is_section(child)) {
        add_para();
        children.push(translate_section(child));
      } else {
        let node = child.firstChild!;
        if (matches(node, terms.Newline) && i < section.children.length - 1) {
          let next = section.children[i + 1];
          if (!is_section(next) && matches(next.firstChild!, terms.Newline)) {
            i += 1;
            add_para();
            continue;
          }
        }

        if (matches(node, terms.Command)) {
          contains_command = true;
        }
        paragraph.push(translate_token(child));
      }
    }

    add_para();

    return to_react(symbol("Section"), section.props, children);
  };

  let new_body = body.map(translate_token).concat(processed_sections.map(translate_section));

  let new_body_el = to_react("Fragment", {}, new_body);
  if (commands.length > 0) {
    return `(function(){${commands.join(";\n")};\nreturn ${new_body_el};})()`;
  } else {
    return new_body_el;
  }
};

let to_react = (name: string, props: { [key: string]: string }, children: string[]): string => {
  let prop_str = Object.keys(props).map(k => `${k}: ${props[k]}`).join(", ");
  return `el(${name}, {${prop_str}}, ${children.join(", ")})`;
};

let text = (cursor: SyntaxNode): string => global.input.slice(cursor.from, cursor.to);

let translate_token = (node: SyntaxNode): string => {
  let child = node.firstChild!;
  if (matches(child, terms.Command)) {
    return translate_command(child);
  } else if (matches(child, terms.Text)) {
    return string_literal(text(child));
  } else if (matches(child, terms.Newline)) {
    return string_literal("\n");
  } else {
    throw `Unhandled child type ${child.name}`;
  }
};

let translate_textbody = (node: SyntaxNode): string => {
  assert(node.type.id == terms.TextBody);

  let tokens = node.getChildren(terms.TextToken);

  // Strip staring / ending newlines
  tokens = tokens.filter((token, i) => {
    let node = token.firstChild!;
    if (matches(node, terms.Newline)) {
      if (i == 0 || i == tokens.length - 1) {
        return false;
      }
    }
    return true;
  });

  // Remove leading whitespace
  let line_starts = tokens
    .map((_t, i) => i)
    .filter(i => {
      let line_start = i == 0 || matches(tokens[i - 1].firstChild!, terms.Newline);
      return line_start && matches(tokens[i].firstChild!, terms.Text);
    });

  let min_leading_whitespace =
    line_starts.length > 0
      ? line_starts
          .map(i => {
            let s = text(tokens[i]);
            return s.match(/^( )*/)![0].length;
          })
          .reduce((a, b) => Math.min(a, b))
      : 0;

  let children = tokens.map((token, i) => {
    if (line_starts.includes(i)) {
      return string_literal(text(token).slice(min_leading_whitespace));
    } else {
      return translate_token(token);
    }
  });

  return to_react("Fragment", {}, children);
};

let translate_named_args = (args: SyntaxNode[]): {[key: string]: string} => 
  _.fromPairs(args.map(node => {
    let key = text(node.getChild(terms.Ident)!);
    let value = node.getChild(terms.TextBody);
    if (value) {
      return [key, translate_textbody(value)];
    } else {
      return [key, true];
    }
  }));

let translate_command = (node: SyntaxNode): string => {
  let sigil = text(node.getChild(terms.CommandSigil)!);
  let ident = text(node.getChild(terms.Ident)!);
  let named_args = node.getChildren(terms.CommandNamedArg);

  let anon_args = node.getChildren(terms.CommandAnonArg).map(node => {
    let child = node.firstChild!;
    if (child.type.id == terms.TextBody) {
      return translate_textbody(node.firstChild!);
    } else if (child.type.id == terms.VerbatimText) {
      return string_literal(text(child));
    } else {
      throw `Unknown CommandAnonArg ${child.name}`;
    }
  });

  if (sigil == "@") {
    let name = INTRINSIC_ELEMENTS.has(ident) ? string_literal(ident) : symbol(ident);
    let props = translate_named_args(named_args);
    return to_react(name, props, anon_args);
  } else if (sigil == "#") {
    return ident;
  } else {
    throw `Unhandled sigil ${sigil}`;
  }
};

const INTRINSIC_ELEMENTS: Set<string> = new Set([
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "big",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "menu",
  "menuitem",
  "meta",
  "meter",
  "nav",
  "noindex",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "slot",
  "script",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "template",
  "tbody",
  "td",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "",
  "video",
  "wbr",
  "webview",
  "svg",
  "animate",
  "TODO",
  "animateMotion",
  "animateTransform",
  "TODO",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "foreignObject",
  "g",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "switch",
  "symbol",
  "text",
  "textPath",
  "tspan",
  "use",
  "view",
]);
