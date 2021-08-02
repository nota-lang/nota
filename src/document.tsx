import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import CSS from "csstype";
import classNames from "classnames";
import { observer } from "mobx-react";

import { ReactTexContext, TexContext } from "./tex";
import { ReactBibliographyContext, ReferencesSection, BibliographyContext } from "./bibliography";
import { DefinitionContext, AllDefinitionData, Definition, Ref } from "./definitions";
import { ListingContext, ListingData } from "./code";
import { register_scroll_hook } from "./scroll";
import { HTMLAttributes } from "./utils";

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
      style={{ width: window.innerWidth, left, ...style }}
      {...props}
    />
  );
};

export let Row: React.FC<HTMLAttributes> = ({ children, className, ...props }) => {
  return (
    <div {...props} className={`row ${className}`}>
      {children}
    </div>
  );
};

export let ToplevelElem: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  return ReactDOM.createPortal(children, ctx.toplevel_portal!);
};

export let Expandable: React.FC<{ prompt: JSX.Element }> = ({ children, prompt }) => {
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

    register_scroll_hook(id, () => {
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

interface DocumentProps {
  bibtex?: string;
  anonymous?: boolean;
  onLoad?: () => void;
}

export let DocumentInner: React.FC = observer(({ children }) => {
  let def_ctx = useContext(DefinitionContext);
  let [show, set_show] = useState(false);

  return (
    <div
      className={classNames("document-wrapper", {
        "def-mode": def_ctx.def_mode,
      })}
    >
      <div className="document">{children}</div>
      <ReferencesSection />
      <Footnotes />
    </div>
  );
});

let wait_for_ready = (): Promise<any> => {
  let wait_doc;
  if (document.readyState !== "complete") {
    wait_doc = new Promise((resolve, _) => window.addEventListener("load", resolve));
  } else {
    wait_doc = Promise.resolve(true);
  }

  let fonts = ["Linux Libertine O", "Linux Biolinum O"];
  let wait_font = document.fonts.load("12px " + fonts.join(", "));

  return Promise.all([wait_font, wait_doc]);
};

export let Document: React.FC<DocumentProps> = ({ children, bibtex, anonymous, onLoad }) => {
  let [loaded, set_loaded] = useState(false);
  let is_ready = wait_for_ready();

  useEffect(() => {
    is_ready.then(() => {
      set_loaded(true);
      if (onLoad) {
        onLoad();
      }
    });
  }, []);

  let [def_ctx] = useState(new AllDefinitionData());
  def_ctx.add_mode_listeners();

  let [toplevel_portal, set_toplevel_portal] = useState(null);
  let on_portal_mount = useCallback(node => {
    set_toplevel_portal(node);
  }, []);

  return !loaded ? null : (
    <DefinitionContext.Provider value={def_ctx}>
      <DocumentContext.Provider value={new DocumentData(anonymous || false, toplevel_portal)}>
        <ReactTexContext.Provider value={new TexContext()}>
          <ReactBibliographyContext.Provider value={new BibliographyContext(bibtex || "")}>
            <ListingContext.Provider value={new ListingData()}>
              {toplevel_portal != null ? <DocumentInner>{children}</DocumentInner> : null}
              <div ref={on_portal_mount} />
            </ListingContext.Provider>
          </ReactBibliographyContext.Provider>
        </ReactTexContext.Provider>
      </DocumentContext.Provider>
    </DefinitionContext.Provider>
  );
};
