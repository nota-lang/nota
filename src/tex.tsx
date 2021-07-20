import React, { useContext } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

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