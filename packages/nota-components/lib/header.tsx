import { joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import React, { createContext, useContext } from "react";

import { DocumentContext } from "./document.js";
import { FCC } from "./utils.js";

interface AuthorAffiliation {
  institution?: string;
  country?: string;
}

let AffiliationContext = createContext<AuthorAffiliation>({});

interface AuthorData {
  name?: string;
  affiliations?: AuthorAffiliation[];
}

let InlineError: FCC = ({ children }) => <span className="inline-error">{children}</span>;

let AuthorContext = createContext<AuthorData>({});

export let Institution: FCC = ({ children }) => {
  let ctx = useContext(AffiliationContext);
  ctx.institution = joinRecursive(children as any);
  return null;
};

export let Affiliation: FCC = ({ children }) => {
  let authCtx = useContext(AuthorContext);
  let affCtx: AuthorAffiliation = {};
  let AffiliationInner = () => {
    if (!authCtx.affiliations) {
      authCtx.affiliations = [];
    }
    authCtx.affiliations.push(affCtx);
    return null;
  };
  return (
    <>
      <AffiliationContext.Provider value={affCtx}>{children}</AffiliationContext.Provider>
      <AffiliationInner />
    </>
  );
};

export let Name: FCC = ({ children }) => {
  let ctx = useContext(AuthorContext);
  ctx.name = joinRecursive(children as any);
  return <></>;
};

export let Author: FCC = ({ children }) => {
  let ctx: AuthorData = {};
  let AuthorInner = () => (
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
      <AuthorInner />
    </>
  );
};

export let Authors: FCC = ({ children }) => {
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

export let Title: FCC = ({ children }) => <div className="document-title">{children}</div>;

export let Abstract: FCC = ({ children }) => <div className="abstract">{children}</div>;
