export { tryParse } from "./parse";
export { translate, translateAst, Translator, optimizePlugin } from "./translate";
export { nota, CodeTag } from "./language";
export * as babelPolyfill from "./babel-polyfill";

//@ts-ignore
export { parser } from "./nota.grammar";
//@ts-ignore
export * as terms from "./nota.grammar";
