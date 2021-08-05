import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import CSS from "csstype";
import classNames from "classnames";
import { observer } from "mobx-react";

import { TexPlugin } from "./tex";
import { BibliographyPlugin } from "./bibliography";
import { DefinitionsPlugin, Definition, Ref } from "./definitions";
import { TooltipPlugin } from "./tooltip";
import { ListingPlugin } from "./code";
import { ScrollPlugin } from "./scroll";
import { HTMLAttributes } from "./utils";
import { Plugin, usePlugin } from "./plugin";

export type NumberStyle = "1" | "a";

export class NestedCounter {
  stack: number[];
  styles: NumberStyle[];

  constructor(styles: NumberStyle[] = ["1"]) {
    this.stack = [0];
    this.styles = styles;
  }

  stylize = (n: number, style: NumberStyle): string => {
    if (style == "1") {
      return n.toString();
    } else if (style == "a") {
      let char_code = "a".charCodeAt(0) + n - 1;
      return String.fromCharCode(char_code);
    } else {
      throw `Bad style ${style}`;
    }
  };

  push = (): string[] => {
    this.stack[this.stack.length - 1] += 1;
    this.stack.push(0);
    return this.stack
      .slice(0, -1)
      .map((n, i) => this.stylize(n, this.styles[i % this.styles.length]));
  };

  Pop: React.FC = () => {
    this.stack.pop();
    return null;
  };
}

class DocumentData {
  sections: NestedCounter = new NestedCounter();
  figures: NestedCounter = new NestedCounter(["1", "a"]);
  theorems: NestedCounter = new NestedCounter();

  footnotes: React.ReactNode[] = [];
  toplevel_portal: Element | null;
  anonymous: boolean;

  constructor(anonymous: boolean, toplevel_portal: Element | null) {
    this.toplevel_portal = toplevel_portal;
    this.anonymous = anonymous;
  }
}

export let DocumentContext = React.createContext<DocumentData>(new DocumentData(false, null));

export let SectionTitle: React.FC<{ level?: number }> = ({ level, children }) => {
  let Header: React.FC<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  >;
  if (!level || level == 1) {
    Header = props => <h2 {...props} />;
  } else if (level == 2) {
    Header = props => <h3 {...props} />;
  } else {
    Header = props => <h4 {...props} />;
  }
  return <Header className="section-title">{children}</Header>;
};

export let Section: React.FC<{ title: string; name?: string }> = ({ name, title, children }) => {
  let doc_ctx = useContext(DocumentContext);
  let incr_thm = doc_ctx.sections.stack.length == 1;
  if (incr_thm) {
    doc_ctx.theorems.push();
  }
  let sec_stack = doc_ctx.sections.push();
  let level = sec_stack.length;
  let sec_num = sec_stack.join(".");

  // TODO: section level-specific styles!

  return (
    <Definition name={name} Label={() => <>Section {sec_num}</>} Tooltip={null} block>
      <section>
        <SectionTitle level={level}>
          <span className="section-number">{sec_num}</span> {title}
        </SectionTitle>
        {children}
        <doc_ctx.sections.Pop />
        {incr_thm ? <doc_ctx.theorems.Pop /> : null}
      </section>
    </Definition>
  );
};

export let SubSection: typeof Section = Section;
export let SubSubSection: typeof Section = Section;

class FigureData {
  caption?: JSX.Element;
}

let FigureContext = React.createContext<FigureData>(new FigureData());

export let Figure: React.FC<{ name?: string }> = props => {
  let doc_ctx = useContext(DocumentContext);
  let fig_stack = doc_ctx.figures.push();
  let level = fig_stack.length;
  let fig_num = fig_stack.join("-");

  let fig_ctx = new FigureData();

  let Caption = () => (
    <Definition name={props.name} Label={() => <>{`Figure ${fig_num}`}</>} Tooltip={null} block>
      <div className="caption">
        {level > 1 ? `(${fig_stack[fig_stack.length - 1]})` : `Figure ${fig_num}:`}{" "}
        {fig_ctx.caption}
      </div>
    </Definition>
  );

  return (
    <FigureContext.Provider value={fig_ctx}>
      <div className={`figure level-${level}`}>
        {props.children}
        <Caption />
      </div>
      <doc_ctx.figures.Pop />
    </FigureContext.Provider>
  );
};

export let Subfigure: typeof Figure = Figure;

export let Caption: React.FC = props => {
  let ctx = useContext(FigureContext);
  ctx.caption = <>{props.children}</>;
  return null;
};

export let Wrap: React.FC<{ align: CSS.Property.Float }> = ({ align, children }) => {
  let margin = "1rem";
  let style;
  if (align == "left") {
    style = { marginRight: margin };
  } else if (align == "right") {
    style = { marginLeft: margin };
  } else {
    style = {};
  }

  return <div style={{ float: align, ...style }}>{children}</div>;
};

export let Smallcaps: React.FC = ({ children }) => <span className="smallcaps">{children}</span>;

export let FullWidthContainer: React.FC<{ inner_width: number } & HTMLAttributes> = ({
  inner_width,
  style,
  className,
  ...props
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let [left, set_left] = useState(0);

  useEffect(() => {
    let { left } = ref.current!.getBoundingClientRect();
    set_left(-left);
  }, []);

  return (
    <div
      ref={ref}
      className={`full-width-container ${className}`}
      style={{ width: document.documentElement.clientWidth, left, ...style }}
      {...props}
    />
  );
};

export let Row: React.FC<HTMLAttributes> = ({ children, className, ...props }) => {
  return (
    <div {...props} className={classNames("row", className)}>
      {children}
    </div>
  );
};

export let ToplevelElem: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  return ReactDOM.createPortal(children, ctx.toplevel_portal!);
};

