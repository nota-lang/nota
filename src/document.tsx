import React, { useState, useContext, useEffect } from "react";
import { ReactTexContext, TexContext } from "./tex";
import {
  ReactBibliographyContext,
  ReferencesSection,
  BibliographyContext,
} from "./bibliography";
import { ListingContext, ListingData } from "./code";
import _ from "lodash";
import CSS from "csstype";
import ReactTooltip from "react-tooltip";

class SectionData {
  subsections: number = 0;
}

class DocumentData {
  sections: number = 0;
  footnotes: React.ReactNode[] = [];
  labels: { [key: string]: string } = {};
  section_contexts: SectionData[] = [];

  add_label(key: string, value: string) {
    if (!this.labels[key]) {
      this.labels[key] = value;
    }
  }
}

let DocumentContext = React.createContext<DocumentData>(new DocumentData());

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

export let Section: React.FC<{ title: string; label?: string }> = ({
  label,
  title,
  children,
}) => {
  let doc_ctx = useContext(DocumentContext);
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
  if (label) {
    doc_ctx.add_label(label, `Section ${sec_num}`);
  }

  let sec_ctx = new SectionData();
  doc_ctx.section_contexts.push(sec_ctx);

  let Cleanup: React.FC = (_) => {
    doc_ctx.section_contexts.pop();
    return null;
  };

  return (
    <section id={label}>
      <SectionTitle level={level}>
        <span className="section-number">{sec_num}</span> {title}
      </SectionTitle>
      {children}
      <Cleanup />
    </section>
  );
};

export let Ref: React.FC<{ label: string }> = ({ label }) => {
  let ctx = useContext(DocumentContext);
  return <a href={`#${label}`}>{ctx.labels[label] || label}</a>;
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

interface DocumentProps {
  bibtex?: string;
}

export let Document: React.FC<DocumentProps> = ({ children, bibtex }) => {
  let [second_pass, set_second_pass] = useState(false);
  useEffect(() => {
    set_second_pass(true);
  });

  let [ctx, set_ctx] = useState(new DocumentData());
  useEffect(() => {
    if (second_pass) {
      let new_ctx = new DocumentData();
      new_ctx.labels = ctx.labels;
      set_ctx(new_ctx);
    }
  }, [second_pass]);

  let Footnotes: React.FC = (_) => (
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

  return (
    <DocumentContext.Provider value={ctx}>
      <ReactTexContext.Provider value={new TexContext()}>
        <ReactBibliographyContext.Provider
          value={new BibliographyContext(bibtex || "")}
        >
          <ListingContext.Provider value={new ListingData()}>
            <div className="document-wrapper" key={second_pass.toString()}>
              <ReactTooltip effect="solid" type="light" className="tooltip" />
              <div className="document">{children}</div>
              <ReferencesSection />
              <Footnotes />
            </div>
          </ListingContext.Provider>
        </ReactBibliographyContext.Provider>
      </ReactTexContext.Provider>
    </DocumentContext.Provider>
  );
};
