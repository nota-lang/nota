import React from 'react';

import {Container} from "./utils";

export let Correspondence: React.FC = ({children}) => {
  return <div className="correspondence">{children}</div>;
};

export let Link: React.FC<{name: string, block?: boolean}> = ({name, block, children}) => {
  return <Container className={`link type-${name}`} block={block}>{children}</Container>
};