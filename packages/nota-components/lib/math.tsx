import React, { useContext, useEffect, useRef, useState } from "react";

import { Definition } from "./definitions.js";
import { DocumentContext, Smallcaps } from "./document.js";
import { ToggleGroup, ToggleGroupButton } from "./togglebox.js";
import { HTMLAttributes } from "./utils.js";

export let Premise: React.FC = ({ children }) => <div className="premise">{children}</div>;
export let PremiseRow: React.FC = ({ children }) => <div className="premise-row">{children}</div>;

export interface IRProps {
  Top: React.FC;
  Bot: React.FC;
  Right?: React.FC;
  toggle?: boolean;
}

export let IR: React.FC<IRProps & HTMLAttributes> = ({ Top, Bot, Right, toggle, ...props }) => {
  let [rightHeight, setRightHeight] = useState(0);
  let rightRef = useRef<HTMLDivElement>(null);

  if (toggle) {
    let RuleToggle = () => <ToggleGroupButton big />;
    Right = RuleToggle;
  }

  if (Right) {
    useEffect(() => {
      let rightEl = rightRef.current!;
      setRightHeight(rightEl.getBoundingClientRect().height);
    }, []);
  }

  return (
    <ToggleGroup>
      <table className="inferrule" {...props}>
        <tbody>
          <tr>
            <td>
              <Top />
            </td>
          </tr>
          <tr>
            <td>
              <div className="divider" />
            </td>
            <td>
              <div className="right">
                <div style={{ bottom: rightHeight / 2 }} ref={rightRef}>
                  {Right ? <Right /> : null}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <Bot />
            </td>
          </tr>
        </tbody>
      </table>
    </ToggleGroup>
  );
};

export let Theorem: React.FC<{ name?: string; title?: string }> = ({ name, title, children }) => {
  let ctx = useContext(DocumentContext);
  let thmNum = ctx.theorems.push().toString();
  let label = `Theorem ${thmNum}`;
  let suffix = title ? `: ${title}` : "";

  return (
    <Definition name={name} label={`${label} ${suffix}`}>
      <div className="theorem">
        <Smallcaps>
          {label}
          {suffix}
        </Smallcaps>
        <div className="theorem-body">{children}</div>
      </div>
      <ctx.theorems.Pop />
    </Definition>
  );
};
