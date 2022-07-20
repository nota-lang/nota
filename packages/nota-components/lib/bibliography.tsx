import { joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import * as bibtexParse from "@orcid/bibtex-parse-js";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { useEffect } from "react";

import { Definition, DefinitionsPlugin } from "./definitions.js";
import { Section, SectionBody } from "./document.js";
import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { $ } from "./tex.js";
import { FCC } from "./utils.js";

function isString(x: any): x is string {
  return typeof x === "string";
}

class BibliographyEntry {
  key: string;
  authors?: String[][];
  year?: number;
  title?: string;

  tags: any;

  constructor(entry: any) {
    this.key = entry.citationKey;
    let tags = entry.entryTags;

    if (isString(tags.author)) {
      this.authors = (tags.author as string).split(" and ").map(author => author.split(", "));
    }

    if (isString(tags.year)) {
      this.year = parseInt(tags.year);
    }

    if (isString(tags.title)) {
      this.title = tags.title;
    }

    this.tags = tags;
  }

  displayAuthor() {
    if (this.authors) {
      if (this.authors.length > 2) {
        return `${this.authors[0][0]} et al.`;
      } else if (this.authors.length > 1) {
        return `${this.authors[0][0]} and ${this.authors[1][0]}`;
      } else if (this.authors.length > 0) {
        return this.authors[0][0];
      } else {
        throw "Empty author list";
      }
    } else {
      return "??";
    }
  }

  bibCite() {
    let names = this.authors?.map(author => [...author.slice(1), author[0]].join(" "));
    let location = this.tags.journal || this.tags.booktitle;
    return (
      <div className="bib-reference">
        <$>
          {"\\text{"}
          {names
            ? (names.length > 1
                ? names.slice(0, -1).join(", ") + ", and " + names[names.length - 1]
                : names[0]) + ". "
            : null}
          {"}"}
        </$>
        {this.year ? this.year + ". " : null}
        {this.title ? this.title + ". " : null}
        {location ? (
          <i>
            {location}
            {this.tags.number ? ` (${this.tags.number})` : null}
            {". "}
          </i>
        ) : null}
        {this.tags.note}
      </div>
    );
  }
}

/* intersperse: Return an array with the separator interspersed between
 * each element of the input array.
 *
 * > _([1,2,3]).intersperse(0)
 * [1,0,2,0,3]
 */
function intersperse(arr: JSX.Element[], Sep: React.FC): JSX.Element[] {
  if (arr.length === 0) {
    return [];
  }

  return arr.slice(1).reduce(
    function (xs, x, i) {
      return xs.concat([<Sep key={i} />, x]);
    },
    [arr[0]]
  );
}

export class BibliographyData extends Pluggable {
  citations: { [key: string]: BibliographyEntry } = {};
  stateful = true;

  constructor() {
    super();
    makeObservable(this, {
      citations: observable,
    });
  }

  importBibtex = action((bibtex: string) => {
    let entries = bibtexParse.toJSON(bibtex);
    entries.forEach((entry: any) => {
      this.citations[entry.citationKey] = new BibliographyEntry(entry);
    });
  });

  cite(keys: string[], full: boolean, yearonly: boolean, ex?: string) {
    let suffix = ex ? `, ${ex}` : "";

    for (let key of keys) {
      if (!this.citations[key]) {
        return <span className="error">{key}</span>;
      }
    }

    return full ? (
      intersperse(
        keys.map(key => {
          let entry = this.citations[key];
          let author = entry.displayAuthor();
          return <$ key={key}>{`\\text{${author} [${entry.year}${suffix}]}`}</$>;
        }),
        props => <span {...props}>{"; "}</span>
      )
    ) : (
      <span>
        [
        {intersperse(
          keys.map(key => {
            let entry = this.citations[key];
            if (yearonly) {
              return <span key={key}>{`${entry.year}${suffix}`}</span>;
            } else {
              let author = entry.displayAuthor();
              return <$ key={key}>{`\\text{${author} ${entry.year}${suffix}}`}</$>;
            }
          }),
          props => (
            <span {...props}>{"; "}</span>
          )
        )}
        ]
      </span>
    );
  }
}

export let BibliographyPlugin = new Plugin(BibliographyData);

export let References: FCC<{ bibtex?: string }> = observer(({ bibtex, children }) => {
  let bibCtx = usePlugin(BibliographyPlugin);
  let defCtx = usePlugin(DefinitionsPlugin);

  if (!bibtex) {
    bibtex = joinRecursive(children as any);
  }

  useEffect(() => {
    bibCtx.importBibtex(bibtex!);
  }, []);

  let keys = Object.keys(bibCtx.citations).filter(key => defCtx.usedDefinitions.has(key));

  return (
    <SectionBody>
      <Section plain>References</Section>
      <div className="bib-references">
        {keys
          .filter(key => key in bibCtx.citations)
          .map(key => (
            <Definition key={key} name={key} label={Cite} block>
              {bibCtx.citations[key].bibCite()}
            </Definition>
          ))}
      </div>
    </SectionBody>
  );
});
References.displayName = "References";

export interface CiteProps {
  name: string | string[];
  full?: boolean;
  year?: boolean;
  extra?: string;
}

export let Cite: React.FC<CiteProps> = observer(({ name, full, year, extra }) => {
  let ctx = usePlugin(BibliographyPlugin);
  let keys = typeof name === "string" ? [name] : name;
  return <>{ctx.cite(keys, full || false, year || false, extra)}</>;
});
Cite.displayName = "Cite";
