import React, { useContext } from "react";
import bibtexParse from "@orcid/bibtex-parse-js";
import _ from "lodash";
import { Section, SectionTitle } from "./document";

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
      this.authors = (tags.author as string)
        .split(" and ")
        .map((author) => author.split(", "));
    }

    if (isString(tags.year)) {
      this.year = parseInt(tags.year);
    }

    if (isString(tags.title)) {
      this.title = tags.title;
    }

    this.tags = tags;
  }

  display_author() {
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

  bib_cite() {
    let names = this.authors?.map((author) =>
      [...author.slice(1), author[0]].join(" ")
    );
    // console.log(this.tags);
    return (
      <div className="reference">
        <a id={`ref-${this.key}`} />
        {names
          ? (names.length > 1
              ? names.slice(0, -1).join(", ") +
                ", and " +
                names[names.length - 1]
              : names[0]) + ". "
          : null}
        {this.year ? this.year + ". " : null}
        {this.title ? this.title + ". " : null}
        <i>{this.tags.journal || this.tags.booktitle}.</i>
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
function intersperse<T>(arr: T[], sep: T): T[] {
  if (arr.length === 0) {
    return [];
  }

  return arr.slice(1).reduce(
    function (xs, x, i) {
      return xs.concat([sep, x]);
    },
    [arr[0]]
  );
}

export class BibliographyContext {
  citations: { [key: string]: BibliographyEntry };
  used_citations: { [key: string]: boolean };

  constructor(bibtex: string) {
    let entries = bibtexParse.toJSON(bibtex);
    this.citations = _.chain(entries)
      .map((entry) => [entry.citationKey, new BibliographyEntry(entry)])
      .fromPairs()
      .value();
    this.used_citations = {};
  }

  cite(key: string | string[], full: boolean, yearonly: boolean) {
    let keys = typeof key === "string" ? [key] : key;

    keys.forEach((key) => {
      this.used_citations[key] = true;
    });

    return full ? (
      <a href={`#ref-${key}`}>
        {intersperse(
          keys.map((key) => {
            let entry = this.citations[key];
            let author = entry.display_author();
            return `${author} [${entry.year}]`;
          }),
          "; "
        )}
      </a>
    ) : (
      <span>
        [
        {intersperse(
          keys.map((key) => {
            let entry = this.citations[key];
            if (yearonly) {
              return entry.year;
            } else {
              let author = entry.display_author();
              return (
                <a
                  key={key}
                  href={`#ref-${key}`}
                >{`${author} ${entry.year}`}</a>
              );
            }
          }),
          ", " as any
        )}
        ]
      </span>
    );
  }
}

export let ReactBibliographyContext =
  React.createContext<BibliographyContext | null>(null);

export let References: React.FC = (_) => {
  let ctx = useContext(ReactBibliographyContext)!;
  return (
    <div className="references">
      <SectionTitle>References</SectionTitle>
      {Object.keys(ctx.used_citations).map((key) => (
        <div key={key}>{ctx.citations[key].bib_cite()}</div>
      ))}
    </div>
  );
};

export let Cite: React.FC<{ v: string | string[]; f?: boolean; y?: boolean }> =
  ({ v, f, y }) => {
    let ctx = useContext(ReactBibliographyContext)!;
    return ctx.cite(v, f || false, y || false);
  };