export let Center: React.FC = ({ children }) => {
  return <div style={{ margin: "0 auto", width: "max-content" }}>{children}</div>;
};

export let Expandable: React.FC<{ prompt: JSX.Element }> = ({ children, prompt }) => {
  let scroll_plugin = usePlugin(ScrollPlugin);
  let ref = useRef(null);
  let [show, set_show] = useState(false);
  let [height, set_height] = useState(0);
  let [id] = useState(() => _.uniqueId());

  useEffect(() => {
    let observer = new ResizeObserver(entries => {
      let height = entries[0].borderBoxSize[0].blockSize;
      set_height(height);
    });
    observer.observe(ref.current!);

    scroll_plugin.register_scroll_hook(id, () => {
      set_show(true);
    });
  }, []);

  return (
    <div className={classNames("expandable", { expanded: show })}>
      <div style={{ textAlign: "center" }}>
        <span className="expand" onClick={() => set_show(!show)}>
          {show ? "Hide..." : prompt}
          <span style={{ fontSize: "0.7em" }}>&nbsp; {show ? "⬆" : "⬇"}</span>
        </span>
      </div>
      <div className="inner nomargin" style={{ height: show ? height : 0 }}>
        <div id={id} ref={ref}>
          {children}
        </div>
      </div>
    </div>
  );
};

export let Footnote: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  ctx.footnotes.push(children);
  let i = ctx.footnotes.length;
  return <Ref name={`footnote:${i}`} />;
};

let Footnotes: React.FC = _ => {
  let ctx = useContext(DocumentContext);
  return ctx.footnotes.length == 0 ? null : (
    <div className="footnotes">
      {ctx.footnotes.map((footnote, i) => {
        let top = {};
        i += 1;
        return (
          <div className="footnote" id={`footnote-${i}`} key={i}>
            <span className="footnote-number">{i}</span>
            <Definition name={`footnote:${i}`} Label={() => <sup className="footnote">{i}</sup>}>
              {footnote}
            </Definition>
          </div>
        );
      })}
    </div>
  );
};

export let DocumentInner: React.FC = observer(({ children }) => {
  let def_ctx = usePlugin(DefinitionsPlugin);
  let [show, set_show] = useState(false);

  return (
    <div
      className={classNames("document-wrapper", {
        "def-mode": def_ctx.def_mode,
      })}
    >
      <div className="document">{children}</div>
      <Footnotes />
    </div>
  );
});

let wait_for_fonts = (): Promise<any> | null => {
  let fonts = [
    ["Inconsolata", ["normal"]],
    ["Linux Libertine O", ["normal", "italic", "bold", "italic bold"]],
    ["Linux Biolinum O", ["normal", "italic", "bold", "italic bold"]],
    ["KaTeX_AMS", ["normal"]],
    ["KaTeX_Caligraphic", ["normal", "bold"]],
    ["KaTeX_Fraktur", ["normal", "bold"]],
    ["KaTeX_Main", ["normal", "italic", "bold", "italic bold"]],
    ["KaTeX_Math", ["normal", "italic", "italic bold"]],
    ["KaTeX_SansSerif", ["normal", "italic", "bold"]],
    ["KaTeX_Script", ["normal"]],
    ["KaTeX_Size1", ["normal"]],
    ["KaTeX_Size2", ["normal"]],
    ["KaTeX_Size3", ["normal"]],
    ["KaTeX_Size4", ["normal"]],
    ["KaTeX_Typewriter", ["normal"]],
  ];

  let font_strs = ["normal", "italic", "bold", "italic bold"].map(
    variant =>
      `${variant} 12px ` +
      fonts
        .filter(([_1, variants]) => _.some(variants, v => v == variant))
        .map(([face, _]) => face)
        .join(", ")
  );

  if (_.every(font_strs, s => document.fonts.check(s))) {
    return null;
  } else {
    return Promise.all([font_strs.map(s => document.fonts.load(s))]);
  }
};

interface DocumentProps {
  anonymous?: boolean;
  onLoad?: () => void;
}

const PLUGINS = (): Plugin<any>[] => [
  DefinitionsPlugin,
  TexPlugin,
  BibliographyPlugin,
  TooltipPlugin,
  ListingPlugin,
  ScrollPlugin,
];

export let Document: React.FC<DocumentProps> = ({ children, anonymous, onLoad }) => {
  let [fonts_promise] = useState(wait_for_fonts());
  let [loaded, set_loaded] = useState(fonts_promise === null);

  useEffect(() => {
    if (fonts_promise !== null) {
      fonts_promise.then(() => {
        set_loaded(true);
      });
    }
  }, []);

  let [toplevel_portal, set_toplevel_portal] = useState(null);
  let on_portal_mount = useCallback(node => {
    set_toplevel_portal(node);
  }, []);

  useEffect(() => {
    if (loaded && toplevel_portal && onLoad) {
      onLoad();
    }
  }, [loaded, toplevel_portal]);

  let inner = null;
  if (toplevel_portal && loaded) {
    inner = PLUGINS().reduce(
      (el, plugin) => <plugin.Provide>{el}</plugin.Provide>,
      <DocumentInner>{children}</DocumentInner>
    );
    inner = (
      <DocumentContext.Provider value={new DocumentData(anonymous || false, toplevel_portal)}>
        {inner}
      </DocumentContext.Provider>
    );
  }

  return (
    <>
      {inner}
      <div className="portal" ref={on_portal_mount} />
    </>
  );
};
