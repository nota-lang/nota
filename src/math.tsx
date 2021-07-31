import React, {useContext} from 'react';
import {DocumentContext, Smallcaps} from './document';
import {Definition} from './definitions';

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