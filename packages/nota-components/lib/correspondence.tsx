import { default as classNames } from "classnames";
import _ from "lodash";
import React, { useEffect, useRef, useState } from "react";

import { Container, HTMLAttributes } from "./utils.js";

export let Correspondence: React.FC<HTMLAttributes> = ({ children, ...props }) => {
  let ref = useRef<HTMLDivElement>(null);
  let [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let links = ref.current!.querySelectorAll(".link");
    let cbs = Array.from(links).map(el => {
      let cls = _.find(el.className.split(" "), s => s.startsWith("type"))!;
      let onEnter = () => {
        setHover(`hover-${cls}`);
      };
      let onLeave = () => {
        setHover(null);
      };
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      };
    });
    return () => cbs.forEach(cb => cb());
  }, []);

  return (
    <div ref={ref} className={classNames("correspondence", hover)} {...props}>
      {children}
    </div>
  );
};

export let Link: React.FC<{ name: string; block?: boolean }> = ({ name, block, children }) => {
  return (
    <Container className={classNames("link", `type-${name}`)} block={block}>
      {children}
    </Container>
  );
};
