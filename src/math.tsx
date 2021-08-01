import React, {useContext, useState, useRef, useEffect} from 'react';
import {DocumentContext, Smallcaps} from './document';
import {Definition} from './definitions';
import {ToggleButton} from "./togglebox";

export let Premise = ({children}) => <div className="premise">{children}</div>;
export let PremiseRow = ({children}) => <div className="premise-row">{children}</div>;

export let IR = ({Top, Bot, Right}) => {
  let [right_height, set_right_height] = useState(0);
  let right_ref = useRef(null);
  if (Right) {
    useEffect(() => {
      let right_el = right_ref.current!;
      set_right_height(right_el.getBoundingClientRect().height);
    }, []);
  }
 
  return <table className="inferrule"><tbody>  
    <tr><td>{Top}</td></tr>
    <tr>
      <td><div className="divider" /></td>
      <td><div className="right"><div style={{bottom: right_height/2}} ref={right_ref}>{Right || null}</div></div></td>
    </tr>
    <tr><td>{Bot}</td></tr>
  </tbody></table>;
};

export let IRToggle = ({Top, Bot}) => {
  let [toggles] = useState([]);
  let reg = (cb) => { toggles.push(cb); };
  let [show_all, set_show_all] = useState(false);

  let on_click = () => {
    toggles.forEach(cb => cb(!show_all));
    set_show_all(!show_all);
  };

  return <IR 
    Right={<ToggleButton big on={show_all} onClick={on_click} />}
    Top={<Top reg={reg} />} 
    Bot={<Bot reg={reg} />} />;
};

export let Theorem: React.FC<{name?: string, title?: string}> = ({name, title,children}) => {
  let ctx = useContext(DocumentContext);
  let thm_num = ctx.theorems.push().join('.');
  let label = `Theorem ${thm_num}`;
  let suffix = title ? `: ${title}` : '';
  
  return <Definition name={name} Label={() => <>{label}{suffix}</>}>
    <div className="theorem">
      <Smallcaps>{label}{suffix}</Smallcaps>
      <div className="theorem-body">{children}</div>
    </div>
    <ctx.theorems.Pop />
  </Definition>;
}