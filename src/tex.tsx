import React, { useContext, useEffect, useRef } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

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

      displayMode: block,
    });
    if (block) {
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    } else {
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    }
  }
}

export let ReactTexContext = React.createContext<TexContext | null>(null);

export let Tex: React.FC = ({ children }) => {
  let ctx = useContext(ReactTexContext)!;
  let ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let container = ref.current!;
    let elems = container.querySelectorAll("[data-def]");
    let cbs = Array.from(elems).map((elem) => {
      if (!(elem instanceof HTMLElement)) {
        throw `Elem with [data-def] not HTMLElement`;
      }

      let on_click = () => {
        let anchor_id = `def-${elem.dataset.def}`;
        let anchor_elem = document.getElementById(anchor_id);
        if (!anchor_elem) {
          throw `Missing anchor with id ${anchor_id}`;
        }

        window.history.pushState(null, "", "#" + anchor_id);

        // Hack to trigger :target
        // See: https://github.com/whatwg/html/issues/639
        window.history.pushState(null, "", "#" + anchor_id);
        window.history.back();

        // Effect doesn't seem to trigger immediately after history.back()?
        // TODO: bad workaround
        setTimeout(
          () =>
            anchor_elem!.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "center",
            }),
          100
        );
      };
      elem.addEventListener("click", on_click);
      return () => elem.removeEventListener("click", on_click);
    });
    return () => {
      cbs.forEach((cb) => cb());
    };
  }, [children]);

  return <span ref={ref}>{ctx.render(children as string, false)}</span>;
};

export let TexBlock: React.FC = ({ children }) => {
  let ctx = useContext(ReactTexContext)!;
  return ctx.render(children as string, true);
};

export let $ = Tex;
export let $$ = TexBlock;
