declare module "*.nota" {
  import type { DocComponent } from "@nota-lang/core";

  const Doc: DocComponent;
  export default Doc;
}

declare module "*.bib?bib" {
  import type { BibDatabase } from "../../src/bib";

  const bib: BibDatabase;
  export default bib;
}
