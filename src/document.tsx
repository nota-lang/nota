import React, {
  useState,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import CSS from "csstype";
import classNames from "classnames";
import { observer, Observer } from "mobx-react";
import { makeObservable, observable } from "mobx";

import { ReactTexContext, TexContext } from "./tex";
import {
  ReactBibliographyContext,
  ReferencesSection,
  BibliographyContext,
} from "./bibliography";
import {
  DefinitionContext,
  AllDefinitionData,
  Definition,
} from "./definitions";
import { ListingContext, ListingData } from "./code";

class SectionData {
  subsections: number = 0;
}

class DocumentData {
  sections: number = 0;
  footnotes: React.ReactNode[] = [];
  section_contexts: SectionData[] = [];
  toplevel_portal: Element | null;

  constructor(toplevel_portal: Element | null) {
    this.toplevel_portal = toplevel_portal;
  }
}

let DocumentContext = React.createContext<DocumentData>(new DocumentData(null));

export let SectionTitle: React.FC<{ level?: number }> = ({
  level,
  children,
}) => {
  let Header: React.FC<
    React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLHeadingElement>,
      HTMLHeadingElement
    >
  >;
  if (!level || level == 0) {
    Header = (props) => <h2 {...props} />;
  } else if (level == 1) {
    Header = (props) => <h3 {...props} />;
  } else {
    Header = (props) => <h4 {...props} />;
  }
  return <Header className="section-title">{children}</Header>;
};

export let Section: React.FC<{ title: string; name?: string }> = ({
  name,
  title,
  children,
}) => {
  let doc_ctx = useContext(DocumentContext);
  let def_ctx = useContext(DefinitionContext);
  if (doc_ctx.section_contexts.length == 0) {
    doc_ctx.sections += 1;
  } else {
    _.last(doc_ctx.section_contexts)!.subsections += 1;
  }

  let level = doc_ctx.section_contexts.length;

  let sec_num = [
    doc_ctx.sections,
    ...doc_ctx.section_contexts.map((ctx) => ctx.subsections),
  ].join(".");

  let sec_ctx = new SectionData();
  doc_ctx.section_contexts.push(sec_ctx);

  let Cleanup: React.FC = (_) => {
    doc_ctx.section_contexts.pop();
    return null;
  };

  return (
    <Definition
      name={name}
      Label={() => <>Section {sec_num}</>}
      Tooltip={null}
      block
    >
      <section>
        <SectionTitle level={level}>
          <span className="section-number">{sec_num}</span> {title}
        </SectionTitle>
        {children}
        <Cleanup />
      </section>
    </Definition>
  );
};

export let Footnote: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  ctx.footnotes.push(children);
  let i = ctx.footnotes.length;
  return (
    <a href={`#footnote-${i}`} id={`footnote-ref-${i}`}>
      <sup className="footnote-marker">{i}</sup>
    </a>
  );
};

export let Wrap: React.FC<{ align: CSS.Property.Float }> = ({
  align,
  children,
}) => {
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

export let Row: React.FC = ({ children }) => {
  return <div className="row">{children}</div>;
};

export let ToplevelElem: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  return ReactDOM.createPortal(children, ctx.toplevel_portal!);
};

interface DocumentProps {
  bibtex?: string;
}

let Footnotes: React.FC = (_) => {
  let ctx = useContext(DocumentContext);
  return (
    <div className="footnotes">
      {ctx.footnotes.map((footnote, i) => {
        let top = {};
        i += 1;
        return (
          <div className="footnote" id={`footnote-${i}`} key={i}>
            <a className="backlink" href={`#footnote-ref-${i}`}>
              ⬅
            </a>
            <span className="footnote-number">{i}</span>
            {footnote}
          </div>
        );
      })}
    </div>
  );
};

export let DocumentInner: React.FC = observer(({ children }) => {
  let def_ctx = useContext(DefinitionContext);

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

export let Document: React.FC<DocumentProps> = ({ children, bibtex }) => {
  let [def_ctx] = useState(new AllDefinitionData());
  def_ctx.add_mode_listeners();

  let [toplevel_portal, set_toplevel_portal] = useState(null);
  let on_portal_mount = useCallback((node) => {
    set_toplevel_portal(node);
  }, []);

  return (
    <DefinitionContext.Provider value={def_ctx}>
      <DocumentContext.Provider value={new DocumentData(toplevel_portal)}>
        <ReactTexContext.Provider value={new TexContext()}>
          <ReactBibliographyContext.Provider
            value={new BibliographyContext(bibtex || "")}
          >
            <ListingContext.Provider value={new ListingData()}>
              {toplevel_portal != null ? (
                <DocumentInner>{children}</DocumentInner>
              ) : null}
              <div ref={on_portal_mount} />
            </ListingContext.Provider>
          </ReactBibliographyContext.Provider>
        </ReactTexContext.Provider>
      </DocumentContext.Provider>
    </DefinitionContext.Provider>
  );
};
