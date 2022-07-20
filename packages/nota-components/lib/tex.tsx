import { NotaText, joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import katex from "katex";
import _ from "lodash";
import React from "react";
import ReactDOM from "react-dom";

import { Definition, DefinitionAnchor, Ref } from "./definitions.js";
import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { Container, FCC, HTMLAttributes } from "./utils.js";

const r = String.raw;

export let texDefAnchor = (label: NotaText, contents: NotaText): NotaText => [
  r`\htmlData{defanchor=`,
  label,
  `}{`,
  contents,
  `}`,
];

export let texDef = (label: NotaText, contents: NotaText): NotaText => [
  r`\htmlData{def=`,
  label,
  `}{`,
  contents,
  `}`,
];

export let texRef = (label: NotaText, contents: NotaText): NotaText => [
  r`\htmlData{ref=`,
  label,
  `}{`,
  contents,
  `}`,
];

export interface Dimensions {
  width: number;
  height: number;
}

export let TexPlugin = new Plugin(
  class extends Pluggable {
    macros: any;

    constructor() {
      super();
      this.macros = {};
    }

    // TODO: this should be a generic utility, not just for tex
    async dimensions(
      contents: NotaText,
      block: boolean,
      container: HTMLElement
    ): Promise<Dimensions> {
      let node = this.render(joinRecursive(contents), block, true);
      let el = document.createElement("div");
      el.style.display = "inline-block";
      el.style.position = "absolute";
      el.style.left = "-99999px";
      ReactDOM.render(node, el);

      let promise = new Promise((resolve, _) => {
        let observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            Array.from(mutation.addedNodes).forEach(addedNode => {
              if (addedNode == el) {
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
      let rawHtml;
      try {
        rawHtml = katex.renderToString(contents, {
          // these two options ensure macros persist across invocations
          macros: this.macros,
          globalGroup: true,

          trust: true,
          strict: false,
          output: "html",

          displayMode: block,
        });
      } catch (e: any) {
        if (e instanceof (katex as any).ParseError) {
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
          <Container
            ref={ref}
            block={block}
            dangerouslySetInnerHTML={{ __html: rawHtml }}
            {...props}
          />
        );
      }

      let parser = new DOMParser();
      let html = parser.parseFromString(rawHtml, "text/html");
      let node = html.body.firstChild! as HTMLElement;

      let el = React.createElement;
      let propAliases: { [_name: string]: string } = {
        class: "className",
      };
      let capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      let translate = (node: HTMLElement | Text, key?: number): JSX.Element | string => {
        if (node instanceof Text) {
          return node.textContent!;
        }

        let children = Array.from(node.childNodes).map((node: any, i) => translate(node, i));

        let props = _.fromPairs(
          Array.from(node.attributes).map(attr => {
            if (attr.name == "style") {
              let style = _.fromPairs(
                attr.value.split(";").map(prop => {
                  let [name, value] = prop.split(":");
                  name = name
                    .split("-")
                    .map((s, i) => (i > 0 ? capitalize(s) : s))
                    .join("");
                  return [name, value];
                })
              );
              return [attr.name, style];
            } else {
              let name = attr.name in propAliases ? propAliases[attr.name] : attr.name;
              return [name, attr.value];
            }
          })
        );
        props.key = key;

        let reactNode = el(node.tagName.toLowerCase(), props, children);

        if (node.dataset.ref) {
          return (
            <Ref label={reactNode} nolink key={key}>
              {node.dataset.ref}
            </Ref>
          );
        } else if (node.dataset.defanchor) {
          return (
            <DefinitionAnchor name={node.dataset.defanchor} key={key}>
              {reactNode}
            </DefinitionAnchor>
          );
        } else if (node.dataset.def) {
          return (
            <Definition name={node.dataset.def} key={key}>
              {reactNode}
            </Definition>
          );
        } else {
          return reactNode;
        }
      };

      return (
        <Container ref={ref} block={block} {...props}>
          {translate(node)}
        </Container>
      );
    }
  }
);

export interface TexProps {
  raw?: boolean;
  block?: boolean;
}

// memo is important to avoid re-renders that include macro definitions
export let Tex: FCC<TexProps & HTMLAttributes> = ({ children, raw, block, ...props }) => {
  let ctx = usePlugin(TexPlugin);
  return ctx.render(joinRecursive(children as any), block, raw, props);
};

export let $: typeof Tex = props => <Tex block={false} {...props} />;
export let $$: typeof Tex = props => <Tex block={true} {...props} />;
