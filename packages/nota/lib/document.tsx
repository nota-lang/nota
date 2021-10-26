import React, { useState, useContext, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import CSS from "csstype";
import classNames from "classnames";
import { observer } from "mobx-react";
import { observable } from "mobx";

import { TexPlugin } from "./tex";
import { BibliographyPlugin } from "./bibliography";
import { DefinitionsPlugin, Definition, Ref } from "./definitions";
import { TooltipPlugin } from "./tooltip";
import { ListingPlugin } from "./code";
import { ScrollPlugin } from "./scroll";
import { HTMLAttributes } from "./utils";
import { Logger, LoggerPlugin } from "./logger";
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

  top = (): string[] => {
    return this.stack
      .slice(0, -1)
      .map((n, i) => this.stylize(n, this.styles[i % this.styles.length]));
  };

  push = (): string[] => {
    this.stack[this.stack.length - 1] += 1;
    this.stack.push(0);
    return this.top();
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
  anonymous: boolean = false;
}

export let DocumentContext = React.createContext<DocumentData>(new DocumentData());

export let SectionTitle: React.FC<{plain?: boolean}> = ({ children, plain }) => {
  let doc_ctx = useContext(DocumentContext);
  let sec_stack = doc_ctx.sections.top();
  let level = sec_stack.length;
  let sec_num = sec_stack.join(".");

  let Header: React.FC<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  >;
  /* eslint react/display-name: off */
  if (!level || level == 1) {
    Header = props => <h2 {...props} />;
  } else if (level == 2) {
    Header = props => <h3 {...props} />;
  } else {
    Header = props => <h4 {...props} />;
  }
  Header.displayName = 'Header';

  return <Header className="section-title">
    {!plain ? <span className="section-number">{sec_num}</span> : null} {children}
  </Header>;
};

export let Section: React.FC<{ name?: string }> = ({ name, children }) => {
  let doc_ctx = useContext(DocumentContext);
  let incr_thm = doc_ctx.sections.stack.length == 1;
  if (incr_thm) {
    doc_ctx.theorems.push();
  }
  let sec_stack = doc_ctx.sections.push();
  let sec_num = sec_stack.join(".");

  // TODO: section level-specific styles!
  return (
    <Definition name={name} Label={() => <>Section {sec_num}</>} Tooltip={null} block>
      <section>
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

export let FullWidthContainer: React.FC<HTMLAttributes> = ({
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

class PortalData {
  @observable portal: HTMLDivElement | null = null;
}
let PortalContext = React.createContext<PortalData>(new PortalData());

export let ToplevelElem: React.FC = observer(({ children }) => {
  let portal = useContext(PortalContext);
  return portal.portal !== null ? ReactDOM.createPortal(children, portal.portal) : null;
});

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

    console.log("registering", id, "to", scroll_plugin);
    scroll_plugin.register_scroll_hook(id, () => {
      set_show(true);
    });

    return () => {
      observer.disconnect();
    };
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

export let FootnoteDef: React.FC<{ name?: string }> = ({ children }) => {
  let ctx = useContext(DocumentContext);
  ctx.footnotes.push(children);
  return null;
};

export let Footnote: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  let i = ctx.footnotes.length;
  return (
    <>
      <FootnoteDef>{children}</FootnoteDef>
      <Ref name={`footnote:${i}`} />
    </>
  );
};

let Footnotes: React.FC = _ => {
  let ctx = useContext(DocumentContext);
  return ctx.footnotes.length == 0 ? null : (
    <div className="footnotes">
      {ctx.footnotes.map((footnote, i) => {
        i += 1;
        return (
          <div className="footnote" id={`footnote-${i}`} key={i}>
            <div className="footnote-number">{i}</div>
            <Definition
              name={`footnote:${i}`}
              Label={() => <sup className="footnote">{i}</sup>}
              block
            >
              <div className="footnote-body">{footnote}</div>
            </Definition>
          </div>
        );
      })}
    </div>
  );
};

export let DocumentInner: React.FC = observer(({ children }) => {
  let def_ctx = usePlugin(DefinitionsPlugin);
  return (
    <>
      <div
        className={classNames("document", {
          "def-mode": def_ctx.def_mode,
        })}
      >
        {children}
      </div>
      <Footnotes />
      <Logger />
    </>
  );
});

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
  LoggerPlugin,
];

export let Document: React.FC<DocumentProps> = ({ children, onLoad }) => {
  let portal = new PortalData();

  if (onLoad) {
    useEffect(onLoad, []);
  }

  let inner = PLUGINS().reduce(
    (el, plugin) => <plugin.Provide>{el}</plugin.Provide>,
    <DocumentInner>{children}</DocumentInner>
  );

  return (
    <>
      <DocumentContext.Provider value={new DocumentData()}>
        <PortalContext.Provider value={portal}>{inner}</PortalContext.Provider>
      </DocumentContext.Provider>
      <div
        className="portal"
        ref={el => {
          portal.portal = el;
        }}
      />
    </>
  );
};
