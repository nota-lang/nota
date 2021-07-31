import React, {useContext} from 'react';
import {DocumentContext, Smallcaps} from './document';
import {Definition} from './definitions';

export let Theorem: React.FC<{name?: string}> = ({name, children}) => {
  let ctx = useContext(DocumentContext);
  let thm_num = ctx.theorems.push().join('.');
  let label = `Theorem ${thm_num}`;
  
  return <Definition name={name} Label={() => <>{label}</>}>
    <div className="theorem">
      <Smallcaps>{label}.</Smallcaps>
      <div className="theorem-body">{children}</div>
    </div>
  </Definition>;
}