import React, { useContext, useEffect, useRef, useState } from "react";

import { Definition } from "./definitions.js";
import { DocumentPlugin, Smallcaps } from "./document.js";
import { usePlugin } from "./plugin.js";
import { ToggleGroup, ToggleGroupButton } from "./togglebox.js";
import { FCC, HTMLAttributes, ReactConstructor, ReactNode, getOrRender } from "./utils.js";

export let Premise: FCC = ({ children }) => <div className="premise">{children}</div>;

export interface IRProps {
  Top?: ReactNode | ReactConstructor;
  Bot: ReactNode | ReactConstructor;
  Right?: ReactNode | ReactConstructor;
  block?: boolean;
  toggle?: boolean;
}

export let IR: FCC<IRProps & HTMLAttributes> = ({
  Top,
  Bot,
  Right,
  toggle,
  block: _block,
  ...props
}) => {
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
            <td className="rules">{Top ? getOrRender(Top, {}) : null}</td>
          </tr>
          <tr>
            <td>
              <div className="divider" />
            </td>
            <td>
              <div className="right">
                <div style={{ bottom: rightHeight / 2 }} ref={rightRef}>
                  {Right ? getOrRender(Right, {}) : null}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td className="rules">{getOrRender(Bot, {})}</td>
          </tr>
        </tbody>
      </table>
    </ToggleGroup>
  );
};

export let Theorem: FCC<{ name?: string; title?: string }> = ({ name, title, children }) => {
  let ctx = usePlugin(DocumentPlugin);
  let thmNum = ctx.theorems.push().toString();
  let label = `Theorem ${thmNum}`;
  let suffix = title ? `: ${title}` : "";

  return (
    <Definition name={name} label={label} block={true}>
      <div className="theorem block">
        <Smallcaps>{label + suffix}</Smallcaps>
        <div className="theorem-body">{children}</div>
      </div>
      <ctx.theorems.Pop />
    </Definition>
  );
};
