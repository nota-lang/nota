import React, { useContext } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
// import notation from './notation.js';
// import nearley from 'nearley';

export class TexContext {
  macros: any

  constructor() {
    this.macros = {};
  }

  render(contents: string) {
    let html = katex.renderToString(contents, {macros: this.macros});
    return <span dangerouslySetInnerHTML={{__html: html}} />;
  }
}

export let ReactTexContext = React.createContext<TexContext | null>(null);

export let Tex: React.FC = ({children}) => {
  let ctx = useContext(ReactTexContext)!;
  return ctx.render(children as string);
};

export let $ = Tex;

// const parser = new nearley.Parser(nearley.Grammar.fromCompiled(notation));
// console.log(notation);

// export let P: React.FC = ({children}) => {
//   console.log(notation.parse(children));
//   // parser.feed(children);
//   // console.log(parser.results);
//   return <>hi</>;
// }