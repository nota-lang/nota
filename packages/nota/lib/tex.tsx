import React from "react";
import katex from "katex";
import H2R from "html-to-react";
import ReactDOM from "react-dom";
import Children from "react-children-utilities";

import { Ref, DefinitionAnchor } from "./definitions";
import { Container, HTMLAttributes } from "./utils";
import {Plugin, Pluggable, usePlugin} from "./plugin";

const r = String.raw;

export let newcommand = (
  cmd: string,
  nargs: number,
  body: string,
  defaults: string[] = []
): string => {
  if (defaults.length > 0) {
    throw `KaTeX currently doesn't support default arguments to newcommand. Check on this issue: https://github.com/KaTeX/KaTeX/issues/2228`;
  }
  let ds = defaults.map(s => `[${s}]`).join("");
  return r`\newcommand{${"\\" + cmd}}[${nargs}]${ds}{\htmlData{cmd=${cmd}}{${body}}}`;
};

export interface Dimensions {
  width: number;
  height: number;
}

export let TexPlugin = new Plugin(class extends Pluggable {
  macros: any;

  constructor() {
    super();
    this.macros = {};
  }

  async dimensions(contents: string, block: boolean, container: HTMLElement): Promise<Dimensions> {
    let node = this.render(contents, block, true);
    let el = document.createElement("div");
    el.style.display = "inline-block";
    el.style.position = "absolute";
    el.style.left = "-99999px";
    ReactDOM.render(node, el);

    let promise = new Promise((resolve, _) => {
      let observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          Array.from(mutation.addedNodes).forEach(added_node => {
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

  render(
    contents: string,
    block: boolean = false,
    raw: boolean = false,
    props: any = {},
    ref?: React.RefObject<HTMLDivElement>
  ) {
    let html;
    try {
      html = katex.renderToString(contents, {
        // these two options ensure macros persist across invocations
        macros: this.macros,
        globalGroup: true,

        trust: true,
        strict: false,
        output: "html",

        displayMode: block,
      });
    } catch (e) {
      if (e instanceof katex.ParseError) {
        console.error(e);
        return (
          <Container ref={ref} className="error" block={block} {...props}>
            <Container block={block}>{e.message}</Container>
            {block ? <pre>{contents}</pre> : null}
          </Container>
        );
      } else {
        throw e;
      }
    }

    if (raw) {
      return (
        <Container ref={ref} block={block} dangerouslySetInnerHTML={{ __html: html }} {...props} />
      );
    }

    let defns = new H2R.ProcessNodeDefinitions(React);
    let instrs = [
      {
        shouldProcessNode: (node: any) => node.attribs && "data-cmd" in node.attribs,
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
        shouldProcessNode: (node: any) => node.attribs && "data-def" in node.attribs,
        processNode: (node: any, children: any, index: any) => {
          let def = node.attribs["data-def"];
          let inner = defns.processDefaultNode(node, children, index);
          return <DefinitionAnchor name={`tex:${def}`}>{inner}</DefinitionAnchor>;
        },
      },
      {
        shouldProcessNode: (_: any) => true,
        processNode: defns.processDefaultNode,
      },
    ];
    let parser = new H2R.Parser();
    let node = parser.parseWithInstructions(html, (_: any) => true, instrs);

    return (
      <Container ref={ref} block={block} {...props}>
        {node}
      </Container>
    );
  }
});

export interface TexProps {
  raw?: boolean;
  block?: boolean;
}

// memo is important to avoid re-renders that include macro definitions
export let Tex: React.FC<TexProps & HTMLAttributes> = React.memo(
  function Tex({ children, raw, block, ...props }) {
    let ctx = usePlugin(TexPlugin);
    return ctx.render(Children.onlyText(children), block, raw, props);
  },
  (prev, next) => prev.children == next.children
);

export let $: typeof Tex = props => <Tex block={false} {...props} />;
export let $$: typeof Tex = props => <Tex block={true} {...props} />;
