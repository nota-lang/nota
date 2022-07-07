import { default as classNames } from "classnames";
import CSS from "csstype";
import _ from "lodash";
import { observer } from "mobx-react";
import React, { useContext, useEffect, useRef, useState } from "react";

import { BibliographyPlugin } from "./bibliography.js";
import { ListingPlugin } from "./code.js";
import { NestedCounter, ValueStack } from "./counter.js";
import { Definition, DefinitionScope, DefinitionsPlugin, Ref } from "./definitions.js";
import { Logger, LoggerPlugin } from "./logger.js";
import { Plugin, usePlugin } from "./plugin.js";
import { Portal, PortalPlugin } from "./portal.js";
import { ScrollPlugin } from "./scroll.js";
import { TexPlugin } from "./tex.js";
import { TooltipPlugin } from "./tooltip.js";
import { HTMLAttributes } from "./utils.js";

class DocumentData {
  sections: NestedCounter = new NestedCounter();
  figures: NestedCounter = new NestedCounter(["1", "a"]);
  theorems: NestedCounter = new NestedCounter();

  footnotes: React.ReactNode[] = [];
  anonymous: boolean = false;
  sectionNumbers: boolean = true;
}

export let DocumentContext = React.createContext<DocumentData>(new DocumentData());

let Stack: React.FC<{ stack: ValueStack }> = ({ stack }) => (
  <li>
    {typeof stack.value === "function" ? <stack.value /> : stack.value}
    {stack.children.length > 0 ? (
      <ol>
        {stack.children.map((child, i) => (
          <Stack key={i} stack={child} />
        ))}
      </ol>
    ) : null}
  </li>
);

export let TableOfContents: React.FC = observer(({}) => {
  let docCtx = useContext(DocumentContext);
  return (
    <div className="toc-wrapper">
      <div className="toc">
        <ol>
          {docCtx.sections.values.map((child, i) => (
            <Stack key={i} stack={child} />
          ))}
        </ol>
      </div>
    </div>
  );
});

export let Section: React.FC<{ plain?: boolean; name?: string }> = ({
  children,
  plain,
  ...props
}) => {
  let docCtx = useContext(DocumentContext);
  let pos = docCtx.sections.position();
  let level = pos.level();
  let secNum = pos.toString();
  let name = props.name || `section-${secNum}`;
  docCtx.sections.saveValue(() => <Ref label={children}>{name}</Ref>);

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
      {!plain && docCtx.sectionNumbers ? <span className="section-number">{secNum}</span> : null}{" "}
      {children}
    </Header>
  );

  return (
    <Definition name={name} label={`Section ${secNum}`} tooltip={null} block>
      {inner}
    </Definition>
  );
};

export let Subsection: typeof Section = props => <Section {...props} />;
export let Subsubsection: typeof Section = props => <Section {...props} />;

export let SectionBody: React.FC = ({ children }) => {
  let docCtx = useContext(DocumentContext);
  docCtx.sections.push();

  return (
    <section>
      {children}
      <docCtx.sections.Pop />
    </section>
  );
};

class FigureData {
  caption?: JSX.Element;
}

let FigureContext = React.createContext<FigureData>(new FigureData());

