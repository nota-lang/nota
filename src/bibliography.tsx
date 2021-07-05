import React, { useContext } from 'react';
import bibtexParse from '@orcid/bibtex-parse-js';
import _ from 'lodash';

function isString(x: any): x is string {
  return typeof x === "string";
}

class BibliographyEntry {
  authors?: String[][];
  year?: number;
  tags: any;

  constructor(tags: any) {
    if (isString(tags.author)) {
      this.authors = (tags.author as string)
        .split(" and ")
        .map(author => author.split(", "));
    }
    
    if (isString(tags.year)) {
      this.year = parseInt(tags.year);    
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

  return arr.slice(1).reduce(function(xs, x, i) {
      return xs.concat([sep, x]);
  }, [arr[0]]);
}

export class BibliographyContext {
  citations: {[key: string]: BibliographyEntry}

  constructor(bibtex: string) {
    let entries = bibtexParse.toJSON(bibtex);
    this.citations = _.chain(entries)
      .map(entry => [entry.citationKey, new BibliographyEntry(entry.entryTags)])
      .fromPairs()
      .value();
  }

  cite(key: string | string[], full: boolean, yearonly: boolean) {
    let keys = typeof key === 'string' ? [key] : key;
    if (full) {
      return <span>
        {intersperse(keys.map(key => {
          let entry = this.citations[key];
          let author = entry.display_author();
          return `${author} [${entry.year}]`;
        }), "; ")}
      </span>;
    } else {
      return <span>[{intersperse(keys.map(key => {
        let entry = this.citations[key];
        if (yearonly) {
          return entry.year;
        } else {
          let author = entry.display_author();
          return `${author} ${entry.year}`;
        };
      }), ", ")}]</span>;
    }
  }
}

export let ReactBibliographyContext = React.createContext<BibliographyContext | null>(null);

export let Cite: React.FC<{v: string | string[], f?: boolean, y?: boolean}> = ({v, f, y}) => {
  let ctx = useContext(ReactBibliographyContext)!;
  return ctx.cite(v, f || false, y || false);
}