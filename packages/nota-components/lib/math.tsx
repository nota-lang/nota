import React, { useContext, useState, useRef, useEffect } from "react";
import { DocumentContext, Smallcaps } from "./document";
import { Definition } from "./definitions";
import { ToggleGroupButton, ToggleGroup } from "./togglebox";
import { HTMLAttributes } from "./utils";

export let Premise: React.FC = ({ children }) => <div className="premise">{children}</div>;
export let PremiseRow: React.FC = ({ children }) => <div className="premise-row">{children}</div>;

export interface IRProps {
  Top: React.FC;
  Bot: React.FC;
  Right?: React.FC;
  toggle?: boolean;
}

export let IR: React.FC<IRProps & HTMLAttributes> = ({ Top, Bot, Right, toggle, ...props }) => {
  let [right_height, set_right_height] = useState(0);
  let right_ref = useRef<HTMLDivElement>(null);

  if (toggle) {
    let RuleToggle = () => <ToggleGroupButton big />;
    Right = RuleToggle;
  }

  if (Right) {
    useEffect(() => {
      let right_el = right_ref.current!;
      set_right_height(right_el.getBoundingClientRect().height);
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
                <div style={{ bottom: right_height / 2 }} ref={right_ref}>
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
  let thm_num = ctx.theorems.push().join(".");
  let label = `Theorem ${thm_num}`;
  let suffix = title ? `: ${title}` : "";

  return (
    <Definition
      name={name}
      Label={() => (
        <>
          {label}
          {suffix}
        </>
      )}
    >
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