export let Figure: React.FC<{ name?: string }> = props => {
  let docCtx = useContext(DocumentContext);
  let pos = docCtx.figures.push();
  let level = pos.level();
  let figNum = pos.toString();

  let figCtx = new FigureData();

  let Caption = () => (
    <Definition
      attrs={{ style: { width: "100%" } }}
      name={props.name}
      label={`Figure ${figNum}`}
      tooltip={null}
      block
    >
      <div className="caption">
        Figure {figNum}: {figCtx.caption}
      </div>
    </Definition>
  );

  let inner = props.name ? (
    <DefinitionScope name={props.name}>{props.children}</DefinitionScope>
  ) : (
    props.children
  );

  return (
    <FigureContext.Provider value={figCtx}>
      <div className={`figure level-${level}`}>
        {inner}
        <Caption />
      </div>
      <docCtx.figures.Pop />
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
  let [left, setLeft] = useState(0);

  useEffect(() => {
    let { left } = ref.current!.getBoundingClientRect();
    setLeft(-left);
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

export let Center: React.FC = ({ children }) => {
  return <div style={{ margin: "0 auto", width: "max-content" }}>{children}</div>;
};

export let Expandable: React.FC<{ prompt: JSX.Element }> = ({ children, prompt }) => {
  let scrollPlugin = usePlugin(ScrollPlugin);
  let ref = useRef(null);
  let [show, setShow] = useState(false);
  let [height, setHeight] = useState(0);
  let [id] = useState(() => _.uniqueId());

  useEffect(() => {
    let observer = new ResizeObserver(entries => {
      let height = entries[0].borderBoxSize[0].blockSize;
      setHeight(height);
    });
    observer.observe(ref.current!);

    console.log("registering", id, "to", scrollPlugin);
    scrollPlugin.registerScrollHook(id, () => {
      setShow(true);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className={classNames("expandable", { expanded: show })}>
      <div style={{ textAlign: "center" }}>
        <span className="expand" onClick={() => setShow(!show)}>
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
  let [i] = useState(ctx.footnotes.length);
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
      {ctx.footnotes.map((footnote, i) => (
        <div className="footnote" id={`footnote-${i}`} key={i}>
          <div className="footnote-number">{i}</div>
          <Definition name={`footnote:${i}`} label={<sup className="footnote">{i}</sup>} block>
            <div className="footnote-body">{footnote}</div>
          </Definition>
        </div>
      ))}
    </div>
  );
};

let isReactEl = (t: React.ReactNode): t is React.ReactElement =>
  t != null && typeof t == "object" && "type" in t;

let preprocessDocument = (children: React.ReactNode[]): React.ReactNode[] => {
  let paragraphs: React.ReactNode[] = [];
  let paragraph: React.ReactNode[] = [];
  let key = 0;
  let flushParagraph = () => {
    if (paragraph.length > 0) {
      if (_.every(paragraph, t => t == "\n" || typeof t != "string")) {
        paragraphs = paragraphs.concat(paragraph);
      } else {
        paragraphs.push(<p key={key++}>{paragraph}</p>);
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
      flushParagraph();
    } else {
      paragraph.push(child);
      i++;
    }
  }
  flushParagraph();

  let sectionStack: React.ReactNode[][] = [[]];
  let depths: [any, number][] = [
    [Section, 0],
    [Subsection, 1],
    [Subsubsection, 2],
  ];
  let flushStack = (depth: number) => {
    _.range(1 + depth, sectionStack.length, 1).forEach(() => {
      let sec = sectionStack.pop();
      let parent = _.last(sectionStack)!;
      parent.push(<SectionBody key={parent.length}>{sec}</SectionBody>);
    });
  };
  paragraphs.forEach(el => {
    if (isReactEl(el)) {
      let depth = depths.find(([F]) => el.type == F);
      if (depth !== undefined) {
        flushStack(depth[1]);
        sectionStack.push([el]);
        return;
      }
    }

    _.last(sectionStack)!.push(el);
  });
  flushStack(0);

  return sectionStack[0];
};

export let DocumentInner: React.FC = observer(({ children }) => {
  let defCtx = usePlugin(DefinitionsPlugin);
  let processed = children instanceof Array ? preprocessDocument(children) : children;

  return (
    <>
      <div
        className={classNames("nota-document-inner", {
          "def-mode": defCtx.defMode,
        })}
      >
        {processed}
        <Footnotes />
        <Logger />
      </div>
      <Portal />
    </>
  );
});

export interface DocumentProps {
  anonymous?: boolean;
  editing?: boolean;
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
  PortalPlugin,
];

export let Document: React.FC<DocumentProps> = ({ children, editing, onLoad }) => {
  if (onLoad) {
    useEffect(onLoad, []);
  }

  let inner = PLUGINS().reduce(
    (el, plugin) => <plugin.Provide>{el}</plugin.Provide>,
    <DocumentInner>{children}</DocumentInner>
  );

  return (
    <div className={classNames("nota-document", { editing })}>
      <DocumentContext.Provider value={new DocumentData()}>{inner}</DocumentContext.Provider>
    </div>
  );
};
