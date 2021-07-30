import React, {useRef, useState, useCallback} from 'react';
import {$, $$} from 'reactex';
import {zipExn} from 'reactex/dist/utils';
import _ from 'lodash';
import { useEffect } from 'react';

const r = String.raw;

let get_relative_midpoint = (container: HTMLElement, el: HTMLElement, top: boolean): {x: number, y: number} => {  
  let cr = container.getBoundingClientRect();
  let er = el.getBoundingClientRect();

  let x = er.x - cr.x;
  let y = er.y - cr.y;

  let mx = x + er.width / 2;
  let my = top ? y : y + er.height;
  return {x: mx, y: my};
};

export let SyntaxDiagram = () => {
  let container_ref = useRef<HTMLDivElement>(null);
  let [overlay, set_overlay] = useState<JSX.Element | null>(null);

  let label_texts = [
    r`Variable $\vr$`, r`Sized Type $\tys$`, r`Expression $\expr$`, r`Place $\plc$`, 
    r`Place Expr $\pexp$`, r`Ownership Qual. $\ownq$`, r`Provenance $\prov$`
  ];

  let promises = [];
  let add_promise = () => {
    let resolve;
    let promise = new Promise((r, _) => { resolve = r; });
    promises.push(promise);
    return resolve;
  };

  let labels = label_texts.map((text, i) => {
    let ref = useRef(null);
    let pos = i < 4 ? "top" : "bottom"; 
    let label = <span ref={ref} key={i} className="diagram-label">
      <$ onLoad={add_promise()}>{r`\text{${text}}`}</$>
    </span>;
    return {label, ref, pos};
  });

  let on_all_load = () => {
    console.log('ok');

    let container = container_ref.current!;
    let elems = container.querySelectorAll<HTMLSpanElement>('[data-index]');
    let elems_arr = _.sortBy(Array.from(elems), elem => {
      let index = parseInt(elem.dataset.index!);
      return index;
    });

    let arrows = zipExn(elems_arr, labels).map(([dst, label], i) => {
      let src = label.ref.current!;
      let spt = get_relative_midpoint(container, src, label.pos == "bottom");
      let dpt = get_relative_midpoint(container, dst, label.pos == "top");
      let path = `M${spt.x},${spt.y} L${dpt.x},${dpt.y}`;
      return <path key={i} d={path} style={{stroke: '#ccc', strokeWidth: '1.25px', /*markerEnd: 'url(#arrow)'*/}} />
    });

    set_overlay(<svg width="700" height="300" style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <marker id="arrow" markerWidth="13" markerHeight="13" orient="auto" refX="2" refY="6">
          <path d="M2,2 L2,11 L10,6 L2,2" style={{fill: "#ccc"}} />
        </marker>
      </defs>
      {arrows}
    </svg>);
  };

  useEffect(() => {
    // TODO: setTimeout is a hack b/c something isn't rendering in time
    Promise.all(promises).then(() => setTimeout(on_all_load, 100));
  }, []);

  return <div id="syntax-diagram" ref={container_ref} style={{textAlign: 'center', position: 'relative'}}>
    <style>{`
    .diagram-label { padding: 2px 4px; margin: 5px 10px; }
    .diagram-hl {
      border: 1px solid #ccc;
      border-radius: 2px;
    }
    .gutter.top {
      margin-bottom: 80px;
    }
    .gutter.bottom {
      margin-top: 30px;
    }
    
    `}</style>

    {overlay}

    <div className="gutter top">
      {labels.filter(({pos}) => pos == "top").map(({label}) => label)}
    </div>

    <$$ onLoad={add_promise()} style={{height: '7rem', marginTop: '3rem'}}>{r`
    \newcommand{\lbl}[2]{\htmlClass{diagram-hl}{\htmlData{index=#1}{#2}}}
    \begin{aligned}
    &\exprlet
      {\lbl{0}{a}}{\lbl{1}{\tystup{\uty, \uty}}}
      {\lbl{2}{\exprtup{\exprconst{\constnum{0}}, \exprconst{\constnum{1}}}}}{
    \\ \exprprov{\r_1, \r_2}{
      \\ ~~ \exprlet
        {b}{\tysref{\r_2}{\lbl{5}{\uniq}}{\uty}}
        {\exprref{\lbl{6}{\r_1}}{\uniq}{\lbl{3}{a.0}}}{
      \\ ~~ \exprpexpasgn{\lbl{4}{\pexpderef{b}}}{a.1} \\
      }}
    }
    \end{aligned}`}</$$>

    <div className="gutter bottom">
      {labels.filter(({pos}) => pos == "bottom").map(({label}) => label)}
    </div>
  </div>;
}
