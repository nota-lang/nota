import { VFile } from "vfile";
import {createProcessor} from "@mdx-js/mdx/lib/core";

let processor = createProcessor();

export const process_nota_markdown = async (input: VFile): Promise<VFile> => {
  return processor.process(input);
};
