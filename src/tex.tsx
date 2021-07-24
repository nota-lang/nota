import React, { useContext } from "react";
import katex from "katex";
import H2R from "html-to-react";
import Tooltip from "rc-tooltip";
import { Ref, Definition } from "./definitions";

const r = String.raw;

export let newcommand = (cmd: string, nargs: number, body: string): string =>
  r`\newcommand{${"\\" + cmd}}[${nargs}]{\htmlData{cmd=${cmd}}{${body}}}`;

export class TexContext {
  macros: any;

  constructor() {
    this.macros = {};
  }

  render(contents: string, block: boolean) {
    let html = katex.renderToString(contents, {
      // these two options ensure macros persist across invocations
      macros: this.macros,
      globalGroup: true,

      trust: true,
      strict: false,
      output: "html",

      displayMode: block,
    });

    let defns = new H2R.ProcessNodeDefinitions(React);
    let instrs = [
      {
        replaceChildren: true,
        shouldProcessNode: (node: any) => node.attribs && "data-cmd" in node.attribs,
        processNode: (node: any, children: any, index: any) => {
          let def = node.attribs["data-cmd"];
          let inner = defns.processDefaultNode(node, children, index);
          return <Ref name={`tex:${def}`} nolink>{inner}</Ref>;
        },
      },
      {
        replaceChildren: true,
        shouldProcessNode: (node: any) => node.attribs && "data-def" in node.attribs,
        processNode: (node: any, children: any, index: any) => {
          let def = node.attribs["data-def"];
          let inner = defns.processDefaultNode(node, children, index);
          return <Definition name={`tex:${def}`} tooltip={null}>{inner}</Definition>;
        },
      },
      {
        shouldProcessNode: (_: any) => true,
        processNode: defns.processDefaultNode,
      },
    ];
    let parser = new H2R.Parser();
    let node = parser.parseWithInstructions(html, (_: any) => true, instrs);

    if (block) {
      return <div>{node}</div>;
    } else {
      return <span>{node}</span>;
    }
  }
}

export let ReactTexContext = React.createContext<TexContext | null>(null);

export let Tex: React.FC = ({ children }) => {
  let ctx = useContext(ReactTexContext)!;
  return ctx.render(children as string, false);
};

export let TexBlock: React.FC = ({ children }) => {
  let ctx = useContext(ReactTexContext)!;
  return ctx.render(children as string, true);
};

export let $ = Tex;
export let $$ = TexBlock;
