import { joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import React, { createContext, useContext } from "react";

import { DocumentContext } from "./document.js";

interface AuthorAffiliation {
  institution?: string;
  country?: string;
}

let AffiliationContext = createContext<AuthorAffiliation>({});

interface AuthorData {
  name?: string;
  affiliations?: AuthorAffiliation[];
}

let InlineError: React.FC = ({ children }) => <span className="inline-error">{children}</span>;

let AuthorContext = createContext<AuthorData>({});

export let Institution: React.FC = ({ children }) => {
  let ctx = useContext(AffiliationContext);
  ctx.institution = joinRecursive(children as any);
  return null;
};

export let Affiliation: React.FC = ({ children }) => {
  let authCtx = useContext(AuthorContext);
  let affCtx: AuthorAffiliation = {};
  let Inner = () => {
    if (!authCtx.affiliations) {
      authCtx.affiliations = [];
    }
    authCtx.affiliations.push(affCtx);
    return null;
  };
  return (
    <>
      <AffiliationContext.Provider value={affCtx}>{children}</AffiliationContext.Provider>
      <Inner />
    </>
  );
};

export let Name: React.FC = ({ children }) => {
  let ctx = useContext(AuthorContext);
  ctx.name = joinRecursive(children as any);
  return <></>;
};

export let Author: React.FC = ({ children }) => {
  let ctx: AuthorData = {};
  let Inner = () => (
    <div className="author">
      {ctx.name ? (
        <span className="author-name">{ctx.name}</span>
      ) : (
        <InlineError>No author name!</InlineError>
      )}
      {ctx.affiliations ? (
        <span className="author-affiliation">
          ,{" "}
          {ctx.affiliations.map((affiliation, i) => (
            <span key={i}>
              {affiliation.institution ? affiliation.institution : null}
              {affiliation.country ? <>, {affiliation.country}</> : null}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
  return (
    <>
      <AuthorContext.Provider value={ctx}>{children}</AuthorContext.Provider>
      <Inner />
    </>
  );
};

export let Authors: React.FC = ({ children }) => {
  let ctx = useContext(DocumentContext);
  return (
    <div className="authors">
      {ctx.anonymous ? (
        <div className="author">
          <span className="author-name">Anonymous author(s)</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export let Title: React.FC = ({ children }) => <h1 className="document-title">{children}</h1>;

export let Abstract: React.FC = ({ children }) => <div className="abstract">{children}</div>;
