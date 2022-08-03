import { default as classNames } from "classnames";
import CSS from "csstype";
import _ from "lodash";
import { observer } from "mobx-react";
import React, { useContext, useEffect, useRef, useState } from "react";

import { BibliographyPlugin, References } from "./bibliography.js";
import { ListingPlugin } from "./code.js";
import { NestedCounter, ValueStack } from "./counter.js";
import { Definition, DefinitionsPlugin, Ref } from "./definitions.js";
import { Logger, LoggerPlugin } from "./logger.js";
import { Plugin, usePlugin } from "./plugin.js";
import { Portal, PortalPlugin } from "./portal.js";
import { ScrollPlugin } from "./scroll.js";
import { TexPlugin } from "./tex.js";
import { TooltipPlugin } from "./tooltip.js";
import { FCC, HTMLAttributes } from "./utils.js";

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
  <li className={!stack.enumerated ? "bullet" : undefined}>
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
        <div className="toc-header">Table of Contents</div>
        <ol>
          {docCtx.sections.values.map((child, i) => (
            <Stack key={i} stack={child} />
          ))}
        </ol>
      </div>
    </div>
  );
});
TableOfContents.displayName = "TableOfContents";

export let Section: FCC<{ plain?: boolean; name?: string }> = ({ children, plain, ...props }) => {
  let docCtx = useContext(DocumentContext);
  let pos = docCtx.sections.position();
  let level = pos.level();
  let secNum = pos.toString();
  let name = props.name || `section-${secNum}`;
  docCtx.sections.saveValue(() => <Ref label={children}>{name}</Ref>, !plain);

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

  return (
    <Header className="section-title">
      <Definition name={name} label={`Section ${secNum}`} tooltip={null} block>
        {!plain && docCtx.sectionNumbers ? <span className="section-number">{secNum}</span> : null}{" "}
        {children}
      </Definition>
    </Header>
  );
};

export let Subsection: typeof Section = props => <Section {...props} />;
export let Subsubsection: typeof Section = props => <Section {...props} />;

export let SectionBody: FCC = ({ children }) => {
  let docCtx = useContext(DocumentContext);
  return (
    <section>
      <docCtx.sections.Push />
      {children}
      <docCtx.sections.Pop />
    </section>
  );
};

class FigureData {
  caption?: JSX.Element;
}

let FigureContext = React.createContext<FigureData>(new FigureData());

export let Figure: FCC<{ name?: string }> = props => {
  let docCtx = useContext(DocumentContext);
  let pos = docCtx.figures.push();
  let level = pos.level();
  let figNum = pos.toString();

  let figCtx = new FigureData();
  let label = `Figure ${figNum}`;
  let Caption = () => (
    <Definition name={props.name} label={label} tooltip={null} block>
      <div className="caption">
        <div className="caption-layout">
          <div className="caption-title">{`${label}:`}</div>
          <div className="caption-content">{figCtx.caption}</div>
        </div>
      </div>
    </Definition>
  );

  let inner = props.children;

  //// TODO: this causes weird labels for ordinary subfigures, eg "Figure 6-Figure 6a"
  // let inner = props.name ? (
  //   <DefinitionScope name={props.name}>{props.children}</DefinitionScope>
  // ) : (
  //   props.children
  // );

  return (
    <FigureContext.Provider value={figCtx}>
      <div className={`figure level-${level}`}>
        <div className="figure-content">{inner}</div>
        <Caption />
      </div>
      <docCtx.figures.Pop />
    </FigureContext.Provider>
  );
};

export let Subfigure: typeof Figure = Figure;

export let Caption: FCC = props => {
  let ctx = useContext(FigureContext);
  ctx.caption = <>{props.children}</>;
  return null;
};

export let Wrap: FCC<{ align: CSS.Property.Float }> = ({ align, children }) => (
  <div className={`wrap ${align}`}>{children}</div>
);

export let Smallcaps: FCC = ({ children }) => <span className="smallcaps">{children}</span>;

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

export let Row: FCC<HTMLAttributes> = ({ children, className, ...props }) => {
  return (
    <div {...props} className={classNames("row", className)}>
      {children}
    </div>
  );
};

export let Center: FCC = ({ children }) => {
  return <div style={{ margin: "0 auto", width: "max-content" }}>{children}</div>;
};

export let Expandable: FCC<{ prompt: JSX.Element }> = ({ children, prompt }) => {
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

export let FootnoteDef: FCC<{ name?: string }> = ({ children }) => {
  let ctx = useContext(DocumentContext);
  ctx.footnotes.push(children);
  return null;
};

export let Footnote: FCC = ({ children }) => {
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
    // TODO: including Acknowledgements and References is a hack
    // for the edge case. Need a general mechanism for custom components
    // that induce section breaks.
    [Acknowledgments, 0],
    [References, 0],
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

export let Acknowledgments: FCC = ({ children }) => {
  return (
    <>
      <Section plain>Acknowledgments</Section>
      {children}
    </>
  );
};

export let DocumentInner: FCC = observer(({ children }) => {
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
DocumentInner.displayName = "DocumentInner";

export interface DocumentProps {
  anonymous?: boolean;
  editing?: boolean;
  onRender?: () => void;
  renderTimeout?: number;
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

export let Document: FCC<DocumentProps & HTMLAttributes> = ({
  children,
  editing,
  onRender,
  renderTimeout,
  ...htmlAttributes
}) => {
  let ref = useRef<HTMLDivElement>(null);
  if (onRender) {
    useEffect(() => {
      let last_change = Date.now();
      let observer = new MutationObserver(_evt => {
        last_change = Date.now();
      });
      observer.observe(ref.current!, { subtree: true, childList: true, attributes: true });

      let timeout = renderTimeout || 1000;
      let intvl = setInterval(() => {
        if (Date.now() - last_change > timeout) {
          clearInterval(intvl);
          observer.disconnect();
          onRender();
        }
      }, 50);
    }, [onRender, children]);
  }

  let inner = PLUGINS().reduce(
    (el, plugin, i) => <plugin.Provide key={i}>{el}</plugin.Provide>,
    <DocumentInner>{children}</DocumentInner>
  );

  // NOTE: at one point, we tried to add <React.StrictMode> to help users catch bugs.
  // But this has some insane interactions with testing-library. StrictMode causes components
  // to render twice, but the testing-library doesn't "understand" the second render,
  // so it incorrectly calls React hooks again AND somehow silences stdout.
  return (
    <div ref={ref} className={classNames("nota-document", { editing })} {...htmlAttributes}>
      <DocumentContext.Provider value={new DocumentData()}>{inner}</DocumentContext.Provider>
    </div>
  );
};
