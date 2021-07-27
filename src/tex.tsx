import React, { useContext } from "react";
import katex from "katex";
import H2R from "html-to-react";
import Tooltip from "rc-tooltip";
import ReactDOM from "react-dom";
import _ from "lodash";

import { Ref, Definition } from "./definitions";
import { AdaptiveDisplay, HTMLAttributes } from "./utils";

const r = String.raw;

export let newcommand = (cmd: string, nargs: number, body: string): string =>
  r`\newcommand{${"\\" + cmd}}[${nargs}]{\htmlData{cmd=${cmd}}{${body}}}`;

export interface Dimensions {
  width: number;
  height: number;
}

export class TexContext {
  macros: any;

  constructor() {
    this.macros = {};
  }

  async dimensions(
    contents: string,
    block: boolean,
    container: HTMLElement
  ): Promise<Dimensions> {
    let node = this.render(contents, block, true);
    let el = document.createElement("div");
    el.style.display = "inline-block";
    el.style.position = "absolute";
    el.style.left = "-99999px";
    ReactDOM.render(node, el);

    let promise = new Promise((resolve, _) => {
      let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          Array.from(mutation.addedNodes).forEach((added_node) => {
            if (added_node == el) {
              observer.disconnect();
              resolve(undefined);
            }
          });
        });
      });
      observer.observe(container, { childList: true, subtree: false });
    });

    container.appendChild(el);

    await promise;

    let rect = el.getBoundingClientRect();
    container.removeChild(el);

    return rect;
  }

  render(contents: string, block: boolean = false, raw: boolean = false, props: any = {}) {
    let html = katex.renderToString(contents, {
      // these two options ensure macros persist across invocations
      macros: this.macros,
      globalGroup: true,

      trust: true,
      strict: false,
      output: "html",

      displayMode: block,
    });

    if (raw) {
      return (
        <AdaptiveDisplay
          block={block}
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
      );
    }

    let defns = new H2R.ProcessNodeDefinitions(React);
    let instrs = [
      {
        replaceChildren: true,
        shouldProcessNode: (node: any) =>
          node.attribs && "data-cmd" in node.attribs,
        processNode: (node: any, children: any, index: any) => {
          let def = node.attribs["data-cmd"];
          let inner = defns.processDefaultNode(node, children, index);
          return (
            <Ref name={`tex:${def}`} nolink>
              {inner}
            </Ref>
          );
        },
      },
      {
        replaceChildren: true,
        shouldProcessNode: (node: any) =>
          node.attribs && "data-def" in node.attribs,
        processNode: (node: any, children: any, index: any) => {
          let def = node.attribs["data-def"];
          let inner = defns.processDefaultNode(node, children, index);
          return (
            <Definition name={`tex:${def}`} Tooltip={null}>
              {inner}
            </Definition>
          );
        },
      },
      {
        shouldProcessNode: (_: any) => true,
        processNode: defns.processDefaultNode,
      },
    ];
    let parser = new H2R.Parser();
    let node = parser.parseWithInstructions(html, (_: any) => true, instrs);

    return <AdaptiveDisplay block={block} {...props}>{node}</AdaptiveDisplay>;
  }
}

export let ReactTexContext = React.createContext<TexContext>(new TexContext());

export interface TexProps {
  raw?: boolean;
};

export let Tex: React.FC<TexProps & HTMLAttributes> = ({ children, raw, ...props }) => {
  let ctx = useContext(ReactTexContext);
  return ctx.render(children as string, false, raw, props);
};

export let TexBlock: React.FC<TexProps & HTMLAttributes> = ({ children, raw, ...props }) => {
  let ctx = useContext(ReactTexContext);
  return ctx.render(children as string, true, raw, props);
};

export let $ = Tex;
export let $$ = TexBlock;
