import React, { useContext } from "react";
import bibtexParse from "@orcid/bibtex-parse-js";
import _ from "lodash";
import { Section, SectionTitle } from "./document";
import { Definition, Ref, DefinitionContext } from "./definitions";

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
    return (
      <div className="bib-reference">
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
function intersperse<T>(arr: JSX.Element[], Sep: React.FC): JSX.Element[] {
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

  cite(keys: string[], full: boolean, yearonly: boolean) {
    keys.forEach((key) => {
      this.used_citations[key] = true;
    });

    return full ? (
      intersperse(
        keys.map((key) => {
          let entry = this.citations[key];
          let author = entry.display_author();
          return <Ref key={key} name={key}>{`${author} [${entry.year}]`}</Ref>;
        }),
        (props) => <span {...props}>{"; "}</span>
      )
    ) : (
      <span>
        [
        {intersperse(
          keys.map((key) => {
            let entry = this.citations[key];
            if (yearonly) {
              return <span key={key}>entry.year</span>;
            } else {
              let author = entry.display_author();
              return (
                <Ref key={key} name={key}>{`${author} ${entry.year}`}</Ref>
              );
            }
          }),
          (props) => (
            <span {...props}>{"; "}</span>
          )
        )}
        ]
      </span>
    );
  }
}

export let ReactBibliographyContext =
  React.createContext<BibliographyContext | null>(null);

export let ReferencesSection: React.FC = (_) => {
  let ctx = useContext(ReactBibliographyContext)!;
  return (
    <section>
      <SectionTitle>References</SectionTitle>
      <References keys={Object.keys(ctx.used_citations)} />
    </section>
  );
};

export let References: React.FC<{ keys: string[] }> = ({ keys }) => {
  let ctx = useContext(ReactBibliographyContext)!;
  return (
    <div className="bib-references">
      {keys.map((key) => (
        <Definition key={key} name={key} block>
          {ctx.citations[key].bib_cite()}
        </Definition>
      ))}
    </div>
  );
};

export let Cite: React.FC<{ v: string | string[]; f?: boolean; y?: boolean }> =
  ({ v, f, y }) => {
    let ctx = useContext(ReactBibliographyContext)!;
    let keys = typeof v === "string" ? [v] : v;
    return <>{ctx.cite(keys, f || false, y || false)}</>;
  };
