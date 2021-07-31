import React, { useEffect, useState, useRef } from 'react';
import classNames from "classnames";
import _ from 'lodash';

import {Container} from "./utils";

export let Correspondence: React.FC = ({children}) => {
  let ref = useRef<HTMLDivElement>(null);
  let [hover, set_hover] = useState<string | null>(null);

  useEffect(() => {
    let links = ref.current!.querySelectorAll('.link');
    let cbs =  Array.from(links).map(el => {
      let cls = _.find(el.className.split(' '), s => s.startsWith('type'))!;
      let on_enter = () => { set_hover(`hover-${cls}`); }
      let on_leave = () => { set_hover(null); }        
      el.addEventListener('mouseenter', on_enter);
      el.addEventListener('mouseleave', on_leave);
      return () => {
        el.removeEventListener('mouseenter', on_enter);
        el.removeEventListener("mouseleave", on_leave);
      };
    });
    return () => cbs.forEach(cb => cb());
  }, []);

  return <div ref={ref} className={classNames("correspondence", hover)}>{children}</div>;
};

export let Link: React.FC<{name: string, block?: boolean}> = ({name, block, children}) => {
  return <Container className={classNames("link", `type-${name}`)} block={block}>{children}</Container>
};