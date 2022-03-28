declare module "html-to-react" {
  export class ProcessNodeDefinitions {
    constructor(mod: any);
    processDefaultNode(node: any, children: any, index: any): JSX.Element;
  }
  export type Instructions = {
    replaceChildren?: boolean;
    shouldProcessNode: (node: any) => boolean;
    processNode: (node: any, children: any, index: any) => JSX.Element;
  }[];
  export class Parser {
    parseWithInstructions(html: any, isValid: any, instrs: Instructions): JSX.Element;
  }
}
