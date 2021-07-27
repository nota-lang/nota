import React, { forwardRef } from "react";
import _ from "lodash";
import { Section } from "./document";

export let zipExn = <S, T>(l1: S[], l2: T[]): [S, T][] => {
  if (l1.length != l2.length) {
    throw `Cannot zip lists of length ${l1.length} and ${l2.length}`;
  }

  return _.zip(l1, l2) as any;
};

export type HTMLAttributes = React.HTMLAttributes<HTMLElement>;

export let AdaptiveDisplay = forwardRef<
  HTMLDivElement,
  { block?: boolean } & HTMLAttributes
>(({ block, ...props }, ref) => {
  if (block) {
    return <div ref={ref} {...props} />;
  } else {
    return <span ref={ref} {...props} />;
  }
});
