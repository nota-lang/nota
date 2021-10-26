import mdx from "@mdx-js/esbuild";
import type esbuild from "esbuild";
import type estree from "estree";
// import { generate } from "astring";

import footnotes_plugin from "./footnotes";
import math_plugin from "./math";
import ref_plugin from "./ref";
import labeled_headers_plugin from "./labeled-headers";
import heading_to_section_plugin from "./heading-to-section";

function print_program() {
  return (program: estree.Program, _) => {
    // console.log(program);
    // console.log(generate(program));
  };
}

export let notaMarkdown = (): esbuild.Plugin => {
  let mdx_plugin = mdx({
    remarkPlugins: [
      math_plugin,
      ref_plugin,
      footnotes_plugin,
      labeled_headers_plugin,
      heading_to_section_plugin,
    ],
    recmaPlugins: [print_program],
  });

  return mdx_plugin;
};
