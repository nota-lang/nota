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
import { NestedCounter, ValueStack } from "./counter";

class DocumentData {
  sections: NestedCounter = new NestedCounter();
  figures: NestedCounter = new NestedCounter(["1", "a"]);
  theorems: NestedCounter = new NestedCounter();

  footnotes: React.ReactNode[] = [];
  anonymous: boolean = false;
  section_numbers: boolean = false;
}

export let DocumentContext = React.createContext<DocumentData>(new DocumentData());

export let Paragraph: React.FC = ({ children }) => <p>{children}</p>;

let Stack: React.FC<{ stack: ValueStack }> = ({ stack }) => (
  <li>
    <stack.value />
    <ol>
      {stack.children.map((child, i) => (
        <Stack key={i} stack={child} />
      ))}
    </ol>
  </li>
);

export let TableOfContents: React.FC = observer(({}) => {
  let doc_ctx = useContext(DocumentContext);
  return (
    <div className="toc-wrapper">
      <div className="toc">
        <ol>
          {doc_ctx.sections.values.map((child, i) => (
            <Stack key={i} stack={child} />
          ))}
        </ol>
      </div>
    </div>
  );
});

export let Section: React.FC<{ plain?: boolean; label?: string }> = ({
  children,
  plain,
  ...props
}) => {
  let doc_ctx = useContext(DocumentContext);
  let pos = doc_ctx.sections.position();
  let level = pos.level();
  let sec_num = pos.to_string();
  let label = props.label || `section-${sec_num}`;
  doc_ctx.sections.save_value(() => <Ref Label={children}>{label}</Ref>);

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
  Header.displayName = "Header";

  let inner = (
    <Header className="section-title">
      {!plain && doc_ctx.section_numbers ? <span className="section-number">{sec_num}</span> : null}{" "}
      {children}
    </Header>
  );

  return (
    <Definition name={label} Label={() => <>Section {sec_num}</>} Tooltip={null} block>
      {inner}
    </Definition>
  );
};

export let Subsection: typeof Section = props => <Section {...props} />;
export let Subsubsection: typeof Section = props => <Section {...props} />;

export let SectionBody: React.FC = ({ children }) => {
  let doc_ctx = useContext(DocumentContext);
  doc_ctx.sections.push();

  return (
    <section>
      {children}
      <doc_ctx.sections.Pop />
    </section>
  );
};

class FigureData {
  caption?: JSX.Element;
}

let FigureContext = React.createContext<FigureData>(new FigureData());

export let Figure: React.FC<{ label?: string }> = props => {
  let doc_ctx = useContext(DocumentContext);
  let pos = doc_ctx.figures.push();
  let level = pos.level();
  let fig_num = pos.to_string();

  let fig_ctx = new FigureData();

  let Caption = () => (
    <Definition
      style={{ width: "100%" }}
      name={props.label}
      Label={() => <>{`Figure ${fig_num}`}</>}
      Tooltip={null}
      block
    >
      <div className="caption">
        Figure {fig_num}: {fig_ctx.caption}
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

export let FullWidthContainer: React.FC<HTMLAttributes> = ({ style, className, ...props }) => {
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
      <Ref>footnote:{i}</Ref>
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

let is_react_el = (t: React.ReactNode): t is React.ReactElement =>
  t != null && typeof t == "object" && "type" in t;

let preprocess_document = (children: React.ReactNode[]): React.ReactNode[] => {
  let paragraphs: React.ReactNode[] = [];
  let paragraph: React.ReactNode[] = [];
  let flush_paragraph = () => {
    if (paragraph.length > 0) {
      if (_.every(paragraph, t => t == "\n" || typeof t != "string")) {
        paragraphs = paragraphs.concat(paragraph);
      } else {
        paragraphs.push(<Paragraph key={paragraphs.length}>{paragraph}</Paragraph>);
      }
      paragraph = [];
    }
  };

  let i = 0;
  while (i < children.length) {
    let child = children[i];
    if (child == "\n" && i < children.length - 1 && children[i + 1] == "\n") {
      while (children[i] == "\n") {
        i++;
      }
      flush_paragraph();
    } else {
      paragraph.push(child);
      i++;
    }
  }
  flush_paragraph();

  let section_stack: React.ReactNode[][] = [[]];
  let depths: [any, number][] = [
    [Section, 0],
    [Subsection, 1],
    [Subsubsection, 2],
  ];
  let flush_stack = (depth: number) => {
    _.range(1 + depth, section_stack.length, 1).forEach(() => {
      let sec = section_stack.pop();
      let parent = _.last(section_stack)!;
      parent.push(<SectionBody key={parent.length}>{sec}</SectionBody>);
    });
  };
  paragraphs.forEach(el => {
    if (is_react_el(el)) {
      let depth = depths.find(([F]) => el.type == F);
      if (depth !== undefined) {
        flush_stack(depth[1]);
        section_stack.push([el]);
        return;
      }
    }

    _.last(section_stack)!.push(el);
  });
  flush_stack(0);

  return section_stack[0];
};

export let DocumentInner: React.FC = observer(({ children }) => {
  let def_ctx = usePlugin(DefinitionsPlugin);
  let processed = children instanceof Array ? preprocess_document(children) : children;

  return (
    <div
      className={classNames({
        "def-mode": def_ctx.def_mode,
      })}
    >
      {processed}
      <Footnotes />
      <Logger />
    </div>
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
    <div className="nota-document">
      <DocumentContext.Provider value={new DocumentData()}>
        <PortalContext.Provider value={portal}>{inner}</PortalContext.Provider>
      </DocumentContext.Provider>
      <div
        className="portal"
        ref={el => {
          portal.portal = el;
        }}
      />
    </div>
  );
};
