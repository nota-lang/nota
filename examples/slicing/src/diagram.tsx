import React, {useRef, useState, useCallback} from 'react';
import {$, $$} from 'nota';
import {zipExn, useSynchronizer} from 'nota/dist/utils';
import {Togglebox, ToggleButton} from "nota/dist/togglebox";
import {IRToggle, Premise, PremiseRow} from "nota/dist/math";
import _, { countBy } from 'lodash';
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
  let add_sync_point = useSynchronizer(useCallback(() => on_all_load(), []));

  let label_texts = [
    r`Variable $\vr$`, r`Sized Type $\tys$`, r`Expression $\expr$`, r`Place $\plc$`, 
    r`Place Expr $\pexp$`, r`Ownership Qual. $\ownq$`, r`Provenance $\prov$`
  ];

  let labels = label_texts.map((text, i) => {
    let ref = useRef(null);
    let pos = i < 4 ? "top" : "bottom"; 
    let label = <span ref={ref} key={i} className="diagram-label">
      <$ onLoad={add_sync_point()}>{r`\text{${text}}`}</$>
    </span>;
    return {label, ref, pos};
  });

  let on_all_load = () => {
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

    <$$ onLoad={add_sync_point()} style={{height: '7rem', marginTop: '3rem'}}>{r`
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

let $T = tex => props => <$ {...props}>{r`\text{${tex}}`}</$>;


export let AssignStaticRule = () => 
  <IRToggle
    Top={({reg}) => <>
      <PremiseRow>
        <Premise>
          <Togglebox
            registerToggle={reg}
            Outside={$T(r`$\expr$ has sized type $\tys$, making $\stackenv_1$`)}
            Inside={$T(r`$\tc{\fenv}{\tyenv}{\stackenv}{\expr}{\tys}{\stackenv'}$`)} />
        </Premise>
        <Premise>
          <Togglebox
            registerToggle={reg}
            Outside={$T(r`$\plc$ has maybe-dead type $\tysx$ in $\stackenv_1$`)}
            Inside={$T(r`$\stackenv_1(\plc) = \tysx$`)} />
        </Premise>
      </PremiseRow>
      <PremiseRow>
        <Premise>
          (
            <Togglebox
              registerToggle={reg}
              Outside={$T(r`$\plc$ is dead`)}
              Inside={$T(r`$\tysx = \tyd$`)} />
          <$ style={{margin: '0 0.5rem'}}>{r`\vee`}</$>
          <Togglebox
            // resize
            registerToggle={reg}
            Outside={$T(r`$\plc$ is $\uniq$-safe`)}
            Inside={$T(r`$\ownsafe{\tyenv}{\stackenv_1}{\uniq}{\plc}{\{\loanform{\uniq}{\plc}\}}$`)} />
          )
        </Premise>
        <Premise>
          <Togglebox 
            registerToggle={reg}
            Outside={$T(r`$\tys$ is a subtype of $\tysx$, making $\stackenv'$`)}
            Inside={$T(r`$\subtype{\tyenv}{\stackenv_1}{\tys}{\tysx}{\stackenv'}$`)} />
        </Premise>
      </PremiseRow>
      </>
    }
    Bot={({reg}) =>            
      <Togglebox
        registerToggle={reg}
        Outside={$T(r`$\exprplcasgn{\plc}{\expr}$ has type $\tysbase{\tybunit}$ and adds $\plc : \tys$ to $\stackenv'$`)}
        Inside={$T(r`
        $\tc{\fenv}{\tyenv}{\stackenv}
          {\exprplcasgn{\plc}{\expr}}
          {\tysbase{\tybunit}}
          {\stackenv'[\plc \mapsto \tys] \triangleright \plc}$
        `)} />
    } />;

export let AssignDynamicRule = () =>
  <IRToggle
    Top={({reg}) =>   
      <Togglebox 
        registerToggle={reg}
        Outside={$T(r`$\pexp$ points to $\plc$ in $\stack$ with root $\vr$ and context $\valuectx$`)}
        Inside={$T(r`$\pointsto{\stack}{\pexp}{\pctx{\plc}{\vr}}{\valuectx}$`)} />
    }
    Bot={({reg}) => 
      <Togglebox
        registerToggle={reg}
        Outside={$T(r`$\exprpexpasgn{\pexp}{v}$ sets $\plc$ to $v$ in $\stack$ by setting $x$ to $\valueplug{\valuectx}{v}$`)}
        Inside={$T(r`$\stepsto{\fenv}{\stack}{\exprpexpasgn{\pexp}{v}}{\stack[\vr \mapsto \valueplug{\valuectx}{v}]}{\exprconst{\constunit}}$`)} />
    } />
