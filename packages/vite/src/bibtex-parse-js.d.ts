/**
 * `@orcid/bibtex-parse-js` ships no types. Only `toJSON` is declared — the reverse direction
 * (`toBibtex`) is not something this plugin has a use for.
 */
declare module "@orcid/bibtex-parse-js" {
  /**
   * One `@…` directive of a `.bib` file, as the parser hands it back.
   *
   * An entry proper carries `entryTags` (its fields) and, all being well, a `citationKey`;
   * `@preamble` and `@comment` carry their body as `entry` and no fields at all.
   */
  export interface RawBibtexEntry {
    citationKey?: string;
    entryType: string;
    entryTags?: Record<string, string>;
    entry?: string;
  }

  const bibtexParse: {
    /** Parse a whole `.bib` file, one array element per `@…` directive. */
    toJSON(source: string): RawBibtexEntry[];
  };

  export default bibtexParse;
}
