/** Forward-reference fixture covering headings, notes, definitions, figures, and citations. */
import { NotaDoc } from "@nota-lang/core";
import { Def, Heading, Label, Note, Ref, Toc } from "../../src/lib";

export function Doc() {
  return (
    <NotaDoc>
      <Toc />
      {"See "}
      <Ref id="beta" />
      {" and "}
      <Ref id="nota" />
      {" and "}
      <Ref id="sec:alpha" />
      {"."}
      <Heading rank={1}>Alpha</Heading>
      <Label id="sec:alpha" />
      {"Alpha body text"}
      <Note>{"An aside."}</Note>
      {"."}
      <Heading rank={1}>Beta</Heading>
      <Def id="nota" Label={() => "Nota"} tooltip="A document language.">
        {"Nota"}
      </Def>
      {" is one such language."}
    </NotaDoc>
  );
}
